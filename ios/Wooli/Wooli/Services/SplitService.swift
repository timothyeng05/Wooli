import Foundation
import SwiftData

/// Splitting one transaction into parts with their own categories — e.g. a
/// Costco trip across Groceries and Home Supplies.
///
/// The original stays in the store (so syncs keep matching it) but is set
/// aside: marked `isSplit` and hidden, so it's never counted. Each part is a
/// transaction of its own with `splitParentId` pointing back to it.
enum SplitService {
    struct Part: Identifiable {
        let id = UUID()
        var categoryId: String?
        /// Positive size of the part; the sign follows the original.
        var amount: Double
    }

    static func parts(of original: LocalTransaction, context: ModelContext) -> [LocalTransaction] {
        let parentId = original.providerTransactionId
        let fetch = FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.splitParentId == parentId },
                                                      sortBy: [SortDescriptor(\.providerTransactionId)])
        return (try? context.fetch(fetch)) ?? []
    }

    static func original(of part: LocalTransaction, context: ModelContext) -> LocalTransaction? {
        let parentId = part.splitParentId
        guard !parentId.isEmpty else { return nil }
        return try? context.fetch(FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.providerTransactionId == parentId })).first
    }

    /// Replace any existing split of `original` with `parts`.
    static func split(_ original: LocalTransaction, into parts: [Part], categories: [BudgetCategory], context: ModelContext) {
        for old in self.parts(of: original, context: context) { context.delete(old) }
        let sign: Double = original.amount < 0 ? -1 : 1
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for (i, part) in parts.enumerated() {
            let tx = LocalTransaction(providerTransactionId: "\(original.providerTransactionId)#split-\(i + 1)",
                                      accountId: original.accountId, amount: sign * abs(part.amount),
                                      transactionDescription: original.transactionDescription, payee: original.payee,
                                      transactedAt: original.transactedAt, isPending: false)
            tx.splitParentId = original.providerTransactionId
            tx.customTitle = original.customTitle
            tx.note = original.note
            Categorizer.assign(part.categoryId.flatMap { byId[$0] }, to: tx)
            // The user chose each part's category, so the parts are reviewed.
            tx.needsReview = part.categoryId == nil
            tx.aiAttempted = true
            context.insert(tx)
        }
        original.isSplit = true
        original.isHidden = true
        original.needsReview = false
        try? context.save()
    }

    /// Undo a split: remove the parts and bring the original back.
    static func unsplit(_ original: LocalTransaction, context: ModelContext) {
        for part in parts(of: original, context: context) { context.delete(part) }
        original.isSplit = false
        original.isHidden = false
        try? context.save()
    }
}
