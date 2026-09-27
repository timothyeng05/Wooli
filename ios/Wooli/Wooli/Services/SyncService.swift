import Foundation
import SwiftData

@MainActor
enum SyncService {
    private static let accessURLKey = "simplefin-access-url"
    private static let lastSyncKey = "lastSimpleFinSyncAt"

    static var hasCredentials: Bool {
        KeychainHelper.load(forKey: accessURLKey) != nil
    }

    static var lastSyncAt: Date? {
        UserDefaults.standard.object(forKey: lastSyncKey) as? Date
    }

    static func connect(setupToken: String) async throws {
        let accessURL = try await SimpleFinClient.claimSetupToken(setupToken)
        KeychainHelper.save(accessURL, forKey: accessURLKey)
    }

    static func disconnect() {
        KeychainHelper.delete(forKey: accessURLKey)
        UserDefaults.standard.removeObject(forKey: lastSyncKey)
    }

    struct Summary {
        var newTransactions = 0
        var bankMessages: [String] = []
    }

    /// Pull accounts + transactions straight from SimpleFIN and merge them into
    /// the local store. User edits (category, review state, notes, hidden) are
    /// never overwritten by a sync.
    static func sync(context: ModelContext) async throws -> Summary {
        guard let accessURL = KeychainHelper.load(forKey: accessURLKey) else {
            throw SimpleFinError.notConnected
        }

        // First sync pulls 90 days; later syncs re-read the last week too so
        // pending transactions that have since posted get updated.
        let ninetyDaysAgo = Calendar.current.date(byAdding: .day, value: -90, to: .now)!
        let startDate = lastSyncAt.map { max(Calendar.current.date(byAdding: .day, value: -7, to: $0)!, ninetyDaysAgo) }
            ?? ninetyDaysAgo

        var options = SimpleFinClient.FetchOptions()
        options.startDate = startDate
        options.pending = true
        let response = try await SimpleFinClient.fetchAccounts(accessURL: accessURL, options: options)

        let accounts = Dictionary(
            (try context.fetch(FetchDescriptor<LocalAccount>())).map { ($0.providerAccountId, $0) },
            uniquingKeysWith: { first, _ in first })
        let transactions = Dictionary(
            (try context.fetch(FetchDescriptor<LocalTransaction>())).map { ($0.providerTransactionId, $0) },
            uniquingKeysWith: { first, _ in first })
        let rules = Dictionary(
            (try context.fetch(FetchDescriptor<MerchantRule>())).map { ($0.merchant, $0) },
            uniquingKeysWith: { first, _ in first })
        let categories = try context.fetch(FetchDescriptor<BudgetCategory>())
        let categoriesById = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let categoriesByName = Dictionary(
            categories.filter { $0.parentId != nil }.map { ($0.name.lowercased(), $0) },
            uniquingKeysWith: { first, _ in first })

        var summary = Summary(bankMessages: response.errors)
        var seenIds = Set<String>()

        for remote in response.accounts {
            let balance = Double(remote.balance) ?? 0
            let balanceDate = Date(timeIntervalSince1970: remote.balanceDate)
            if let existing = accounts[remote.id] {
                existing.name = remote.name
                existing.institutionName = remote.org.name ?? existing.institutionName
                existing.balance = balance
                existing.balanceDate = balanceDate
                existing.lastSyncedAt = .now
            } else {
                context.insert(LocalAccount(
                    providerAccountId: remote.id, name: remote.name,
                    institutionName: remote.org.name ?? remote.org.domain ?? "Bank",
                    currency: remote.currency, balance: balance, balanceDate: balanceDate,
                    kind: AccountKind.infer(name: remote.name, balance: balance)))
            }

            for tx in remote.transactions ?? [] {
                seenIds.insert(tx.id)
                let amount = Double(tx.amount) ?? 0
                let date = Date(timeIntervalSince1970: tx.transactedAt ?? tx.posted)
                let isPending = (tx.pending ?? false) || tx.posted == 0
                if let existing = transactions[tx.id] {
                    existing.amount = amount
                    existing.transactionDescription = tx.description
                    existing.payee = tx.payee
                    existing.transactedAt = date
                    existing.isPending = isPending
                } else {
                    let new = LocalTransaction(
                        providerTransactionId: tx.id, accountId: remote.id, amount: amount,
                        transactionDescription: tx.description, payee: tx.payee,
                        transactedAt: date, isPending: isPending)
                    if let suggested = Categorizer.suggest(merchant: new.normalizedMerchant, description: tx.description,
                                                           rules: rules, categoriesByName: categoriesByName) {
                        Categorizer.assign(categoriesById[suggested], to: new)
                    }
                    context.insert(new)
                    summary.newTransactions += 1
                }
            }
        }

        // A pending charge that posts often comes back under a new id. Drop
        // pending rows inside the fetched window that the bank no longer reports.
        let returnedAccounts = Set(response.accounts.map(\.id))
        for tx in transactions.values where tx.isPending && tx.transactedAt >= startDate
            && returnedAccounts.contains(tx.accountId) && !seenIds.contains(tx.providerTransactionId) {
            context.delete(tx)
        }

        try context.save()
        UserDefaults.standard.set(Date.now, forKey: lastSyncKey)
        return summary
    }
}
