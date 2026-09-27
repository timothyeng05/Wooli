import Foundation
import SwiftData

// CloudKit-backed SwiftData rules apply to every model here: no
// @Attribute(.unique), every stored property has a default, and links between
// models are plain string ids rather than relationships. Dedup happens by hand
// in SyncService.

enum AccountKind: String, CaseIterable, Identifiable {
    case checking, savings, credit, investment, loan, other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .checking: "Checking"
        case .savings: "Savings"
        case .credit: "Credit Cards"
        case .investment: "Investments"
        case .loan: "Loans"
        case .other: "Other"
        }
    }

    var singularLabel: String {
        switch self {
        case .credit: "Credit Card"
        case .investment: "Investment"
        case .loan: "Loan"
        default: label
        }
    }

    var symbol: String {
        switch self {
        case .checking: "banknote"
        case .savings: "building.columns"
        case .credit: "creditcard"
        case .investment: "chart.line.uptrend.xyaxis"
        case .loan: "house"
        case .other: "wallet.bifold"
        }
    }

    var isAsset: Bool { self != .credit && self != .loan }

    /// SimpleFIN doesn't report an account type, so guess from the name and
    /// the sign of the balance. The user can correct it on the account screen.
    static func infer(name: String, balance: Double) -> AccountKind {
        let n = name.lowercased()
        if n.contains("credit") || n.contains("card") || n.contains("visa") || n.contains("amex") { return .credit }
        if n.contains("mortgage") || n.contains("loan") { return .loan }
        if ["brokerage", "401", "ira", "roth", "invest", "hsa", "stock"].contains(where: n.contains) { return .investment }
        if n.contains("saving") || n.contains("money market") { return .savings }
        if n.contains("checking") { return .checking }
        return balance < 0 ? .credit : .checking
    }
}

@Model
final class LocalAccount {
    var providerAccountId: String = ""
    var name: String = ""
    var nickname: String = ""
    var institutionName: String = ""
    var currency: String = "USD"
    var balance: Double = 0
    var balanceDate: Date = Date.now
    var lastSyncedAt: Date = Date.now
    var kindRaw: String = AccountKind.other.rawValue
    var isHidden: Bool = false

    init(providerAccountId: String, name: String, institutionName: String, currency: String,
         balance: Double, balanceDate: Date, kind: AccountKind) {
        self.providerAccountId = providerAccountId
        self.name = name
        self.institutionName = institutionName
        self.currency = currency
        self.balance = balance
        self.balanceDate = balanceDate
        self.kindRaw = kind.rawValue
    }

    var kind: AccountKind {
        get { AccountKind(rawValue: kindRaw) ?? .other }
        set { kindRaw = newValue.rawValue }
    }

    var displayName: String { nickname.isEmpty ? name : nickname }

    /// Signed contribution to net worth. Debts always count as negative, whatever
    /// sign the bank reports them with.
    var netWorthValue: Double { kind.isAsset ? balance : -abs(balance) }
}

@Model
final class LocalTransaction {
    var providerTransactionId: String = ""
    var accountId: String = ""
    /// Positive = money in, negative = money out (same as the web app).
    var amount: Double = 0
    var transactionDescription: String = ""
    var payee: String?
    var transactedAt: Date = Date.now
    var isPending: Bool = false

    var categoryId: String?
    var isTransfer: Bool = false
    /// "A human hasn't confirmed this yet" — not "the categorizer was unsure".
    /// Only an explicit confirmation clears it (same rule as the web app).
    var needsReview: Bool = true
    var isHidden: Bool = false
    var normalizedMerchant: String = ""
    var note: String = ""
    /// The current category came from the on-device model and hasn't been confirmed.
    var aiSuggested: Bool = false
    /// The on-device model has already looked at this one (don't ask again).
    var aiAttempted: Bool = false
    /// Display name set by a "Rename merchant" rule.
    var customTitle: String = ""
    /// This transaction was split into parts (it's kept, but set aside so it
    /// isn't counted twice; the parts carry the categories and amounts).
    var isSplit: Bool = false
    /// For a part of a split: the providerTransactionId of the original.
    var splitParentId: String = ""
    /// Free-form labels across categories, e.g. "Japan trip".
    var tags: [String] = []

