import Foundation
import SwiftData

// No @Attribute(.unique) here -- CloudKit-backed SwiftData containers don't
// support unique constraints. Dedup is done by hand in SyncService instead.
@Model
final class LocalAccount {
    var providerAccountId: String = ""
    var name: String = ""
    var institutionName: String = ""
    var currency: String = "USD"
    var balance: Double = 0
    var balanceDate: Date = .now
    var lastSyncedAt: Date = .now

    init(
        providerAccountId: String,
        name: String,
        institutionName: String,
        currency: String,
        balance: Double,
        balanceDate: Date,
        lastSyncedAt: Date = .now
    ) {
        self.providerAccountId = providerAccountId
        self.name = name
        self.institutionName = institutionName
        self.currency = currency
        self.balance = balance
        self.balanceDate = balanceDate
        self.lastSyncedAt = lastSyncedAt
    }
}

@Model
final class LocalTransaction {
    var providerTransactionId: String = ""
    var accountId: String = ""
    var amount: Double = 0
    var transactionDescription: String = ""
    var payee: String?
    var transactedAt: Date = .now
    var isPending: Bool = false

    init(
        providerTransactionId: String,
        accountId: String,
        amount: Double,
        transactionDescription: String,
        payee: String?,
        transactedAt: Date,
        isPending: Bool
    ) {
        self.providerTransactionId = providerTransactionId
        self.accountId = accountId
        self.amount = amount
        self.transactionDescription = transactionDescription
        self.payee = payee
        self.transactedAt = transactedAt
        self.isPending = isPending
    }
}
