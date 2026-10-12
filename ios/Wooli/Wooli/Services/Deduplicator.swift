import Foundation
import SwiftData

/// CloudKit-backed stores can't enforce unique ids, so the same bank record can
/// exist twice, e.g. a new iPhone syncs from SimpleFIN before its iCloud copy
/// has finished downloading. Merge those back to one, keeping the copy the
/// user has worked on.
enum Deduplicator {
    static func run(context: ModelContext) {
        dedupeTransactions(context)
        dedupeCategories(context)
        dedupe(FetchDescriptor<LocalAccount>(), key: \.providerAccountId, context: context) { a, b in
            a.nickname.count + (a.isHidden ? 1 : 0) >= b.nickname.count + (b.isHidden ? 1 : 0)
        }
        dedupe(FetchDescriptor<BalanceSnapshot>(), key: { "\($0.accountId)|\($0.day.timeIntervalSince1970)" },
               context: context) { _, _ in true }
        dedupe(FetchDescriptor<MerchantRule>(), key: { "\($0.merchant)|\($0.statement)" }, context: context) { a, b in a.updatedAt >= b.updatedAt }
        dedupe(FetchDescriptor<TransactionRule>(), key: { "\($0.statementMatch)|\($0.statementText)|\($0.statementTexts.joined(separator: ","))" },
               context: context) { a, b in a.timesApplied >= b.timesApplied }
        dedupe(FetchDescriptor<RecurringItem>(), key: { "\($0.merchant)|\($0.title)" }, context: context) { a, b in a.createdAt >= b.createdAt }
        // Modules: one period per start day; keep the newest edit.
        dedupe(FetchDescriptor<PeriodEntry>(), key: { "\($0.startDay.timeIntervalSince1970)" }, context: context) { a, b in a.updatedAt >= b.updatedAt }
        try? context.save()
    }

    private static func dedupeTransactions(_ context: ModelContext) {
        // Prefer reviewed, then categorized, then annotated copies.
        func score(_ t: LocalTransaction) -> Int {
            (t.needsReview ? 0 : 4) + (t.categoryId != nil ? 2 : 0) + (t.note.isEmpty ? 0 : 1)
        }
        dedupe(FetchDescriptor<LocalTransaction>(), key: \.providerTransactionId, context: context) { a, b in
            score(a) >= score(b)
        }
    }

    private static func dedupeCategories(_ context: ModelContext) {
        // If the same category exists across devices, preserve the one with a budget target set.
        func score(_ c: BudgetCategory) -> Int {
            (c.monthlyTarget > 0 ? 10 : 0) + (c.rolloverEnabled ? 2 : 0) + (c.rolloverBalance != 0 ? 1 : 0)
        }
        dedupe(FetchDescriptor<BudgetCategory>(),
               key: { "\($0.parentId ?? "root")|\($0.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())" },
               context: context) { a, b in
            score(a) >= score(b)
        }
    }

    private static func dedupe<T: PersistentModel>(_ descriptor: FetchDescriptor<T>, key: (T) -> String,
                                                   context: ModelContext, prefer: (T, T) -> Bool) {
        guard let all = try? context.fetch(descriptor) else { return }
        var keep = [String: T]()
        for item in all {
            let k = key(item)
            guard !k.isEmpty else { continue }
            if let existing = keep[k] {
                if prefer(existing, item) {
                    context.delete(item)
                } else {
                    context.delete(existing)
                    keep[k] = item
                }
            } else {
                keep[k] = item
            }
        }
    }
}
