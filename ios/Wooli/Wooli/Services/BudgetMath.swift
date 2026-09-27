import Foundation

/// Month-level totals. Same rules as the web app: positive amounts are money
/// in, negative are money out, and transfers are left out of income/spending.
/// Hidden transactions and transactions on hidden accounts are left out too.
struct MonthSummary {
    var income: Double = 0
    var spending: Double = 0
    /// Net spending per top-level expense category id (nil key = uncategorized).
    var spendingByGroup: [String?: Double] = [:]
    /// Net spending per leaf category id.
    var spendingByCategory: [String: Double] = [:]

    var net: Double { income - spending }

    init() {}

    init(transactions: [LocalTransaction], in interval: DateInterval,
         categories: [String: BudgetCategory], hiddenAccounts: Set<String>) {
        for tx in transactions where interval.contains(tx.transactedAt)
            && !tx.isHidden && !tx.isTransfer && !hiddenAccounts.contains(tx.accountId) {
            let category = tx.categoryId.flatMap { categories[$0] }
            if let category {
                if category.isIncome {
                    income += tx.amount
                } else if category.isExpense {
                    spending -= tx.amount
                    let groupId = category.parentId ?? category.id
                    spendingByGroup[groupId, default: 0] -= tx.amount
                    spendingByCategory[category.id, default: 0] -= tx.amount
                }
            } else if tx.amount > 0 {
                income += tx.amount
            } else {
                spending -= tx.amount
                spendingByGroup[nil, default: 0] -= tx.amount
            }
        }
    }
}

extension DateInterval {
    static func month(containing date: Date, calendar: Calendar = .current) -> DateInterval {
        calendar.dateInterval(of: .month, for: date)!
    }
}

extension Double {
    func currency(_ code: String = "USD", cents: Bool = true) -> String {
        formatted(.currency(code: code).precision(.fractionLength(cents ? 2 : 0)))
    }

    /// "+$1,250.00" for money in, "$42.10" for money out — the Wallet/Card
    /// convention of only calling out income.
    func signedCurrency(_ code: String = "USD") -> String {
        self > 0 ? "+" + currency(code) : abs(self).currency(code)
    }
}
