import SwiftUI
import SwiftData
import Charts

struct DashboardView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query private var accounts: [LocalAccount]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var snapshots: [BalanceSnapshot]
    @AppStorage("displayName") private var displayName = ""
    @State private var showSettings = false
    @State private var range: ChartRange = .month3

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        return displayName.isEmpty ? part : "\(part), \(displayName)"
    }

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let thisMonth = DateInterval.month(containing: .now)
        let month = MonthSummary(transactions: transactions, in: thisMonth,
                                 categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let plan = BudgetPlan(categories: categories, transactions: transactions, month: thisMonth, ledger: ledger)
        let plannedIncome = plan.plannedIncome
        let plannedExpenses = plan.plannedExpenses
        let reviewItems = ledger.reviewQueue(transactions)

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if StatusBanner.isVisible(app) { StatusBanner().card(padding: 14) }

                    if app.mode == .live, let lastSyncAt = app.lastSyncAt {
                        HStack(spacing: 4) {
                            Spacer()
                            Text(app.isSyncing ? "Syncing…" : "Synced \(lastSyncAt.formatted(.relative(presentation: .named)))")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .contentTransition(.numericText())
                    }

                    PaceCard(transactions: transactions, ledger: ledger, month: thisMonth, target: plannedExpenses)

                    if !reviewItems.isEmpty {
                        ReviewPreviewCard(items: reviewItems, categories: categories, ledger: ledger)
                    }

                    ModuleHomeCards()

                    BudgetSummaryCard(month: thisMonth, summary: month,
                                      plannedIncome: plannedIncome, plannedExpenses: plannedExpenses)

                    RecurringCard()

                    NetWorthCard(accounts: accounts, snapshots: snapshots, range: $range)

                    SpendingComparisonCard(transactions: transactions, ledger: ledger)

                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader(title: "Transactions") {
                            Button("See all") { app.selectedTab = .transactions }
                                .font(.subheadline.weight(.medium))
                        }
                        let recent = transactions.filter { !$0.isHidden && ledger.isVisible($0) }.prefix(5)
                        if recent.isEmpty {
                            Text("No transactions yet").font(.subheadline).foregroundStyle(Theme.textTertiary)
                                .frame(maxWidth: .infinity).padding(.vertical, 16)
                        }
                        ForEach(recent) { tx in
                            NavigationLink {
                                TransactionDetailView(transaction: tx)
                            } label: {
                                TransactionRow(transaction: tx, category: ledger.category(for: tx))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card()
                }
                .padding(16)
            }
            .pageBackground()
            .navigationTitle(greeting)
            .navigationDestination(item: Binding(get: { app.openModule }, set: { app.openModule = $0 })) { moduleScreen($0) }
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { SyncButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gearshape") { showSettings = true }
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }
}

/// Income vs. planned and expenses vs. planned, like the web dashboard.
struct BudgetSummaryCard: View {
    @Environment(AppModel.self) private var app
    let month: DateInterval
    let summary: MonthSummary
    let plannedIncome: Double
    let plannedExpenses: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Button { app.selectedTab = .budget } label: {
                CardHeader(title: "Budget") {
                    HStack(spacing: 4) {
                        Text(month.start.formatted(.dateTime.month(.wide).year()))
                        Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                    }
                    .font(.subheadline).foregroundStyle(Theme.textTertiary)
                }
            }
            .buttonStyle(.plain)

            PlanRow(title: "Income", actual: summary.income, planned: plannedIncome, tint: Theme.income,
                    actualLabel: "earned", isIncome: true)
            PlanRow(title: "Expenses", actual: summary.spending, planned: plannedExpenses, tint: Theme.expense,
                    actualLabel: "spent", isIncome: false)
        }
        .card()
    }
}

struct PlanRow: View {
    let title: String
    let actual: Double
    let planned: Double
    let tint: Color
    let actualLabel: String
    let isIncome: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text(planned > 0 ? "\(planned.currency()) planned" : "No plan set")
                    .font(.footnote).foregroundStyle(Theme.textTertiary)
            }
            BarGauge(value: actual, total: planned > 0 ? planned : max(actual, 1), tint: tint)
            HStack {
                Text("\(actual.currency()) \(actualLabel)").font(.footnote).foregroundStyle(Theme.textSecondary)
                Spacer()
                if planned > 0 {
                    let diff = planned - actual
                    if isIncome {
                        Text(diff <= 0 ? "\(abs(diff).currency()) over target" : "\(diff.currency()) to go")
                            .foregroundStyle(diff <= 0 ? Theme.income : Theme.textSecondary)
                    } else {
                        Text(diff >= 0 ? "\(diff.currency()) remaining" : "\(abs(diff).currency()) over")
                            .foregroundStyle(diff >= 0 ? Theme.textSecondary : Theme.expense)
                    }
                }
            }
            .font(.footnote)
            .monospacedDigit()
        }
    }
}

