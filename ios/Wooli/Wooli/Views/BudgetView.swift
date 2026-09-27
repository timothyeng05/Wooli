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
    @State private var summaryOpen = true
    @FocusState private var editing: String?

    private var isCurrentMonth: Bool { month.contains(.now) }

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let plan = BudgetPlan(categories: categories, transactions: transactions, month: month, ledger: ledger)

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    LeftToBudgetBanner(amount: plan.plannedIncome - plan.plannedExpenses)

                    VStack(alignment: .leading, spacing: 16) {
                        Button {
                            withAnimation(.snappy) { summaryOpen.toggle() }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "chevron.down")
                                    .rotationEffect(.degrees(summaryOpen ? 0 : -90))
                                    .font(.caption.weight(.bold))
                                    .frame(width: 28, height: 28)
                                    .overlay(Circle().strokeBorder(Theme.border))
                                Text("Summary").font(.headline).foregroundStyle(Theme.text)
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                        if summaryOpen {
                            PlanRow(title: "Income", actual: plan.earned, planned: plan.plannedIncome, tint: Theme.income,
                                    actualLabel: "earned", isIncome: true)
                            Divider()
                            PlanRow(title: "Expenses", actual: plan.spent, planned: plan.plannedExpenses, tint: Theme.income,
                                    actualLabel: "spent", isIncome: false)
                        }
                    }
                    .card()

                    BudgetSection(title: "Income", groups: plan.incomeGroups, plan: plan, isIncome: true, month: month, editing: $editing)
                    BudgetSection(title: "Expenses", groups: plan.expenseGroups, plan: plan, isIncome: false, month: month, editing: $editing)

                    if plan.uncategorizedSpending > 0 {
                        Button { app.showReview = true } label: {
                            HStack {
                                Text("❓")
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Uncategorized").font(.body.weight(.medium)).foregroundStyle(Theme.text)
                                    Text("\(plan.uncategorizedSpending.currency(cents: false)) spent — review to budget it")
                                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
                            }
                            .card(padding: 16)
                        }
                        .buttonStyle(.plain)
                    }

                    SpendingHistoryCard(transactions: transactions, ledger: ledger, month: month, target: plan.plannedExpenses)
                }
                .padding(16)
            }
            .pageBackground()
            .scrollDismissesKeyboard(.interactively)
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
                        NavigationLink { RecurringView() } label: { Label("Recurring", systemImage: "arrow.triangle.2.circlepath") }
                    } label: {
                        Label("More", systemImage: "ellipsis")
                    }
                    if !isCurrentMonth {
                        Button("Today") { withAnimation { month = .month(containing: .now) } }
                    }
                    Button("Next Month", systemImage: "chevron.right") { shift(1) }
                        .disabled(isCurrentMonth)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Done") { editing = nil }
                }
            }
        }
    }

    private func shift(_ months: Int) {
        let start = Calendar.current.date(byAdding: .month, value: months, to: month.start)!
        withAnimation { month = .month(containing: start) }
    }
}

/// Planned vs. actual for one month, per category and group.
struct BudgetPlan {
    let categories: [BudgetCategory]
    let incomeGroups: [BudgetCategory]
    let expenseGroups: [BudgetCategory]
    private let children: [String: [BudgetCategory]]
    /// Actual per leaf: earned for income, net spent for expenses.
    private let actualByCategory: [String: Double]
    let uncategorizedSpending: Double

    init(categories: [BudgetCategory], transactions: [LocalTransaction], month: DateInterval, ledger: Ledger) {
        self.categories = categories
        let groups = categories.filter { $0.parentId == nil }
        incomeGroups = groups.filter(\.isIncome)
        expenseGroups = groups.filter(\.isExpense)
        children = Dictionary(grouping: categories.filter { $0.parentId != nil }, by: { $0.parentId! })

        var actual = [String: Double]()
        var uncategorized = 0.0
        for tx in transactions where month.contains(tx.transactedAt) && !tx.isHidden && !tx.isTransfer && ledger.isVisible(tx) {
            if let category = ledger.category(for: tx) {
                actual[category.id, default: 0] += category.isIncome ? tx.amount : -tx.amount
            } else if tx.amount < 0 {
                uncategorized -= tx.amount
            }
        }
        actualByCategory = actual
        uncategorizedSpending = uncategorized
    }

    func children(of group: BudgetCategory) -> [BudgetCategory] { children[group.id] ?? [] }

    func actual(_ category: BudgetCategory) -> Double {
        if category.parentId == nil {
            return children(of: category).reduce(actualByCategory[category.id] ?? 0) { $0 + (actualByCategory[$1.id] ?? 0) }
        }
        return actualByCategory[category.id] ?? 0
    }

