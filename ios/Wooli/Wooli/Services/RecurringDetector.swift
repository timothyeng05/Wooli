import Foundation
import SwiftData

/// Finds bills, subscriptions and paychecks that repeat, and keeps them up to
/// date as new transactions arrive. No AI: same merchant, similar amount, on
/// a regular schedule.
enum RecurringDetector {
    /// Allowed spread between charges of one item (e.g. a utility bill that
    /// varies month to month).
    static let amountTolerance = 0.35

    /// Bump when detection rules change: earlier automatic detections are
    /// re-evaluated (ones the user stopped tracking or added are kept).
    private static let version = 2
    private static let versionKey = "recurringDetectorVersion"

    /// Category groups where repeat visits are normal spending, not bills.
    private static let discretionaryGroups: Set<String> = ["Food & Dining", "Shopping", "Entertainment"]
    private static let discretionaryCategories: Set<String> = ["Rideshare & Taxi", "Rideshare", "Gas", "Parking & Tolls",
                                                               "Transit", "Car", "Hotels", "Flights", "Vacation"]

    static func refresh(context: ModelContext) {
        let hiddenAccountIds = Set(((try? context.fetch(FetchDescriptor<LocalAccount>())) ?? [])
            .filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        let transactions = ((try? context.fetch(FetchDescriptor<LocalTransaction>(
            sortBy: [SortDescriptor(\.transactedAt)]))) ?? [])
            .filter { !$0.isHidden && !$0.isTransfer && !$0.isPending && $0.splitParentId.isEmpty
                && abs($0.amount) >= 1 && !$0.normalizedMerchant.isEmpty && !hiddenAccountIds.contains($0.accountId) }
        var items = (try? context.fetch(FetchDescriptor<RecurringItem>())) ?? []

        if UserDefaults.standard.integer(forKey: versionKey) < version {
            for item in items where !item.isManual && item.isActive { context.delete(item) }
            items.removeAll { !$0.isManual && $0.isActive }
            UserDefaults.standard.set(version, forKey: versionKey)
        }

        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        func isDiscretionary(_ tx: LocalTransaction) -> Bool {
            guard let c = tx.categoryId.flatMap({ byId[$0] }) else { return false }
            let group = c.parentId.flatMap { byId[$0] }?.name ?? ""
            return discretionaryGroups.contains(group) || discretionaryCategories.contains(c.name)
        }

        // 1. Match new payments to items we already know about.
        let byMerchant = Dictionary(grouping: transactions, by: \.normalizedMerchant)
        for item in items where item.isActive {
            let earliest = item.lastDate.addingTimeInterval(item.cadence.days * 0.5 * 86_400)
            let payments = (byMerchant[item.merchant] ?? []).filter {
                $0.transactedAt >= earliest && sameDirection($0.amount, item.amount) && similar($0.amount, item.amount)
            }
            if let latest = payments.last {
                record(latest, on: item)
            }
        }

        // 2. Detect new ones. One merchant can have several (two phone
        //    lines, a bill and a membership), so split by direction and amount.
        for (merchant, charges) in byMerchant {
            let directions = [charges.filter { $0.amount < 0 }, charges.filter { $0.amount > 0 }]
            // Tight clusters first (two phone lines at different prices), then the
            // whole group (a utility bill that varies month to month).
            let candidates = directions.flatMap { amountClusters($0, tolerance: 0.10) + [$0] }
            for cluster in candidates where cluster.count >= 2 {
                let typical = median(cluster.map(\.amount))
                // Already tracked (or dismissed) at about this amount.
                if items.contains(where: { $0.merchant == merchant && sameDirection($0.amount, typical) && similar($0.amount, typical) }) {
                    continue
                }
                let discretionary = cluster.contains(where: isDiscretionary)
                guard let (cadence, series) = detectSeries(cluster, strict: discretionary) else { continue }
                let last = series.last!
                let item = RecurringItem(merchant: merchant, title: last.title, amount: typical,
                                         cadence: cadence, lastDate: last.transactedAt)
                item.categoryId = last.categoryId
                item.accountId = last.accountId
                item.lastTransactionId = last.providerTransactionId
                context.insert(item)
                items.append(item)
            }
        }
        try? context.save()
    }

    /// Group charges whose amounts are within tolerance of each other.
    private static func amountClusters(_ charges: [LocalTransaction], tolerance: Double) -> [[LocalTransaction]] {
        var clusters: [[LocalTransaction]] = []
        for tx in charges.sorted(by: { abs($0.amount) < abs($1.amount) }) {
            if let i = clusters.indices.last, similar(tx.amount, median(clusters[i].map(\.amount)), tolerance: tolerance) {
                clusters[i].append(tx)
            } else {
                clusters.append([tx])
            }
        }
        return clusters.map { $0.sorted { $0.transactedAt < $1.transactedAt } }
    }

    /// Start tracking a transaction the user marked as recurring.
    @discardableResult
    static func track(_ tx: LocalTransaction, cadence: Cadence, context: ModelContext) -> RecurringItem {
        let existing = (try? context.fetch(FetchDescriptor<RecurringItem>()))?.first { $0.merchant == tx.normalizedMerchant }
        let item = existing ?? {
            let new = RecurringItem(merchant: tx.normalizedMerchant, title: tx.title, amount: tx.amount,
                                    cadence: cadence, lastDate: tx.transactedAt)
            new.isManual = true
            context.insert(new)
            return new
        }()
        item.cadence = cadence
        item.isActive = true
        record(tx, on: item)
        try? context.save()
        return item
    }

    private static func record(_ tx: LocalTransaction, on item: RecurringItem) {
        item.lastDate = tx.transactedAt
        item.nextDate = item.cadence.next(after: tx.transactedAt)
        item.lastTransactionId = tx.providerTransactionId
        // Follow the latest amount so price changes show up.
        item.amount = tx.amount
        if let category = tx.categoryId { item.categoryId = category }
        if item.accountId.isEmpty { item.accountId = tx.accountId }
    }

    /// The longest regular run at the end of these charges, if any.
    private static func detectSeries(_ charges: [LocalTransaction], strict: Bool) -> (Cadence, [LocalTransaction])? {
        // Collapse same-day duplicates (e.g. a charge and its adjustment).
        var series: [LocalTransaction] = []
        for tx in charges.sorted(by: { $0.transactedAt < $1.transactedAt }) {
            if let last = series.last, Calendar.current.isDate(last.transactedAt, inSameDayAs: tx.transactedAt) { continue }
            series.append(tx)
        }
        guard series.count >= 2 else { return nil }
        // Whole calendar days, so time of day doesn't push a gap out of range.
        let cal = Calendar.current
        let gaps = zip(series, series.dropFirst()).map {
            Double(cal.dateComponents([.day], from: cal.startOfDay(for: $0.transactedAt), to: cal.startOfDay(for: $1.transactedAt)).day ?? 0)
        }
        guard var cadence = Cadence.from(days: median(gaps)),
              gaps.allSatisfy({ Cadence.from(days: $0) == cadence }) else { return nil }
        // Paid on the same two days each month (1st & 15th) rather than every 14 days.
        if cadence == .biweekly {
            let days = Set(series.map { cal.component(.day, from: $0.transactedAt) })
            let clusters = days.sorted().reduce(into: [Int]()) { acc, d in if acc.last.map({ d - $0 > 3 }) ?? true { acc.append(d) } }
            if clusters.count <= 2 && Set(gaps).count > 1 { cadence = .semimonthly }
        }
        let typical = median(series.map(\.amount))
        guard series.allSatisfy({ similar($0.amount, typical) }) else { return nil }
        // Weekly/biweekly need more than two sightings to be believable.
        if [.weekly, .biweekly, .semimonthly].contains(cadence) && series.count < 3 { return nil }
        // Everyday spending (restaurants, rides, shopping) repeats by chance;
        // ask for more evidence before calling it recurring.
        if strict && series.count < 3 { return nil }
        // With only two sightings, the amount and day of month must line up
        // closely, the way a bill does.
        if series.count == 2 {
            let (a, b) = (series[0], series[1])
            let amountClose = abs(abs(a.amount) - abs(b.amount)) / max(abs(a.amount), abs(b.amount)) <= 0.05
            let dayA = cal.component(.day, from: a.transactedAt), dayB = cal.component(.day, from: b.transactedAt)
            let dayGap = min(abs(dayA - dayB), 31 - abs(dayA - dayB))
            if !amountClose || (cadence == .monthly && dayGap > 4) { return nil }
        }
        return (cadence, series)
    }

    static func similar(_ a: Double, _ b: Double, tolerance: Double = amountTolerance) -> Bool {
        let big = max(abs(a), abs(b))
        return big == 0 || abs(abs(a) - abs(b)) / big <= tolerance
    }

    private static func sameDirection(_ a: Double, _ b: Double) -> Bool { (a < 0) == (b < 0) }

    private static func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        guard !sorted.isEmpty else { return 0 }
        return sorted.count % 2 == 1 ? sorted[sorted.count / 2] : (sorted[sorted.count / 2 - 1] + sorted[sorted.count / 2]) / 2
    }
}