/// Cumulative spend this month against a dashed "even pace" line — the one
/// number that answers "am I on track?" Until flex budgeting exists, "pace"
/// is measured against all planned expenses rather than a flex-only subset.
struct PaceCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger
    let month: DateInterval
    let target: Double

    var body: some View {
        let current = cumulativeSpending(transactions, in: month, through: .now,
                                         categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let spent = current.last?.value ?? 0
        let daysInMonth = Calendar.current.range(of: .day, in: .month, for: month.start)?.count ?? 30
        let dayOfMonth = min(current.count, daysInMonth)
        let evenPaceToday = target > 0 ? target * Double(dayOfMonth) / Double(daysInMonth) : 0
        let paceDiff = evenPaceToday - spent
        let over = target > 0 && spent > target
        let tint = over ? Theme.expense : Theme.income

        VStack(alignment: .leading, spacing: 10) {
            CardHeader(title: "Spending Pace", subtitle: month.start.formatted(.dateTime.month(.wide)))
            if target > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(max(target - spent, 0).currency(cents: false)) \(spent > target ? "over" : "left")")
                        .font(.system(size: 28, weight: .bold)).monospacedDigit()
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Text("of \(target.currency(cents: false))").font(.subheadline).foregroundStyle(Theme.textTertiary)
                }
            } else {
                Text(spent.currency())
                    .font(.system(size: 28, weight: .bold)).monospacedDigit()
                    .foregroundStyle(Theme.text)
            }

            Chart {
                if target > 0 {
                    ForEach([(1, 0.0), (daysInMonth, target)], id: \.0) { day, value in
                        LineMark(x: .value("Day", day), y: .value("Pace", value), series: .value("Series", "Pace"))
                            .foregroundStyle(Theme.textTertiary)
                            .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                    }
                }
                ForEach(Array(current.enumerated()), id: \.offset) { i, point in
                    AreaMark(x: .value("Day", i + 1), y: .value("Spent", point.value))
                        .foregroundStyle(LinearGradient(colors: [tint.opacity(0.18), tint.opacity(0)],
                                                        startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.monotone)
                    LineMark(x: .value("Day", i + 1), y: .value("Spent", point.value), series: .value("Series", "Actual"))
                        .foregroundStyle(tint)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .interpolationMethod(.monotone)
                }
                if let last = current.last {
                    PointMark(x: .value("Day", current.count), y: .value("Spent", last.value))
                        .foregroundStyle(tint)
                        .symbolSize(50)
                }
            }
            .chartXScale(domain: 1...max(daysInMonth, 2))
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .frame(height: 120)

            if target > 0 {
                Text("\(abs(paceDiff).currency(cents: false)) \(paceDiff >= 0 ? "under pace" : "over pace") · dashed line is an even spend")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
            } else {
                Text("Set a budget on the Budget tab to see your pace this month.")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
        .card()
    }
}

/// A few transactions waiting on a category, plus a one-tap way to clear
/// whichever of them already have one — the review queue stays for the rest.
struct ReviewPreviewCard: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    let items: [LocalTransaction]
    let categories: [BudgetCategory]
    let ledger: Ledger
    @State private var confirmedPulse = false

    var body: some View {
        let ready = items.filter { $0.categoryId != nil }

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "To Review · \(items.count)") {
                Button("See all") { app.showReview = true }
                    .font(.subheadline.weight(.medium))
            }
            ForEach(items.prefix(4)) { tx in
                TransactionRow(transaction: tx, category: ledger.category(for: tx), quickEdit: false)
            }
            if !ready.isEmpty {
                Button {
                    withAnimation(.snappy) {
                        for tx in ready { Categorizer.confirm(tx, categories: categories, context: context) }
                    }
                    confirmedPulse.toggle()
                } label: {
                    Text("Mark \(ready.count) as reviewed")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .sensoryFeedback(.success, trigger: confirmedPulse)
            }
        }
        .card()
    }
}

/// Net worth with a range picker and a line chart.
struct NetWorthCard: View {
    @Environment(AppModel.self) private var app
    let accounts: [LocalAccount]
    let snapshots: [BalanceSnapshot]
    @Binding var range: ChartRange
    var showsLink = true

