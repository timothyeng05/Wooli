import SwiftUI
import SwiftData
import Charts

struct DashboardView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query private var accounts: [LocalAccount]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query(sort: \Person.name) private var people: [Person]
    @Query private var recurringItems: [RecurringItem]
    @State private var layoutRows: [DashboardLayoutRow] = DashboardLayoutStore.load()
    @State private var selectedPersonId: String? = nil

    @AppStorage("displayName") private var displayName = ""
    @State private var showSettings = false
    @State private var showCustomize = false

    /// Visible cards in the user's chosen order. Any card not yet represented
    /// in `layoutRows` (a fresh install, or a card added in a later update)
    /// is appended at the end rather than silently disappearing.
    private var orderedCards: [DashboardCard] {
        let visible = layoutRows.filter { !$0.isHidden }.compactMap { DashboardCard(rawValue: $0.cardId) }
        let known = Set(layoutRows.map(\.cardId))
        let missing = DashboardCard.allCases.filter { !known.contains($0.rawValue) }
        return visible + missing
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        return displayName.isEmpty ? part : "\(part), \(displayName)"
    }

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let thisMonth = DateInterval.month(containing: .now)
        let visibleAccounts = Set(accounts.filter { $0.counts(forPerson: selectedPersonId) }.map(\.providerAccountId))
        // Every card here looks at most seven months back (the pace line averages
        // up to six full months), so slice once instead of each card walking five
        // years of history. `transactions` is sorted newest first.
        let cutoff = Calendar.current.date(byAdding: .month, value: -(SpendingPace.averageMonths.upperBound + 1),
                                           to: thisMonth.start) ?? thisMonth.start
        let relevantTransactions = transactions.prefix { $0.transactedAt >= cutoff }
            .filter { visibleAccounts.contains($0.accountId) }
        let month = MonthSummary(transactions: relevantTransactions, in: thisMonth,
                                 categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let plan = BudgetPlan(categories: categories, transactions: relevantTransactions, month: thisMonth, ledger: ledger)
        let plannedIncome = plan.plannedIncome
        let plannedExpenses = plan.plannedExpenses
        let reviewItems = ledger.reviewQueue(relevantTransactions)

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if !people.isEmpty {
                        Picker("Person", selection: $selectedPersonId) {
                            Text("Everyone").tag(String?.none)
                            ForEach(people) { person in
                                Text("\(person.name)").tag(String?.some(person.id))
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 4)
                    }

                    if StatusBanner.isVisible(app) { StatusBanner().card(padding: 14) }

                    SyncStatusLine()

                    if !reviewItems.isEmpty {
                        ReviewPreviewCard(items: reviewItems, ledger: ledger)
                    }

                    SpendingCard(transactions: relevantTransactions, ledger: ledger, month: thisMonth, target: plannedExpenses,
                                 recurring: recurringItems.filter { selectedPersonId == nil || visibleAccounts.contains($0.accountId) })

                    ForEach(orderedCards.filter { $0 != .review }) { card in
                        cardView(for: card, ledger: ledger, thisMonth: thisMonth, month: month,
                                plan: plan, plannedIncome: plannedIncome, plannedExpenses: plannedExpenses,
                                reviewItems: reviewItems, relevantTransactions: relevantTransactions)
                    }
                }
                .padding(16)
            }
            .pageBackground()

            .navigationTitle(greeting)
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { HamburgerButton() }
                ToolbarItem(placement: .topBarTrailing) { SyncButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Edit Home", systemImage: "slider.horizontal.3") { showCustomize = true }
                        Button("Settings", systemImage: "gearshape") { showSettings = true }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showCustomize) { DashboardCustomizeView(layoutRows: $layoutRows) }
            .onAppear { layoutRows = DashboardLayoutStore.load() }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }

    @ViewBuilder
    private func cardView(for card: DashboardCard, ledger: Ledger, thisMonth: DateInterval, month: MonthSummary,
                          plan: BudgetPlan, plannedIncome: Double, plannedExpenses: Double,
                          reviewItems: [LocalTransaction], relevantTransactions: [LocalTransaction]) -> some View {
        switch card {
        case .review:
            if !reviewItems.isEmpty {
                ReviewPreviewCard(items: reviewItems, ledger: ledger)
            }
        case .budget:
            BudgetSummaryCard(month: thisMonth, summary: month, plannedIncome: plannedIncome, plannedExpenses: plannedExpenses)
        case .recurring:
            RecurringCard()
        case .transactions:
            VStack(alignment: .leading, spacing: 12) {
                CardHeader(title: "Transactions") {
                    Button("See all") { app.selectedTab = .transactions }
                        .font(.subheadline.weight(.medium))
                }
                let recent = relevantTransactions.filter { !$0.isHidden && ledger.isVisible($0) }.prefix(5)
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
    }
}

/// A card on the Dashboard the user can reorder or hide from "Edit Home".
enum DashboardCard: String, CaseIterable, Identifiable {
    case review, budget, recurring, transactions
    var id: String { rawValue }

    var title: String {
        switch self {
        case .review: "To Review"
        case .budget: "Budget"
        case .recurring: "Recurring"
        case .transactions: "Recent Transactions"
        }
    }

    var subtitle: String {
        switch self {
        case .review: "Transactions waiting for a category"
        case .budget: "Income and expenses vs. planned"
        case .recurring: "Bills, subscriptions, and paychecks"
        case .transactions: "Last 5"
        }
    }

    var icon: String {
        switch self {
        case .review: "checkmark.square"
        case .budget: "map"
        case .recurring: "arrow.triangle.2.circlepath"
        case .transactions: "list.bullet"
        }
    }
}

struct DashboardLayoutRow: Codable, Identifiable, Equatable {
    var id: String { cardId }
    var cardId: String
    var sortOrder: Int
    var isHidden: Bool

    init(cardId: String, sortOrder: Int, isHidden: Bool = false) {
        self.cardId = cardId
        self.sortOrder = sortOrder
        self.isHidden = isHidden
    }
}

enum DashboardLayoutStore {
    private static let key = "dashboardLayout_v1"

    static func load() -> [DashboardLayoutRow] {
        if let data = UserDefaults.standard.data(forKey: key),
           let list = try? JSONDecoder().decode([DashboardLayoutRow].self, from: data) {
            return ensureSeeded(existing: list)
        }
        return defaultRows()
    }

    static func save(_ rows: [DashboardLayoutRow]) {
        if let data = try? JSONEncoder().encode(rows) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private static func defaultRows() -> [DashboardLayoutRow] {
        DashboardCard.allCases.enumerated().map { idx, card in
            DashboardLayoutRow(cardId: card.rawValue, sortOrder: idx, isHidden: false)
        }
    }

    private static func ensureSeeded(existing: [DashboardLayoutRow]) -> [DashboardLayoutRow] {
        // Drop cards that were retired (Modules moved to Today).
        var rows = existing.filter { DashboardCard(rawValue: $0.cardId) != nil }
        let known = Set(rows.map(\.cardId))
        let missing = DashboardCard.allCases.filter { !known.contains($0.rawValue) }
        var nextOrder = (rows.map(\.sortOrder).max() ?? -1) + 1
        for card in missing {
            rows.append(DashboardLayoutRow(cardId: card.rawValue, sortOrder: nextOrder, isHidden: false))
            nextOrder += 1
        }
        return rows.sorted { $0.sortOrder < $1.sortOrder }
    }
}

/// "Edit Home": drag to reorder, toggle to show/hide.
struct DashboardCustomizeView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var layoutRows: [DashboardLayoutRow]
    @State private var movedPulse = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach($layoutRows) { $row in
                        if let card = DashboardCard(rawValue: row.cardId) {
                            Toggle(isOn: Binding(get: { !row.isHidden }, set: {
                                row.isHidden = !$0
                                DashboardLayoutStore.save(layoutRows)
                            })) {
                                Label {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(card.title).foregroundStyle(Theme.text)
                                        Text(card.subtitle).font(.caption).foregroundStyle(Theme.textTertiary)
                                    }
                                } icon: {
                                    Image(systemName: card.icon).foregroundStyle(Theme.brand)
                                }
                            }
                        }
                    }
                    .onMove { from, to in
                        layoutRows.move(fromOffsets: from, toOffset: to)
                        for (i, _) in layoutRows.enumerated() { layoutRows[i].sortOrder = i }
                        DashboardLayoutStore.save(layoutRows)
                        movedPulse.toggle()
                    }
                } footer: {
                    Text("Drag to reorder. Turn off what you don't use.")
                }
            }
            .environment(\.editMode, .constant(.active))
            .sensoryFeedback(.selection, trigger: movedPulse)
            .navigationTitle("Edit Home")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

