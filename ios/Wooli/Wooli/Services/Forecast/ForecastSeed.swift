import Foundation

/// Builds a starting plan from what Wooli already knows: people, account
/// balances and the last 12 months of income and spending.
enum ForecastSeed {
    struct Actuals: Equatable {
        /// Take-home income over the last 12 months, by person id ("" = shared / unassigned).
        var incomeByPerson: [String: Double] = [:]
        var spending: Double = 0
        /// How many months of history the yearly figures come from (up to 12).
        var months: Double = 12
        var totalIncome: Double { incomeByPerson.values.reduce(0, +) }
    }

    static func actuals(transactions: [LocalTransaction], categories: [BudgetCategory], accounts: [LocalAccount],
                        now: Date = .now) -> Actuals {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        let owner = Dictionary(accounts.map { ($0.providerAccountId, $0.ownerId ?? "") }, uniquingKeysWith: { a, _ in a })
        let start = Calendar.current.date(byAdding: .month, value: -12, to: now)!
        var out = Actuals()
        var earliest = now
        for tx in transactions where tx.transactedAt >= start && tx.transactedAt <= now
            && !tx.isHidden && !tx.isTransfer && !tx.isSplit && !hidden.contains(tx.accountId) {
            guard let c = tx.categoryId.flatMap({ byId[$0] }) else { continue }
            earliest = min(earliest, tx.transactedAt)
            if c.isIncome {
                out.incomeByPerson[owner[tx.accountId] ?? "", default: 0] += tx.amount
            } else if c.isExpense {
                out.spending -= tx.amount
            }
        }
        // With less than a year of history, scale what's there up to a year
        // rather than treating the missing months as $0.
        let days = max(now.timeIntervalSince(earliest) / 86_400, 30)
        let scale = days < 335 ? 365 / days : 1
        out.spending = max(out.spending, 0) * scale
        for key in out.incomeByPerson.keys { out.incomeByPerson[key]! *= scale }
        out.months = min(days / 30.4, 12)
        return out
    }

    static func people(from people: [Person], currentYear: Int = ForecastEngine.startYear()) -> [ForecastPerson] {
        guard !people.isEmpty else { return [ForecastPerson(name: "Me", birthYear: currentYear - 30)] }
        return people.map { ForecastPerson(id: $0.id, name: $0.name, birthYear: currentYear - 30, colorHex: $0.colorHex,
                                           emoji: $0.icon == "👤" ? "" : $0.icon) }
    }

    static func incomes(people: [ForecastPerson], actuals: Actuals) -> [ForecastIncome] {
        let shared = actuals.incomeByPerson[""] ?? 0
        let each = people.isEmpty ? 0 : shared / Double(people.count)
        return people.map { p in
            ForecastIncome(name: "Income (\(p.name))", ownerId: p.id,
                           yearlyAmount: ((actuals.incomeByPerson[p.id] ?? 0) + each).rounded())
        }
    }

    static func accounts(from accounts: [LocalAccount]) -> [ForecastAccount] {
        accounts.filter { !$0.isHidden && abs($0.balance) >= 1 }
            .sorted { abs($0.balance) > abs($1.balance) }
            .map { a in
                ForecastAccount(name: a.displayName, institution: a.institutionName,
                                kind: ForecastAccountKind(a.kind, name: a.name + " " + a.nickname),
                                balance: abs(a.balance), ownerId: a.ownerId, sourceAccountId: a.providerAccountId)
            }
    }

    /// Latest balances from linked accounts, keeping the user's other settings.
    static func refreshBalances(_ plan: inout ForecastPlan, from accounts: [LocalAccount]) {
        let byId = Dictionary(accounts.map { ($0.providerAccountId, $0) }, uniquingKeysWith: { a, _ in a })
        for i in plan.accounts.indices {
            if let src = plan.accounts[i].sourceAccountId, let a = byId[src] { plan.accounts[i].balance = abs(a.balance) }
        }
    }
}
