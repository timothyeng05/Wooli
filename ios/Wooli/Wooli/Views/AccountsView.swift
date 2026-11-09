import SwiftUI
import SwiftData
import Charts

/// Account groups shown on the Accounts page.
enum AccountGroup: String, CaseIterable, Identifiable {
    case cash = "Cash", credit = "Credit Cards", investments = "Investments", loans = "Loans"
    var id: String { rawValue }

    var kinds: [AccountKind] {
        switch self {
        case .cash: [.checking, .savings, .other]
        case .credit: [.credit]
        case .investments: [.investment]
        case .loans: [.loan]
        }
    }

    var isAsset: Bool { self == .cash || self == .investments }
}

struct AccountsView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalAccount.name) private var accounts: [LocalAccount]
    @Query private var snapshots: [BalanceSnapshot]
    @State private var range: ChartRange = .month1
    @State private var showSettings = false

    var body: some View {
        let visible = accounts.filter { !$0.isHidden }
        let netWorth = visible.reduce(0) { $0 + $1.netWorthValue }
        let history = BalanceHistory(snapshots: snapshots)
        let start = range.startDate(earliest: history.earliest)
        let series = history.series(for: visible, from: start) { a, b in a.kind.isAsset ? b : -abs(b) }
        let totalAssets = visible.filter { $0.kind.isAsset }.reduce(0) { $0 + $1.balance }
        let totalDebts = visible.filter { !$0.kind.isAsset }.reduce(0) { $0 + abs($1.balance) }

        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if StatusBanner.isVisible(app) { StatusBanner().card(padding: 14) }

                    VStack(alignment: .leading, spacing: 8) {
                        Text(netWorth.currency())
                            .font(.system(size: 34, weight: .bold)).monospacedDigit()
                            .foregroundStyle(Theme.text)
                            .contentTransition(.numericText())
                        ChangeLabel(change: netWorth - (series.first?.value ?? netWorth), base: series.first?.value,
                                    period: range.periodLabel)
                        NetWorthChart(points: series, tint: Color(hex: "#0891b2"))
                            .frame(height: 200)
                            .padding(.vertical, 8)
                        RangePicker(selection: $range)
                    }
                    .padding(.horizontal, 4)

                    ForEach(AccountGroup.allCases) { group in
                        let members = accounts.filter { group.kinds.contains($0.kind) }
                        if !members.isEmpty {
                            AccountGroupCard(group: group, accounts: members, history: history, start: start,
                                             periodLabel: range.periodLabel,
                                             share: group.isAsset ? totalAssets : totalDebts)
                        }
                    }

                    if accounts.isEmpty {
                        VStack(spacing: 8) {
                            if app.isSyncing {
                                ProgressView("Syncing with your banks…")
                            } else {
                                ContentUnavailableView("No Accounts", systemImage: "building.columns",
                                                       description: Text(app.mode == .live ? "Pull down to sync from SimpleFIN."
                                                                         : "Tap + to add an account you keep track of yourself."))
                            }
                        }
                        .card()
                    }

                    if let last = app.lastSyncAt, app.mode == .live {
                        Text("Updated \(last, format: .relative(presentation: .named))")
                            .font(.caption).foregroundStyle(Theme.textTertiary)
                    }
                }
                .padding(16)
            }
            .pageBackground()
            
            .navigationTitle("Accounts")
            .refreshable { await app.sync(context: context) }
            .toolbar {
                ToolbarItem(placement: .wooliLeading) { HamburgerButton() }
                ToolbarItem(placement: .wooliTrailing) { SyncButton() }
                ToolbarItem(placement: .wooliTrailing) { ManualAddMenu() }
                ToolbarItem(placement: .wooliTrailing) {
                    Button("Settings", systemImage: "gearshape") { showSettings = true }
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }
}

private struct AccountGroupCard: View {
    let group: AccountGroup
    let accounts: [LocalAccount]
    let history: BalanceHistory
    let start: Date
    let periodLabel: String
    let share: Double
    @State private var showHidden = false

    var body: some View {
        let visible = accounts.filter { !$0.isHidden }
        let hidden = accounts.filter(\.isHidden)
        // Show the group as its natural sign: assets positive, debts as owed.
        let total = visible.reduce(0) { $0 + (group.isAsset ? $1.balance : -abs($1.balance)) }
        let series = history.series(for: visible, from: start) { _, b in group.isAsset ? b : -abs(b) }
        let change = total - (series.first?.value ?? total)

        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .firstTextBaseline) {
                    Text(group.rawValue).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                    Spacer()
                    Text(total.currency()).font(.title3.weight(.semibold)).monospacedDigit().foregroundStyle(Theme.text)
                }
                HStack {
                    ChangeLabel(change: change, base: series.first?.value, period: periodLabel)
                    Spacer()
                    if share > 0 {
                        Text("\((abs(total) / share).formatted(.percent.precision(.fractionLength(0)))) of \(group.isAsset ? "assets" : "liabilities")")
                            .font(.footnote).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .padding(20)

            ForEach(visible) { account in
                Divider().overlay(Theme.border)
                AccountLink(account: account)
            }

            if !hidden.isEmpty {
                if showHidden {
                    ForEach(hidden) { account in
                        Divider().overlay(Theme.border)
                        AccountLink(account: account).opacity(0.55)
                    }
                }
                Divider().overlay(Theme.border)
                Button {
                    withAnimation { showHidden.toggle() }
                } label: {
                    Label(showHidden ? "Hide hidden accounts" : "Show \(hidden.count) hidden account\(hidden.count == 1 ? "" : "s")",
                          systemImage: showHidden ? "eye.slash" : "eye")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20).padding(.vertical, 16)
                }
                .buttonStyle(.plain)
            }
        }
        .card(padding: 0)
    }
}

