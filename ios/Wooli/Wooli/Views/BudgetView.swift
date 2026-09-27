import SwiftUI
import SwiftData
import Charts

struct BudgetView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @State private var month = DateInterval.month(containing: .now)

    private var isCurrentMonth: Bool { month.contains(.now) }

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let summary = MonthSummary(transactions: transactions, in: month,
                                   categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let groups = categories.filter { $0.parentId == nil && $0.isExpense }
        let incomeGroups = categories.filter { $0.parentId == nil && $0.isIncome }
        let plannedIncome = incomeGroups.reduce(0) { $0 + $1.monthlyTarget }
        let plannedExpenses = groups.reduce(0) { $0 + $1.monthlyTarget }

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    // Left to spend
                    VStack(alignment: .leading, spacing: 10) {
                        if plannedExpenses > 0 {
                            let left = plannedExpenses - summary.spending
                            SectionLabel(left >= 0 ? "Left to spend" : "Over budget")
                            Text(abs(left).currency(cents: false))
                                .font(.system(size: 34, weight: .bold)).monospacedDigit()
                                .foregroundStyle(left >= 0 ? Theme.text : Theme.expense)
                            BarGauge(value: summary.spending, total: plannedExpenses,
                                     tint: left >= 0 ? Theme.brand : Theme.expense, height: 10)
                            Text("\(summary.spending.currency(cents: false)) spent of \(plannedExpenses.currency(cents: false)) planned")
                                .font(.footnote).foregroundStyle(Theme.textSecondary)
                        } else {
                            SectionLabel("Spent")
                            Text(summary.spending.currency(cents: false))
                                .font(.system(size: 34, weight: .bold)).monospacedDigit()
                            Text("Tap a category below to plan a monthly amount.")
                                .font(.footnote).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .card()

                    // Income
                    VStack(alignment: .leading, spacing: 14) {
                        CardHeader(title: "Income")
                        ForEach(incomeGroups) { group in
                            NavigationLink {
                                CategoryBudgetView(group: group, month: month)
                            } label: {
                                PlanRow(title: "\(group.icon)  \(group.name)", actual: summary.income, planned: group.monthlyTarget,
                                        tint: Theme.income, actualLabel: "earned", isIncome: true)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card()

                    // Expenses
                    VStack(alignment: .leading, spacing: 4) {
                        CardHeader(title: "Expenses").padding(.bottom, 10)
                        ForEach(groups) { group in
                            NavigationLink {
                                CategoryBudgetView(group: group, month: month)
                            } label: {
                                BudgetRow(icon: group.icon, name: group.name, color: Color(hex: group.colorHex),
                                          spent: summary.spendingByGroup[group.id] ?? 0, target: group.monthlyTarget)
                            }
                            .buttonStyle(.plain)
                            if group.id != groups.last?.id { Divider().overlay(Theme.border) }
                        }
                        if let uncategorized = summary.spendingByGroup[nil], uncategorized > 0 {
                            Divider().overlay(Theme.border)
                            Button { app.showReview = true } label: {
                                BudgetRow(icon: "❓", name: "Uncategorized", color: Color(.systemGray3),
                                          spent: uncategorized, target: 0)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .card()

                    // History
                    SpendingHistoryCard(transactions: transactions, ledger: ledger, month: month, target: plannedExpenses)
                }
                .padding(16)
            }
            .pageBackground()
            .navigationTitle(month.start.formatted(.dateTime.month(.wide).year()))
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Previous Month", systemImage: "chevron.left") { shift(-1) }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        NavigationLink { CategoriesSettingsView() } label: { Label("Edit Categories", systemImage: "square.grid.2x2") }
                        NavigationLink { RulesView() } label: { Label("Rules", systemImage: "wand.and.stars") }
                    } label: {
                        Label("More", systemImage: "ellipsis")
                    }
                    if !isCurrentMonth {
                        Button("Today") { withAnimation { month = .month(containing: .now) } }
                    }
                    Button("Next Month", systemImage: "chevron.right") { shift(1) }
                        .disabled(isCurrentMonth)
                }
            }
        }
    }

    private func shift(_ months: Int) {
        let start = Calendar.current.date(byAdding: .month, value: months, to: month.start)!
        withAnimation { month = .month(containing: start) }
    }
}

private struct BudgetRow: View {
    let icon: String
    let name: String
    let color: Color
    let spent: Double
    let target: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Text(icon)
                    .frame(width: 32, height: 32)
                    .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(name).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text(spent.currency(cents: false)).font(.subheadline.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(target > 0 && spent > target ? Theme.expense : Theme.text)
                    if target > 0 {
                        let left = target - spent
                        Text(left >= 0 ? "\(left.currency(cents: false)) left" : "\(abs(left).currency(cents: false)) over")
                            .font(.caption).foregroundStyle(left >= 0 ? Theme.textTertiary : Theme.expense)
                    }
                }
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary)
            }
            if target > 0 {
                BarGauge(value: max(spent, 0), total: target, tint: spent > target ? Theme.expense : color, height: 6)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

private struct SpendingHistoryCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger
    let month: DateInterval
    let target: Double

    var body: some View {
        let history = (0..<6).reversed().map { offset -> (Date, Double) in
            let start = Calendar.current.date(byAdding: .month, value: -offset, to: month.start)!
            return (start, MonthSummary(transactions: transactions, in: .month(containing: start),
                                        categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts).spending)
        }

        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Spending", subtitle: "Last 6 months")
            Chart(history, id: \.0) { start, spent in
                BarMark(x: .value("Month", start, unit: .month), y: .value("Spent", spent))
                    .foregroundStyle(start == month.start ? Theme.brand : Theme.brand.opacity(0.3))
                    .cornerRadius(4)
                if target > 0 {
                    RuleMark(y: .value("Planned", target))
                        .foregroundStyle(Theme.textTertiary)
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                }
            }
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
            .frame(height: 160)
        }
        .card()
    }
}

