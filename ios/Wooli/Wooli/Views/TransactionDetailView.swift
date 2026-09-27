import SwiftUI
import SwiftData

/// Header of a transaction: icon, amount, account, merchant, and a link to
/// other transactions from the same merchant. Shared by detail and review.
struct TransactionHeader: View {
    let transaction: LocalTransaction
    let category: BudgetCategory?
    let account: LocalAccount?
    let sameMerchantCount: Int
    var onShowSameMerchant: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                CategoryTile(category: category, size: 60)
                Spacer()
                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 8) {
                        if transaction.isPending { PendingBadge() }
                        Text(transaction.amount.signedCurrency())
                            .font(.system(size: 28, weight: .bold)).monospacedDigit()
                            .foregroundStyle(transaction.amount > 0 ? Theme.income : Theme.text)
                    }
                    if let account {
                        HStack(spacing: 6) {
                            InstitutionLogo(name: account.institutionName, size: 22)
                            Text(account.displayName).font(.subheadline).foregroundStyle(Theme.textSecondary)
                                .lineLimit(1)
                        }
                    }
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.title).font(.title2.weight(.semibold)).foregroundStyle(Theme.text)
                Text(transaction.transactedAt.formatted(date: .complete, time: .omitted))
                    .font(.subheadline).foregroundStyle(Theme.textTertiary)
                if sameMerchantCount > 1, let onShowSameMerchant {
                    Button(action: onShowSameMerchant) {
                        HStack(spacing: 4) {
                            Text("\(sameMerchantCount) transactions")
                            Image(systemName: "arrow.right")
                        }
                        .font(.subheadline.weight(.semibold))
                    }
                    .padding(.top, 4)
                }
            }
        }
    }
}

/// Category chips, note, hide toggle, and the bank's original statement.
struct TransactionEditor: View {
    @Bindable var transaction: LocalTransaction
    let suggestions: [BudgetCategory]
    let allCategories: [BudgetCategory]
    @State private var showPicker = false
    /// Set when the user overrides an AI suggestion: offer a one-tap rule.
    @State private var teachCategory: BudgetCategory?
    @State private var customizeRule = false
    @Environment(\.modelContext) private var context

    private func pick(_ category: BudgetCategory?) {
        let changed = transaction.categoryId != category?.id
        withAnimation(.snappy) {
            Categorizer.assign(category, to: transaction)
            if changed, let category {
                Categorizer.learn(from: transaction, categories: allCategories, context: context)
                teachCategory = category
            }
        }
    }

    private func prefill(_ rule: TransactionRule) {
        RuleEngine.seed(rule, from: transaction, category: teachCategory)
    }

    private func createRule() {
        let rule = TransactionRule()
        prefill(rule)
        context.insert(rule)
        let all = (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? []
        let byId = Dictionary(allCategories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        RuleEngine.applyToExisting(rule, transactions: all, categories: byId)
        try? context.save()
        withAnimation { teachCategory = nil }
    }

    var body: some View {
        let current = transaction.categoryId.flatMap { id in allCategories.first { $0.id == id } }
        let chips = current.map { c in [c] + suggestions.filter { $0.id != c.id } } ?? suggestions

        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Category")
                FlowLayout(spacing: 8) {
                    ForEach(chips.prefix(4)) { category in
                        Chip(label: category.name, emoji: category.icon, selected: category.id == transaction.categoryId) {
                            pick(category)
                        }
                    }
                    Chip(label: "Other", symbol: "magnifyingglass", selected: false) { showPicker = true }
                }
                if transaction.aiSuggested && transaction.needsReview {
                    Label("Suggested by Apple Intelligence. Check it's right.", systemImage: "sparkles")
                        .font(.footnote).foregroundStyle(Theme.brand)
                }
                if let teachCategory {
                    TeachWooliCard(merchant: RuleEngine.statementPrefix(transaction.transactionDescription), category: teachCategory,
                                   onCreate: createRule, onCustomize: { customizeRule = true }) {
                        withAnimation { self.teachCategory = nil }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
                if transaction.isTransfer {
                    Label("Transfers aren't counted as income or spending.", systemImage: "arrow.left.arrow.right")
                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Notes")
                TextField("Add notes…", text: $transaction.note, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border))
            }

            Toggle(isOn: $transaction.isHidden) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hide transaction").foregroundStyle(Theme.text)
                    Text("Keep it in the list but leave it out of budgets and totals")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }
            }
            .padding(14)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border))

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Original Statement")
                Text(transaction.transactionDescription)
                    .font(.callout)
                    .foregroundStyle(Theme.textSecondary)
                    .textSelection(.enabled)
                Button {
                    customizeRule = true
                } label: {
                    Label("Create rule from this transaction", systemImage: "wand.and.stars")
                        .font(.subheadline.weight(.medium))
                }
                .padding(.top, 4)
                MarkRecurringButton(transaction: transaction)
            }
        }
        .sheet(isPresented: $customizeRule, onDismiss: { teachCategory = nil }) {
            RuleEditor(rule: nil, prefill: prefill, source: transaction)
        }
        .sheet(isPresented: $showPicker) {
            NavigationStack {
                CategoryPickerView(selectedId: transaction.categoryId) { picked in
                    pick(picked)
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { showPicker = false }
                    }
                }
            }
        }
    }
}

