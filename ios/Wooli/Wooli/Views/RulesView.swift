import SwiftUI
import SwiftData

/// Transaction rules (Monarch-style "if … then …") plus plain-English
/// instructions for Apple Intelligence.
struct RulesView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \TransactionRule.createdAt, order: .reverse) private var rules: [TransactionRule]
    @Query(sort: \CategoryRule.createdAt) private var instructions: [CategoryRule]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @State private var search = ""
    @State private var editing: TransactionRule?
    @State private var creating = false
    @State private var draftInstruction = ""
    @State private var confirmTidy = false
    @State private var tidyMerged: Int?

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let names = Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
        let shown = rules.filter { rule in
            search.isEmpty || (RuleEngine.conditionLines(rule, categories: byId, accounts: names)
                + RuleEngine.actionLines(rule, categories: byId)).joined(separator: " ").localizedCaseInsensitiveContains(search)
        }

        // One section per category the rules file into, in category order.
        let grouped = Dictionary(grouping: shown) { $0.setCategoryId ?? "" }
            .sorted { a, b in
                let sa = byId[a.key]?.sortOrder ?? Int.max, sb = byId[b.key]?.sortOrder ?? Int.max
                return sa == sb ? a.key < b.key : sa < sb
            }

        List {
            Section {
                if rules.isEmpty {
                    Text("Rules run on every new transaction, before anything else. Tap + to create one, or tap \"Create rule\" when you fix a transaction.")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                } else {
                    Text("\(rules.count) rule\(rules.count == 1 ? "" : "s") across \(grouped.count) categor\(grouped.count == 1 ? "y" : "ies")")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
            }

            ForEach(grouped, id: \.key) { categoryId, group in
                Section {
                    ForEach(group) { rule in
                        Button { editing = rule } label: {
                            RuleCard(rule: rule, categories: byId, accounts: names)
                        }
                        .buttonStyle(.plain)
                        .swipeActions {
                            Button("Delete", systemImage: "trash", role: .destructive) { context.delete(rule) }
                            Button(rule.isEnabled ? "Pause" : "Resume", systemImage: rule.isEnabled ? "pause" : "play") {
                                rule.isEnabled.toggle()
                            }
                            .tint(.gray)
                        }
                    }
                } header: {
                    if let category = byId[categoryId] {
                        HStack(spacing: 6) {
                            Text(category.icon)
                            Text(category.name)
                            Spacer()
                            Text("\(group.count) rule\(group.count == 1 ? "" : "s")").foregroundStyle(Theme.textTertiary)
                        }
                        .textCase(nil)
                    } else {
                        Text("Other")
                    }
                }
            }

            Section {
                ForEach(instructions) { rule in
                    InstructionRow(rule: rule) { instructionsChanged() }
                }
                .onDelete { offsets in
                    for i in offsets { context.delete(instructions[i]) }
                    instructionsChanged()
                }
                HStack {
                    TextField("e.g. Purchases in Japan are Travel", text: $draftInstruction, axis: .vertical)
                        .lineLimit(1...3)
                    Button("Add", systemImage: "plus.circle.fill") {
                        let text = draftInstruction.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !text.isEmpty else { return }
                        context.insert(CategoryRule(text: text))
                        draftInstruction = ""
                        instructionsChanged()
                    }
                    .labelStyle(.iconOnly)
                    .font(.title3)
                    .disabled(draftInstruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            } header: {
                Text("Instructions for Apple Intelligence")
            } footer: {
                Text("For fuzzier cases that exact rules can't catch. Apple Intelligence follows these on this iPhone when it suggests categories.")
            }
        }
        .searchable(text: $search, prompt: "Search rules")
        
            .navigationTitle("Rules")
        .toolbar {
            Menu {
                Button("Tidy up rules", systemImage: "wand.and.rays") { confirmTidy = true }
            } label: {
                Label("More", systemImage: "ellipsis")
            }
            Button("Create rule", systemImage: "plus") { creating = true }
        }
        .confirmationDialog("Tidy up rules?", isPresented: $confirmTidy, titleVisibility: .visible) {
            Button("Tidy up") { tidyMerged = RuleEngine.tidy(context: context) }
        } message: {
            Text("Rules for the same category are combined into one where possible: \"is exactly\" becomes \"contains\", and if one of them marks transactions reviewed, they all do.")
        }
        .alert(tidyMerged == 0 ? "Nothing to combine" : "Combined \(tidyMerged ?? 0) rule\(tidyMerged == 1 ? "" : "s")",
               isPresented: Binding(get: { tidyMerged != nil }, set: { if !$0 { tidyMerged = nil } })) {
            Button("OK", role: .cancel) {}
        }
        .sheet(isPresented: $creating) { RuleEditor(rule: nil) }
        .sheet(item: $editing) { rule in RuleEditor(rule: rule) }
    }

    private func instructionsChanged() {
        try? context.save()
        AICategorizer.reconsiderUnreviewed(context: context)
        Task { await app.autoCategorize(context: context) }
    }
}

private struct RuleCard: View {
    let rule: TransactionRule
    let categories: [String: BudgetCategory]
    let accounts: [String: String]

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(RuleEngine.conditionLines(rule, categories: categories, accounts: accounts), id: \.self) {
                    Text($0).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                }
                ForEach(RuleEngine.actionLines(rule, categories: categories), id: \.self) {
                    Text($0).font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
                Group {
                    if !rule.isEnabled {
                        Text("Paused")
                    } else if let last = rule.lastAppliedAt {
                        Text("\(rule.timesApplied) transaction\(rule.timesApplied == 1 ? "" : "s") updated · Last applied \(last.formatted(.relative(presentation: .named)))")
                    } else {
                        Text("Not applied yet")
                    }
                }
                .font(.footnote.italic())
                .foregroundStyle(Theme.textTertiary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, 6)
        .opacity(rule.isEnabled ? 1 : 0.55)
        .contentShape(Rectangle())
    }
}

private struct InstructionRow: View {
    @Bindable var rule: CategoryRule
    let onChange: () -> Void

    var body: some View {
        Toggle(isOn: $rule.isEnabled) {
            Text(rule.text).foregroundStyle(rule.isEnabled ? Theme.text : Theme.textTertiary)
        }
        .onChange(of: rule.isEnabled) { _, _ in onChange() }
    }
}

// MARK: - Editor

/// Create or edit a rule: Settings (conditions + actions) and Preview (matches).
struct RuleEditor: View {
    /// Nil to create a new rule.
    let rule: TransactionRule?
    /// Optional starting values when creating from a transaction.
    var prefill: ((TransactionRule) -> Void)?
    /// The transaction the rule is being made from, to offer its text.
    var source: LocalTransaction?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]

    @State private var draft = TransactionRule()
    @State private var tab = 0
    @State private var loaded = false
    @State private var confirmDelete = false

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let matcher = RuleEngine.Matcher(draft)
        let matches = RuleEngine.hasConditions(draft) ? transactions.filter { matcher.matches($0) } : []
        let canSave = RuleEngine.hasConditions(draft) && RuleEngine.hasActions(draft)

        NavigationStack {
            VStack(spacing: 0) {
                Picker("View", selection: $tab) {
                    Text("Settings").tag(0)
                    Text("Preview (\(matches.count))").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16).padding(.vertical, 8)

                if tab == 0 {
                    settings(byId: byId)
                } else {
                    List(matches) { tx in
                        TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] }, quickEdit: false)
                    }
                    .overlay {
                        if matches.isEmpty {
                            ContentUnavailableView("No Matches", systemImage: "line.3.horizontal.decrease.circle",
                                                   description: Text("Add a condition in Settings to see which transactions match."))
                        }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
            
            .navigationTitle(rule == nil ? "Create rule" : "Edit rule")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
                if rule != nil {
                    ToolbarItem(placement: .destructiveAction) {
                        Button("Delete", systemImage: "trash", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    if !matches.isEmpty {
                        Text("Also updates \(matches.count) existing transaction\(matches.count == 1 ? "" : "s")")
                            .font(.footnote).foregroundStyle(Theme.textSecondary)
                    }
                    Button {
                        save(matches: matches, categories: byId)
                    } label: {
                        Text(rule == nil ? "Create rule" : "Save rule").font(.headline)
                            .frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!canSave)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(.bar)
            }
            .confirmationDialog("Delete this rule?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Rule", role: .destructive) {
                    if let rule { context.delete(rule) }
                    dismiss()
                }
            } message: {
                Text("Transactions it already changed stay as they are.")
            }
        }
        .onAppear(perform: load)
    }

    @ViewBuilder
    private func settings(byId: [String: BudgetCategory]) -> some View {
        let accountNames = Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
        Form {
            Section("If the transaction matches…") {
                NavigationLink {
                    TextListConditionEditor(title: "Original statement", mode: $draft.statementMatch, values: $draft.statementTexts,
                                            suggestion: source?.transactionDescription)
                } label: {
                    ConditionRow(title: "Original statement", value: conditionSummary(draft.statementTexts, mode: draft.statementMatch))
                }
                NavigationLink {
                    TextListConditionEditor(title: "Merchant name", mode: $draft.merchantMatch, values: $draft.merchantTexts,
                                            suggestion: source?.baseTitle)
                } label: {
                    ConditionRow(title: "Merchant name", value: conditionSummary(draft.merchantTexts, mode: draft.merchantMatch))
                }
                NavigationLink {
                    AmountConditionEditor(rule: draft)
                } label: {
                    ConditionRow(title: "Amount", value: RuleEngine.conditionLines(amountOnly(draft), categories: byId, accounts: [:]).first?
                        .replacingOccurrences(of: "If ", with: ""))
                }
                NavigationLink {
                    MultiSelectList(title: "Categories", selection: setBinding(\.categoryIds),
                                    options: [("", "Uncategorized", nil)] + categories.filter { $0.parentId != nil }
                                        .map { ($0.id, "\($0.icon)  \($0.name)", nil) })
                } label: {
                    ConditionRow(title: "Categories", value: draft.categoryIds.isEmpty ? nil : "\(draft.categoryIds.count) selected")
                }
                NavigationLink {
                    MultiSelectList(title: "Accounts", selection: setBinding(\.accountIds),
                                    options: accounts.map { ($0.providerAccountId, $0.displayName, $0.institutionName) })
                } label: {
                    ConditionRow(title: "Accounts", value: draft.accountIds.isEmpty ? nil
                                 : draft.accountIds.compactMap { accountNames[$0] }.joined(separator: ", "))
                }
            }

            Section("Then apply these updates") {
                LabeledContent("Rename merchant") {
                    TextField("Keep name", text: $draft.renameTo).multilineTextAlignment(.trailing)
                }
                NavigationLink {
                    CategoryPickerView(selectedId: draft.setCategoryId) { draft.setCategoryId = $0?.id }
                } label: {
                    ConditionRow(title: "Update category",
                                 value: draft.setCategoryId.flatMap { byId[$0] }.map { "\($0.icon) \($0.name)" })
                }
                Picker("Review status", selection: $draft.reviewAction) {
                    Text("No change").tag("")
                    Text("Mark as reviewed").tag("reviewed")
                    Text("Mark as needs review").tag("needsReview")
                }
                Toggle("Hide transaction", isOn: $draft.hide)
                LabeledContent("Add tag") {
                    TextField("None", text: $draft.addTag).multilineTextAlignment(.trailing)
                        .autocorrectionDisabled()
                }
            }

            if rule != nil {
                Section {
                    Toggle("Rule is on", isOn: $draft.isEnabled)
                }
            }
        }
    }

    private func conditionSummary(_ values: [String], mode: String) -> String? {
        guard !values.isEmpty else { return nil }
        let verb = mode == "exact" ? "is" : "contains"
        return "\(verb) " + values.map { "\"\($0)\"" }.joined(separator: " or ")
    }

    private func amountOnly(_ r: TransactionRule) -> TransactionRule {
        let copy = TransactionRule()
        copy.amountDirection = r.amountDirection
        copy.amountMatch = r.amountMatch
        copy.amountValue = r.amountValue
        copy.amountValue2 = r.amountValue2
        return copy
    }

    private func setBinding(_ keyPath: ReferenceWritableKeyPath<TransactionRule, [String]>) -> Binding<Set<String>> {
        Binding(get: { Set(draft[keyPath: keyPath]) }, set: { draft[keyPath: keyPath] = Array($0).sorted() })
    }

    /// The draft is an unsaved copy so Close discards changes.
    private func load() {
        guard !loaded else { return }
        loaded = true
        if let rule {
            for (dst, src) in [(\TransactionRule.statementMatch, rule.statementMatch), (\.merchantMatch, rule.merchantMatch),
                               (\.amountDirection, rule.amountDirection), (\.amountMatch, rule.amountMatch),
                               (\.renameTo, rule.renameTo), (\.reviewAction, rule.reviewAction)] as [(ReferenceWritableKeyPath<TransactionRule, String>, String)] {
                draft[keyPath: dst] = src
            }
            draft.statementTexts = RuleEngine.statementValues(rule)
            draft.merchantTexts = RuleEngine.merchantValues(rule)
            draft.amountValue = rule.amountValue
            draft.amountValue2 = rule.amountValue2
            draft.categoryIds = rule.categoryIds
            draft.accountIds = rule.accountIds
            draft.setCategoryId = rule.setCategoryId
            draft.hide = rule.hide
            draft.addTag = rule.addTag
            draft.isEnabled = rule.isEnabled
        } else {
            prefill?(draft)
        }
    }

    private func save(matches: [LocalTransaction], categories: [String: BudgetCategory]) {
        let target: TransactionRule
        if let rule {
            target = rule
        } else {
            target = TransactionRule()
            context.insert(target)
        }
        target.statementMatch = draft.statementTexts.isEmpty ? "" : (draft.statementMatch.isEmpty ? "contains" : draft.statementMatch)
        target.statementTexts = draft.statementTexts
        target.statementText = "" // fully migrated to statementTexts as of this save
        target.merchantMatch = draft.merchantTexts.isEmpty ? "" : (draft.merchantMatch.isEmpty ? "exact" : draft.merchantMatch)
        target.merchantTexts = draft.merchantTexts
        target.merchantText = "" // fully migrated to merchantTexts as of this save
        target.amountDirection = draft.amountDirection
        target.amountMatch = draft.amountMatch
        target.amountValue = draft.amountValue
        target.amountValue2 = draft.amountValue2
        target.categoryIds = draft.categoryIds
        target.accountIds = draft.accountIds
        target.renameTo = draft.renameTo.trimmingCharacters(in: .whitespaces)
        target.setCategoryId = draft.setCategoryId
        target.reviewAction = draft.reviewAction
        target.hide = draft.hide
        target.addTag = draft.addTag.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
        target.isEnabled = draft.isEnabled
        if target.isEnabled {
            RuleEngine.applyToExisting(target, transactions: matches, categories: categories)
        }
        try? context.save()
        // Lossless only: merges this rule with others that are identical
        // except for which text they match. Broadening "exact" to "contains"
        // stays behind the explicit "Tidy up rules" confirmation, since that
        // can change what someone else's rule matches.
        _ = RuleEngine.consolidate(context: context)
        dismiss()
    }
}

