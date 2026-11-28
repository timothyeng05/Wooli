import SwiftUI
import SwiftData
import Charts

struct ReportsView: View {
    enum ReportTab: String, CaseIterable, Identifiable {
        case cashFlow = "Cash Flow"
        case spending = "Spending"
        case income = "Income"
        case forecast = "Forecast"
        var id: String { rawValue }
    }

    enum Period: String, CaseIterable, Identifiable {
        case thisMonth = "This month", lastMonth = "Last month", last3 = "Last 3 months",
             last6 = "Last 6 months", thisYear = "This year"
        var id: String { rawValue }

        var interval: DateInterval {
            let cal = Calendar.current
            let now = Date.now
            let monthStart = cal.dateInterval(of: .month, for: now)!.start
            switch self {
            case .thisMonth: return cal.dateInterval(of: .month, for: now)!
            case .lastMonth: return cal.dateInterval(of: .month, for: cal.date(byAdding: .month, value: -1, to: now)!)!
            case .last3: return DateInterval(start: cal.date(byAdding: .month, value: -2, to: monthStart)!, end: now)
            case .last6: return DateInterval(start: cal.date(byAdding: .month, value: -5, to: monthStart)!, end: now)
            case .thisYear: return DateInterval(start: cal.dateInterval(of: .year, for: now)!.start, end: now)
            }
        }
    }

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @Query(sort: \Person.name) private var people: [Person]
    @State private var selectedPersonId: String? = nil
    @State private var tab: ReportTab = .cashFlow
    @State private var period: Period = .thisMonth

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let visibleAccountIds = Set(accounts.filter { $0.counts(forPerson: selectedPersonId) }.map(\.providerAccountId))
        let relevantTransactions = transactions.filter { visibleAccountIds.contains($0.accountId) && !$0.isSplit }
        let summary = MonthSummary(transactions: relevantTransactions, in: period.interval,
                                   categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let periodTransactions = relevantTransactions.filter {
            period.interval.contains($0.transactedAt) && !$0.isHidden && !$0.isTransfer && ledger.isVisible($0)
        }

        NavigationStack {
            VStack(spacing: 0) {
                // Sub-tabs header
                HStack(spacing: 10) {
                    HStack(spacing: 4) {
                        ForEach(ReportTab.allCases) { item in
                            Button {
                                withAnimation(.snappy) { tab = item }
                            } label: {
                                Text(item.rawValue)
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 6)
                                    .background(tab == item ? FieldNotes.ink : FieldNotes.pillBg, in: Capsule())
                                    .foregroundStyle(tab == item ? FieldNotes.paper : FieldNotes.inkSecondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Spacer()
                    if tab != .forecast {
                        if !people.isEmpty {
                            Picker("Person", selection: $selectedPersonId) {
                                Text("Everyone").tag(String?.none)
                                ForEach(people) { person in
                                    Text("\(person.name)").tag(String?.some(person.id))
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(maxWidth: 140)
                        }
                        Picker("Period", selection: $period) {
                            ForEach(Period.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: 160)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(FieldNotes.paperAlt)

                Divider().overlay(FieldNotes.border)

                if tab == .forecast {
                    ForecastView()
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            HStack(spacing: 12) {
                                StatTile(label: "Income", value: summary.income, tint: Theme.income)
                                StatTile(label: "Spending", value: summary.spending, tint: Theme.expense)
                                StatTile(label: "Saved", value: summary.net, tint: summary.net >= 0 ? FieldNotes.forest : Theme.expense)
                            }

                            switch tab {
                            case .cashFlow:
                                CashFlowCard(transactions: relevantTransactions, ledger: ledger)
                                ReportsSummarySection(summary: summary, transactions: periodTransactions)
                                EmbeddedFilteredTransactionsCard(
                                    title: "Transactions · \(period.rawValue)",
                                    transactions: periodTransactions,
                                    ledger: ledger
                                )
                            case .spending:
                                let spendingTxs = periodTransactions.filter { $0.amount < 0 }
                                WideColumns(sideWidth: 420) {
                                    SpendingBreakdownCard(summary: summary, ledger: ledger, interval: period.interval)
                                } side: {
                                    TopMerchantsCard(transactions: relevantTransactions, interval: period.interval, ledger: ledger)
                                    TagsReportCard(transactions: relevantTransactions, interval: period.interval, ledger: ledger)
                                }
                                ReportsSummarySection(summary: summary, transactions: spendingTxs)
                                EmbeddedFilteredTransactionsCard(
                                    title: "Spending Transactions · \(period.rawValue)",
                                    transactions: spendingTxs,
                                    ledger: ledger
                                )
                            case .income:
                                let incomeTxs = periodTransactions.filter { $0.amount > 0 }
                                IncomeBreakdownCard(transactions: incomeTxs, ledger: ledger)
                                ReportsSummarySection(summary: summary, transactions: incomeTxs)
                                EmbeddedFilteredTransactionsCard(
                                    title: "Income Transactions · \(period.rawValue)",
                                    transactions: incomeTxs,
                                    ledger: ledger
                                )
                            case .forecast:
                                EmptyView()
                            }
                        }
                        .padding(16)
                    }
                    .scrollContentBackground(.hidden)
                    .background(FieldNotes.paper)
                }
            }
            .navigationTitle("Reports")
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { HamburgerButton() }
            }
        }
    }
}

private struct StatTile: View {
    let label: String
    let value: Double
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionLabel(label)
            Text(value.currency(cents: false))
                .font(.headline).monospacedDigit()
                .foregroundStyle(tint)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .card(padding: 14)
    }
}

private struct CashFlowCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger

    private struct Bar: Identifiable {
        let month: Date
        let kind: String
        let value: Double
        var id: String { "\(month.timeIntervalSince1970)-\(kind)" }
    }

    var body: some View {
        let cal = Calendar.current
        let thisMonth = cal.dateInterval(of: .month, for: .now)!.start
        let months = (0..<6).reversed().map { cal.date(byAdding: .month, value: -$0, to: thisMonth)! }
        // One pass to the last six months, not six passes over years of history.
        let recent = transactions.filter { $0.transactedAt >= months[0] }
        let summaries = months.map { start in
            (start, MonthSummary(transactions: recent, in: .month(containing: start),
                                 categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts))
        }
        let bars = summaries.flatMap { month, s in
            [Bar(month: month, kind: "Income", value: s.income), Bar(month: month, kind: "Expenses", value: s.spending)]
        }
        let totalIncome = summaries.reduce(0) { $0 + $1.1.income }
        let totalSaved = summaries.reduce(0) { $0 + $1.1.net }

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Cash flow", subtitle: "Last 6 months")
            Chart(bars) { bar in
                BarMark(x: .value("Month", bar.month, unit: .month), y: .value("Amount", bar.value))
                    .foregroundStyle(by: .value("Type", bar.kind))
                    .position(by: .value("Type", bar.kind))
                    .cornerRadius(3)
            }
            .chartForegroundStyleScale(["Income": Theme.income, "Expenses": Theme.expense])
            .chartXAxis {
                AxisMarks(values: .stride(by: .month)) { _ in
                    AxisValueLabel(format: .dateTime.month(.abbreviated), centered: true)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 4)) { value in
                    AxisGridLine().foregroundStyle(Theme.border)
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text(v.formatted(.currency(code: "USD").notation(.compactName))) }
                    }
                }
            }
            .chartLegend(position: .bottom)
            .frame(height: 200)

            if totalIncome > 0 {
                HStack {
                    Text("Saved \(totalSaved.currency(cents: false))")
                    Spacer()
                    Text("Savings rate \((totalSaved / totalIncome).formatted(.percent.precision(.fractionLength(0))))")
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.textSecondary)
            }
        }
        .card()
    }
}

