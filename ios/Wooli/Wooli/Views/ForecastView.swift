import SwiftUI
import SwiftData
import Charts

/// Warm "Field Notes" paper + deep forest ink palette shared across Budget & Finance views.
enum FieldNotes {
    static let paper = Color(light: 0xFBF9F5, dark: 0x101814)
    static let paperAlt = Color(light: 0xF4F0EA, dark: 0x18231D)
    static let card = Color(light: 0xFFFFFF, dark: 0x15201B)
    static let ink = Color(light: 0x182C23, dark: 0xEEF3EF)
    static let forest = Color(light: 0x2B4C3F, dark: 0x52B788)
    static let forestSoft = Color(light: 0xE7EFEA, dark: 0x1E352B)
    static let inkSecondary = Color(light: 0x4E6157, dark: 0xA9BDB2)
    static let inkTertiary = Color(light: 0x7A8B82, dark: 0x799184)
    static let border = Color(light: 0xE2DDD3, dark: 0x26382F)
    static let pillBg = Color(light: 0xECE6DC, dark: 0x1F2E26)
}

/// Cash + Recurring + Spending Pace projection over 30, 60, or 90 days.
struct ForecastView: View {
    enum Horizon: Int, CaseIterable, Identifiable {
        case days30 = 30
        case days60 = 60
        case days90 = 90
        var id: Int { rawValue }
        var label: String { "\(rawValue)D" }
    }

    struct ForecastPoint: Identifiable {
        let day: Date
        let balance: Double
        var id: Date { day }
    }

    struct ForecastEvent: Identifiable {
        let id = UUID()
        let date: Date
        let title: String
        let amount: Double
        let isRecurring: Bool
        let runningBalance: Double
    }

    @Query private var accounts: [LocalAccount]
    @Query(sort: \RecurringItem.nextDate) private var recurringItems: [RecurringItem]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var horizon: Horizon = .days60
    @State private var includeVariablePace = true

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let cashAccounts = accounts.filter { !$0.isHidden && ($0.kind == .checking || $0.kind == .savings) }
        let startingCash = cashAccounts.reduce(0) { $0 + $1.balance }
        let activeRecurring = recurringItems.filter { $0.isActive && !ledger.hiddenAccounts.contains($0.accountId) }
        let dailyVariableSpend = estimateDailyVariableSpend(transactions: transactions, recurring: activeRecurring, ledger: ledger)
        let projection = buildProjection(startingCash: startingCash, recurring: activeRecurring, dailySpend: includeVariablePace ? dailyVariableSpend : 0, days: horizon.rawValue)
        let endBalance = projection.points.last?.balance ?? startingCash
        let netChange = endBalance - startingCash
        let lowestPoint = projection.points.min(by: { $0.balance < $1.balance })