struct Chip: View {
    let label: String
    var emoji: String?
    var symbol: String?
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let emoji { Text(emoji) }
                if let symbol { Image(systemName: symbol).foregroundStyle(Theme.textSecondary) }
                Text(label).foregroundStyle(Theme.text)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 14).padding(.vertical, 9)
            .background(selected ? Theme.brandSoft : Theme.card, in: Capsule())
            .overlay(Capsule().strokeBorder(selected ? Theme.brand : Theme.border, lineWidth: selected ? 1.5 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Wraps chips onto multiple lines.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

enum CategorySuggestions {
    /// The merchant's learned category, then the categories used most often
    /// for money moving the same direction (in vs. out).
    static func suggest(for tx: LocalTransaction, rules: [MerchantRule], categories: [BudgetCategory],
                        history: [LocalTransaction], limit: Int = 3) -> [BudgetCategory] {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var result: [BudgetCategory] = []
        func add(_ id: String?) {
            guard let id, let c = byId[id], !result.contains(where: { $0.id == id }) else { return }
            result.append(c)
        }
        add(Categorizer.learnedCategory(merchant: tx.normalizedMerchant,
                                        statement: Categorizer.statementKey(tx.transactionDescription),
                                        in: rules.filter { $0.merchant == tx.normalizedMerchant }))
        let sameDirection = history.filter { !$0.needsReview && ($0.amount > 0) == (tx.amount > 0) }
        let counts = Dictionary(grouping: sameDirection.compactMap(\.categoryId), by: { $0 }).mapValues(\.count)
        for (id, _) in counts.sorted(by: { $0.value > $1.value }) where result.count < limit { add(id) }
        if result.count < limit {
            let fallback = tx.amount > 0 ? ["Salary", "Other Income", "Transfer"] : ["Groceries", "Restaurants", "Shopping"]
            for name in fallback where result.count < limit { add(categories.first { $0.name == name }?.id) }
        }
        return Array(result.prefix(limit))
    }
}

struct TransactionDetailView: View {
    @Bindable var transaction: LocalTransaction

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @Query private var rules: [MerchantRule]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @State private var showSameMerchant = false

    var body: some View {
        let category = transaction.categoryId.flatMap { id in categories.first { $0.id == id } }
        let account = accounts.first { $0.providerAccountId == transaction.accountId }
        let sameMerchant = transactions.filter { $0.normalizedMerchant == transaction.normalizedMerchant }

        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                TransactionHeader(transaction: transaction, category: category, account: account,
                                  sameMerchantCount: sameMerchant.count) { showSameMerchant = true }
                Divider()
                TransactionEditor(transaction: transaction,
                                  suggestions: CategorySuggestions.suggest(for: transaction, rules: rules,
                                                                           categories: categories, history: transactions),
                                  allCategories: categories)
            }
            .card()
            .padding(16)
        }
        .pageBackground()
        .navigationTitle("Transaction")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if transaction.needsReview {
                ReviewActionBar(canConfirm: transaction.categoryId != nil, skipTitle: nil) {
                    withAnimation {
                        if Categorizer.confirm(transaction, categories: categories, context: context) { dismiss() }
                    }
                }
            }
        }
        .sheet(isPresented: $showSameMerchant) {
            SameMerchantSheet(title: transaction.title, transactions: sameMerchant, categories: categories)
        }
    }
}

