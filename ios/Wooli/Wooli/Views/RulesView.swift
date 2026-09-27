import SwiftUI
import SwiftData

/// Plain-English rules the on-device categorizer follows.
struct RulesView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \CategoryRule.createdAt) private var rules: [CategoryRule]
    @State private var draft = ""
    @FocusState private var focused: Bool

    var body: some View {
        List {
            Section {
                TextField("e.g. Rentaltoll charges are Car", text: $draft, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($focused)
                Button("Add Rule", systemImage: "plus") { add() }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            } header: {
                Text("New Rule")
            } footer: {
                Text("Write it the way you'd tell a person. Apple Intelligence follows these on this iPhone when it suggests categories, and re-checks anything you haven't reviewed yet.")
            }

            if !rules.isEmpty {
                Section("Your Rules") {
                    ForEach(rules) { rule in
                        RuleRow(rule: rule) { changed() }
                    }
                    .onDelete { offsets in
                        for i in offsets { context.delete(rules[i]) }
                        changed()
                    }
                }
            }

            Section("Examples") {
                ForEach(Self.examples, id: \.self) { example in
                    Button {
                        draft = example
                        focused = true
                    } label: {
                        Label(example, systemImage: "text.quote").foregroundStyle(Theme.text)
                    }
                }
            }
        }
        .navigationTitle("Categorization Rules")
        .toolbar { EditButton() }
    }

    static let examples = [
        "Venmo payments to Maya are Rent",
        "Anything from Target under $15 is Groceries",
        "Transfers to Fidelity or Schwab are Transfer, not spending",
        "Parking and tolls are Car",
    ]

    private func add() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        context.insert(CategoryRule(text: text))
        draft = ""
        changed()
    }

    private func changed() {
        try? context.save()
        AICategorizer.reconsiderUnreviewed(context: context)
        Task { await app.autoCategorize(context: context) }
    }
}

private struct RuleRow: View {
    @Bindable var rule: CategoryRule
    let onChange: () -> Void

    var body: some View {
        Toggle(isOn: $rule.isEnabled) {
            Text(rule.text).foregroundStyle(rule.isEnabled ? Theme.text : Theme.textTertiary)
        }
        .onChange(of: rule.isEnabled) { _, _ in onChange() }
    }
}

/// Shown after the user corrects an AI suggestion: offer to save the fix as a rule.
struct TeachWooliCard: View {
    let suggestion: String
    let onSave: (String) -> Void
    let onDismiss: () -> Void
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Teach Wooli", systemImage: "sparkles").font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.brand)
                Spacer()
                Button("Not now", systemImage: "xmark", action: onDismiss)
                    .labelStyle(.iconOnly).foregroundStyle(Theme.textTertiary)
            }
            Text("Save this as a rule so Apple Intelligence gets it right next time.")
                .font(.footnote).foregroundStyle(Theme.textSecondary)
            TextField("Rule", text: $text, axis: .vertical)
                .lineLimit(1...3)
                .padding(10)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Theme.border))
            Button("Save Rule") { onSave(text.trimmingCharacters(in: .whitespacesAndNewlines)) }
                .buttonStyle(.borderedProminent)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(14)
        .background(Theme.brandSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .onAppear { text = suggestion }
    }
}
