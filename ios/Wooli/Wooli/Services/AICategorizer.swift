import Foundation
import SwiftData
import os
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Pre-fills categories with Apple's on-device language model (Apple
/// Intelligence). Runs entirely on the iPhone: nothing is sent anywhere.
///
/// It only looks at transactions still uncategorized after the user's own
/// merchant rules and the keyword hints, picks from the user's categories
/// (or "None"), and learns from merchants the user already confirmed. Like
/// every suggestion, the result stays in the review queue until confirmed.
private let log = Logger(subsystem: "com.wooli", category: "ai-categorize")

@MainActor
enum AICategorizer {
    static let enabledKey = "aiCategorizeEnabled"

    static var isEnabled: Bool {
        UserDefaults.standard.object(forKey: enabledKey) as? Bool ?? true
    }

    enum Status: Equatable {
        case available
        case unsupportedOS
        case deviceNotEligible
        case notEnabled
        case notReady
    }

    static var status: Status {
        #if canImport(FoundationModels)
        guard #available(iOS 26.0, *) else { return .unsupportedOS }
        switch SystemLanguageModel.default.availability {
        case .available: return .available
        case .unavailable(.deviceNotEligible): return .deviceNotEligible
        case .unavailable(.appleIntelligenceNotEnabled): return .notEnabled
        case .unavailable(.modelNotReady): return .notReady
        case .unavailable: return .notReady
        }
        #else
        return .unsupportedOS
        #endif
    }

    static var statusDescription: String {
        switch status {
        case .available: "Runs on this iPhone. Nothing is sent anywhere."
        case .unsupportedOS: "Needs iOS 26 or later."
        case .deviceNotEligible: "This iPhone doesn't support Apple Intelligence. Wooli will keep using your merchant rules."
        case .notEnabled: "Turn on Apple Intelligence in Settings to use this."
        case .notReady: "Apple Intelligence is still downloading. Wooli will try again later."
        }
    }

    /// After the user adds or changes a rule, let the model look again at
    /// everything still unreviewed that it (or nobody) has categorized.
    static func reconsiderUnreviewed(context: ModelContext) {
        let fetch = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.needsReview && $0.aiAttempted && ($0.categoryId == nil || $0.aiSuggested) })
        for tx in (try? context.fetch(fetch)) ?? [] { tx.aiAttempted = false }
        try? context.save()
    }

    /// Categorize up to `limit` transactions. Returns how many got a suggestion.
    @discardableResult
    static func run(context: ModelContext, limit: Int = 500) async -> Int {
        guard isEnabled, status == .available else { return 0 }
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            let store = BackgroundStore(modelContainer: context.container)
            return await store.runOnDeviceCategorizer(limit: limit)
        }
        #endif
        return 0
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
extension AICategorizer {

    nonisolated static func isContentRefusal(_ error: Error) -> Bool {
        if #available(iOS 27.0, *), let error = error as? LanguageModelError {
            switch error {
            case .guardrailViolation, .refusal: return true
            default: return false
            }
        }
        if let error = error as? LanguageModelSession.GenerationError {
            switch error {
            case .guardrailViolation, .refusal: return true
            default: return false
            }
        }
        return false
    }

    /// Up to 3 confirmed transactions that share the merchant's first word, or
    /// the same amount on the same account (recurring bills).
    nonisolated static func similarConfirmed(to tx: LocalTransaction, in confirmed: [LocalTransaction],
                                         names: [String: String]) -> [String] {
        let firstWord = tx.normalizedMerchant.split(separator: " ").first.map(String.init) ?? ""
        let matches = confirmed.filter { other in
            (firstWord.count > 2 && other.normalizedMerchant.hasPrefix(firstWord))
                || (other.accountId == tx.accountId && abs(other.amount - tx.amount) < 0.01 && abs(tx.amount) >= 5)
        }
        var seen = Set<String>()
        return matches.compactMap { other -> String? in
            guard let name = other.categoryId.flatMap({ names[$0] }), seen.insert(other.title + name).inserted else { return nil }
            return "- \"\(other.title)\" \(abs(other.amount).formatted(.currency(code: "USD"))) -> \(name)"
        }
        .prefix(3).map { $0 }
    }

    nonisolated static func buildInstructions(byName: [String: BudgetCategory], groups: [String: BudgetCategory],
                                          rules: [String], examples: [String]) -> String {
        let list = byName.values.sorted { $0.sortOrder < $1.sortOrder }.map { c -> String in
            let group = c.parentId.flatMap { groups[$0] }
            let kind = c.isIncome ? "income" : c.isTransfer ? "transfer between own accounts" : "spending"
            return "- \(c.name)" + (group.map { " (\($0.name), \(kind))" } ?? " (\(kind))")
        }.joined(separator: "\n")
        var text = """
        You sort personal bank transactions into budget categories.
        Pick exactly one category from this list, or None if you are not reasonably sure:
        \(list)

        Guidance:
        - If you don't recognize the merchant and nothing in the description makes the category clear, answer None.
          A blank is much better than a wrong guess — the person will categorize it themselves.
        - Credit card payments and moves between the person's own accounts are transfers.
        - Money going into or out of investment or retirement accounts (401k, IRA, Roth, brokerage, money market,
          Fidelity, Vanguard, Schwab) is savings/investments or a transfer, never salary or spending.
        - Paychecks and deposits from employers are salary. Interest and dividends are not salary.
        - Payments to people through Venmo, Zelle, Cash App or PayPal are unclear: answer None unless the description
          says what it was for.
        - A merchant name with a foreign city or region (for example Hokkaido, Tokyo, Paris) means the person was
          travelling: pick the kind of place (restaurant, shop, hotel, transport), not a transfer or card payment.
        - Only choose a transfer or credit card payment if the description clearly says payment, transfer or autopay.
        """
        if !rules.isEmpty {
            text += "\n\nThis person's own rules. Always follow these, even over the examples below:\n"
                + rules.map { "- \($0)" }.joined(separator: "\n")
        }
        if !examples.isEmpty {
            text += "\n\nThis person has categorized these merchants before:\n" + examples.joined(separator: "\n")
        }
        return text
    }

    /// Up to 20 recent confirmed merchant -> category pairs, like the web app's few-shot examples.
    nonisolated static func examples(context: ModelContext, categories: [BudgetCategory]) -> [String] {
        let names = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
        var fetch = FetchDescriptor<MerchantRule>(sortBy: [SortDescriptor(\.updatedAt, order: .reverse)])
        fetch.fetchLimit = 20
        let rules = (try? context.fetch(fetch)) ?? []
        return rules.compactMap { rule in names[rule.categoryId].map { "\"\(rule.merchant)\" -> \($0)" } }
    }
}
#endif
