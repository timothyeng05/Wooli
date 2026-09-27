import SwiftUI
import SwiftData

struct TransactionDetailView: View {
    @Bindable var transaction: LocalTransaction

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]

    private var category: BudgetCategory? {
        transaction.categoryId.flatMap { id in categories.first { $0.id == id } }
    }
    private var account: LocalAccount? {
        accounts.first { $0.providerAccountId == transaction.accountId }
    }

    var body: some View {
        Form {
            Section {
                VStack(spacing: 10) {
                    CategoryBadge(category: category, size: 64)
                    Text(transaction.title)
                        .font(.title3.weight(.semibold))
                        .multilineTextAlignment(.center)
                    Text(transaction.amount.signedCurrency())
                        .font(.system(.largeTitle, design: .rounded).weight(.bold))
                        .monospacedDigit()
                        .foregroundStyle(transaction.amount > 0 ? .green : .primary)
                    Text(transaction.transactedAt.formatted(date: .complete, time: .omitted))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    if transaction.isPending {
                        Text("Pending")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10).padding(.vertical, 3)
                            .background(.orange.opacity(0.15), in: Capsule())
                            .foregroundStyle(.orange)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section {
                NavigationLink {
                    CategoryPickerView(selectedId: transaction.categoryId) { picked in
                        Categorizer.assign(picked, to: transaction)
                    }
                } label: {
                    LabeledContent("Category") {
                        if let category {
                            Text("\(category.icon) \(category.name)")
                        } else {
                            Text("Choose…").foregroundStyle(.orange)
                        }
                    }
                }
                if transaction.isTransfer {
                    Label("Transfers aren't counted as income or spending.", systemImage: "arrow.left.arrow.right")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                LabeledContent("Account", value: account?.displayName ?? "—")
            }

            Section("Note") {
                TextField("Add a note", text: $transaction.note, axis: .vertical)
            }

            Section {
                Toggle("Hide from Reports", isOn: $transaction.isHidden)
            } footer: {
                Text("Hidden transactions stay in your list but aren't counted in budgets or totals.")
            }

            Section("Bank Description") {
                Text(transaction.transactionDescription)
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
        }
        .navigationTitle("Transaction")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if transaction.needsReview {
                VStack(spacing: 6) {
                    Button {
                        withAnimation {
                            if Categorizer.confirm(transaction, categories: categories, context: context) { dismiss() }
                        }
                    } label: {
                        Label("Mark as Reviewed", systemImage: "checkmark")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(transaction.categoryId == nil)

                    if transaction.categoryId == nil {
                        Text("Choose a category first.").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
                .background(.bar)
            }
        }
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
                                    CategoryBadge(category: option, size: 30)
                                    Text(option.name).foregroundStyle(.primary)
                                    Spacer()
                                    if option.id == selectedId {
                                        Image(systemName: "checkmark").foregroundStyle(Color.accentColor).fontWeight(.semibold)
                                    }
                                }
                            }
                        }
                    } header: {
                        Text("\(parent.icon)  \(parent.name)")
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
