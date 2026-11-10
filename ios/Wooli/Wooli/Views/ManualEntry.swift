import SwiftUI
import SwiftData

/// Accounts and transactions the user types in, instead of (or alongside)
/// SimpleFIN. They're ordinary `LocalAccount` / `LocalTransaction` records
/// whose ids start with `manual-`, so bank sync never matches or removes them.
enum ManualEntry {
    static let idPrefix = "manual-"
    static func newId() -> String { idPrefix + UUID().uuidString }

    /// Today's point on the balance chart, like a sync would record.
    static func recordSnapshot(for account: LocalAccount, context: ModelContext) {
        let today = Calendar.current.startOfDay(for: .now)
        let id = account.providerAccountId
        let existing = (try? context.fetch(FetchDescriptor<BalanceSnapshot>(
            predicate: #Predicate { $0.accountId == id && $0.day == today }))) ?? []
        if let snap = existing.first {
            snap.balance = account.balance
        } else {
            context.insert(BalanceSnapshot(accountId: id, day: today, balance: account.balance))
        }
        account.balanceDate = .now
    }

    /// Removes a manual transaction and takes it back out of its account's balance.
    static func delete(_ transaction: LocalTransaction, context: ModelContext) {
        let accountId = transaction.accountId
        if let account = try? context.fetch(FetchDescriptor<LocalAccount>(
            predicate: #Predicate { $0.providerAccountId == accountId })).first {
            account.balance -= transaction.amount
            recordSnapshot(for: account, context: context)
        }
        context.delete(transaction)
        try? context.save()
    }

    /// Removes a manual account with its transactions and balance history.
    static func delete(_ account: LocalAccount, context: ModelContext) {
        let id = account.providerAccountId
        try? context.delete(model: LocalTransaction.self, where: #Predicate { $0.accountId == id })
        try? context.delete(model: BalanceSnapshot.self, where: #Predicate { $0.accountId == id })
        context.delete(account)
        try? context.save()
    }
}

extension LocalAccount {
    var isManual: Bool { providerAccountId.hasPrefix(ManualEntry.idPrefix) }
}

extension LocalTransaction {
    var isManual: Bool { providerTransactionId.hasPrefix(ManualEntry.idPrefix) }
}

// MARK: - Add account

struct AddAccountSheet: View {
    var onCreate: (LocalAccount) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @State private var name = ""
    @State private var institution = ""
    @State private var kind: AccountKind = .checking
    @State private var balance: Double?

    private var isDebt: Bool { !kind.isAsset }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name, prompt: Text("e.g. Everyday Checking, Cash"))
                    Picker("Type", selection: $kind) {
                        ForEach(AccountKind.allCases) { Text($0.singularLabel).tag($0) }
                    }
                    TextField("Bank (optional)", text: $institution, prompt: Text("e.g. Chase"))
                }
                Section {
                    TextField(isDebt ? "Amount owed" : "Current balance", value: $balance, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad)
                } footer: {
                    Text("Wooli adds and subtracts the transactions you enter. You can correct the balance any time from the account.")
                }
            }
            .navigationTitle("New Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() {
        let amount = balance ?? 0
        let account = LocalAccount(providerAccountId: ManualEntry.newId(),
                                   name: name.trimmingCharacters(in: .whitespaces),
                                   institutionName: institution.trimmingCharacters(in: .whitespaces),
                                   currency: "USD",
                                   // Debts are stored negative, like SimpleFIN reports them.
                                   balance: isDebt ? -abs(amount) : amount,
                                   balanceDate: .now, kind: kind)
        context.insert(account)
        ManualEntry.recordSnapshot(for: account, context: context)
        try? context.save()
        onCreate(account)
        dismiss()
    }
}

// MARK: - Add transaction

struct AddTransactionSheet: View {
    /// Pre-selected account (when opened from an account).
    var accountId: String?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalAccount.name) private var accounts: [LocalAccount]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]

    @State private var isIncome = false
    @State private var amount: Double?
    @State private var payee = ""
    @State private var date = Date.now
    @State private var selectedAccountId: String?
    @State private var categoryId: String?
    @State private var note = ""
    @State private var showAddAccount = false

    private var manualAccounts: [LocalAccount] { accounts.filter(\.isManual) }

    var body: some View {
        let category = categoryId.flatMap { id in categories.first { $0.id == id } }

        NavigationStack {
            Form {
                Section {
                    Picker("Kind", selection: $isIncome) {
                        Text("Expense").tag(false)
                        Text("Income").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())

                    TextField("Amount", value: $amount, format: .currency(code: "USD"))
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .keyboardType(.decimalPad)
                    TextField(isIncome ? "From" : "Paid to", text: $payee, prompt: Text(isIncome ? "e.g. Paycheck" : "e.g. Trader Joe's"))
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                }

                Section {
                    if manualAccounts.isEmpty {
                        Button("Add an account first", systemImage: "plus.circle") { showAddAccount = true }
                    } else {
                        Picker("Account", selection: $selectedAccountId) {
                            ForEach(manualAccounts) { Text($0.displayName).tag(String?.some($0.providerAccountId)) }
                        }
                    }
                    NavigationLink {
                        CategoryPickerView(selectedId: categoryId) { categoryId = $0?.id }
                    } label: {
                        LabeledContent("Category") {
                            Text(category.map { "\($0.icon) \($0.name)" } ?? "Choose")
                                .foregroundStyle(category == nil ? Theme.textTertiary : Theme.text)
                        }
                    }
                } footer: {
                    Text("Bank-synced accounts aren't listed — their transactions come from SimpleFIN.")
                        .opacity(manualAccounts.count < accounts.count ? 1 : 0)
                }

                Section {
                    TextField("Note", text: $note, axis: .vertical)
                }
            }
            .navigationTitle(isIncome ? "New Income" : "New Expense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .disabled((amount ?? 0) == 0 || selectedAccountId == nil)
                }
            }
            .sheet(isPresented: $showAddAccount) {
                AddAccountSheet { selectedAccountId = $0.providerAccountId }
            }
            .onAppear {
                selectedAccountId = selectedAccountId ?? accountId ?? manualAccounts.first?.providerAccountId
            }
        }
    }

