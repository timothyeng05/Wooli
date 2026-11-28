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
    /// Set when the user overrides or assigns a category: offer a non-blocking "Create a rule" toast.
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
        withAnimation(.snappy) { teachCategory = nil }
    }

    var body: some View {
        let current = transaction.categoryId.flatMap { id in allCategories.first { $0.id == id } }
        let chips = current.map { c in [c] + suggestions.filter { $0.id != c.id } } ?? suggestions

        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Original Statement")
                Text(transaction.transactionDescription)
                    .font(.callout)
                    .foregroundStyle(FieldNotes.inkSecondary)
                    .textSelection(.enabled)
            }

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
                        .font(.footnote).foregroundStyle(FieldNotes.forest)
                }
                if transaction.isTransfer {
                    Label("Transfers aren't counted as income or spending.", systemImage: "arrow.left.arrow.right")
                        .font(.footnote).foregroundStyle(FieldNotes.inkSecondary)
                }
            }

            TagsSection(transaction: transaction)

            VStack(alignment: .leading, spacing: 10) {
                SectionLabel("Notes")
                TextField("Add notes…", text: $transaction.note, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(14)
                    .background(FieldNotes.paper, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(FieldNotes.border))
            }

            Toggle(isOn: $transaction.isHidden) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hide transaction").foregroundStyle(FieldNotes.ink)
                    Text("Keep it in the list but leave it out of budgets and totals")
                        .font(.footnote).foregroundStyle(FieldNotes.inkTertiary)
                }
            }
            .padding(14)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(FieldNotes.border))

            VStack(alignment: .leading, spacing: 8) {
                SectionLabel("Actions")
                Button {
                    customizeRule = true
                } label: {
                    Label("Create rule from this transaction", systemImage: "wand.and.stars")
                        .font(.subheadline.weight(.medium))
                }
                MarkRecurringButton(transaction: transaction)
                SplitModeButton(transaction: transaction)
            }
        }
        .overlay(alignment: .bottom) {
            if let teachCategory {
                CreateRuleToast(
                    merchant: RuleEngine.statementPrefix(transaction.transactionDescription),
                    category: teachCategory,
                    onCreate: createRule,
                    onCustomize: { customizeRule = true },
                    onDismiss: { withAnimation(.snappy) { self.teachCategory = nil } }
                )
                .padding(.top, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .task(id: teachCategory?.id) {
            guard teachCategory != nil else { return }
            try? await Task.sleep(for: .seconds(6))
            guard !Task.isCancelled else { return }
            withAnimation(.snappy) { teachCategory = nil }
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
    var onStepPrevious: (() -> Void)? = nil
    var onStepNext: (() -> Void)? = nil

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @Query private var rules: [MerchantRule]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @State private var showSameMerchant = false
    @State private var confirmDelete = false
    @Environment(\.closeSideDetail) private var closeSideDetail

    var body: some View {
        let category = transaction.categoryId.flatMap { id in categories.first { $0.id == id } }
        let account = accounts.first { $0.providerAccountId == transaction.accountId }
        let sameMerchant = transactions.filter { $0.normalizedMerchant == transaction.normalizedMerchant }

        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                TransactionHeader(transaction: transaction, category: category, account: account,
                                  sameMerchantCount: sameMerchant.count) { showSameMerchant = true }
                Divider().overlay(FieldNotes.border)
                TransactionEditor(transaction: transaction,
                                  suggestions: CategorySuggestions.suggest(for: transaction, rules: rules,
                                                                           categories: categories, history: transactions),
                                  allCategories: categories)
            }
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FieldNotes.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(FieldNotes.border))
            .padding(16)
        }
        .scrollContentBackground(.hidden)
        .background(FieldNotes.paperAlt)
        .navigationTitle("Transaction")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if onStepPrevious != nil || onStepNext != nil {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        onStepPrevious?()
                    } label: {
                        Image(systemName: "chevron.up")
                    }
                    .disabled(onStepPrevious == nil)
                    .help("Previous transaction (↑)")

                    Button {
                        onStepNext?()
                    } label: {
                        Image(systemName: "chevron.down")
                    }
                    .disabled(onStepNext == nil)
                    .help("Next transaction (↓)")
                }
            }
            // Only typed-in transactions can be deleted; bank ones would come back on the next sync.
            if transaction.isManual {
                ToolbarItem(placement: .destructiveAction) {
                    Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
                }
            }
        }
        .confirmationDialog("Delete this transaction?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Transaction", role: .destructive) {
                dismiss()
                closeSideDetail()
                // Delete after the pop finishes so this screen never draws a deleted record.
                Task {
                    try? await Task.sleep(for: .milliseconds(400))
                    ManualEntry.delete(transaction, context: context)
                }
            }
        } message: {
            Text("Its amount is taken back out of the account balance.")
        }
        .safeAreaInset(edge: .bottom) {
            if transaction.needsReview {
                let category = transaction.categoryId.flatMap { id in categories.first { $0.id == id } }
                ReviewActionBar(canConfirm: transaction.categoryId != nil, skipTitle: nil,
                                alwaysTitle: category.map { "Always \($0.name) for \(transaction.baseTitle) · skip review" },
                                onAlways: {
                                    guard let category else { return }
                                    RuleEngine.autoApprove(transaction, category: category, context: context)
                                    dismiss()
                                }) {
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
    /// Press-and-hold option on "Mark as reviewed", e.g. "Always Transit for MTA · skip review".
    var alwaysTitle: String?
    var onAlways: (() -> Void)?
    let onConfirm: () -> Void

    init(canConfirm: Bool, skipTitle: String?, onSkip: (() -> Void)? = nil,
         alwaysTitle: String? = nil, onAlways: (() -> Void)? = nil, onConfirm: @escaping () -> Void) {
        self.canConfirm = canConfirm
        self.skipTitle = skipTitle
        self.onSkip = onSkip
        self.alwaysTitle = alwaysTitle
        self.onAlways = onAlways
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
                .contextMenu {
                    if canConfirm, let alwaysTitle, let onAlways {
                        Button("Mark as reviewed", systemImage: "checkmark", action: onConfirm)
                        Button(alwaysTitle, systemImage: "checkmark.seal", action: onAlways)
                    }
                }
            }
            .controlSize(.large)
            if !canConfirm {
                Text("Choose a category first").font(.footnote).foregroundStyle(Theme.textSecondary)
            } else if alwaysTitle != nil {
                Text("Hold \"Mark as reviewed\" to skip review for this merchant from now on")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
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

/// Non-blocking floating toast offering a 1-click rule creation after picking a category.
private struct CreateRuleToast: View {
    let merchant: String
    let category: BudgetCategory
    let onCreate: () -> Void
    let onCustomize: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "wand.and.stars")
                .foregroundStyle(FieldNotes.paper)
            VStack(alignment: .leading, spacing: 1) {
                Text("Create a rule?")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(FieldNotes.paper)
                Text("Always \(category.icon) \(category.name) for \(merchant)")
                    .font(.caption2)
                    .foregroundStyle(FieldNotes.paper.opacity(0.82))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Button("Create", action: onCreate)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(FieldNotes.forest, in: Capsule())
                .foregroundStyle(.white)
                .buttonStyle(.plain)
            Button("Edit", action: onCustomize)
                .font(.caption.weight(.medium))
                .foregroundStyle(FieldNotes.paper.opacity(0.9))
                .buttonStyle(.plain)
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(FieldNotes.paper.opacity(0.75))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(FieldNotes.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: Color.black.opacity(0.18), radius: 8, y: 3)
    }
}

/// Split button + editor supporting By Amount ($) and By Percent (%) validation.
private struct SplitModeButton: View {
    let transaction: LocalTransaction
    @Environment(\.modelContext) private var context
    @State private var editing: LocalTransaction?

    var body: some View {
        let original = transaction.splitParentId.isEmpty ? transaction : SplitService.original(of: transaction, context: context)
        Group {
            if let original {
                Button {
                    editing = original
                } label: {
                    Label(transaction.splitParentId.isEmpty ? "Split transaction" : "Edit split (\(original.amount.signedCurrency()) total)",
                          systemImage: "arrow.triangle.branch")
                        .font(.subheadline.weight(.medium))
                }
                .disabled(transaction.isPending)
            }
        }
        .sheet(item: $editing) { SplitModeEditor(original: $0) }
    }
}

private struct SplitModeEditor: View {
    enum Mode: String, CaseIterable, Identifiable {
        case amount = "By Amount ($)"
        case percent = "By Percent (%)"
        var id: String { rawValue }
    }

    let original: LocalTransaction
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var mode: Mode = .amount
    @State private var parts: [SplitService.Part] = []
    @State private var percents: [UUID: Double] = [:]
    @State private var pickingFor: UUID?
    @State private var loaded = false
    @State private var confirmUnsplit = false

    private var total: Double { abs(original.amount) }
    private var assignedAmount: Double { parts.reduce(0) { $0 + abs($1.amount) } }
    private var remainingAmount: Double { ((total - assignedAmount) * 100).rounded() / 100 }
    private var assignedPercent: Double { parts.reduce(0) { $0 + (percents[$1.id] ?? 0) } }
    private var remainingPercent: Double { ((100.0 - assignedPercent) * 10).rounded() / 10 }

    private var isValid: Bool {
        guard parts.count >= 2 && parts.allSatisfy({ $0.amount > 0 }) else { return false }
        switch mode {
        case .amount: return abs(remainingAmount) < 0.005
        case .percent: return abs(remainingPercent) < 0.1
        }
    }

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        NavigationStack {
            Form {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(original.title).font(.headline).foregroundStyle(FieldNotes.ink)
                            Text(original.transactedAt.formatted(date: .abbreviated, time: .omitted))
                                .font(.footnote).foregroundStyle(FieldNotes.inkTertiary)
                        }
                        Spacer()
                        Text(original.amount.signedCurrency()).font(.title3.weight(.bold)).monospacedDigit()
                    }
                    Picker("Split Mode", selection: $mode) {
                        ForEach(Mode.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Section {
                    ForEach($parts) { $part in
                        HStack(spacing: 12) {
                            Button {
                                pickingFor = part.id
                            } label: {
                                HStack(spacing: 10) {
                                    CategoryTile(category: part.categoryId.flatMap { byId[$0] }, size: 32)
                                    Text(part.categoryId.flatMap { byId[$0]?.name } ?? "Choose category")
                                        .foregroundStyle(part.categoryId == nil ? Theme.pending : FieldNotes.ink)
                                        .lineLimit(1)
                                }
                            }
                            .buttonStyle(.borderless)
                            Spacer(minLength: 8)
                            if mode == .amount {
                                TextField("$0.00", value: amountBinding(for: part.id), format: .currency(code: "USD"))
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .font(.body.monospacedDigit())
                                    .frame(width: 110)
                            } else {
                                HStack(spacing: 6) {
                                    TextField("0%", value: percentBinding(for: part.id), format: .number.precision(.fractionLength(0...1)))
                                        .keyboardType(.decimalPad)
                                        .multilineTextAlignment(.trailing)
                                        .font(.body.monospacedDigit())
                                        .frame(width: 64)
                                    Text("%").foregroundStyle(FieldNotes.inkSecondary)
                                    Text(part.amount.currency())
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(FieldNotes.inkTertiary)
                                        .frame(width: 72, alignment: .trailing)
                                }
                            }
                        }
                    }
                    .onDelete { offsets in
                        for idx in offsets { percents.removeValue(forKey: parts[idx].id) }
                        parts.remove(atOffsets: offsets)
                    }

                    Button("Add a part", systemImage: "plus") {
                        let newPart = SplitService.Part(categoryId: nil, amount: max(remainingAmount, 0))
                        parts.append(newPart)
                        percents[newPart.id] = max(remainingPercent, 0)
                    }
                } header: {
                    Text("Parts")
                } footer: {
                    HStack {
                        if mode == .amount {
                            if abs(remainingAmount) < 0.005 {
                                Label("Adds up to \(total.currency())", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(Theme.income)
                            } else if remainingAmount > 0 {
                                Text("\(remainingAmount.currency()) left to assign").foregroundStyle(Theme.pending)
                            } else {
                                Text("\(abs(remainingAmount).currency()) over total").foregroundStyle(Theme.expense)
                            }
                        } else {
                            if abs(remainingPercent) < 0.1 {
                                Label("100% assigned (\(total.currency()))", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(Theme.income)
                            } else if remainingPercent > 0 {
                                Text("\(remainingPercent.formatted(.number.precision(.fractionLength(0...1))))% left to assign")
                                    .foregroundStyle(Theme.pending)
                            } else {
                                Text("\(abs(remainingPercent).formatted(.number.precision(.fractionLength(0...1))))% over 100%")
                                    .foregroundStyle(Theme.expense)
                            }
                        }
                        Spacer()
                        if parts.count >= 2 {
                            Button("Split evenly") { splitEvenly() }.font(.footnote.weight(.semibold))
                        }
                    }
                }

                if original.isSplit {
                    Section {
                        Button("Undo split", role: .destructive) { confirmUnsplit = true }
                    } footer: {
                        Text("Brings back the original transaction as one line.")
                    }
                }
            }
            .navigationTitle(original.isSplit ? "Edit split" : "Split transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        SplitService.split(original, into: parts, categories: categories, context: context)
                        dismiss()
                    }
                    .disabled(!isValid)
                }
            }
            .sheet(isPresented: Binding(get: { pickingFor != nil }, set: { if !$0 { pickingFor = nil } })) {
                NavigationStack {
                    CategoryPickerView(selectedId: parts.first { $0.id == pickingFor }?.categoryId) { picked in
                        if let i = parts.firstIndex(where: { $0.id == pickingFor }) { parts[i].categoryId = picked?.id }
                        pickingFor = nil
                    }
                }
            }
            .confirmationDialog("Undo this split?", isPresented: $confirmUnsplit, titleVisibility: .visible) {
                Button("Undo split", role: .destructive) {
                    SplitService.unsplit(original, context: context)
                    dismiss()
                }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        let existing = SplitService.parts(of: original, context: context)
        if existing.isEmpty {
            let half = (total / 2 * 100).rounded() / 100
            parts = [.init(categoryId: original.categoryId, amount: total - half), .init(categoryId: nil, amount: half)]
        } else {
            parts = existing.map { .init(categoryId: $0.categoryId, amount: abs($0.amount)) }
        }
        syncPercentsFromAmounts()
    }

    private func syncPercentsFromAmounts() {
        guard total > 0 else { return }
        for part in parts {
            percents[part.id] = ((part.amount / total * 100) * 10).rounded() / 10
        }
    }

    private func amountBinding(for id: UUID) -> Binding<Double> {
        Binding(
            get: { parts.first { $0.id == id }?.amount ?? 0 },
            set: { newValue in
                guard let i = parts.firstIndex(where: { $0.id == id }) else { return }
                parts[i].amount = newValue
                if let j = parts.indices.last(where: { $0 != i }) {
                    let others = parts.indices.filter { $0 != j }.reduce(0) { $0 + parts[$1].amount }
                    parts[j].amount = max(((total - others) * 100).rounded() / 100, 0)
                }
                syncPercentsFromAmounts()
            }
        )
    }

    private func percentBinding(for id: UUID) -> Binding<Double> {
        Binding(
            get: { percents[id] ?? 0 },
            set: { newPct in
                let clamped = max(0, min(100, newPct))
                percents[id] = clamped
                guard let i = parts.firstIndex(where: { $0.id == id }) else { return }
                parts[i].amount = ((total * clamped / 100.0) * 100).rounded() / 100
                if let j = parts.indices.last(where: { $0 != i }) {
                    let otherPct = parts.indices.filter { $0 != j }.reduce(0.0) { $0 + (percents[parts[$1].id] ?? 0) }
                    let remPct = max(((100.0 - otherPct) * 10).rounded() / 10, 0)
                    percents[parts[j].id] = remPct
                    let others = parts.indices.filter { $0 != j }.reduce(0) { $0 + parts[$1].amount }
                    parts[j].amount = max(((total - others) * 100).rounded() / 100, 0)
                }
            }
        )
    }

    private func splitEvenly() {
        let cents = Int((total * 100).rounded())
        let each = cents / parts.count
        for i in parts.indices {
            parts[i].amount = Double(each + (i == 0 ? cents - each * parts.count : 0)) / 100
        }
        syncPercentsFromAmounts()
    }
}
