import Foundation

struct SimpleFinAccountsResponse: Codable {
    let accounts: [SimpleFinAccount]
    let errors: [String]
}

struct SimpleFinAccount: Codable {
    let id: String
    let name: String
    let currency: String
    let balance: String
    let availableBalance: String?
    let balanceDate: Double
    let org: SimpleFinOrg
    let transactions: [SimpleFinTransaction]?

    enum CodingKeys: String, CodingKey {
        case id, name, currency, balance, org, transactions
        case availableBalance = "available-balance"
        case balanceDate = "balance-date"
    }
}

struct SimpleFinOrg: Codable {
    let domain: String?
    let name: String?
    let url: String?
    let id: String?
}

struct SimpleFinTransaction: Codable {
    let id: String
    /// When the transaction posted. Per the protocol this is 0 while it's pending.
    let posted: Double
    let amount: String
    let description: String
    let payee: String?
    let memo: String?
    /// When the transaction actually happened. Optional -- not every institution sends it.
    let transactedAt: Double?
    let pending: Bool?

    enum CodingKeys: String, CodingKey {
        case id, posted, amount, description, payee, memo, pending
        case transactedAt = "transacted_at"
    }
}