private struct ConditionRow: View {
    let title: String
    let value: String?
    var body: some View {
        LabeledContent(title) {
            if let value { Text(value).foregroundStyle(Theme.brand).lineLimit(1) }
        }
    }
}

/// Matches if the transaction matches any one of several text values —
/// e.g. statement contains "UBER" or "LYFT" — all under one shared match mode.
private struct TextListConditionEditor: View {
    let title: String
    @Binding var mode: String
    @Binding var values: [String]
    var suggestion: String?
    @State private var newValue = ""
    /// Rows with stable ids, so deleting one doesn't shift text into the wrong field.
    @State private var rows: [Row] = []

    private struct Row: Identifiable {
        let id = UUID()
        var text: String
    }

    var body: some View {
        Form {
            Section {
                Picker("Match", selection: Binding(get: { mode.isEmpty ? "contains" : mode }, set: { mode = $0 })) {
                    Text("Contains").tag("contains")
                    Text("Exactly matches").tag("exact")
                }
                .pickerStyle(.segmented)
            } footer: {
                Text(values.count > 1 ? "Matches if it \(mode == "exact" ? "exactly equals" : "contains") any one of the values below."
                                     : "Trim it to the part that's the same every time — drop dates, store numbers and card digits.")
            }

            Section {
                ForEach($rows) { $row in
                    TextField("Value", text: $row.text, axis: .vertical)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .padding(.vertical, 4)
                        .swipeActions {
                            Button("Remove", systemImage: "trash", role: .destructive) {
                                rows.removeAll { $0.id == row.id }
                            }
                        }
                }
                HStack {
                    TextField("Add another value", text: $newValue, axis: .vertical)
                        .lineLimit(1...4)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Add", systemImage: "plus.circle.fill") { addNewValue() }
                        .labelStyle(.iconOnly)
                        .disabled(newValue.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } header: {
                Text(title)
            }

            if let suggestion, !suggestion.isEmpty {
                Section("From this transaction") {
                    Button {
                        addValue(suggestion)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(suggestion).font(.callout.monospaced()).foregroundStyle(Theme.text)
                            Text("Add the full text").font(.caption).foregroundStyle(Theme.brand)
                        }
                    }
                    let prefix = RuleEngine.statementPrefix(suggestion)
                    if prefix != suggestion {
                        Button {
                            addValue(prefix)
                            mode = "contains"
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(prefix).font(.callout.monospaced()).foregroundStyle(Theme.text)
                                Text("Add just the start (recommended)").font(.caption).foregroundStyle(Theme.brand)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(title)
        .onAppear {
            if mode.isEmpty { mode = title == "Merchant name" ? "exact" : "contains" }
            if rows.map(\.text) != values { rows = values.map { Row(text: $0) } }
        }
        .onChange(of: rows.map(\.text)) { _, texts in
            if texts != values { values = texts }
        }
    }

    private func addNewValue() {
        let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        addValue(trimmed)
        newValue = ""
    }

    private func addValue(_ value: String) {
        guard !rows.contains(where: { $0.text == value }) else { return }
        rows.append(Row(text: value))
    }
}

private struct AmountConditionEditor: View {
    @Bindable var rule: TransactionRule

    var body: some View {
        Form {
            Picker("Type", selection: $rule.amountDirection) {
                Text("Any").tag("")
                Text("Debit (money out)").tag("debit")
                Text("Credit (money in)").tag("credit")
            }
            Picker("Amount", selection: $rule.amountMatch) {
                Text("Any amount").tag("")
                Text("Equals").tag("equals")
                Text("Over").tag("greater")
                Text("Under").tag("less")
                Text("Between").tag("between")
            }
            if !rule.amountMatch.isEmpty {
                LabeledContent(rule.amountMatch == "between" ? "From" : "Amount") {
                    TextField("0", value: $rule.amountValue, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                }
                if rule.amountMatch == "between" {
                    LabeledContent("To") {
                        TextField("0", value: $rule.amountValue2, format: .currency(code: "USD"))
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }
            }
        }
        .navigationTitle("Amount")
    }
}

/// Shown after the user overrides an AI suggestion: offer a one-tap rule.
struct TeachWooliCard: View {
    /// What the rule will match, e.g. the statement prefix.
    let merchant: String
    let category: BudgetCategory
    let onCreate: () -> Void
    let onCustomize: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Create a rule?", systemImage: "wand.and.stars").font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.brand)
                Spacer()
                Button("Not now", systemImage: "xmark", action: onDismiss)
                    .labelStyle(.iconOnly).foregroundStyle(Theme.textTertiary)
            }
            Text("Always put transactions containing **\(merchant)** in \(category.icon) **\(category.name)**, including the ones you haven't reviewed yet.")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
            HStack {
                Button("Create rule", action: onCreate).buttonStyle(.borderedProminent)
                Button("Customize…", action: onCustomize).buttonStyle(.bordered)
            }
            .controlSize(.small)
        }
        .padding(14)
        .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
