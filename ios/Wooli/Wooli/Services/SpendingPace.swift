import Foundation

/// The expected shape of a month's spending, for the pace line. Bills and
/// subscriptions land on the days they usually charge; the rest of the
/// target is spread across the month, weighted by how much you tend to spend
/// on each day of the week. A straight "even spend" line made the 1st of the
/// month look far over pace whenever rent went out.
///
/// Once there are `averageMonths` full months of history, the line is
/// instead the average running total of those months, day by day — what
/// you actually spend, not what you planned.
struct SpendingPace {
    /// Expected running total at the end of each day of the month (index 0 = the 1st).
    let expected: [Double]
    /// Recurring bills placed on their usual days this month.
    let bills: Double
    /// Day-of-week habits shaped the line (false: not enough history yet, spread evenly).
    let usesHabits: Bool
    /// The average month's total when the line is the last few months' average, else nil.
    let monthlyAverage: Double?

    /// Days of history needed before day-of-week habits are trusted.
    static let minimumHistoryDays = 21
    /// Full months of history averaged once they're all there.
    static let averageMonths = 3

    init(target: Double, month: DateInterval, items: [RecurringItem], transactions: [LocalTransaction],
         ledger: Ledger, now: Date = .now) {
        let cal = Calendar.current
        let days = cal.range(of: .day, in: .month, for: month.start)?.count ?? 30
        let today = cal.startOfDay(for: now)

        if let average = Self.averageCurve(transactions: transactions, before: month, days: days, ledger: ledger) {
            expected = average
            bills = 0
            usesHabits = false
            monthlyAverage = average.last ?? 0
            return
        }
        monthlyAverage = nil

        // Bills: every charge this month, paid or still to come.
        var billsByDay = [Double](repeating: 0, count: days)
        var billMerchants = Set<String>()
        for item in items where item.isActive && item.amount < 0 && !ledger.hiddenAccounts.contains(item.accountId) {
            if let category = item.categoryId.flatMap({ ledger.categoriesById[$0] }), !category.isExpense { continue }
            billMerchants.insert(item.merchant)
            for date in Self.charges(of: item, in: month, today: today) {
                billsByDay[cal.component(.day, from: date) - 1] += -item.amount
            }
        }
        bills = billsByDay.reduce(0, +)

        // Everything else: weekday weights from past (complete) days of
        // non-bill spending.
        let weights = Self.weekdayWeights(transactions: transactions, excluding: billMerchants, ledger: ledger, before: today)
        usesHabits = weights != nil
        let dayWeights = (0..<days).map { i -> Double in
            let date = cal.date(byAdding: .day, value: i, to: month.start)!
            return weights?[cal.component(.weekday, from: date) - 1] ?? 1
        }
        let weightTotal = dayWeights.reduce(0, +)
        let flexible = max(target - bills, 0)

        var running = 0.0
        expected = (0..<days).map { i in
            running += billsByDay[i] + (weightTotal > 0 ? flexible * dayWeights[i] / weightTotal : 0)
            return running
        }
    }

    /// Average running total per day of the `averageMonths` months before
    /// `month`, counted like the actual line (`cumulativeSpending`), or nil
    /// unless history starts by the first few days of the oldest one. Days
    /// past a shorter month's end use that month's total.
    static func averageCurve(transactions: [LocalTransaction], before month: DateInterval, days: Int,
                             ledger: Ledger) -> [Double]? {
        let cal = Calendar.current
        guard let earliest = transactions.map(\.transactedAt).min(),
              let oldest = cal.date(byAdding: .month, value: -averageMonths, to: month.start),
              earliest < cal.date(byAdding: .day, value: 3, to: oldest)! else { return nil }

        let curves = (1...averageMonths).compactMap { back -> [Double]? in
            guard let start = cal.date(byAdding: .month, value: -back, to: month.start),
                  let past = cal.dateInterval(of: .month, for: start) else { return nil }
            return cumulativeSpending(transactions, in: past, categories: ledger.categoriesById,
                                      hiddenAccounts: ledger.hiddenAccounts).map(\.value)
        }
        guard curves.count == averageMonths, !curves.contains(where: \.isEmpty) else { return nil }
        return (0..<days).map { i in
            curves.reduce(0) { $0 + $1[min(i, $1.count - 1)] } / Double(curves.count)
        }
    }

    /// Charges of `item` that fall in `month`: walked back from the last one
    /// seen, and forward from the next expected one (unless it's overdue —
    /// that bill may have stopped, as `RecurringMonth` treats it).
    static func charges(of item: RecurringItem, in month: DateInterval, today: Date) -> [Date] {
        let cal = Calendar.current
        var dates = Set<Date>()
        var date = item.lastDate
        while date >= month.start {
            if month.contains(date) { dates.insert(cal.startOfDay(for: date)) }
            date = item.cadence.previous(before: date)
        }
        let grace = item.cadence == .weekly ? 3.0 : 6.0
        if item.nextDate >= today.addingTimeInterval(-grace * 86_400) {
            date = item.nextDate
            while date < month.end {
                if month.contains(date) { dates.insert(cal.startOfDay(for: date)) }
                date = item.cadence.next(after: date)
            }
        }
        return dates.sorted()
    }

    /// Relative spend per weekday (index 0 = Sunday, mean 1), or nil without
    /// enough history. Uses the median day so one big purchase doesn't make
    /// its weekday look expensive, and blends half-and-half with an even
    /// spread so the line doesn't overreact to a few weeks of data.
    static func weekdayWeights(transactions: [LocalTransaction], excluding billMerchants: Set<String>,
                               ledger: Ledger, before today: Date) -> [Double]? {
        let cal = Calendar.current
        var perDay = [Date: Double]()
        var earliest = today
        for tx in transactions where tx.transactedAt < today {
            earliest = min(earliest, cal.startOfDay(for: tx.transactedAt))
            guard !tx.isHidden, !tx.isTransfer, ledger.isVisible(tx), !billMerchants.contains(tx.normalizedMerchant) else { continue }
            let isSpending = ledger.category(for: tx).map(\.isExpense) ?? (tx.amount < 0)
            guard isSpending else { continue }
            perDay[cal.startOfDay(for: tx.transactedAt), default: 0] -= tx.amount
        }
        let span = cal.dateComponents([.day], from: earliest, to: today).day ?? 0
        guard span >= minimumHistoryDays else { return nil }

        // Every day in the window counts, including days with no spending.
        var byWeekday = [[Double]](repeating: [], count: 7)
        for i in 0..<span {
            let day = cal.date(byAdding: .day, value: i, to: earliest)!
            byWeekday[cal.component(.weekday, from: day) - 1].append(max(perDay[day] ?? 0, 0))
        }
        let medians = byWeekday.map(median)
        let mean = medians.reduce(0, +) / 7
        guard mean > 0 else { return nil }
        return medians.map { 0.5 + 0.5 * $0 / mean }
    }

    private static func median(_ values: [Double]) -> Double {
        guard !values.isEmpty else { return 0 }
        let sorted = values.sorted()
        return sorted.count % 2 == 1 ? sorted[sorted.count / 2] : (sorted[sorted.count / 2 - 1] + sorted[sorted.count / 2]) / 2
    }
}
