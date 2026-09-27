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
            return await OnDeviceCategorizer.run(context: context, limit: limit)
        }
        #endif
        return 0
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@MainActor
private enum OnDeviceCategorizer {
    static func run(context: ModelContext, limit: Int) async -> Int {
        let windowStart = ReviewWindow.start
        let pendingFetch = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.needsReview && !$0.aiAttempted && !$0.isHidden
                && ($0.categoryId == nil || $0.aiSuggested) && $0.transactedAt >= windowStart },
            sortBy: [SortDescriptor(\.transactedAt, order: .reverse)])
        guard let pending = try? context.fetch(pendingFetch), !pending.isEmpty else { return 0 }

        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let groups = Dictionary(categories.filter { $0.parentId == nil }.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        // Leaf categories (or groups with no children), unique by name.
        let parentIds = Set(categories.compactMap(\.parentId))
        var byName = [String: BudgetCategory]()
        for c in categories.sorted(by: { $0.sortOrder < $1.sortOrder }) where !parentIds.contains(c.id) {
            if byName[c.name] == nil { byName[c.name] = c }
        }
        guard !byName.isEmpty else { return 0 }
        let names = byName.keys.sorted()

        let schema: GenerationSchema
        do {
            let choice = DynamicGenerationSchema(name: "Category", description: "One category from the list, or None",
                                                 anyOf: names + ["None"])
            let root = DynamicGenerationSchema(name: "Categorization", properties: [
                .init(name: "category", description: "The best matching category, or None if nothing fits", schema: choice),
            ])
            schema = try GenerationSchema(root: root, dependencies: [])
        } catch {
            return 0
        }

        let userRules = ((try? context.fetch(FetchDescriptor<CategoryRule>(sortBy: [SortDescriptor(\.createdAt)]))) ?? [])
            .filter(\.isEnabled).map(\.text)
        let instructions = buildInstructions(byName: byName, groups: groups, rules: userRules,
                                             examples: examples(context: context, categories: categories))
        let accounts = (try? context.fetch(FetchDescriptor<LocalAccount>())) ?? []
        let accountKinds = Dictionary(accounts.map { ($0.providerAccountId, "\($0.displayName) (\($0.kind.singularLabel))") },
                                      uniquingKeysWith: { a, _ in a })
        // Transactions the user has already confirmed, for "similar merchant" clues.
        let confirmed = ((try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { !$0.needsReview && $0.categoryId != nil }))) ?? [])
        let namesById = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
        let options = GenerationOptions(samplingMode: .greedy)
        var suggested = 0

        for tx in pending.prefix(limit) {
            // A fresh session per transaction keeps the context window small.
            let session = LanguageModelSession(instructions: instructions)
            let direction = tx.amount >= 0 ? "money in" : "money out"
            var prompt = """
            Bank description: \(tx.transactionDescription)
            Merchant: \(tx.title)
            Amount: \(abs(tx.amount).formatted(.currency(code: "USD"))) (\(direction))
            Account: \(accountKinds[tx.accountId] ?? "Unknown")
            """
            let similar = similarConfirmed(to: tx, in: confirmed, names: namesById)
            if !similar.isEmpty {
                prompt += "\nSimilar transactions this person already categorized:\n" + similar.joined(separator: "\n")
            }
            do {
                let response = try await session.respond(to: prompt, schema: schema, includeSchemaInPrompt: true, options: options)
                let answer = try response.content.value(String.self, forProperty: "category")
                log.debug("\(tx.title, privacy: .private) -> \(answer, privacy: .public)")
                // The model may have been slow; skip if the user got there first.
                if tx.needsReview, tx.categoryId == nil || tx.aiSuggested, let category = byName[answer] {
                    Categorizer.assign(category, to: tx, byAI: true)
                    suggested += 1
                }
                tx.aiAttempted = true
                // Save as we go so suggestions show up one by one.
                try? context.save()
            } catch {
                if isContentRefusal(error) {
                    // The model won't handle this one; don't ask again.
                    tx.aiAttempted = true
                    continue
                }
                // Model unavailable, still downloading, rate limited, etc. Stop
                // and leave the rest untouched so the next run retries them.
                log.error("categorize failed: \(String(describing: error), privacy: .public)")
                break
            }
        }
        try? context.save()
        return suggested
    }

    private static func isContentRefusal(_ error: Error) -> Bool {
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
    private static func similarConfirmed(to tx: LocalTransaction, in confirmed: [LocalTransaction],
                                         names: [String: String]) -> [String] {
        let firstWord = tx.normalizedMerchant.split(separator: " ").first.map(String.init) ?? ""
        let matches = confirmed.filter { other in
            (firstWord.count > 2 && other.normalizedMerchant.hasPrefix(firstWord))
                || (other.accountId == tx.accountId && abs(other.amount - tx.amount) < 0.01 && abs(tx.amount) >= 5)
        }
        var seen = Set<String>()
        return matches.compactMap { other -> String? in
            guard let name = other.categoryId.flatMap({ names[$0] }), seen.insert(other.title + name).inserted else { return nil }
            return "- \"\(other.title)\" \(abs(other.amount).formatted(.currency(code: "USD"))) → \(name)"
        }
        .prefix(3).map { $0 }
    }

    private static func buildInstructions(byName: [String: BudgetCategory], groups: [String: BudgetCategory],
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

    /// Up to 20 recent confirmed merchant → category pairs, like the web app's few-shot examples.
    private static func examples(context: ModelContext, categories: [BudgetCategory]) -> [String] {
        let names = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { a, _ in a })
        var fetch = FetchDescriptor<MerchantRule>(sortBy: [SortDescriptor(\.updatedAt, order: .reverse)])
        fetch.fetchLimit = 20
        let rules = (try? context.fetch(fetch)) ?? []
        return rules.compactMap { rule in names[rule.categoryId].map { "\"\(rule.merchant)\" → \($0)" } }
    }
}
#endif