/// Bottom bar with "Skip for now" (optional) and "Mark as reviewed".
struct ReviewActionBar: View {
    let canConfirm: Bool
    let skipTitle: String?
    var onSkip: (() -> Void)?
    let onConfirm: () -> Void

    init(canConfirm: Bool, skipTitle: String?, onSkip: (() -> Void)? = nil, onConfirm: @escaping () -> Void) {
        self.canConfirm = canConfirm
        self.skipTitle = skipTitle
        self.onSkip = onSkip
        self.onConfirm = onConfirm
    }

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 12) {
                if let skipTitle, let onSkip {
                    Button(action: onSkip) {
                        Text(skipTitle).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.text)
                }
                Button(action: onConfirm) {
                    Text("Mark as reviewed").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canConfirm)
            }
            .controlSize(.large)
            if !canConfirm {
                Text("Choose a category first").font(.footnote).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
    }
}

struct SameMerchantSheet: View {
    let title: String
    let transactions: [LocalTransaction]
    let categories: [BudgetCategory]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let total = transactions.reduce(0) { $0 + $1.amount }
        NavigationStack {
            List {
                Section {
                    LabeledContent("Total", value: total.signedCurrency())
                    LabeledContent("Transactions", value: "\(transactions.count)")
                }
                Section {
                    ForEach(transactions) { tx in
                        HStack {
                            TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] })
                        }
                        .overlay(alignment: .bottomLeading) {
                            Text(tx.transactedAt.formatted(date: .abbreviated, time: .omitted))
                                .font(.caption2).foregroundStyle(Theme.textTertiary)
                                .offset(x: 52, y: 10)
                        }
                        .padding(.bottom, 8)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

struct CategoryPickerView: View {
    let selectedId: String?
    let onPick: (BudgetCategory?) -> Void

    @Environment(\.dismiss) private var dismiss
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var search = ""

    var body: some View {
        let parents = categories.filter { $0.parentId == nil }
        let query = search.lowercased()

        List {
            ForEach(parents) { parent in
                let children = categories.filter { $0.parentId == parent.id }
                let options = (children.isEmpty ? [parent] : children)
                    .filter { query.isEmpty || $0.name.lowercased().contains(query) || parent.name.lowercased().contains(query) }
                if !options.isEmpty {
                    Section {
                        ForEach(options) { option in
                            Button {
                                onPick(option)
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    CategoryTile(category: option, size: 32)
                                    Text(option.name).foregroundStyle(Theme.text)
                                    Spacer()
                                    if option.id == selectedId {
                                        Image(systemName: "checkmark").foregroundStyle(Theme.brand).fontWeight(.semibold)
                                    }
                                }
                            }
                        }
                    } header: {
                        Text("\(parent.icon)  \(parent.name)")
                    }
                }
            }
            if query.isEmpty {
                Section {
                    NavigationLink {
                        CategoriesSettingsView()
                    } label: {
                        Label("Edit Categories", systemImage: "square.grid.2x2")
                    }
                }
            }
            if selectedId != nil && query.isEmpty {
                Section {
                    Button("Remove Category", role: .destructive) {
                        onPick(nil)
                        dismiss()
                    }
                }
            }
        }
        .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always))
        .navigationTitle("Category")
        .navigationBarTitleDisplayMode(.inline)
    }
}