/// Income vs. planned and expenses vs. planned, like the web dashboard.
struct BudgetSummaryCard: View {
    let month: DateInterval
    let summary: MonthSummary
    let plannedIncome: Double
    let plannedExpenses: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            NavigationLink {
                BudgetView()
            } label: {
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

/// Cumulative spend this month against a dashed "usual pace" line — the one
/// number that answers "am I on track?" The line follows how a month
/// normally goes (bills on their days, the rest by weekday habits; see
/// `SpendingPace`) and ends at all planned expenses — or, with three to six
/// full months of history, is the average of those months. Last month's
/// running total is drawn behind both for comparison.
struct SpendingCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger
    let month: DateInterval
    let target: Double
    let recurring: [RecurringItem]

    var body: some View {
        let current = cumulativeSpending(transactions, in: month, through: .now,
                                         categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let lastMonth = DateInterval.month(containing: Calendar.current.date(byAdding: .month, value: -1, to: month.start)!)
        let previous = cumulativeSpending(transactions, in: lastMonth,
                                          categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let spent = current.last?.value ?? 0
        let lastAtSameDay = previous.indices.contains(current.count - 1) ? previous[current.count - 1].value : (previous.last?.value ?? 0)
        let daysInMonth = Calendar.current.range(of: .day, in: .month, for: month.start)?.count ?? 30
        let dayOfMonth = min(current.count, daysInMonth)
        let pace = SpendingPace(target: target, month: month, items: recurring, transactions: transactions, ledger: ledger)
        let expectedToday = target > 0 && dayOfMonth > 0 ? pace.expected[min(dayOfMonth, pace.expected.count) - 1] : 0
        let paceDiff = expectedToday - spent
        let over = target > 0 && spent > target
        let tint = over ? Theme.expense : Theme.income

        VStack(alignment: .leading, spacing: 10) {
            CardHeader(title: "Spending", subtitle: month.start.formatted(.dateTime.month(.wide)))
            if target > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(abs(target - spent).currency(cents: false)) \(over ? "over" : "left")")
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
                ForEach(Array(([0.0] + previous.map(\.value)).enumerated()).dropFirst(target > 0 ? 0 : 1), id: \.offset) { day, value in
                    LineMark(x: .value("Day", day), y: .value("Spent", value), series: .value("Series", "Last month"))
                        .foregroundStyle(Theme.lastMonth)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                        .interpolationMethod(.stepEnd)
                }
                if target > 0 {
                    // Starts from 0 before the 1st so a bill on day 1 shows as a step.
                    ForEach(Array(([0.0] + pace.expected).enumerated()), id: \.offset) { day, value in
                        LineMark(x: .value("Day", day), y: .value("Pace", value), series: .value("Series", "Pace"))
                            .foregroundStyle(Theme.textTertiary)
                            .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                            .interpolationMethod(.monotone)
                    }
                }
                // Same 0 start as the pace line, so day-1 bills read as a step in both.
                ForEach(Array(([0.0] + current.map(\.value)).enumerated()).dropFirst(target > 0 ? 0 : 1), id: \.offset) { day, value in
                    AreaMark(x: .value("Day", day), y: .value("Spent", value))
                        .foregroundStyle(LinearGradient(colors: [tint.opacity(0.18), tint.opacity(0)],
                                                        startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.monotone)
                    LineMark(x: .value("Day", day), y: .value("Spent", value), series: .value("Series", "Actual"))
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
            .chartXScale(domain: (target > 0 ? 0 : 1)...max(daysInMonth, previous.count, 2))
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
                LegendDot(color: tint, label: "This month")
                if target > 0 { LegendDot(color: Theme.textTertiary, label: "Usual pace") }
                LegendDot(color: Theme.lastMonth, label: "Last month")
            }
            .frame(maxWidth: .infinity)

            if target > 0 {
                Text("\(abs(paceDiff).currency(cents: false)) \(paceDiff >= 0 ? "under" : "over") your usual pace")
                    .font(.footnote.weight(.medium)).foregroundStyle(Theme.textSecondary)
            }
            if lastAtSameDay > 0 {
                let diff = spent - lastAtSameDay
                Text("\(abs(diff).currency(cents: false)) \(diff <= 0 ? "less" : "more") than this time last month")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(diff <= 0 ? Theme.income : Theme.expense)
            }
            if target > 0 {
                Text(paceCaption(pace))
                    .font(.caption).foregroundStyle(Theme.textTertiary)
            } else {
                Text("Set a budget on the Budget tab to see your pace this month.")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
        .card()
    }

    /// What shaped the dashed line, so it doesn't feel arbitrary.
    private func paceCaption(_ pace: SpendingPace) -> String {
        if let average = pace.monthlyAverage {
            return "Dashed line: your average of the last \(pace.averagedMonths) months (\(average.currency(cents: false)) a month)"
        }
        let bills = pace.bills > 0 ? "\(pace.bills.currency(cents: false)) of bills on their usual days" : nil
        let rest = pace.usesHabits ? "the rest by how you spend on each weekday" : "the rest spread evenly"
        return "Dashed line: " + [bills, rest].compactMap { $0 }.joined(separator: ", ")
    }
}

/// A few transactions waiting on a category, with a way into the review queue.
/// No bulk "mark all as reviewed": each one gets confirmed on its own.
struct ReviewPreviewCard: View {
    @Environment(AppModel.self) private var app
    let items: [LocalTransaction]
    let ledger: Ledger

    var body: some View {
        VStack(spacing: Space.s) {
            SectionBand(title: "Needs review", summary: "Transactions waiting for a category",
                        badge: .number(items.count))
            VStack(spacing: 0) {
                ForEach(Array(items.prefix(4).enumerated()), id: \.element.id) { index, tx in
                    if index > 0 { ItemRowDivider() }
                    TransactionRow(transaction: tx, category: ledger.category(for: tx), quickEdit: false)
                }
                Button("Review all") { app.showReview = true }
                    .buttonStyle(.wooliPrimary)
                    .padding(.top, Space.s)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .card()
        }
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

/// Bank and iCloud sync status. Its own view so status changes (iCloud
/// reports several per sync) redraw this line, not every Dashboard card.
private struct SyncStatusLine: View {
    @Environment(AppModel.self) private var app
    private var cloud = ICloudSyncMonitor.shared

    var body: some View {
        if app.mode == .live {
            HStack(spacing: 12) {
                Spacer()
                if let lastSyncAt = app.lastSyncAt {
                    HStack(spacing: 4) {
                        Image(systemName: "building.columns")
                        Text(app.isSyncing ? "Bank syncing…" : "Bank: \(lastSyncAt.formatted(.relative(presentation: .named)))")
                    }
                }
                HStack(spacing: 4) {
                    Image(systemName: cloud.iconName)
                        .symbolEffect(.pulse, isActive: cloud.isSyncing)
                    Text(cloud.shortLabel)
                }
                .foregroundStyle(cloud.statusColor)
            }
            .font(.caption2)
            .foregroundStyle(Theme.textTertiary)
            .contentTransition(.numericText())
        }
    }
}