private struct SpendingBreakdownCard: View {
    let summary: MonthSummary
    let ledger: Ledger
    let interval: DateInterval

    private struct Slice: Identifiable {
        let id: String
        let name: String
        let icon: String
        let color: Color
        let amount: Double
        /// Nil for the "Uncategorized" slice — nothing to drill into there.
        let category: BudgetCategory?
    }

    var body: some View {
        let slices = summary.spendingByGroup.filter { $0.value > 0 }.sorted { $0.value > $1.value }.map { key, value in
            let c = key.flatMap { ledger.categoriesById[$0] }
            return Slice(id: key ?? "none", name: c?.name ?? "Uncategorized", icon: c?.icon ?? "❓",
                         color: c.map { Color(hex: $0.colorHex) } ?? Color(.systemGray3), amount: value, category: c)
        }
        let total = slices.reduce(0) { $0 + $1.amount }

        VStack(alignment: .leading, spacing: 16) {
            CardHeader(title: "Spending by category")
            if slices.isEmpty {
                Text("No spending in this period").font(.subheadline).foregroundStyle(Theme.textTertiary)
            } else {
                ZStack {
                    Chart(slices) { slice in
                        SectorMark(angle: .value("Spent", slice.amount), innerRadius: .ratio(0.65), angularInset: 1.5)
                            .cornerRadius(4)
                            .foregroundStyle(slice.color)
                    }
                    VStack(spacing: 2) {
                        Text("Total").font(.caption).foregroundStyle(Theme.textTertiary)
                        Text(total.currency(cents: false)).font(.title3.weight(.bold)).monospacedDigit()
                    }
                }
                .frame(height: 200)

                VStack(spacing: 12) {
                    ForEach(slices) { slice in
                        if let category = slice.category {
                            NavigationLink {
                                CategoryBudgetView(group: category, month: interval)
                            } label: {
                                sliceRow(slice, total: total)
                            }
                            .buttonStyle(.plain)
                        } else {
                            sliceRow(slice, total: total)
                        }
                    }
                }
            }
        }
        .card()
    }

