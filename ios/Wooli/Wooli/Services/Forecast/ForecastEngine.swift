import Foundation

/// Year-by-year projection of a `ForecastPlan`, plus a Monte Carlo run of it.
/// Everything is computed in future (nominal) dollars; each year carries the
/// inflation deflator so views can show today's dollars instead.
enum ForecastEngine {

    // MARK: Output

    struct Line: Identifiable, Equatable {
        var id: String
        var title: String
        var symbol: String
        var amount: Double
    }

    struct AccountYear: Equatable {
        var id: String
        var name: String
        var kind: ForecastAccountKind?
        var start: Double
        var growth: Double
        var deposits: Double
        var withdrawals: Double
        var end: Double
    }

    struct Year: Identifiable, Equatable {
        var year: Int
        var id: Int { year }
        /// Cumulative inflation since the start (1 in year one).
        var deflator: Double
        var incomes: [Line] = []
        var expenses: [Line] = []
        var accounts: [AccountYear] = []
        /// Home equity and other non-account assets.
        var otherAssets: Double = 0
        var debts: Double = 0
        /// Expenses nothing could pay for, accumulated.
        var shortfall: Double = 0
        var totalIncome: Double { incomes.reduce(0) { $0 + $1.amount } }
        var totalExpenses: Double { expenses.reduce(0) { $0 + $1.amount } }
        var withdrawals: Double { accounts.reduce(0) { $0 + $1.withdrawals } }
        var deposits: Double { accounts.reduce(0) { $0 + $1.deposits } }
        var assets: Double { accounts.reduce(0) { $0 + $1.end } + otherAssets }
        var liabilities: Double { debts + shortfall }
        var netWorth: Double { assets - liabilities }

        /// A value in the units the user picked.
        func shown(_ value: Double, todaysDollars: Bool) -> Double { todaysDollars ? value / deflator : value }
    }

    struct Projection: Equatable {
        var years: [Year]
        /// First year with unfunded expenses.
        var shortfallYear: Int?

        func year(_ y: Int) -> Year? { years.first { $0.year == y } }
        var isSuccess: Bool { shortfallYear == nil }
    }

    // MARK: Market draws

    /// What one year of the economy did. The deterministic plan uses the averages.
    struct YearDraw {
        var inflation: Double
        var marketReturn: Double
        var cashReturn: Double
    }

    // MARK: Projection

    static func startYear(now: Date = .now) -> Int { Calendar.current.component(.year, from: now) }

    /// Share of the current year still ahead, so year one only counts the months left.
    static func firstYearFraction(now: Date = .now) -> Double {
        let cal = Calendar.current
        let year = cal.dateInterval(of: .year, for: now)!
        return max(0.05, year.end.timeIntervalSince(now) / year.duration)
    }

