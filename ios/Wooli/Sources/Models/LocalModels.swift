import Foundation
import SwiftData

@Model
final class LocalAccount {
    @Attribute(.unique) var providerAccountId: String
    var name: String
    var institutionName: String
    var currency: String
    var balance: Double
    var balanceDate: Date
    var lastSyncedAt: Date

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
    @Attribute(.unique) var providerTransactionId: String
    var accountId: String
    var amount: Double
    var transactionDescription: String
    var payee: String?
    var transactedAt: Date
    var isPending: Bool

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