private struct AccountLink: View {
    let account: LocalAccount

    var body: some View {
        NavigationLink {
            AccountDetailView(account: account)
        } label: {
            HStack(spacing: 14) {
                InstitutionLogo(name: account.institutionName, size: 44)
                VStack(alignment: .leading, spacing: 3) {
                    Text(account.displayName).font(.body.weight(.medium)).foregroundStyle(Theme.text).lineLimit(1)
                    Text(account.kind.singularLabel).font(.footnote).foregroundStyle(Theme.textSecondary)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(account.balance.currency(account.currency))
                        .font(.body.weight(.semibold)).monospacedDigit().foregroundStyle(Theme.text)
                    Text(account.lastSyncedAt, format: .relative(presentation: .named))
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }
            }
            .padding(.horizontal, 20).padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct AccountDetailView: View {
    @Query(sort: \Person.name) private var people: [Person]

    @Bindable var account: LocalAccount
    @Query private var snapshots: [BalanceSnapshot]
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var range: ChartRange = .month3

    init(account: LocalAccount) {
        _account = Bindable(account)
        // Only this account's records, not every account's history.
        let id = account.providerAccountId
        _snapshots = Query(filter: #Predicate<BalanceSnapshot> { $0.accountId == id })
        _transactions = Query(filter: #Predicate<LocalTransaction> { $0.accountId == id },
                              sort: \LocalTransaction.transactedAt, order: .reverse)
    }

    var body: some View {
        let mine = snapshots.filter { $0.accountId == account.providerAccountId }
        let history = BalanceHistory(snapshots: mine)
        let series = history.series(for: [account], from: range.startDate(earliest: history.earliest)) { _, b in b }
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let recent = transactions.filter { $0.accountId == account.providerAccountId && !$0.isSplit }.prefix(25)

        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 12) {
                        InstitutionLogo(name: account.institutionName, size: 44)
                        VStack(alignment: .leading) {
                            Text(account.institutionName).font(.subheadline).foregroundStyle(Theme.textSecondary)
                            Text(account.kind.singularLabel).font(.footnote).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    Text(account.balance.currency(account.currency))
                        .font(.system(size: 32, weight: .bold)).monospacedDigit().foregroundStyle(Theme.text)
                    ChangeLabel(change: account.balance - (series.first?.value ?? account.balance),
                                base: series.first?.value, period: range.periodLabel, invert: !account.kind.isAsset)
                    NetWorthChart(points: series).frame(height: 140).padding(.vertical, 6)
                    RangePicker(selection: $range)
                }
                .card()

                VStack(alignment: .leading, spacing: 0) {
                    SectionLabel("Settings").padding(.bottom, 10)
                    TextField("Nickname", text: $account.nickname, prompt: Text(account.name))
                        .padding(.vertical, 12)
                    Divider()
                    InstitutionLogoEditor(institutionName: account.institutionName)
                    Divider()
                    Picker("Type", selection: $account.kindRaw) {
                        ForEach(AccountKind.allCases) { Text($0.singularLabel).tag($0.rawValue) }
                    }
                    .padding(.vertical, 6)
                    Picker("Assigned To", selection: $account.ownerId) {
                        Text("Everyone").tag(String?.none)
                        ForEach(people) { person in
                            Text("\(person.icon) \(person.name)").tag(String?.some(person.id))
                        }
                    }
                    .padding(.vertical, 6)
                    Divider()

                    Divider()
                    Toggle("Hide account", isOn: $account.isHidden).padding(.vertical, 10)
                    Text("Hidden accounts aren't counted in net worth, budgets, or the review queue.")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)

                    Divider()
                    Toggle("Hide transactions", isOn: $account.hideTransactions).padding(.vertical, 10)
                    Text("Account balance is still included in net worth, but its transactions won't appear in budgets or lists.")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }
                .card()

                if account.isManual { ManualAccountControls(account: account) }

                VStack(alignment: .leading, spacing: 12) {
                    CardHeader(title: "Recent transactions")
                    if recent.isEmpty {
                        Text("No transactions yet").font(.subheadline).foregroundStyle(Theme.textTertiary)
                    }
                    ForEach(recent) { tx in
                        NavigationLink {
                            TransactionDetailView(transaction: tx)
                        } label: {
                            TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] })
                        }
                        .buttonStyle(.plain)
                    }
                }
                .card()
            }
            .padding(16)
        }
        .pageBackground()
        
            .navigationTitle(account.displayName)
        .inlineNavigationTitle()
    }
}


private struct InstitutionLogoEditor: View {
    let institutionName: String
    @AppStorage("institutionLogos") private var customLogosData: Data = Data()
    @State private var showingPicker = false
    @State private var selection = ""
    
    var body: some View {
        NavigationLink {
            IconPickerView(selection: $selection, categoryName: institutionName)
                .onAppear { selection = "" }
                .onChange(of: selection) { _, emoji in
                    guard !emoji.isEmpty else { return }
                    var dict = (try? JSONDecoder().decode([String: String].self, from: customLogosData)) ?? [:]
                    dict[institutionName] = emoji
                    if let data = try? JSONEncoder().encode(dict) { customLogosData = data }
                    showingPicker = false
                }
        } label: {
            HStack {
                Text("Institution Icon")
                Spacer()
                InstitutionLogo(name: institutionName, size: 32)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .buttonStyle(.plain)
        .padding(.vertical, 8)
    }
}