    static func project(_ plan: ForecastPlan, startYear: Int = startYear(), firstYearFraction: Double = firstYearFraction(),
                        detail: Bool = true, draws: ((Int) -> YearDraw)? = nil) -> Projection {
        let s = plan.settings
        let endYear = max(plan.endYear, startYear)
        let split = plan.resolvedSavingsSplit
        let order = plan.resolvedWithdrawalOrder

        // Running balances (future dollars). Debts kept positive.
        var balance: [String: Double] = [ForecastPlan.extraSavingsId: 0]
        var kinds: [String: ForecastAccountKind] = [:]
        for a in plan.accounts {
            balance[a.id] = abs(a.balance)
            kinds[a.id] = a.kind
        }
        let accountIds = [ForecastPlan.extraSavingsId] + plan.accounts.filter { $0.kind != .debt }.map(\.id)
        let debtAccounts = plan.accounts.filter { $0.kind == .debt }

        // Homes bought: value and mortgage balance, both future dollars.
        var homeValue: [String: Double] = [:]
        var mortgage: [String: Double] = [:]
        var mortgagePayment: [String: Double] = [:]

        var shortfall = 0.0
        var shortfallYear: Int?
        var deflator = 1.0
        var expenseFactor = 1.0
        var years: [Year] = []
        years.reserveCapacity(endYear - startYear + 1)

        for year in startYear...endYear {
            let t = year - startYear
            let fraction = t == 0 ? firstYearFraction : 1
            let draw = draws?(t) ?? YearDraw(inflation: s.inflation, marketReturn: s.investmentGrowth, cashReturn: s.cashGrowth)
            if t > 0 {
                deflator *= 1 + draw.inflation
                expenseFactor *= 1 + (plan.expenseChange ?? draw.inflation)
            }
            var row = Year(year: year, deflator: deflator)

            // Income
            var income = 0.0
            for inc in plan.incomes {
                let owner = plan.person(inc.ownerId)
                if let owner, year >= owner.retirementYear || year > owner.endYear { continue }
                if onCareerBreak(plan, owner: inc.ownerId, year: year) { continue }
                let amount = inc.yearlyAmount * deflator * pow(1 + inc.raise, Double(t)) * fraction
                income += amount
                if detail { row.incomes.append(Line(id: inc.id, title: inc.name, symbol: "building.2", amount: amount)) }
            }
            for p in plan.people where p.socialSecurityMonthly > 0 {
                let on = year >= p.socialSecurityYear && year <= p.endYear
                let amount = on ? p.socialSecurityMonthly * 12 * deflator * fraction : 0
                income += amount
                if detail { row.incomes.append(Line(id: "ss-\(p.id)", title: "Social Security (\(p.name))", symbol: "shield", amount: amount)) }
            }
            for e in plan.events where e.kind == .windfall && e.year == year {
                let amount = e.amount * deflator
                income += amount
                if detail { row.incomes.append(Line(id: e.id, title: e.displayTitle, symbol: e.kind.symbol, amount: amount)) }
            }

            // Expenses
            var expenses = 0.0
            let living = plan.yearlyExpenses * expenseFactor * fraction
            expenses += living
            if detail { row.expenses.append(Line(id: "living", title: "Yearly living expenses", symbol: "cart", amount: living)) }

            for e in plan.events {
                var amount = 0.0
                switch e.kind {
                case .haveKid, .recurringExpense:
                    if year >= e.year && year < e.year + max(e.years, 1) { amount = e.amount * deflator }
                case .oneTimeExpense:
                    if year == e.year { amount = e.amount * deflator }
                case .buyHome:
                    if year == e.year {
                        let price = e.amount * deflator
                        let loan = price * (1 - e.downPayment)
                        homeValue[e.id] = price
                        mortgage[e.id] = loan
                        mortgagePayment[e.id] = annuityPayment(loan, rate: e.mortgageRate, years: e.mortgageYears)
                        amount = price * e.downPayment + price * 0.02   // closing costs
                    }
                    if year >= e.year, let value = homeValue[e.id] {
                        if year > e.year { homeValue[e.id] = value * (1 + draw.inflation) }
                        amount += (homeValue[e.id] ?? 0) * e.carryingCost
                        if let owed = mortgage[e.id], owed > 0.5 {
                            let interest = owed * e.mortgageRate
                            let pay = min(mortgagePayment[e.id] ?? 0, owed + interest)
                            mortgage[e.id] = owed + interest - pay
                            amount += pay
                        }
                    }
                case .windfall, .careerBreak:
                    break
                }
                expenses += amount
                if detail, amount > 0 { row.expenses.append(Line(id: e.id, title: e.displayTitle, symbol: e.kind.symbol, amount: amount)) }
            }

            // Debt payments (cards, loans)
            var debtTotal = 0.0
            for d in debtAccounts {
                let owed = balance[d.id] ?? 0
                guard owed > 0.5 else { continue }
                let rate = d.growthRate ?? s.growth(for: .debt)
                let interest = owed * rate * fraction
                let yearly = (d.yearlyPayment ?? max(d.balance / 5, 0)) * fraction
                let pay = min(yearly, owed + interest)
                balance[d.id] = owed + interest - pay
                expenses += pay
                if detail { row.expenses.append(Line(id: d.id, title: "\(d.name) payments", symbol: "creditcard", amount: pay)) }
            }
            for d in debtAccounts { debtTotal += balance[d.id] ?? 0 }
            debtTotal += mortgage.values.reduce(0, +)

            // Growth on opening balances.
            var starts: [String: Double] = [:]
            var growth: [String: Double] = [:]
            for id in accountIds {
                let b = balance[id] ?? 0
                starts[id] = b
                let kind = kinds[id] ?? .cash
                let rate: Double
                if let custom = plan.accounts.first(where: { $0.id == id })?.growthRate {
                    rate = custom + (kind.isMarket ? draw.marketReturn - s.investmentGrowth : draw.cashReturn - s.cashGrowth)
                } else {
                    rate = kind.isMarket ? draw.marketReturn : draw.cashReturn
                }
                let g = b * rate * fraction
                growth[id] = g
                balance[id] = b + g
            }

            // Surplus pays back any shortfall, then is saved; a deficit is drawn down.
            var deposits: [String: Double] = [:]
            var withdrawals: [String: Double] = [:]
            var net = income - expenses
            if net > 0 {
                let repay = min(net, shortfall)
                shortfall -= repay
                net -= repay
                for (id, share) in split {
                    deposits[id, default: 0] += net * share
                    balance[id, default: 0] += net * share
                }
            } else if net < 0 {
                var need = -net
                for id in order where need > 0 {
                    if kinds[id] == .retirement, !canDrawRetirement(plan, accountId: id, year: year) { continue }
                    let available = max(balance[id] ?? 0, 0)
                    let take = min(available, need)
                    guard take > 0 else { continue }
                    balance[id] = available - take
                    withdrawals[id, default: 0] += take
                    need -= take
                }
                if need > 0.5 {
                    shortfall += need
                    if shortfallYear == nil { shortfallYear = year }
                }
            }
            // An unpaid gap carries a cost, like the card it would land on.
            if t > 0, shortfall > 0 { shortfall *= 1 + draw.inflation }

            row.shortfall = shortfall
            row.debts = debtTotal
            row.otherAssets = homeValue.values.reduce(0, +)
            for id in accountIds {
                row.accounts.append(AccountYear(id: id, name: detail ? plan.accountName(id) : "", kind: kinds[id],
                                                start: starts[id] ?? 0, growth: growth[id] ?? 0,
                                                deposits: deposits[id] ?? 0, withdrawals: withdrawals[id] ?? 0,
                                                end: balance[id] ?? 0))
            }
            years.append(row)
        }
        return Projection(years: years, shortfallYear: shortfallYear)
    }