    private func save() {
        guard let selectedAccountId, let value = amount, value != 0 else { return }
        let signed = isIncome ? abs(value) : -abs(value)
        let title = payee.trimmingCharacters(in: .whitespaces)
        let tx = LocalTransaction(providerTransactionId: ManualEntry.newId(), accountId: selectedAccountId,
                                  amount: signed, transactionDescription: title.isEmpty ? (isIncome ? "Income" : "Expense") : title,
                                  payee: title.isEmpty ? nil : title, transactedAt: date, isPending: false)
        tx.categoryId = categoryId
        tx.note = note
        // You chose the category yourself, so there's nothing to review.
        tx.needsReview = categoryId == nil
        context.insert(tx)
        if let account = manualAccounts.first(where: { $0.providerAccountId == selectedAccountId }) {
            account.balance += signed
            ManualEntry.recordSnapshot(for: account, context: context)
        }
        try? context.save()
        dismiss()
    }
}

// MARK: - Manual account controls (account detail)

/// Balance correction, add transaction, and delete — shown on manual accounts.
struct ManualAccountControls: View {
    @Bindable var account: LocalAccount
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var showAddTransaction = false
    @State private var editingBalance: Double?
    @State private var confirmDelete = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel("Manual account").padding(.bottom, 10)
            Button {
                showAddTransaction = true
            } label: {
                Label("Add transaction", systemImage: "plus.circle.fill").padding(.vertical, 12)
            }
            Divider()
            LabeledContent(account.kind.isAsset ? "Balance" : "Amount owed") {
                TextField("Balance", value: Binding(
                    get: { editingBalance ?? abs(account.balance) },
                    set: { editingBalance = $0 }), format: .currency(code: account.currency))
                    .multilineTextAlignment(.trailing)
                    .keyboardType(.decimalPad)
                    .onSubmit(saveBalance)
            }
            .padding(.vertical, 12)
            if editingBalance != nil {
                Button("Save balance", action: saveBalance)
                    .font(.subheadline.weight(.semibold))
                    .padding(.bottom, 10)
            }
            Divider()
            Button("Delete account", role: .destructive) { confirmDelete = true }
                .padding(.vertical, 12)
        }
        .card()
        .sheet(isPresented: $showAddTransaction) { AddTransactionSheet(accountId: account.providerAccountId) }
        .confirmationDialog("Delete \(account.displayName)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete Account and Transactions", role: .destructive) {
                dismiss()
                // Delete after the pop finishes so the account screen never draws a deleted record.
                Task {
                    try? await Task.sleep(for: .milliseconds(400))
                    ManualEntry.delete(account, context: context)
                }
            }
        } message: {
            Text("This removes the account, every transaction in it, and its balance history from this \(ThisDevice.name) and your iCloud.")
        }
    }

    private func saveBalance() {
        guard let value = editingBalance else { return }
        account.balance = account.kind.isAsset ? value : -abs(value)
        ManualEntry.recordSnapshot(for: account, context: context)
        try? context.save()
        editingBalance = nil
    }
}

/// Toolbar "+" for Accounts and Transactions.
struct ManualAddMenu: View {
    @State private var showAccount = false
    @State private var showTransaction = false

    var body: some View {
        Menu {
            Button("Add Transaction", systemImage: "list.bullet.rectangle") { showTransaction = true }
            Button("Add Account", systemImage: "building.columns") { showAccount = true }
        } label: {
            Label("Add", systemImage: "plus")
        }
        .sheet(isPresented: $showAccount) { AddAccountSheet() }
        .sheet(isPresented: $showTransaction) { AddTransactionSheet() }
    }
}
