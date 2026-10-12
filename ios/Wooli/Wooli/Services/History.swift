import Foundation
import SwiftData

enum ChartRange: String, CaseIterable, Identifiable {
    case month1, month3, month6, ytd, year1, all
    var id: String { rawValue }

    var label: String {
        switch self {
        case .month1: "1M"
        case .month3: "3M"
        case .month6: "6M"
        case .ytd: "YTD"
        case .year1: "1Y"
        case .all: "All"
        }
    }

    var periodLabel: String {
        switch self {
        case .month1: "1 month"
        case .month3: "3 months"
        case .month6: "6 months"
        case .ytd: "this year"
        case .year1: "1 year"
        case .all: "all time"
        }
    }

    func startDate(now: Date = .now, earliest: Date?) -> Date {
        let cal = Calendar.current
        let today = cal.startOfDay(for: now)
        switch self {
        case .month1: return cal.date(byAdding: .month, value: -1, to: today)!
        case .month3: return cal.date(byAdding: .month, value: -3, to: today)!
        case .month6: return cal.date(byAdding: .month, value: -6, to: today)!
        case .ytd: return cal.dateInterval(of: .year, for: today)!.start
        case .year1: return cal.date(byAdding: .year, value: -1, to: today)!
        case .all: return earliest.map { cal.startOfDay(for: $0) } ?? cal.date(byAdding: .month, value: -1, to: today)!
        }
    }
}

struct HistoryPoint: Identifiable {
    let day: Date
    let value: Double
    var id: Date { day }
}

/// Balance history built from daily snapshots. Between snapshots an account
/// keeps its last known balance; before its first snapshot it counts as 0.
struct BalanceHistory {
    private let byAccount: [String: [BalanceSnapshot]]
    let earliest: Date?

    init(snapshots: [BalanceSnapshot]) {
        byAccount = Dictionary(grouping: snapshots, by: \.accountId).mapValues { $0.sorted { $0.day < $1.day } }
        earliest = snapshots.map(\.day).min()
    }

    /// Daily series of the summed value of `accounts`, using `value` to turn a
    /// balance into a signed contribution (e.g. debts negative).
    func series(for accounts: [LocalAccount], from start: Date, to end: Date = .now,
                value: (LocalAccount, Double) -> Double) -> [HistoryPoint] {
        let cal = Calendar.current
        var cursors = [String: Int]()
        var points: [HistoryPoint] = []
        var day = cal.startOfDay(for: start)
        let last = cal.startOfDay(for: end)
        // Weekly points over long ranges keep the chart light.
        let span = cal.dateComponents([.day], from: day, to: last).day ?? 0
        let step = span > 200 ? 7 : 1

        while day <= last {
            var total = 0.0
            for account in accounts {
                guard let snaps = byAccount[account.providerAccountId], !snaps.isEmpty else { continue }
                var i = cursors[account.providerAccountId] ?? -1
                while i + 1 < snaps.count && snaps[i + 1].day <= day { i += 1 }
                cursors[account.providerAccountId] = i
                if i >= 0 { total += value(account, snaps[i].balance) }
            }
            points.append(HistoryPoint(day: day, value: total))
            day = cal.date(byAdding: .day, value: step, to: day)!
        }
        if let lastPoint = points.last, lastPoint.day < last {
            points.append(HistoryPoint(day: last, value: accounts.reduce(0) { $0 + value($1, $1.balance) }))
        }
        return points
    }
}

/// Running total of spending by day of month — for "this month vs last month".
func cumulativeSpending(_ transactions: [LocalTransaction], in month: DateInterval, through end: Date? = nil,
                        categories: [String: BudgetCategory], hiddenAccounts: Set<String>) -> [HistoryPoint] {
    let cal = Calendar.current
    let limit = min(end ?? month.end, month.end)
    var perDay = [Int: Double]()
    for tx in transactions where month.contains(tx.transactedAt) && tx.transactedAt <= limit {
        guard !tx.isHidden, !tx.isTransfer, !hiddenAccounts.contains(tx.accountId) else { continue }
        let category = tx.categoryId.flatMap { categories[$0] }
        let isSpending = category.map(\.isExpense) ?? (tx.amount < 0)
        guard isSpending else { continue }
        perDay[cal.component(.day, from: tx.transactedAt), default: 0] -= tx.amount
    }
    let lastDay = cal.component(.day, from: limit.addingTimeInterval(-1))
    var running = 0.0
    return (1...max(lastDay, 1)).map { d in
        running += perDay[d] ?? 0
        return HistoryPoint(day: cal.date(byAdding: .day, value: d - 1, to: month.start)!, value: running)
    }
}