    static func annuityPayment(_ principal: Double, rate: Double, years: Int) -> Double {
        guard principal > 0, years > 0 else { return 0 }
        guard rate > 0 else { return principal / Double(years) }
        return principal * rate / (1 - pow(1 + rate, -Double(years)))
    }

    private static func onCareerBreak(_ plan: ForecastPlan, owner: String?, year: Int) -> Bool {
        plan.events.contains { $0.kind == .careerBreak && $0.ownerId == owner && year >= $0.year && year < $0.year + max($0.years, 1) }
    }

    private static func canDrawRetirement(_ plan: ForecastPlan, accountId: String, year: Int) -> Bool {
        let ownerId = plan.accounts.first { $0.id == accountId }?.ownerId
        let people = ownerId.flatMap { plan.person($0) }.map { [$0] } ?? plan.people
        guard !people.isEmpty else { return true }
        return people.contains { $0.age(in: year) >= plan.settings.retirementAccessAge }
    }

    // MARK: Monte Carlo

    struct Simulation: Equatable {
        static let pathCount = 1000

        var plan: ForecastPlan
        var startYear: Int
        var years: [Int]
        /// Net worth per path per year, in today's dollars of that path.
        var real: [[Double]]
        /// Net worth per path per year, future dollars.
        var nominal: [[Double]]
        var shortfallYears: [Int?]

