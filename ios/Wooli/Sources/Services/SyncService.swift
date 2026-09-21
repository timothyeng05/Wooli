import Foundation
import SwiftData

@MainActor
enum SyncService {
    private static let accessURLKey = "simplefin-access-url"

    static var isConnected: Bool {
        KeychainHelper.load(forKey: accessURLKey) != nil
    }

    static func connect(setupToken: String) async throws {
        let accessURL = try await SimpleFinClient.claimSetupToken(setupToken)
        KeychainHelper.save(accessURL, forKey: accessURLKey)
    }

    static func disconnect() {
        KeychainHelper.delete(forKey: accessURLKey)
    }

    static func sync(modelContext: ModelContext) async throws {
        guard let accessURL = KeychainHelper.load(forKey: accessURLKey) else {
            throw SimpleFinError.notConnected
        }
        var options = SimpleFinClient.FetchOptions()
        options.startDate = Calendar.current.date(byAdding: .day, value: -90, to: .now)
        options.pending = true

        let response = try await SimpleFinClient.fetchAccounts(accessURL: accessURL, options: options)
        for account in response.accounts {
            upsertAccount(account, modelContext: modelContext)
            for transaction in account.transactions ?? [] {
                upsertTransaction(transaction, accountId: account.id, modelContext: modelContext)
            }
        }
        try modelContext.save()
    }

    private static func upsertAccount(_ remote: SimpleFinAccount, modelContext: ModelContext) {
        let remoteId = remote.id
        let descriptor = FetchDescriptor<LocalAccount>(
            predicate: #Predicate { $0.providerAccountId == remoteId }
        )
        let balance = Double(remote.balance) ?? 0
        let balanceDate = Date(timeIntervalSince1970: remote.balanceDate)

        if let existing = try? modelContext.fetch(descriptor).first {
            existing.name = remote.name
            existing.institutionName = remote.org.name ?? existing.institutionName
            existing.balance = balance
            existing.balanceDate = balanceDate
            existing.lastSyncedAt = .now
        } else {
            modelContext.insert(LocalAccount(
                providerAccountId: remote.id,
                name: remote.name,
                institutionName: remote.org.name ?? "Unknown",
                currency: remote.currency,
                balance: balance,
                balanceDate: balanceDate
            ))
        }
    }

    private static func upsertTransaction(_ remote: SimpleFinTransaction, accountId: String, modelContext: ModelContext) {
        let remoteId = remote.id
        let descriptor = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.providerTransactionId == remoteId }
        )
        let amount = Double(remote.amount) ?? 0
        let transactedAt = Date(timeIntervalSince1970: remote.transactedAt ?? remote.posted)

        if let existing = try? modelContext.fetch(descriptor).first {
            existing.amount = amount
            existing.transactionDescription = remote.description
            existing.payee = remote.payee
            existing.transactedAt = transactedAt
            existing.isPending = remote.pending ?? false
        } else {
            modelContext.insert(LocalTransaction(
                providerTransactionId: remote.id,
                accountId: accountId,
                amount: amount,
                transactionDescription: remote.description,
                payee: remote.payee,
                transactedAt: transactedAt,
                isPending: remote.pending ?? false
            ))
        }
    }
}
