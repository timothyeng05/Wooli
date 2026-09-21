import SwiftUI
import SwiftData

struct AccountsView: View {
    var onDisconnect: () -> Void

    @Environment(\.modelContext) private var modelContext
    @Query(sort: \LocalAccount.name) private var accounts: [LocalAccount]
    @State private var isSyncing = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.red)
                }
                ForEach(accounts) { account in
                    NavigationLink(value: account) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(account.name).font(.headline)
                                Text(account.institutionName).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(account.balance, format: .currency(code: account.currency))
                        }
                    }
                }
            }
            .overlay {
                if accounts.isEmpty && !isSyncing {
                    ContentUnavailableView("No accounts yet", systemImage: "building.columns", description: Text("Tap refresh to sync from SimpleFIN."))
                }
            }
            .navigationTitle("Accounts")
            .navigationDestination(for: LocalAccount.self) { account in
                TransactionsView(accountId: account.providerAccountId, accountName: account.name)
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        sync()
                    } label: {
                        if isSyncing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(isSyncing)
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Disconnect", role: .destructive, action: onDisconnect)
                }
            }
            .task { sync() }
        }
    }

    private func sync() {
        isSyncing = true
        errorMessage = nil
        Task {
            do {
                try await SyncService.sync(modelContext: modelContext)
            } catch {
                errorMessage = error.localizedDescription
            }
            isSyncing = false
        }
    }
}