/// One category group for a month: planned amount, breakdown, and transactions.
struct CategoryBudgetView: View {
    @Bindable var group: BudgetCategory
    let month: DateInterval

    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let summary = MonthSummary(transactions: transactions, in: month,
                                   categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let children = categories.filter { $0.parentId == group.id }
        let memberIds = Set(children.map(\.id) + [group.id])
        let items = transactions.filter {
            month.contains($0.transactedAt) && !$0.isHidden && ledger.isVisible($0)
                && $0.categoryId.map(memberIds.contains) == true
        }
        let actual = group.isIncome ? items.reduce(0) { $0 + $1.amount } : (summary.spendingByGroup[group.id] ?? 0)

        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionLabel(group.isIncome ? "Earned" : "Spent")
                    Text(actual.currency())
                        .font(.system(size: 32, weight: .bold)).monospacedDigit().foregroundStyle(Theme.text)
                    if group.monthlyTarget > 0 {
                        BarGauge(value: actual, total: group.monthlyTarget,
                                 tint: group.isIncome ? Theme.income : (actual > group.monthlyTarget ? Theme.expense : Color(hex: group.colorHex)))
                    }
                    Divider().padding(.vertical, 4)
                    LabeledContent("Planned each month") {
                        TextField("None", value: $group.monthlyTarget, format: .currency(code: "USD").precision(.fractionLength(0)))
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 140)
                            .font(.body.weight(.semibold))
                    }
                    .foregroundStyle(Theme.text)
                }
                .card()

                if !children.isEmpty && !group.isIncome {
                    VStack(alignment: .leading, spacing: 12) {
                        CardHeader(title: "Breakdown")
                        ForEach(children) { child in
                            HStack {
                                Text("\(child.icon)  \(child.name)").foregroundStyle(Theme.text)
                                Spacer()
                                Text((summary.spendingByCategory[child.id] ?? 0).currency())
                                    .monospacedDigit().foregroundStyle(Theme.textSecondary)
                            }
                            .font(.subheadline)
                        }
                    }
                    .card()
                }

                VStack(alignment: .leading, spacing: 12) {
                    CardHeader(title: "Transactions")
                    if items.isEmpty {
                        Text("Nothing this month").font(.subheadline).foregroundStyle(Theme.textTertiary)
                    }
                    ForEach(items) { tx in
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
        .navigationTitle("\(group.icon) \(group.name)")
        .navigationBarTitleDisplayMode(.inline)
    }
}