        var successes: Int { shortfallYears.filter { $0 == nil }.count }
        var successRate: Double { Double(successes) / Double(max(shortfallYears.count, 1)) }

        func values(todaysDollars: Bool) -> [[Double]] { todaysDollars ? real : nominal }

        /// Percentile band per year (e.g. 0.4…0.6 for the middle 20%).
        func band(_ low: Double, _ high: Double, todaysDollars: Bool) -> [(year: Int, low: Double, high: Double, median: Double)] {
            let v = values(todaysDollars: todaysDollars)
            return years.indices.map { i in
                let column = v.map { $0[i] }.sorted()
                return (years[i], percentile(column, low), percentile(column, high), percentile(column, 0.5))
            }
        }

        /// Every path's value in one year.
        func column(year: Int, todaysDollars: Bool) -> [Double] {
            guard let i = years.firstIndex(of: year) else { return [] }
            return values(todaysDollars: todaysDollars).map { $0[i] }
        }
    }

    static func percentile(_ sorted: [Double], _ p: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let idx = min(max(Int((Double(sorted.count - 1) * p).rounded()), 0), sorted.count - 1)
        return sorted[idx]
    }

    static func simulate(_ plan: ForecastPlan, paths: Int = Simulation.pathCount, seed: UInt64,
                         startYear: Int = startYear(), firstYearFraction: Double = firstYearFraction()) -> Simulation {
        var rng = ForecastRandom(seed: seed)
        let s = plan.settings
        var real: [[Double]] = []
        var nominal: [[Double]] = []
        var shortfalls: [Int?] = []
        var years: [Int] = []
        real.reserveCapacity(paths)
        nominal.reserveCapacity(paths)
        for _ in 0..<paths {
            // Draw the whole path's economy up front so the projection stays a pure function.
            let horizon = max(plan.endYear - startYear + 1, 1)
            let pathDraws: [YearDraw] = (0..<horizon).map { _ in
                let inflation = max(-0.02, s.inflation + rng.normal() * 0.012)
                let market = max(-0.6, s.investmentGrowth + rng.normal() * s.volatility)
                let cash = max(0, s.cashGrowth + (inflation - s.inflation) * 0.5)
                return YearDraw(inflation: inflation, marketReturn: market, cashReturn: cash)
            }
            let p = project(plan, startYear: startYear, firstYearFraction: firstYearFraction, detail: false) { pathDraws[min($0, pathDraws.count - 1)] }
            if years.isEmpty { years = p.years.map(\.year) }
            nominal.append(p.years.map(\.netWorth))
            real.append(p.years.map { $0.netWorth / $0.deflator })
            shortfalls.append(p.shortfallYear)
        }
        return Simulation(plan: plan, startYear: startYear, years: years, real: real, nominal: nominal, shortfallYears: shortfalls)
    }
}

/// Small, fast, reproducible RNG (SplitMix64) so "Run again" gives a new set
/// and tests can pin one.
struct ForecastRandom: RandomNumberGenerator {
    private var state: UInt64
    private var spare: Double?

    init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    /// Standard normal (Box–Muller).
    mutating func normal() -> Double {
        if let s = spare { spare = nil; return s }
        let u1 = max(Double.random(in: 0..<1, using: &self), .leastNonzeroMagnitude)
        let u2 = Double.random(in: 0..<1, using: &self)
        let r = (-2 * log(u1)).squareRoot()
        spare = r * sin(2 * .pi * u2)
        return r * cos(2 * .pi * u2)
    }
}
