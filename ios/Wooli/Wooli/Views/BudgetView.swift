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
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter(\.isHidden).map(\.providerAccountId))
        let summary = MonthSummary(transactions: transactions, in: month, categories: byId, hiddenAccounts: hidden)
        let groups = categories.filter { $0.parentId == nil && $0.isExpense }
        let totalTarget = groups.reduce(0) { $0 + $1.monthlyTarget }
        let history = (0..<6).reversed().map { offset -> (Date, Double) in
            let start = Calendar.current.date(byAdding: .month, value: -offset, to: month.start)!
            let interval = DateInterval.month(containing: start)
            return (start, MonthSummary(transactions: transactions, in: interval, categories: byId, hiddenAccounts: hidden).spending)
        }

        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        if totalTarget > 0 {
                            let left = totalTarget - summary.spending
                            Text(left >= 0 ? "Left to Spend" : "Over Budget")
                                .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                            Text(abs(left).currency(cents: false))
                                .font(.system(.largeTitle, design: .rounded).weight(.bold)).monospacedDigit()
                                .foregroundStyle(left >= 0 ? Color.primary : Color.red)
                            ProgressView(value: min(summary.spending, totalTarget), total: totalTarget)
                                .tint(left >= 0 ? .accentColor : .red)
                            Text("\(summary.spending.currency(cents: false)) spent of \(totalTarget.currency(cents: false))")
                                .font(.footnote).foregroundStyle(.secondary)
                        } else {
                            Text("Spent").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                            Text(summary.spending.currency(cents: false))
                                .font(.system(.largeTitle, design: .rounded).weight(.bold)).monospacedDigit()
                            Text("Tap a category below to set a monthly target.")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section("Last 6 Months") {
                    Chart(history, id: \.0) { start, spent in
                        BarMark(x: .value("Month", start, unit: .month), y: .value("Spent", spent))
                            .foregroundStyle(start == month.start ? Color.accentColor : Color.accentColor.opacity(0.35))
                            .cornerRadius(4)
                        if totalTarget > 0 {
                            RuleMark(y: .value("Target", totalTarget))
                                .foregroundStyle(.secondary)
                                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        }
                    }
                    .chartXAxis {
                        AxisMarks(values: .stride(by: .month)) { _ in
                            AxisValueLabel(format: .dateTime.month(.narrow), centered: true)
                        }
                    }
                    .chartYAxis {
                        AxisMarks(position: .leading) { value in
                            AxisGridLine()
                            AxisValueLabel {
                                if let v = value.as(Double.self) { Text(v.formatted(.currency(code: "USD").notation(.compactName))) }
                            }
                        }
                    }
                    .frame(height: 150)
                    .padding(.vertical, 8)
                }

                Section("Categories") {
                    ForEach(groups) { group in
                        NavigationLink {
                            CategoryBudgetView(group: group, month: month)
                        } label: {
                            BudgetRow(icon: group.icon, name: group.name, color: Color(hex: group.colorHex),
                                      spent: summary.spendingByGroup[group.id] ?? 0, target: group.monthlyTarget)
                        }
                    }
                    if let uncategorized = summary.spendingByGroup[nil], uncategorized > 0 {
                        NavigationLink {
                            TransactionsView(startInReview: true, embedded: true)
                        } label: {
                            BudgetRow(icon: "❓", name: "Uncategorized", color: .gray, spent: uncategorized, target: 0)
                        }
                    }
                }

                Section {
                    LabeledContent("Income", value: summary.income.currency())
                    LabeledContent("Spending", value: summary.spending.currency())
                    LabeledContent("Net") {
                        Text(summary.net.currency()).foregroundStyle(summary.net >= 0 ? .green : .red)
                    }
                } header: {
                    Text("Cash Flow")
                } footer: {
                    Text("Transfers and credit card payments aren't counted.")
                }
            }
            .navigationTitle(month.start.formatted(.dateTime.month(.wide).year()))
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItemGroup(placement: .topBarLeading) {
                    Button("Previous Month", systemImage: "chevron.left") { shift(-1) }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if !isCurrentMonth {
                        Button("This Month") { withAnimation { month = .month(containing: .now) } }
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
            HStack {
                Text(icon)
                Text(name).font(.body.weight(.medium))
                Spacer()
                if target > 0 {
                    Text("\(spent.currency(cents: false)) of \(target.currency(cents: false))")
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(spent > target ? .red : .secondary)
                } else {
                    Text(spent.currency(cents: false)).font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                }
            }
            if target > 0 {
                ProgressView(value: min(max(spent, 0), target), total: target)
                    .tint(spent > target ? .red : color)
            }
        }
        .padding(.vertical, 4)
    }
}

/// One category group for a month: its target, subcategory breakdown, and transactions.
struct CategoryBudgetView: View {
    @Bindable var group: BudgetCategory
    let month: DateInterval

    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter(\.isHidden).map(\.providerAccountId))
        let summary = MonthSummary(transactions: transactions, in: month, categories: byId, hiddenAccounts: hidden)
        let children = categories.filter { $0.parentId == group.id }
        let memberIds = Set(children.map(\.id) + [group.id])
        let items = transactions.filter {
            month.contains($0.transactedAt) && !$0.isHidden && !hidden.contains($0.accountId)
                && $0.categoryId.map(memberIds.contains) == true
        }
        let spent = summary.spendingByGroup[group.id] ?? 0

        List {
            Section {
                LabeledContent("Spent", value: spent.currency())
                LabeledContent("Monthly Target") {
                    TextField("None", value: $group.monthlyTarget, format: .currency(code: "USD").precision(.fractionLength(0)))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 140)
                }
            } footer: {
                Text("Targets apply to every month.")
            }

            if !children.isEmpty {
                Section("Breakdown") {
                    ForEach(children) { child in
                        LabeledContent {
                            Text((summary.spendingByCategory[child.id] ?? 0).currency())
                                .monospacedDigit()
                        } label: {
                            Text("\(child.icon)  \(child.name)")
                        }
                    }
                }
            }

            Section("Transactions") {
                if items.isEmpty {
                    Text("Nothing this month").foregroundStyle(.secondary)
                }
                ForEach(items) { tx in
                    NavigationLink {
                        TransactionDetailView(transaction: tx)
                    } label: {
                        TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] })
                    }
                }
            }
        }
        .navigationTitle("\(group.icon) \(group.name)")
        .navigationBarTitleDisplayMode(.inline)
    }
}