    init(providerTransactionId: String, accountId: String, amount: Double, transactionDescription: String,
         payee: String?, transactedAt: Date, isPending: Bool) {
        self.providerTransactionId = providerTransactionId
        self.accountId = accountId
        self.amount = amount
        self.transactionDescription = transactionDescription
        self.payee = payee
        self.transactedAt = transactedAt
        self.isPending = isPending
        self.normalizedMerchant = MerchantNormalizer.normalize(payee?.isEmpty == false ? payee : transactionDescription)
    }

    var title: String {
        customTitle.isEmpty ? baseTitle : customTitle
    }

    /// Merchant name before any rename rule — what rules match against.
    var baseTitle: String {
        if let payee, !payee.trimmingCharacters(in: .whitespaces).isEmpty { return payee }
        let pretty = normalizedMerchant.split(separator: " ").map { $0.capitalized }.joined(separator: " ")
        return pretty.isEmpty ? transactionDescription : pretty
    }
}

@Model
final class BudgetCategory {
    var id: String = UUID().uuidString
    var name: String = ""
    var icon: String = "•"
    var colorHex: String = "#64748b"
    var parentId: String?
    var isIncome: Bool = false
    var isTransfer: Bool = false
    var sortOrder: Int = 0
    /// Monthly spend target. Set on top-level groups (the web app's default
    /// `budget_level = 'parent'`); 0 means no target.
    var monthlyTarget: Double = 0
    /// Carry what's left (or overspent) into next month.
    var rolloverEnabled: Bool = false
    /// Running carried-over amount available this month (negative = overspent).
    var rolloverBalance: Double = 0
    /// Start of the first month not yet folded into the balance.
    var rolloverThrough: Date?

    init(name: String, icon: String, colorHex: String, parentId: String? = nil,
         isIncome: Bool = false, isTransfer: Bool = false, sortOrder: Int = 0) {
        self.name = name
        self.icon = icon
        self.colorHex = colorHex
        self.parentId = parentId
        self.isIncome = isIncome
        self.isTransfer = isTransfer
        self.sortOrder = sortOrder
    }

    var isExpense: Bool { !isIncome && !isTransfer }
}

/// A confirmed merchant → category pairing, learned when the user reviews a
/// transaction. Mirrors the web app's `merchant_memory`.
@Model
final class MerchantRule {
    var merchant: String = ""
    /// Start of the original statement (see `Categorizer.statementKey`), so
    /// one merchant can mean different things ("schwab direct deposit" vs
    /// "schwab transfer funds"). Empty for older entries.
    var statement: String = ""
    var categoryId: String = ""
    var timesConfirmed: Int = 1
    var updatedAt: Date = Date.now

    init(merchant: String, statement: String = "", categoryId: String) {
        self.merchant = merchant
        self.statement = statement
        self.categoryId = categoryId
    }
}

/// One balance reading per account per day, recorded on each sync. SimpleFIN
/// only reports today's balance, so this is how net-worth history builds up.
@Model
final class BalanceSnapshot {
    var accountId: String = ""
    var day: Date = Date.now
    var balance: Double = 0

    init(accountId: String, day: Date, balance: Double) {
        self.accountId = accountId
        self.day = day
        self.balance = balance
    }
}

/// A plain-English instruction from the user that the on-device categorizer
/// follows, e.g. "Venmo payments to Maya are Rent".
@Model
final class CategoryRule {
    var text: String = ""
    var isEnabled: Bool = true
    var createdAt: Date = Date.now

    init(text: String) {
        self.text = text
    }
}

/// A Monarch-style "if … then …" rule. All set conditions must match; every
/// set action is applied. Runs before learned merchants, keywords and AI.
@Model
final class TransactionRule {
    var id: String = UUID().uuidString
    var isEnabled: Bool = true
    var createdAt: Date = Date.now
    var lastAppliedAt: Date?
    var timesApplied: Int = 0