    var body: some View {
        let visible = accounts.filter { !$0.isHidden }
        let netWorth = visible.reduce(0) { $0 + $1.netWorthValue }
        let history = BalanceHistory(snapshots: snapshots)
        let series = history.series(for: visible, from: range.startDate(earliest: history.earliest)) { account, balance in
            account.kind.isAsset ? balance : -abs(balance)
        }
        let change = netWorth - (series.first?.value ?? netWorth)

        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Net Worth")
            Text(netWorth.currency())
                .font(.system(size: 32, weight: .bold)).monospacedDigit()
                .foregroundStyle(Theme.text)
                .contentTransition(.numericText())
            ChangeLabel(change: change, base: series.first?.value, period: range.periodLabel)

            NetWorthChart(points: series, tint: Theme.brand)
                .frame(height: 140)
                .padding(.top, 6)

            RangePicker(selection: $range)

            if showsLink {
                Button("View accounts") { app.selectedTab = .accounts }
                    .font(.subheadline.weight(.medium))
                    .padding(.top, 2)
            }
        }
        .card()
    }
}

struct NetWorthChart: View {
    let points: [HistoryPoint]
    var tint: Color = Theme.brand

    var body: some View {
        let values = points.map(\.value)
        let lo = values.min() ?? 0, hi = values.max() ?? 1
        let pad = max((hi - lo) * 0.1, 1)
        Chart(points) { point in
            AreaMark(x: .value("Day", point.day), yStart: .value("Base", lo - pad), yEnd: .value("Value", point.value))
                .foregroundStyle(LinearGradient(colors: [tint.opacity(0.22), tint.opacity(0.0)],
                                                startPoint: .top, endPoint: .bottom))
                .interpolationMethod(.monotone)
            LineMark(x: .value("Day", point.day), y: .value("Value", point.value))
                .foregroundStyle(tint)
                .lineStyle(StrokeStyle(lineWidth: 2))
                .interpolationMethod(.monotone)
        }
        .chartYScale(domain: (lo - pad)...(hi + pad))
        .chartXAxis(.hidden)
        .chartYAxis(.hidden)
        .accessibilityLabel("Net worth over time")
    }
}

/// Cumulative spending this month vs. last month.
struct SpendingComparisonCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger

    var body: some View {
        let cal = Calendar.current
        let thisMonth = DateInterval.month(containing: .now)
        let lastMonth = DateInterval.month(containing: cal.date(byAdding: .month, value: -1, to: .now)!)
        let current = cumulativeSpending(transactions, in: thisMonth, through: .now,
                                         categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let previous = cumulativeSpending(transactions, in: lastMonth,
                                          categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let spent = current.last?.value ?? 0
        let dayIndex = current.count
        let lastAtSameDay = previous.indices.contains(dayIndex - 1) ? previous[dayIndex - 1].value : (previous.last?.value ?? 0)

        VStack(alignment: .leading, spacing: 10) {
            CardHeader(title: "Spending", subtitle: "This month vs. last month")
            Text(spent.currency())
                .font(.system(size: 28, weight: .bold)).monospacedDigit()
                .foregroundStyle(Theme.text)
            if lastAtSameDay > 0 {
                let diff = spent - lastAtSameDay
                Text("\(abs(diff).currency()) \(diff <= 0 ? "less" : "more") than this time last month")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(diff <= 0 ? Theme.income : Theme.expense)
            }

            Chart {
                ForEach(Array(previous.enumerated()), id: \.offset) { i, point in
                    LineMark(x: .value("Day", i + 1), y: .value("Spent", point.value), series: .value("Month", "Last"))
                        .foregroundStyle(Theme.lastMonth)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.stepEnd)
                }
                ForEach(Array(current.enumerated()), id: \.offset) { i, point in
                    AreaMark(x: .value("Day", i + 1), y: .value("Spent", point.value))
                        .foregroundStyle(Theme.thisMonth.opacity(0.15))
                        .interpolationMethod(.stepEnd)
                    LineMark(x: .value("Day", i + 1), y: .value("Spent", point.value), series: .value("Month", "This"))
                        .foregroundStyle(Theme.thisMonth)
                        .lineStyle(StrokeStyle(lineWidth: 2.5))
                        .interpolationMethod(.stepEnd)
                }
            }
            .chartXScale(domain: 1...31)
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                    AxisGridLine().foregroundStyle(Theme.border)
                    AxisValueLabel {
                        if let v = value.as(Double.self) {
                            Text(v.formatted(.currency(code: "USD").notation(.compactName)))
                                .foregroundStyle(Theme.textTertiary)
                        }
                    }
                }
            }
            .frame(height: 170)

            HStack(spacing: 16) {
                LegendDot(color: Theme.thisMonth, label: "This month")
                LegendDot(color: Theme.lastMonth, label: "Last month")
            }
            .frame(maxWidth: .infinity)
        }
        .card()
    }
}

struct LegendDot: View {
    let color: Color
    let label: String
    var body: some View {
        HStack(spacing: 6) {
            Capsule().fill(color).frame(width: 14, height: 4)
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
        }
    }
}
