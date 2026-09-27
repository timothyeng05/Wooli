import SwiftUI
import SwiftData

/// Build a spending summary and share it to the Claude app (or copy it), so
/// the user can analyze it with their own Claude plan. Nothing is sent
/// anywhere until they tap Share or Copy.
struct AnalyzeWithClaudeView: View {
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @State private var options = ClaudeExport.Options()
    @State private var copied = false

    static let suggestedQuestions = [
        "Where can I cut back?",
        "Anything unusual or surprising?",
        "Compare this month to last month",
        "Which subscriptions should I cancel?",
        "Am I on track with my budget?",
    ]

    var body: some View {
        let text = ClaudeExport(options: options, transactions: transactions, categories: categories, accounts: accounts).text

        NavigationStack {
            Form {
                Section {
                    TextField("Ask anything about your spending", text: $options.question, axis: .vertical)
                        .lineLimit(1...4)
                    FlowLayout(spacing: 8) {
                        ForEach(Self.suggestedQuestions, id: \.self) { q in
                            Chip(label: q, selected: options.question == q) { options.question = q }
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Question")
                }

                Section("Period") {
                    Picker("Period", selection: $options.period) {
                        ForEach(ClaudeExport.Period.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: options.period) { _, new in
                        if new == .both && options.question.isEmpty { options.question = "Compare this month to last month" }
                    }
                }

                Section {
                    Toggle("Transaction list", isOn: $options.includeTransactions)
                    Toggle("Account names", isOn: $options.includeAccountNames)
                    Toggle("Bank statement text", isOn: $options.includeStatements)
                    Toggle("Transfers & card payments", isOn: $options.includeTransfers)
                } header: {
                    Text("Include")
                } footer: {
                    Text(options.includeAccountNames
                         ? "Account names are included as they appear in Wooli."
                         : "Accounts are shown by type (e.g. \"Credit Card\"), not by name or number.")
                }

                Section {
                    Text(text.count > 3500 ? String(text.prefix(3500)) + "\n…" : text)
                        .font(.caption.monospaced())
                        .foregroundStyle(Theme.textSecondary)
                        .textSelection(.enabled)
                } header: {
                    Text("Preview")
                } footer: {
                    Text("\(text.count.formatted()) characters. This is exactly what you'll share — nothing leaves your iPhone until you tap Share or Copy.")
                }
            }
            .navigationTitle("Analyze with Claude")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    HStack(spacing: 12) {
                        Button {
                            UIPasteboard.general.string = text
                            withAnimation { copied = true }
                        } label: {
                            Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                                .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                        }
                        .buttonStyle(.bordered)
                        ShareLink(item: text, subject: Text("My spending"),
                                  preview: SharePreview("Spending summary from Wooli")) {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .controlSize(.large)
                    Text("Pick the Claude app in the share sheet, or paste into a chat.")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                }
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(.bar)
            }
        }
    }
}