    /// A group is budgeted either as a whole (its own amount) or by category.
    func isGroupBudget(_ group: BudgetCategory) -> Bool { group.monthlyTarget > 0 }

    func planned(_ category: BudgetCategory) -> Double {
        if category.parentId == nil && !isGroupBudget(category) {
            return children(of: category).reduce(0) { $0 + $1.monthlyTarget }
        }
        return category.monthlyTarget
    }

    var plannedIncome: Double { incomeGroups.reduce(0) { $0 + planned($1) } }
    var plannedExpenses: Double { expenseGroups.reduce(0) { $0 + planned($1) } }
    var earned: Double { incomeGroups.reduce(0) { $0 + actual($1) } }
    var spent: Double { expenseGroups.reduce(0) { $0 + actual($1) } + uncategorizedSpending }
}

private struct LeftToBudgetBanner: View {
    let amount: Double

    var body: some View {
        let over = amount < 0
        HStack {
            Text("Left to budget").font(.headline)
            Spacer()
            Text(amount.currency(cents: false)).font(.title3.weight(.bold)).monospacedDigit()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 20).padding(.vertical, 16)
        .background(over ? Theme.expense : Theme.income, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityHint(over ? "You've planned more spending than income." : "Income not yet assigned to a category.")
    }
}

private struct BudgetSection: View {
    let title: String
    let groups: [BudgetCategory]
    let plan: BudgetPlan
    let isIncome: Bool
    let month: DateInterval
    var editing: FocusState<String?>.Binding

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                Spacer()
                Text("Planned").frame(width: 90, alignment: .trailing)
                Text("Remaining").frame(width: 80, alignment: .trailing)
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(Theme.textTertiary)
            .padding(.horizontal, 4)

            ForEach(groups) { group in
                GroupBudgetCard(group: group, plan: plan, isIncome: isIncome, month: month, editing: editing)
            }
        }
    }
}

private struct GroupBudgetCard: View {
    @Bindable var group: BudgetCategory
    let plan: BudgetPlan
    let isIncome: Bool
    let month: DateInterval
    var editing: FocusState<String?>.Binding
    @State private var open = true
    @State private var showUnbudgeted = false

    var body: some View {
        let children = plan.children(of: group)
        let groupLevel = plan.isGroupBudget(group)
        let byCategory = children.contains { $0.monthlyTarget > 0 }
        let budgeted = groupLevel ? children : children.filter { $0.monthlyTarget > 0 }
        let unbudgeted = groupLevel ? [] : children.filter { $0.monthlyTarget == 0 }

        VStack(spacing: 0) {
            // Group row
            HStack(spacing: 10) {
                Button {
                    withAnimation(.snappy) { open.toggle() }
                } label: {
                    Image(systemName: "chevron.down")
                        .rotationEffect(.degrees(open ? 0 : -90))
                        .font(.caption.weight(.bold))
                        .frame(width: 28, height: 28)
                        .overlay(Circle().strokeBorder(Theme.border))
                }
                .buttonStyle(.plain)
                .foregroundStyle(Theme.text)
                NavigationLink {
                    CategoryBudgetView(group: group, month: month)
                } label: {
                    Text(group.name).font(.headline).foregroundStyle(Theme.text).lineLimit(1).minimumScaleFactor(0.75)
                }
                .buttonStyle(.plain)
                Spacer(minLength: 4)
                if byCategory && !groupLevel {
                    Text(plan.planned(group).currency(cents: false)).font(.body.weight(.semibold)).monospacedDigit()
                        .frame(width: 90, alignment: .trailing)
                } else {
                    PlannedField(value: $group.monthlyTarget, id: group.id, editing: editing)
                }
                RemainingPill(planned: plan.planned(group), actual: plan.actual(group), isIncome: isIncome)
            }
            .padding(.horizontal, 14).padding(.vertical, 12)

            if open {
                ForEach(budgeted) { child in
                    Divider().overlay(Theme.border)
                    CategoryBudgetRow(category: child, plan: plan, isIncome: isIncome, showsField: !groupLevel, month: month, editing: editing)
                }
                if !unbudgeted.isEmpty {
                    if showUnbudgeted {
                        ForEach(unbudgeted) { child in
                            Divider().overlay(Theme.border)
                            CategoryBudgetRow(category: child, plan: plan, isIncome: isIncome, showsField: true, month: month, editing: editing)
                        }
                    }
                    Divider().overlay(Theme.border)
                    Button {
                        withAnimation(.snappy) { showUnbudgeted.toggle() }
                    } label: {
                        Label(showUnbudgeted ? "Hide unbudgeted" : "Show \(unbudgeted.count) unbudgeted",
                              systemImage: showUnbudgeted ? "eye.slash" : "eye")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16).padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .card(padding: 0)
    }
}

private struct CategoryBudgetRow: View {
    @Bindable var category: BudgetCategory
    let plan: BudgetPlan
    let isIncome: Bool
    let showsField: Bool
    let month: DateInterval
    var editing: FocusState<String?>.Binding

    var body: some View {
        let planned = category.monthlyTarget
        let actual = plan.actual(category)
        // The bar below already shows progress against the plan, so the
        // amount caption would just repeat it — only show one or the other.
        let showsBar = showsField && planned > 0
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text(category.icon).font(.title3).frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    NavigationLink {
                        CategoryBudgetView(group: category, month: month)
                    } label: {
                        Text(category.name).foregroundStyle(Theme.text).lineLimit(1).minimumScaleFactor(0.75)
                    }
                    .buttonStyle(.plain)
                    if actual != 0 && !showsBar {
                        Text("\(abs(actual).currency(cents: false)) \(isIncome ? "earned" : "spent")")
                            .font(.caption).foregroundStyle(Theme.textTertiary)
                    }
                }
                Spacer(minLength: 4)
                if showsField {
                    PlannedField(value: $category.monthlyTarget, id: category.id, editing: editing)
                    RemainingPill(planned: planned, actual: actual, isIncome: isIncome)
                } else {
                    Text(abs(actual).currency(cents: false)).font(.subheadline).monospacedDigit()
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: 80, alignment: .trailing)
                }
            }
            .padding(.leading, showsField ? 14 : 28).padding(.trailing, 14).padding(.vertical, 10)

            if showsBar {
                BarGauge(value: max(actual, 0), total: planned,
                         tint: !isIncome && actual > planned ? Theme.expense : Theme.income, height: 3)
            }
        }
        .background(showsField ? Color.clear : Theme.background.opacity(0.5))
    }
}

