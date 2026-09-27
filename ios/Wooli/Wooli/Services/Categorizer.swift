import Foundation
import SwiftData

/// Suggests categories without AI: the user's confirmed merchants first, then
/// the built-in merchant directory. Either way the transaction stays in the
/// review queue until the user confirms it. (User rules run before this, and
/// the on-device AI handles whatever is left.)
enum Categorizer {
    /// Suggest a category id for a transaction, or nil.
    static func suggest(merchant: String, description: String, amount: Double = 0,
                        rules: [String: MerchantRule], categoriesByName: [String: BudgetCategory]) -> String? {
        if !merchant.isEmpty, let rule = rules[merchant] { return rule.categoryId }
        guard let kind = MerchantDirectory.kind(for: merchant + " " + description, amount: amount) else { return nil }
        return MerchantDirectory.category(forKind: kind, in: categoriesByName)?.id
    }

    /// Leaf categories keyed by lowercased name, for `suggest`.
    static func leavesByName(_ categories: [BudgetCategory]) -> [String: BudgetCategory] {
        let parents = Set(categories.compactMap(\.parentId))
        return Dictionary(categories.filter { $0.parentId != nil || !parents.contains($0.id) }
            .map { ($0.name.lowercased(), $0) }, uniquingKeysWith: { a, _ in a })
    }

    /// Re-run the merchant directory over unreviewed transactions that have no
    /// category or only an AI guess. Directory entries are specific merchants,
    /// so they're trusted over the AI. Runs on launch so directory
    /// improvements reach existing transactions.
    static func refreshKeywordHints(context: ModelContext) {
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let byName = leavesByName(categories)
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let fetch = FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.needsReview && ($0.categoryId == nil || $0.aiSuggested) })
        for tx in (try? context.fetch(fetch)) ?? [] {
            if let id = suggest(merchant: tx.normalizedMerchant, description: tx.transactionDescription + " " + tx.title,
                                amount: tx.amount, rules: [:], categoriesByName: byName), id != tx.categoryId {
                assign(byId[id], to: tx)
            }
        }
        try? context.save()
    }

    /// Apply a category to a transaction. The transfer flag always follows the
    /// category, as it does on the web.
    static func assign(_ category: BudgetCategory?, to transaction: LocalTransaction, byAI: Bool = false) {
        transaction.categoryId = category?.id
        transaction.isTransfer = category?.isTransfer ?? false
        transaction.aiSuggested = byAI && category != nil
    }

    /// The user confirmed this transaction. Requires a category (same rule as
    /// the web review queue). Remembers the merchant, and pre-fills other
    /// unreviewed, uncategorized transactions from the same merchant, which
    /// still need their own confirmation.
    @discardableResult
    static func confirm(_ transaction: LocalTransaction, categories: [BudgetCategory], context: ModelContext) -> Bool {
        guard let categoryId = transaction.categoryId else { return false }
        transaction.needsReview = false

        let merchant = transaction.normalizedMerchant
        guard !merchant.isEmpty else { return true }

        let ruleFetch = FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.merchant == merchant })
        if let rule = try? context.fetch(ruleFetch).first {
            if rule.categoryId == categoryId { rule.timesConfirmed += 1 } else { rule.categoryId = categoryId; rule.timesConfirmed = 1 }
            rule.updatedAt = .now
        } else {
            context.insert(MerchantRule(merchant: merchant, categoryId: categoryId))
        }

        let category = categories.first { $0.id == categoryId }
        let siblings = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.normalizedMerchant == merchant && $0.needsReview && $0.categoryId == nil })
        for other in (try? context.fetch(siblings)) ?? [] {
            assign(category, to: other)
        }
        return true
    }
}
