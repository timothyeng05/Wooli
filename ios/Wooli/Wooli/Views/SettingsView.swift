import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var showConnect = false
    @State private var confirmErase = false
    @AppStorage("displayName") private var displayName = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Your first name", text: $displayName)
                        .textContentType(.givenName)
                } header: {
                    Text("Name")
                } footer: {
                    Text("Used in the dashboard greeting.")
                }

                Section("Bank Connection") {
                    if app.mode == .live {
                        LabeledContent {
                            Text("Connected").foregroundStyle(.green)
                        } label: {
                            Label("SimpleFIN", systemImage: "building.columns.fill")
                        }
                        if let last = app.lastSyncAt {
                            LabeledContent("Last Sync", value: last.formatted(.relative(presentation: .named)))
                        }
                        Button {
                            Task { await app.sync(context: context) }
                        } label: {
                            HStack {
                                Label("Sync Now", systemImage: "arrow.clockwise")
                                if app.isSyncing { Spacer(); ProgressView() }
                            }
                        }
                        .disabled(app.isSyncing)
                    } else {
                        LabeledContent("Status", value: "Sample Data")
                        Button("Connect with SimpleFIN", systemImage: "link") { showConnect = true }
                    }
                }

                Section("Budget") {
                    NavigationLink {
                        CategoriesSettingsView()
                    } label: {
                        Label("Categories", systemImage: "square.grid.2x2")
                    }
                }

                Section {
                    PrivacyRow(symbol: "iphone", text: "Accounts and transactions are stored on this iPhone.")
                    PrivacyRow(symbol: "icloud", text: "They sync only to your own private iCloud. Turn on Advanced Data Protection in iCloud settings for end-to-end encryption.")
                    PrivacyRow(symbol: "key", text: "Your SimpleFIN access key is kept in your iCloud Keychain, end-to-end encrypted like your saved passwords, so a new iPhone connects automatically.")
                    PrivacyRow(symbol: "eye.slash", text: "No analytics, no ads, and no Wooli server.")
                } header: {
                    Text("Privacy")
                }

                Section {
                    Button(app.mode == .live ? "Disconnect and Erase All Data" : "Erase Sample Data", role: .destructive) {
                        confirmErase = true
                    }
                } footer: {
                    Text("Removes the SimpleFIN connection and everything Wooli stored on this iPhone, in your iCloud, and on your other devices.")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog("Erase all Wooli data?", isPresented: $confirmErase, titleVisibility: .visible) {
                Button("Erase All Data", role: .destructive) {
                    dismiss()
                    app.disconnectAndErase(context: context)
                }
            } message: {
                Text("This can't be undone. Your bank accounts themselves aren't affected.")
            }
            .sheet(isPresented: $showConnect) { ConnectSheet() }
        }
    }
}

private struct PrivacyRow: View {
    let symbol: String
    let text: String

    var body: some View {
        Label {
            Text(text).font(.subheadline)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Color.accentColor)
        }
    }
}

struct CategoriesSettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var editing: BudgetCategory?
    @State private var addingTo: BudgetCategory?

    var body: some View {
        List {
            ForEach(categories.filter { $0.parentId == nil }) { parent in
                Section {
                    ForEach(categories.filter { $0.parentId == parent.id }) { child in
                        Button {
                            editing = child
                        } label: {
                            HStack(spacing: 12) {
                                CategoryTile(category: child, size: 30)
                                Text(child.name).foregroundStyle(.primary)
                            }
                        }
                    }
                    .onDelete { offsets in
                        let children = categories.filter { $0.parentId == parent.id }
                        for index in offsets { delete(children[index]) }
                    }
                    Button("Add Category", systemImage: "plus") { addingTo = parent }
                } header: {
                    Button {
                        editing = parent
                    } label: {
                        Text("\(parent.icon)  \(parent.name)")
                    }
                    .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Categories")
        .sheet(item: $editing) { category in
            CategoryEditor(category: category)
        }
        .sheet(item: $addingTo) { parent in
            CategoryEditor(newIn: parent)
        }
    }

    /// Transactions in a deleted category become uncategorized and go back to review.
    private func delete(_ category: BudgetCategory) {
        let id: String? = category.id
        let affected = (try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.categoryId == id }))) ?? []
        for tx in affected {
            tx.categoryId = nil
            tx.isTransfer = false
            tx.needsReview = true
        }
        let categoryId = category.id
        let rules = (try? context.fetch(FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.categoryId == categoryId }))) ?? []
        rules.forEach(context.delete)
        context.delete(category)
    }
}

private struct CategoryEditor: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    private let existing: BudgetCategory?
    private let parent: BudgetCategory?
    @State private var name: String
    @State private var icon: String

    init(category: BudgetCategory) {
        existing = category
        parent = nil
        _name = State(initialValue: category.name)
        _icon = State(initialValue: category.icon)
    }

    init(newIn parent: BudgetCategory) {
        existing = nil
        self.parent = parent
        _name = State(initialValue: "")
        _icon = State(initialValue: "📌")
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Name", text: $name)
                TextField("Emoji", text: $icon)
                    .onChange(of: icon) { _, new in
                        if new.count > 1, let last = new.last { icon = String(last) }
                    }
            }
            .navigationTitle(existing == nil ? "New Category" : "Edit Category")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium])
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if let existing {
            existing.name = trimmed
            existing.icon = icon.isEmpty ? "•" : icon
        } else if let parent {
            context.insert(BudgetCategory(name: trimmed, icon: icon.isEmpty ? "•" : icon, colorHex: parent.colorHex,
                                          parentId: parent.id, isIncome: parent.isIncome, isTransfer: parent.isTransfer,
                                          sortOrder: parent.sortOrder + 99))
        }
        dismiss()
    }
}