    @ViewBuilder
    private func sliceRow(_ slice: Slice, total: Double) -> some View {
        VStack(spacing: 6) {
            HStack {
                Text(slice.icon)
                Text(slice.name).font(.subheadline.weight(.medium)).foregroundStyle(Theme.text)
                Spacer()
                Text((slice.amount / total).formatted(.percent.precision(.fractionLength(0))))
                    .font(.footnote).foregroundStyle(Theme.textTertiary)
                Text(slice.amount.currency(cents: false))
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                    .frame(minWidth: 70, alignment: .trailing)
                if slice.category != nil {
                    Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                }
            }
            BarGauge(value: slice.amount, total: total, tint: slice.color, height: 6)
        }
    }
}

private struct TopMerchantsCard: View {
    let transactions: [LocalTransaction]
    let interval: DateInterval
    let ledger: Ledger

    var body: some View {
        let spending = transactions.filter {
            interval.contains($0.transactedAt) && $0.amount < 0 && !$0.isHidden && !$0.isTransfer && ledger.isVisible($0)
        }
        let merchants = Dictionary(grouping: spending, by: \.title)
            .map { (name: $0.key, total: -$0.value.reduce(0) { $0 + $1.amount }, count: $0.value.count,
                    category: $0.value.first.flatMap { ledger.category(for: $0) }) }
            .sorted { $0.total > $1.total }
            .prefix(8)

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Top merchants")
            if merchants.isEmpty {
                Text("No spending in this period").font(.subheadline).foregroundStyle(Theme.textTertiary)
            }
            ForEach(Array(merchants.enumerated()), id: \.offset) { _, m in
                HStack(spacing: 12) {
                    CategoryTile(category: m.category, size: 36)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(m.name).font(.subheadline.weight(.medium)).foregroundStyle(FieldNotes.ink).lineLimit(1)
                        Text("\(m.count) transaction\(m.count == 1 ? "" : "s")").font(.caption).foregroundStyle(FieldNotes.inkTertiary)
                    }
                    Spacer()
                    Text(m.total.currency()).font(.subheadline.weight(.semibold)).monospacedDigit()
                }
            }
        }
        .card()
    }
}

private struct IncomeBreakdownCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger

    var body: some View {
        let byCategory = Dictionary(grouping: transactions) { $0.categoryId ?? "uncategorized" }
            .map { id, items in
                (id: id, category: ledger.categoriesById[id], total: items.reduce(0) { $0 + $1.amount }, count: items.count)
            }
            .sorted { $0.total > $1.total }
        let maxVal = max(byCategory.first?.total ?? 1, 1)

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Income by category")
            if byCategory.isEmpty {
                Text("No income in this period").font(.subheadline).foregroundStyle(FieldNotes.inkTertiary)
            } else {
                ForEach(byCategory, id: \.id) { entry in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text("\(entry.category?.icon ?? "💵") \(entry.category?.name ?? "Uncategorized")")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(FieldNotes.ink)
                            Spacer()
                            Text("\(entry.count) tx")
                                .font(.caption)
                                .foregroundStyle(FieldNotes.inkTertiary)
                            Text(entry.total.currency(cents: false))
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                                .foregroundStyle(Theme.income)
                        }
                        BarGauge(value: entry.total, total: maxVal, tint: Theme.income, height: 6)
                    }
                }
            }
        }
        .card()
    }
}

private struct ReportsSummarySection: View {
    let summary: MonthSummary
    let transactions: [LocalTransaction]

    var body: some View {
        let count = transactions.count
        let avgSize = count > 0 ? transactions.reduce(0) { $0 + abs($1.amount) } / Double(count) : 0
        let savingsRate = summary.income > 0 ? summary.net / summary.income : 0

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Summary")
            HStack(spacing: 16) {
                summaryMetric("Transactions", "\(count)")
                Divider().frame(height: 32)
                summaryMetric("Avg transaction", avgSize.currency(cents: false))
                Divider().frame(height: 32)
                summaryMetric("Net cash flow", summary.net.signedCurrency())
                Divider().frame(height: 32)
                summaryMetric("Savings rate", summary.income > 0 ? savingsRate.formatted(.percent.precision(.fractionLength(0))) : "—")
            }
        }
        .card()
    }

    private func summaryMetric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.bold))
                .tracking(0.8)
                .foregroundStyle(FieldNotes.inkTertiary)
            Text(value)
                .font(.headline.monospacedDigit())
                .foregroundStyle(FieldNotes.ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct EmbeddedFilteredTransactionsCard: View {
    let title: String
    let transactions: [LocalTransaction]
    let ledger: Ledger

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: title, subtitle: "\(transactions.count) matching")
            if transactions.isEmpty {
                Text("No transactions in this period")
                    .font(.subheadline)
                    .foregroundStyle(FieldNotes.inkTertiary)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(transactions.prefix(25).enumerated()), id: \.element.id) { idx, tx in
                        if idx > 0 { Divider().overlay(FieldNotes.border) }
                        NavigationLink {
                            TransactionDetailView(transaction: tx)
                        } label: {
                            TransactionRow(transaction: tx, category: ledger.category(for: tx),
                                           accountName: ledger.accountNames[tx.accountId], quickEdit: false)
                                .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .card()
    }
}
