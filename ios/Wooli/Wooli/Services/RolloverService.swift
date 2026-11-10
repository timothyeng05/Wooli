import Foundation
import SwiftData

/// Budget rollover: at each new month, what was left of a category's planned
/// amount (planned − spent, can be negative) is added to its carried-over
/// balance. The balance lives on the category, so it survives the app's
/// two-month transaction window; months Wooli has no data for are skipped
/// rather than counted as unspent.
enum RolloverService {
    static func turnOn(_ category: BudgetCategory) {
        category.rolloverEnabled = true
        category.rolloverBalance = 0
        category.rolloverThrough = Calendar.current.dateInterval(of: .month, for: .now)!.start
    }

    static func closeMonths(context: ModelContext, now: Date = .now) {
        let cal = Calendar.current
        let thisMonth = cal.dateInterval(of: .month, for: now)!.start
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let due = categories.filter { $0.rolloverEnabled && $0.isExpense && ($0.rolloverThrough ?? thisMonth) < thisMonth }
        guard !due.isEmpty else { return }

        let transactions = (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? []
        let accounts = (try? context.fetch(FetchDescriptor<LocalAccount>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))

        for category in due {
            var month = category.rolloverThrough ?? thisMonth
            while month < thisMonth {
                let interval = cal.dateInterval(of: .month, for: month)!
                let summary = MonthSummary(transactions: transactions, in: interval, categories: byId, hiddenAccounts: hidden)
                let spent = category.parentId == nil ? (summary.spendingByGroup[category.id] ?? 0)
                                                      : (summary.spendingByCategory[category.id] ?? 0)
                category.rolloverBalance += category.monthlyTarget - spent
                month = interval.end
            }
            category.rolloverThrough = thisMonth
        }
        try? context.save()
    }
}