    // Conditions ("" = not used)
    var statementMatch: String = ""   // "contains" | "exact"
    /// Legacy single-value field, kept so rules created before multi-value
    /// support still read correctly — see `RuleEngine.statementValues`.
    var statementText: String = ""
    /// Matches if the statement matches any one of these (OR within this
    /// condition; still AND'd against the rule's other conditions).
    var statementTexts: [String] = []
    var merchantMatch: String = ""    // "contains" | "exact"
    /// Legacy single-value field — see `RuleEngine.merchantValues`.
    var merchantText: String = ""
    var merchantTexts: [String] = []
    var amountDirection: String = ""  // "debit" | "credit"
    var amountMatch: String = ""      // "equals" | "greater" | "less" | "between"
    var amountValue: Double = 0
    var amountValue2: Double = 0
    var categoryIds: [String] = []
    var accountIds: [String] = []

    // Actions
    var renameTo: String = ""
    var setCategoryId: String?
    var reviewAction: String = ""     // "reviewed" | "needsReview"
    var hide: Bool = false
    var addTag: String = ""

    init() {}
}

enum Cadence: String, CaseIterable, Identifiable {
    case weekly, biweekly, semimonthly, monthly, quarterly, yearly
    var id: String { rawValue }

    var label: String {
        switch self {
        case .weekly: "Weekly"
        case .biweekly: "Every 2 weeks"
        case .semimonthly: "Twice a month"
        case .monthly: "Monthly"
        case .quarterly: "Every 3 months"
        case .yearly: "Yearly"
        }
    }

    /// Typical days between charges.
    var days: Double {
        switch self {
        case .weekly: 7
        case .biweekly: 14
        case .semimonthly: 15.2
        case .monthly: 30.4
        case .quarterly: 91
        case .yearly: 365
        }
    }

    func next(after date: Date) -> Date {
        let cal = Calendar.current
        switch self {
        case .weekly: return cal.date(byAdding: .day, value: 7, to: date)!
        case .biweekly: return cal.date(byAdding: .day, value: 14, to: date)!
        case .semimonthly:
            // e.g. the 1st and 15th: the other half of the month.
            let day = cal.component(.day, from: date)
            if day <= 15 { return cal.date(byAdding: .day, value: 14, to: date)! }
            let firstOfNext = cal.date(from: cal.dateComponents([.year, .month], from: cal.date(byAdding: .month, value: 1, to: date)!))!
            return cal.date(byAdding: .day, value: max(day - 16, 0), to: firstOfNext)!
        case .monthly: return cal.date(byAdding: .month, value: 1, to: date)!
        case .quarterly: return cal.date(byAdding: .month, value: 3, to: date)!
        case .yearly: return cal.date(byAdding: .year, value: 1, to: date)!
        }
    }

    /// Classify an interval in days, or nil if it isn't a regular cadence.
    static func from(days: Double) -> Cadence? {
        switch days {
        case 6...8: .weekly
        case 13...17: .biweekly  // also catches twice-a-month (1st & 15th)
        case 26...35: .monthly
        case 84...98: .quarterly
        case 350...380: .yearly
        default: nil
        }
    }
}

/// A bill, subscription or paycheck that repeats. Kept separately from
/// transactions so it survives when old transactions are pruned.
@Model
final class RecurringItem {
    var id: String = UUID().uuidString
    /// Normalized merchant it matches (see LocalTransaction.normalizedMerchant).
    var merchant: String = ""
    var title: String = ""
    var categoryId: String?
    var accountId: String = ""
    /// Typical amount, signed like transactions (negative = money out).
    var amount: Double = 0
    var cadenceRaw: String = Cadence.monthly.rawValue
    var lastDate: Date = Date.now
    var nextDate: Date = Date.now
    var lastTransactionId: String = ""
    var isActive: Bool = true
    /// Added by the user rather than detected.
    var isManual: Bool = false
    var createdAt: Date = Date.now

    init(merchant: String, title: String, amount: Double, cadence: Cadence, lastDate: Date) {
        self.merchant = merchant
        self.title = title
        self.amount = amount
        self.cadenceRaw = cadence.rawValue
        self.lastDate = lastDate
        self.nextDate = cadence.next(after: lastDate)
    }

    var cadence: Cadence {
        get { Cadence(rawValue: cadenceRaw) ?? .monthly }
        set { cadenceRaw = newValue.rawValue }
    }
}
