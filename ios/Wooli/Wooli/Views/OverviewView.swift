import SwiftUI
import SwiftData
import Charts

struct OverviewView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query private var accounts: [LocalAccount]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var showSettings = false

    private var categoriesById: [String: BudgetCategory] {
        Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    }
    private var hiddenAccounts: Set<String> {
        Set(accounts.filter(\.isHidden).map(\.providerAccountId))
    }
    private var accountNames: [String: String] {
        Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
    }

    var body: some View {
        let byId = categoriesById
        let hidden = hiddenAccounts
        let visibleAccounts = accounts.filter { !$0.isHidden }
        let netWorth = visibleAccounts.reduce(0) { $0 + $1.netWorthValue }
        let assets = visibleAccounts.filter { $0.kind.isAsset }.reduce(0) { $0 + $1.balance }
        let debts = visibleAccounts.filter { !$0.kind.isAsset }.reduce(0) { $0 + abs($1.balance) }
        let month = MonthSummary(transactions: transactions, in: .month(containing: .now),
                                 categories: byId, hiddenAccounts: hidden)
        let target = categories.filter { $0.parentId == nil && $0.isExpense }.reduce(0) { $0 + $1.monthlyTarget }
        let reviewCount = transactions.filter { $0.needsReview && !$0.isHidden && !hidden.contains($0.accountId) }.count
        let recent = transactions.filter { !$0.isHidden && !hidden.contains($0.accountId) }.prefix(5)

        NavigationStack {
            List {
                if app.mode == .sample || app.syncError != nil {
                    Section { StatusBanner() }
                }

                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Net Worth").font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
                        Text(netWorth.currency())
                            .font(.system(.largeTitle, design: .rounded).weight(.bold))
                            .monospacedDigit()
                            .contentTransition(.numericText())
                        HStack(spacing: 16) {
                            Label(assets.currency(cents: false), systemImage: "arrow.up.right")
                                .foregroundStyle(.green)
                            Label(debts.currency(cents: false), systemImage: "arrow.down.right")
                                .foregroundStyle(.red)
                        }
                        .font(.subheadline.weight(.medium))
                        .labelStyle(CompactLabelStyle())
                    }
                    .padding(.vertical, 6)
                }

                Section {
                    MonthCard(summary: month, target: target, categories: byId)
                } header: {
                    Text(Date.now.formatted(.dateTime.month(.wide)))
                }

                if reviewCount > 0 {
                    Section {
                        NavigationLink {
                            TransactionsView(startInReview: true, embedded: true)
                        } label: {
                            HStack(spacing: 12) {
                                SymbolTile(symbol: "checklist", tint: .accentColor)
                                VStack(alignment: .leading) {
                                    Text("Review Transactions").font(.body.weight(.medium))
                                    Text("\(reviewCount) waiting for you").font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                if !recent.isEmpty {
                    Section("Recent Activity") {
                        ForEach(recent) { tx in
                            NavigationLink {
                                TransactionDetailView(transaction: tx)
                            } label: {
                                TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] },
                                               accountName: accountNames[tx.accountId])
                            }
                        }
                    }
                }
            }
            .navigationTitle("Overview")
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

/// Spent-vs-target progress plus a donut of where the money went.
private struct MonthCard: View {
    let summary: MonthSummary
    let target: Double
    let categories: [String: BudgetCategory]

    private struct Slice: Identifiable {
        let id: String
        let name: String
        let icon: String
        let color: Color
        let amount: Double
    }

    private var slices: [Slice] {
        let sorted = summary.spendingByGroup.filter { $0.value > 0 }.sorted { $0.value > $1.value }
        var result: [Slice] = sorted.prefix(5).map { key, value in
            let c = key.flatMap { categories[$0] }
            return Slice(id: key ?? "uncategorized", name: c?.name ?? "Uncategorized", icon: c?.icon ?? "❓",
                         color: c.map { Color(hex: $0.colorHex) } ?? Color(.systemGray), amount: value)
        }
        let rest = sorted.dropFirst(5).reduce(0) { $0 + $1.value }
        if rest > 0 { result.append(Slice(id: "rest", name: "Everything Else", icon: "•", color: Color(.systemGray4), amount: rest)) }
        return result
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Spent").font(.subheadline).foregroundStyle(.secondary)
                    Text(summary.spending.currency(cents: false))
                        .font(.system(.title, design: .rounded).weight(.semibold)).monospacedDigit()
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Income").font(.subheadline).foregroundStyle(.secondary)
                    Text(summary.income.currency(cents: false))
                        .font(.system(.title3, design: .rounded).weight(.semibold)).monospacedDigit()
                        .foregroundStyle(.green)
                }
            }

            if target > 0 {
                VStack(alignment: .leading, spacing: 6) {
                    ProgressView(value: min(summary.spending, target), total: target)
                        .tint(summary.spending > target ? .red : .accentColor)
                    let left = target - summary.spending
                    Text(left >= 0 ? "\(left.currency(cents: false)) left of \(target.currency(cents: false))"
                                   : "\(abs(left).currency(cents: false)) over your \(target.currency(cents: false)) budget")
                        .font(.footnote).foregroundStyle(left >= 0 ? Color.secondary : Color.red)
                }
            }

            if !slices.isEmpty {
                HStack(spacing: 20) {
                    Chart(slices) { slice in
                        SectorMark(angle: .value("Spent", slice.amount), innerRadius: .ratio(0.62), angularInset: 1.5)
                            .cornerRadius(3)
                            .foregroundStyle(slice.color)
                    }
                    .frame(width: 120, height: 120)
                    .accessibilityLabel("Spending by category")

                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(slices) { slice in
                            HStack(spacing: 6) {
                                Circle().fill(slice.color).frame(width: 8, height: 8)
                                Text(slice.name).font(.caption).lineLimit(1)
                                Spacer(minLength: 4)
                                Text(slice.amount.currency(cents: false)).font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }
}

struct CompactLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 3) {
            configuration.icon.imageScale(.small)
            configuration.title
        }
    }
}