// MARK: - Transaction filters

/// The window the app asks the user to review and lists by default: last
/// month plus month to date. Older transactions stay on the phone (see
/// `TransactionRetention`) for charts and reports.
enum ReviewWindow {
    static var start: Date {
        let cal = Calendar.current
        let thisMonth = cal.dateInterval(of: .month, for: .now)!.start
        return cal.date(byAdding: .month, value: -1, to: thisMonth)!
    }

    static func contains(_ date: Date) -> Bool { date >= start }
}

/// How long transactions are kept: five years, so Reports and insights can
/// compare months and years. Balances, net-worth history and learned
/// merchant rules are kept regardless.
enum TransactionRetention {
    static let years = 5

    static var start: Date {
        let cal = Calendar.current
        let thisMonth = cal.dateInterval(of: .month, for: .now)!.start
        return cal.date(byAdding: .year, value: -years, to: thisMonth)!
    }

    /// Delete transactions older than the retention window.
    @MainActor
    static func pruneOlderTransactions(context: ModelContext) {
        let cutoff = start
        try? context.delete(model: LocalTransaction.self, where: #Predicate { $0.transactedAt < cutoff })
        try? context.save()
    }
}

struct TransactionFilter: Equatable {
    enum DateRange: String, CaseIterable, Identifiable {
        case recent = "Last month & this month", all = "All time", thisMonth = "This month", lastMonth = "Last month",
             last30 = "Last 30 days", last60 = "Last 60 days", last90 = "Last 90 days", thisYear = "This year"
        var id: String { rawValue }

        var interval: DateInterval? {
            let cal = Calendar.current
            let now = Date.now
            switch self {
            case .all: return nil
            case .recent: return DateInterval(start: ReviewWindow.start, end: .distantFuture)
            case .thisMonth: return cal.dateInterval(of: .month, for: now)
            case .lastMonth: return cal.dateInterval(of: .month, for: cal.date(byAdding: .month, value: -1, to: now)!)
            case .last30, .last60, .last90:
                let days = self == .last30 ? 30 : self == .last60 ? 60 : 90
                return DateInterval(start: cal.date(byAdding: .day, value: -days, to: cal.startOfDay(for: now))!, end: .distantFuture)
            case .thisYear: return cal.dateInterval(of: .year, for: now)
            }
        }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case newest = "Date (new to old)", oldest = "Date (old to new)",
             largest = "Amount (high to low)", smallest = "Amount (low to high)"
        var id: String { rawValue }
    }

    var dateRange: DateRange = .recent
    var sort: Sort = .newest
    var accountIds: Set<String> = []
    var categoryIds: Set<String> = []
    var merchants: Set<String> = []
    var tags: Set<String> = []
    var minAmount: Double?
    var maxAmount: Double?

    var activeCount: Int {
        [dateRange != .recent, !accountIds.isEmpty, !tags.isEmpty, !categoryIds.isEmpty, !merchants.isEmpty,
         minAmount != nil || maxAmount != nil].filter { $0 }.count
    }

    func matches(_ tx: LocalTransaction) -> Bool {
        if let interval = dateRange.interval, !interval.contains(tx.transactedAt) { return false }
        if !accountIds.isEmpty && !accountIds.contains(tx.accountId) { return false }
        if !categoryIds.isEmpty && !categoryIds.contains(tx.categoryId ?? "") { return false }
        if !merchants.isEmpty && !merchants.contains(tx.normalizedMerchant) { return false }
        if !tags.isEmpty && tags.isDisjoint(with: tx.tags) { return false }
        let size = abs(tx.amount)
        if let minAmount, size < minAmount { return false }
        if let maxAmount, size > maxAmount { return false }
        return true
    }

    func sorted(_ items: [LocalTransaction]) -> [LocalTransaction] {
        switch sort {
        case .newest: items.sorted { $0.transactedAt > $1.transactedAt }
        case .oldest: items.sorted { $0.transactedAt < $1.transactedAt }
        case .largest: items.sorted { abs($0.amount) > abs($1.amount) }
        case .smallest: items.sorted { abs($0.amount) < abs($1.amount) }
        }
    }
}