        ScrollView {
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("CASH FLOW FORECAST")
                            .font(.caption.weight(.bold))
                            .tracking(1.1)
                            .foregroundStyle(FieldNotes.inkTertiary)
                        Text("Projected Cash Balance")
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(FieldNotes.ink)
                    }
                    Spacer()
                    HStack(spacing: 4) {
                        ForEach(Horizon.allCases) { h in
                            Button {
                                withAnimation(.snappy) { horizon = h }
                            } label: {
                                Text(h.label)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(horizon == h ? FieldNotes.ink : FieldNotes.pillBg, in: Capsule())
                                    .foregroundStyle(horizon == h ? FieldNotes.paper : FieldNotes.inkSecondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Toggle("Include spending pace", isOn: $includeVariablePace)
                        .toggleStyle(.switch)
                        .labelsHidden()
                        .help("Include estimated daily variable spending")
                }

                // Summary Strip
                HStack(spacing: 12) {
                    ForecastStatCard(label: "Starting Cash", value: startingCash.currency(cents: false), detail: "\(cashAccounts.count) cash account\(cashAccounts.count == 1 ? "" : "s")", tint: FieldNotes.ink)
                    ForecastStatCard(label: "Projected (\(horizon.label))", value: endBalance.currency(cents: false), detail: "\(netChange >= 0 ? "+" : "")\(netChange.currency(cents: false)) net", tint: netChange >= 0 ? Theme.income : Theme.expense)
                    ForecastStatCard(label: "Daily Pace", value: dailyVariableSpend.currency(cents: false), detail: includeVariablePace ? "Non-bill variable/day" : "Pace excluded", tint: FieldNotes.forest)
                    ForecastStatCard(label: "Lowest Projected", value: (lowestPoint?.balance ?? startingCash).currency(cents: false), detail: lowestPoint.map { $0.day.formatted(.dateTime.month(.abbreviated).day()) } ?? "Today", tint: (lowestPoint?.balance ?? startingCash) < 0 ? Theme.expense : FieldNotes.ink)
                }

                // Projected Balance Chart
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Cash + Recurring + Pace")
                            .font(.headline)
                            .foregroundStyle(FieldNotes.ink)
                        Spacer()
                        Text(includeVariablePace ? "Recurring bills & income + \(dailyVariableSpend.currency(cents: false))/day pace" : "Recurring bills & income only")
                            .font(.caption)
                            .foregroundStyle(FieldNotes.inkTertiary)
                    }

                    Chart {
                        RuleMark(y: .value("Starting", startingCash))
                            .foregroundStyle(FieldNotes.inkTertiary.opacity(0.6))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))

                        ForEach(projection.points) { point in
                            AreaMark(x: .value("Date", point.day), y: .value("Balance", point.balance))
                                .foregroundStyle(LinearGradient(colors: [FieldNotes.forest.opacity(0.22), FieldNotes.forest.opacity(0.0)], startPoint: .top, endPoint: .bottom))
                                .interpolationMethod(.monotone)
                            LineMark(x: .value("Date", point.day), y: .value("Balance", point.balance))
                                .foregroundStyle(FieldNotes.forest)
                                .lineStyle(StrokeStyle(lineWidth: 2.5))
                                .interpolationMethod(.monotone)
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .automatic(desiredCount: 6)) { _ in
                            AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                            AxisGridLine().foregroundStyle(FieldNotes.border)
                            AxisValueLabel {
                                if let v = value.as(Double.self) {
                                    Text(v.formatted(.currency(code: "USD").notation(.compactName)))
                                        .foregroundStyle(FieldNotes.inkTertiary)
                                }
                            }
                        }
                    }
                    .frame(height: 240)
                }
                .padding(20)
                .background(FieldNotes.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(FieldNotes.border))

                // Upcoming Scheduled Cash Events
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Scheduled Cash Events")
                            .font(.headline)
                            .foregroundStyle(FieldNotes.ink)
                        Spacer()
                        Text("\(projection.events.count) upcoming")
                            .font(.caption)
                            .foregroundStyle(FieldNotes.inkTertiary)
                    }

                    if projection.events.isEmpty {
                        Text("No active recurring bills or paychecks scheduled in the next \(horizon.rawValue) days.")
                            .font(.subheadline)
                            .foregroundStyle(FieldNotes.inkSecondary)
                            .padding(.vertical, 12)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(projection.events.prefix(20).enumerated()), id: \.element.id) { idx, ev in
                                if idx > 0 { Divider().overlay(FieldNotes.border) }
                                HStack(spacing: 12) {
                                    Text(ev.date.formatted(.dateTime.month(.abbreviated).day()))
                                        .font(.caption.weight(.semibold).monospacedDigit())
                                        .foregroundStyle(FieldNotes.inkSecondary)
                                        .frame(width: 56, alignment: .leading)
                                    Text(ev.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(FieldNotes.ink)
                                        .lineLimit(1)
                                    Spacer()
                                    Text(ev.amount.signedCurrency())
                                        .font(.subheadline.weight(.semibold).monospacedDigit())
                                        .foregroundStyle(ev.amount > 0 ? Theme.income : FieldNotes.ink)
                                    Text(ev.runningBalance.currency(cents: false))
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(FieldNotes.inkTertiary)
                                        .frame(width: 80, alignment: .trailing)
                                }
                                .padding(.vertical, 10)
                            }
                        }
                    }
                }
                .padding(20)
                .background(FieldNotes.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(FieldNotes.border))
            }
            .padding(16)
        }
        .background(FieldNotes.paper)
    }

    private func estimateDailyVariableSpend(transactions: [LocalTransaction], recurring: [RecurringItem], ledger: Ledger) -> Double {
        let cal = Calendar.current
        let now = Date.now
        let start = cal.date(byAdding: .day, value: -60, to: now) ?? now
        let billMerchants = Set(recurring.filter { $0.amount < 0 }.map(\.merchant))
        let variable = transactions.filter { tx in
            tx.transactedAt >= start && tx.transactedAt <= now
                && !tx.isHidden && !tx.isTransfer && ledger.isVisible(tx)
                && tx.amount < 0 && !billMerchants.contains(tx.normalizedMerchant)
        }
        let total = variable.reduce(0) { $0 + abs($1.amount) }
        return total / 60.0
    }

    private func buildProjection(startingCash: Double, recurring: [RecurringItem], dailySpend: Double, days: Int) -> (points: [ForecastPoint], events: [ForecastEvent]) {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let end = cal.date(byAdding: .day, value: days, to: today)!

        var eventsByDay: [Date: [(String, Double)]] = [:]
        for item in recurring {
            var d = cal.startOfDay(for: item.nextDate)
            while d < today {
                let next = cal.startOfDay(for: item.cadence.next(after: d))
                if next <= d { break }
                d = next
            }
            while d <= end {
                eventsByDay[d, default: []].append((item.title, item.amount))
                let next = cal.startOfDay(for: item.cadence.next(after: d))
                if next <= d { break }
                d = next
            }
        }

        var balance = startingCash
        var points: [ForecastPoint] = []
        var events: [ForecastEvent] = []
        for offset in 0...days {
            let day = cal.date(byAdding: .day, value: offset, to: today)!
            if offset > 0 { balance -= dailySpend }
            if let dayEvents = eventsByDay[day] {
                for (title, amount) in dayEvents {
                    balance += amount
                    events.append(ForecastEvent(date: day, title: title, amount: amount, isRecurring: true, runningBalance: balance))
                }
            }
            points.append(ForecastPoint(day: day, balance: balance))
        }
        return (points, events)
    }
}

private struct ForecastStatCard: View {
    let label: String
    let value: String
    let detail: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(0.9)
                .foregroundStyle(FieldNotes.inkTertiary)
            Text(value)
                .font(.title3.weight(.bold).monospacedDigit())
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(detail)
                .font(.caption)
                .foregroundStyle(FieldNotes.inkSecondary)
                .lineLimit(1)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(FieldNotes.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(FieldNotes.border))
    }
}
