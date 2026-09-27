import SwiftUI
import SwiftData

struct AccountsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalAccount.name) private var accounts: [LocalAccount]
    @State private var showSettings = false

    var body: some View {
        let visible = accounts.filter { !$0.isHidden }
        let hidden = accounts.filter(\.isHidden)
        let netWorth = visible.reduce(0) { $0 + $1.netWorthValue }

        NavigationStack {
            List {
                if app.mode == .sample || app.syncError != nil || !app.bankMessages.isEmpty {
                    Section {
                        StatusBanner()
                        ForEach(app.bankMessages, id: \.self) { message in
                            Label(message, systemImage: "building.columns")
                                .font(.footnote).foregroundStyle(.orange)
                        }
                    }
                }

                Section {
                    LabeledContent {
                        Text(netWorth.currency())
                            .font(.title3.weight(.semibold)).monospacedDigit()
                            .foregroundStyle(.primary)
                    } label: {
                        Text("Net Worth").font(.title3.weight(.semibold))
                    }
                }

                ForEach(AccountKind.allCases) { kind in
                    let group = visible.filter { $0.kind == kind }
                    if !group.isEmpty {
                        Section {
                            ForEach(group) { account in
                                NavigationLink {
                                    AccountDetailView(account: account)
                                } label: {
                                    AccountRow(account: account)
                                }
                            }
                        } header: {
                            HStack {
                                Text(kind.label)
                                Spacer()
                                Text(group.reduce(0) { $0 + abs($1.balance) }.currency(cents: false))
                                    .monospacedDigit()
                            }
                        }
                    }
                }

                if !hidden.isEmpty {
                    Section {
                        ForEach(hidden) { account in
                            NavigationLink {
                                AccountDetailView(account: account)
                            } label: {
                                AccountRow(account: account).opacity(0.5)
                            }
                        }
                    } header: {
                        Text("Hidden")
                    } footer: {
                        Text("Hidden accounts aren't included in net worth, budgets, or the review queue.")
                    }
                }
            }
            .overlay {
                if accounts.isEmpty {
                    if app.isSyncing {
                        ProgressView("Syncing with your banks…")
                    } else {
                        ContentUnavailableView("No Accounts", systemImage: "building.columns",
                                               description: Text("Pull down to sync from SimpleFIN."))
                    }
                }
            }
            .navigationTitle("Accounts")
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { SyncButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Settings", systemImage: "gearshape") { showSettings = true }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let last = app.lastSyncAt, app.mode == .live {
                    Text("Updated \(last, format: .relative(presentation: .named))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(6)
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }
}

private struct AccountRow: View {
    let account: LocalAccount

    var body: some View {
        HStack(spacing: 12) {
            SymbolTile(symbol: account.kind.symbol, tint: account.kind.isAsset ? .accentColor : .orange, size: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(account.displayName).lineLimit(1)
                Text(account.institutionName).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(account.balance.currency(account.currency))
                .monospacedDigit()
                .foregroundStyle(account.kind.isAsset ? Color.primary : Color.red)
        }
    }
}

struct AccountDetailView: View {
    @Bindable var account: LocalAccount

    var body: some View {
        List {
            Section {
                VStack(spacing: 6) {
                    SymbolTile(symbol: account.kind.symbol, tint: account.kind.isAsset ? .accentColor : .orange, size: 56)
                    Text(account.balance.currency(account.currency))
                        .font(.system(.largeTitle, design: .rounded).weight(.bold)).monospacedDigit()
                    Text("\(account.institutionName) · as of \(account.balanceDate.formatted(date: .abbreviated, time: .shortened))")
                        .font(.footnote).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .listRowBackground(Color.clear)
            }

            Section {
                TextField("Nickname", text: $account.nickname, prompt: Text(account.name))
                Picker("Type", selection: $account.kindRaw) {
                    ForEach(AccountKind.allCases) { Text($0.singularLabel).tag($0.rawValue) }
                }
                Toggle("Hide Account", isOn: $account.isHidden)
            } footer: {
                Text("Credit cards and loans count against your net worth.")
            }

            Section {
                NavigationLink("Activity") {
                    TransactionsView(embedded: true, accountId: account.providerAccountId)
                }
            }
        }
        .navigationTitle(account.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }
}
