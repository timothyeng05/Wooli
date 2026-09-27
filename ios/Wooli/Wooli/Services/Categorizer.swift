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
        guard transaction.categoryId != nil else { return false }
        transaction.needsReview = false
        learn(from: transaction, categories: categories, context: context)
        return true
    }

    /// The user picked a category by hand: remember it for this merchant and
    /// pass it on to other unreviewed transactions from the same merchant
    /// that are uncategorized or only have an AI guess. Those stay in review.
    /// Returns how many other transactions were updated.
    @discardableResult
    static func learn(from transaction: LocalTransaction, categories: [BudgetCategory], context: ModelContext) -> Int {
        guard let categoryId = transaction.categoryId else { return 0 }
        let merchant = transaction.normalizedMerchant
        guard !merchant.isEmpty else { return 0 }

        let ruleFetch = FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.merchant == merchant })
        if let rule = try? context.fetch(ruleFetch).first {
            if rule.categoryId == categoryId { rule.timesConfirmed += 1 } else { rule.categoryId = categoryId; rule.timesConfirmed = 1 }
            rule.updatedAt = .now
        } else {
            context.insert(MerchantRule(merchant: merchant, categoryId: categoryId))
        }

        let category = categories.first { $0.id == categoryId }
        var updated = 0
        for other in siblingsToUpdate(of: transaction, context: context) where other.categoryId != categoryId {
            assign(category, to: other)
            updated += 1
        }
        try? context.save()
        return updated
    }

    /// Other unreviewed transactions from the same merchant that a manual
    /// choice would carry over to (uncategorized or AI-guessed only).
    static func siblingsToUpdate(of transaction: LocalTransaction, context: ModelContext) -> [LocalTransaction] {
        let merchant = transaction.normalizedMerchant
        guard !merchant.isEmpty else { return [] }
        let fetch = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.normalizedMerchant == merchant && $0.needsReview && ($0.categoryId == nil || $0.aiSuggested) })
        let me = transaction.persistentModelID
        return ((try? context.fetch(fetch)) ?? []).filter { $0.persistentModelID != me }
    }
}