/// This month's view of recurring items: what's been paid, what's still due.
struct RecurringMonth {
    struct Occurrence: Identifiable {
        let item: RecurringItem
        let date: Date
        var id: String { "\(item.id)-\(date.timeIntervalSince1970)" }
    }

    let paid: [RecurringItem]
    let upcoming: [Occurrence]
    let late: [RecurringItem]

    init(items: [RecurringItem], now: Date = .now) {
        let cal = Calendar.current
        let month = cal.dateInterval(of: .month, for: now)!
        let today = cal.startOfDay(for: now)
        let active = items.filter(\.isActive)

        paid = active.filter { month.contains($0.lastDate) }.sorted { $0.lastDate > $1.lastDate }

        var upcoming: [Occurrence] = []
        var late: [RecurringItem] = []
        for item in active {
            // A few days' grace before calling a charge late (banks post slowly).
            let grace = item.cadence == .weekly ? 3.0 : 6.0
            if item.nextDate < today.addingTimeInterval(-grace * 86_400) {
                late.append(item)
                continue
            }
            // Includes a charge due in the last few days that hasn't posted yet.
            var date = item.nextDate
            while date < month.end {
                upcoming.append(Occurrence(item: item, date: date))
                date = item.cadence.next(after: date)
            }
        }
        self.upcoming = upcoming.sorted { $0.date < $1.date }
        self.late = late.sorted { $0.nextDate < $1.nextDate }
    }

    var paidOut: Double { paid.filter { $0.amount < 0 }.reduce(0) { $0 - $1.amount } }
    var dueOut: Double { upcoming.filter { $0.item.amount < 0 }.reduce(0) { $0 - $1.item.amount } }
    var expectedIn: Double { upcoming.filter { $0.item.amount > 0 }.reduce(0) { $0 + $1.item.amount } }
}