/// Boxed, editable planned amount.
private struct PlannedField: View {
    @Binding var value: Double
    let id: String
    var editing: FocusState<String?>.Binding
    
    @State private var draftValue: Double = 0

    var body: some View {
        TextField("$0", value: $draftValue, format: .currency(code: "USD").precision(.fractionLength(0)))
            .keyboardType(.numberPad)
            .multilineTextAlignment(.trailing)
            .font(.subheadline.weight(.semibold).monospacedDigit())
            .focused(editing, equals: id)
            .padding(.horizontal, 8).padding(.vertical, 7)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8)
                .strokeBorder(editing.wrappedValue == id ? Theme.brand : Theme.border, lineWidth: editing.wrappedValue == id ? 1.5 : 1))
            .frame(width: 90)
            .onAppear {
                draftValue = value
            }
            .onChange(of: editing.wrappedValue) { old, new in
                if new == id {
                    draftValue = value
                } else if old == id {
                    if value != draftValue {
                        value = draftValue
                    }
                }
            }
            .onChange(of: value) { old, new in
                if editing.wrappedValue != id {
                    draftValue = new
                }
            }
    }
}

/// "Remaining" amount as a colored pill.
private struct RemainingPill: View {
    let planned: Double
    let actual: Double
    let isIncome: Bool

    var body: some View {
        let remaining = max(planned, 0) - actual
        let shown = isIncome ? max(remaining, 0) : remaining
        let (fg, bg): (Color, Color) = {
            if planned == 0 && actual == 0 { return (Theme.textTertiary, .clear) }
            if isIncome { return shown > 0 ? (Theme.textSecondary, Theme.track) : (Theme.income, Theme.income.opacity(0.12)) }
            return shown >= 0 ? (Theme.income, Theme.income.opacity(0.12)) : (Theme.expense, Theme.expense.opacity(0.12))
        }()
        Text(shown.currency(cents: false))
            .font(.subheadline.weight(.semibold)).monospacedDigit()
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 8).padding(.vertical, 6)
            .background(bg, in: Capsule())
            .foregroundStyle(fg)
            .frame(width: 80, alignment: .trailing)
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
        // Top-level groups roll up under spendingByGroup; a single leaf
        // category (tapped directly, not via its parent) needs its own total.
        let actual = group.isIncome ? items.reduce(0) { $0 + $1.amount }
            : (group.parentId == nil ? (summary.spendingByGroup[group.id] ?? 0) : (summary.spendingByCategory[group.id] ?? 0))

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