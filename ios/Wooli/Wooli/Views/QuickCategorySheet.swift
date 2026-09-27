import SwiftUI
import SwiftData

/// Opened by tapping a transaction's icon: search and pick a category, see
/// how many same-merchant transactions follow along, and optionally save a
/// rule — all in one step.
struct QuickCategorySheet: View {
    @Bindable var transaction: LocalTransaction

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var merchantRules: [MerchantRule]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @State private var search = ""
    @State private var makeRule = false
    @State private var ruleOnStatement = true
    @State private var ruleText = ""
    @State private var markReviewed = false

    var body: some View {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        let groups = categories.filter { $0.parentId == nil }
        let parentIds = Set(categories.compactMap(\.parentId))
        let suggestions = CategorySuggestions.suggest(for: transaction, rules: merchantRules, categories: categories,
                                                      history: transactions, limit: 4)
        let siblings = Categorizer.siblingsToUpdate(of: transaction, context: context)

        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        CategoryTile(category: categories.first { $0.id == transaction.categoryId }, size: 44)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(transaction.title).font(.headline).foregroundStyle(Theme.text).lineLimit(1)
                            Text(transaction.transactedAt.formatted(date: .abbreviated, time: .omitted))
                                .font(.footnote).foregroundStyle(Theme.textTertiary)
                        }
                        Spacer()
                        Text(transaction.amount.signedCurrency()).font(.headline).monospacedDigit()
                            .foregroundStyle(transaction.amount > 0 ? Theme.income : Theme.text)
                    }
                    Toggle(isOn: $makeRule.animation()) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Always categorize like this")
                            Text("Creates a rule for future transactions")
                                .font(.caption).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    if makeRule {
                        Picker("Match on", selection: $ruleOnStatement) {
                            Text("Original statement").tag(true)
                            Text("Merchant name").tag(false)
                        }
                        .pickerStyle(.segmented)
                        .onChange(of: ruleOnStatement) { _, onStatement in
                            ruleText = onStatement ? RuleEngine.statementPrefix(transaction.transactionDescription)
                                                   : transaction.baseTitle
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text(ruleOnStatement ? "Statement contains" : "Merchant is")
                                .font(.caption).foregroundStyle(Theme.textTertiary)
                            TextField("Text to match", text: $ruleText, axis: .vertical)
                                .lineLimit(1...3)
                                .font(.callout.monospaced())
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                            if ruleOnStatement {
                                Text(transaction.transactionDescription)
                                    .font(.caption2.monospaced()).foregroundStyle(Theme.textTertiary)
                                    .lineLimit(2)
                            }
                        }
                    }
                    if transaction.needsReview {
                        Toggle("Mark as reviewed", isOn: $markReviewed)
                    }
                } footer: {
                    if !siblings.isEmpty {
                        Text("Also updates \(siblings.count) other unreviewed \(transaction.title) transaction\(siblings.count == 1 ? "" : "s").")
                    }
                }

                if query.isEmpty && !suggestions.isEmpty {
                    Section("Suggested") {
                        ForEach(suggestions) { category in row(category) }
                    }
                }

                ForEach(groups) { group in
                    let children = categories.filter { $0.parentId == group.id }
                    let options = (parentIds.contains(group.id) ? children : [group]).filter {
                        query.isEmpty || $0.name.lowercased().contains(query) || group.name.lowercased().contains(query)
                    }
                    if !options.isEmpty {
                        Section("\(group.icon)  \(group.name)") {
                            ForEach(options) { category in row(category) }
                        }
                    }
                }
            }
            .searchable(text: $search, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search categories")
            .navigationTitle("Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .presentationDetents([.large])
        .onAppear { ruleText = RuleEngine.statementPrefix(transaction.transactionDescription) }
    }

    private func row(_ category: BudgetCategory) -> some View {
        Button {
            pick(category)
        } label: {
            HStack(spacing: 12) {
                CategoryTile(category: category, size: 32)
                Text(category.name).foregroundStyle(Theme.text)
                Spacer()
                if category.id == transaction.categoryId {
                    Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(Theme.brand)
                }
            }
        }
    }

    private func pick(_ category: BudgetCategory) {
        Categorizer.assign(category, to: transaction)
        if markReviewed { transaction.needsReview = false }
        Categorizer.learn(from: transaction, categories: categories, context: context)
        let matchText = ruleText.trimmingCharacters(in: .whitespacesAndNewlines)
        if makeRule && !matchText.isEmpty {
            let rule = TransactionRule()
            if ruleOnStatement {
                rule.statementMatch = "contains"
                rule.statementText = matchText
            } else {
                rule.merchantMatch = "exact"
                rule.merchantText = matchText
            }
            rule.setCategoryId = category.id
            context.insert(rule)
            let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            RuleEngine.applyToExisting(rule, transactions: transactions, categories: byId)
        }
        try? context.save()
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        dismiss()
    }
}
