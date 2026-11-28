import Foundation
import Testing
@testable import Wooli

// Forecasting: the yearly projection and the Monte Carlo run.

struct ForecastEngineTests {
    private func plan(income: Double = 100_000, expenses: Double = 60_000, savings: Double = 50_000) -> ForecastPlan {
        var p = ForecastPlan()
        let me = ForecastPerson(id: "me", name: "Me", birthYear: 1996, retirementAge: 65, endAge: 90,
                                socialSecurityMonthly: 2_000, socialSecurityAge: 67)
        p.people = [me]
        p.incomes = [ForecastIncome(id: "inc", name: "Salary", ownerId: "me", yearlyAmount: income)]
        p.accounts = [ForecastAccount(id: "brk", name: "Brokerage", kind: .investment, balance: savings)]
        p.yearlyExpenses = expenses
        p.useActualExpenses = false
        return p
    }

    @Test func runsFromNowToTheEndOfPlan() {
        let p = ForecastEngine.project(plan(), startYear: 2026, firstYearFraction: 1)
        #expect(p.years.first?.year == 2026)
        #expect(p.years.last?.year == 1996 + 90)
    }

    @Test func zeroGrowthNoInflationIsSimpleArithmetic() {
        var pl = plan(income: 100_000, expenses: 60_000, savings: 10_000)
        pl.settings.inflation = 0
        pl.settings.investmentGrowth = 0
        pl.settings.cashGrowth = 0
        pl.people[0].socialSecurityMonthly = 0
        let p = ForecastEngine.project(pl, startYear: 2026, firstYearFraction: 1)
        // Surplus goes to Extra savings by default.
        #expect(abs(p.years[0].netWorth - 50_000) < 0.01)
        #expect(abs(p.years[1].netWorth - 90_000) < 0.01)
    }

    @Test func incomeStopsAtRetirementAndSocialSecurityStarts() {
        let p = ForecastEngine.project(plan(), startYear: 2026, firstYearFraction: 1)
        let before = p.year(1996 + 64)!, retired = p.year(1996 + 65)!, ss = p.year(1996 + 67)!
        #expect(before.incomes.first { $0.id == "inc" }!.amount > 0)
        #expect(retired.incomes.first { $0.id == "inc" } == nil)
        #expect(retired.incomes.first { $0.id == "ss-me" }!.amount == 0)
        #expect(ss.incomes.first { $0.id == "ss-me" }!.amount > 0)
    }

    @Test func deficitDrawsDownThenRecordsShortfall() {
        var pl = plan(income: 0, expenses: 30_000, savings: 50_000)
        pl.settings.inflation = 0
        pl.settings.investmentGrowth = 0
        pl.people[0].socialSecurityMonthly = 0
        let p = ForecastEngine.project(pl, startYear: 2026, firstYearFraction: 1)
        #expect(p.years[0].accounts.first { $0.id == "brk" }!.end == 20_000)
        #expect(p.years[1].shortfall == 10_000)
        #expect(p.shortfallYear == 2027)
        #expect(!p.isSuccess)
    }

    @Test func homePurchaseAddsEquityAndMortgage() {
        var pl = plan(income: 200_000, expenses: 50_000, savings: 300_000)
        pl.events = [ForecastEvent.template(.buyHome, year: 2028)]
        let p = ForecastEngine.project(pl, startYear: 2026, firstYearFraction: 1)
        #expect(p.year(2027)!.otherAssets == 0)
        #expect(p.year(2028)!.otherAssets > 700_000)
        #expect(p.year(2028)!.debts > 500_000)
    }

    @Test func todaysDollarsDeflate() {
        let p = ForecastEngine.project(plan(), startYear: 2026, firstYearFraction: 1)
        let y = p.years[10]
        #expect(abs(y.deflator - pow(1.03, 10)) < 1e-9)
        #expect(y.shown(y.netWorth, todaysDollars: true) < y.netWorth)
    }

    @Test func simulationIsReproducibleAndBounded() {
        let pl = plan()
        let a = ForecastEngine.simulate(pl, paths: 200, seed: 42, startYear: 2026, firstYearFraction: 1)
        let b = ForecastEngine.simulate(pl, paths: 200, seed: 42, startYear: 2026, firstYearFraction: 1)
        #expect(a.successes == b.successes)
        #expect(a.real.count == 200)
        #expect((0...1).contains(a.successRate))
        // A comfortable saver should succeed in most futures.
        #expect(a.successRate > 0.8)
    }

    @Test func overspenderFailsInMostFutures() {
        let s = ForecastEngine.simulate(plan(income: 50_000, expenses: 90_000, savings: 10_000),
                                        paths: 200, seed: 7, startYear: 2026, firstYearFraction: 1)
        #expect(s.successRate < 0.1)
    }

    @Test func withdrawalOrderPutsCashFirst() {
        var pl = plan()
        pl.accounts.append(ForecastAccount(id: "chk", name: "Checking", kind: .cash, balance: 1_000))
        pl.accounts.append(ForecastAccount(id: "401", name: "401(k)", kind: .retirement, balance: 1_000))
        #expect(pl.resolvedWithdrawalOrder == [ForecastPlan.extraSavingsId, "chk", "brk", "401"])
    }

    @Test func shortHistoryIsAnnualized() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let food = BudgetCategory(name: "Food", icon: "", colorHex: "#000")
        let acct = LocalAccount(providerAccountId: "a", name: "Card", institutionName: "", currency: "USD",
                                balance: 0, balanceDate: now, kind: .credit)
        // $1,000 a month for the last 4 months only.
        let txs: [LocalTransaction] = (0..<4).map { i in
            let t = LocalTransaction(providerTransactionId: "t\(i)", accountId: "a", amount: -1_000, transactionDescription: "x",
                                     payee: nil, transactedAt: now.addingTimeInterval(-Double(i) * 30.4 * 86_400 - 86_400 * 29), isPending: false)
            t.categoryId = food.id
            return t
        }
        let a = ForecastSeed.actuals(transactions: txs, categories: [food], accounts: [acct], now: now)
        #expect(abs(a.spending - 12_000) < 1_200)
        #expect(a.months < 5)
    }

    @Test func earliestRetirementMovesEarlierForStrongSavers() {
        // Big saver: should be able to retire well before 65.
        let rich = ForecastEngine.earliestRetirement(for: plan(income: 300_000, expenses: 60_000, savings: 200_000),
                                                     target: 0.95, paths: 150, startYear: 2026, firstYearFraction: 1)
        #expect(rich != nil)
        #expect((rich?.offset ?? 0) < -5)
        #expect((rich?.successRate ?? 0) >= 0.95)
        // Overspender: nothing works.
        let broke = ForecastEngine.earliestRetirement(for: plan(income: 40_000, expenses: 90_000, savings: 0),
                                                      target: 0.95, paths: 150, startYear: 2026, firstYearFraction: 1)
        #expect(broke == nil)
    }

    @Test func payStepsChangeIncomeFromTheirYear() {
        var pl = plan(income: 100_000)
        pl.settings.inflation = 0
        pl.incomes[0].paySteps = [ForecastPayStep(year: 2028, amount: 150_000), ForecastPayStep(year: 2030, amount: 200_000)]
        let p = ForecastEngine.project(pl, startYear: 2026, firstYearFraction: 1)
        let pay = { (y: Int) in p.year(y)!.incomes.first { $0.id == "inc" }!.amount }
        #expect(pay(2027) == 100_000)
        #expect(pay(2028) == 150_000)
        #expect(pay(2029) == 150_000)
        #expect(pay(2031) == 200_000)
    }

    @Test func careerPathBlendsPromotionsAndBonus() {
        // Paste format: Level, Base ($K), Bonus %, Years, +/yr ($K).
        let levels = ForecastCareerPath.parse("SA2\t$193\t24%\t1\nSA3\t$197\t24%\t1\nPartner\t$500\t0%\t9\t$100")
        #expect(levels.count == 3)
        #expect(levels[0].base == 193_000)
        #expect(levels[2].yearlyIncrease == 100_000)
        let path = ForecastCareerPath(levels: levels, nextPromotionYear: 2027, promotionMonth: 7)
        // 2027: half a year at each base, bonus on the January base.
        #expect(abs(path.pay(in: 2027) - ((193_000 + 197_000) / 2 + 193_000 * 0.24)) < 0.01)
        // Partner from July 2028: +$100K a year, capped after 9 years at $1.3M.
        #expect(abs(path.pay(in: 2030) - 650_000) < 0.01) // $600K to June, $700K from July
        #expect(abs(path.pay(in: 2040) - 1_300_000) < 0.01)
        #expect(abs(path.pay(in: 2050) - 1_300_000) < 0.01)
    }

    @Test func switchingPayGrowthKeepsEachOptionsData() {
        var inc = ForecastIncome(yearlyAmount: 100_000)
        inc.career = ForecastCareerPath(levels: [ForecastCareerLevel(name: "A", base: 200_000)], nextPromotionYear: 2030)
        inc.paySteps = [ForecastPayStep(year: 2027, amount: 150_000)]
        inc.payGrowth = .steps
        #expect(inc.amount(in: 2028, startYear: 2026) == 150_000)
        #expect(inc.career?.levels.count == 1)
        inc.payGrowth = .career
        #expect(abs(inc.amount(in: 2028, startYear: 2026) - 200_000) < 0.01)
        inc.payGrowth = .raise
        #expect(inc.amount(in: 2028, startYear: 2026) == 100_000)
        #expect(inc.paySteps.count == 1)
    }

    @Test func pasteSkipsHeaderAndReadsK() {
        let rows = ForecastCareerPath.parse("Level\tBase\tBonus %\tYears\t+/yr\nAnalyst\t$100K\t10%\tnow\t\nManager\t$170K\t20%\t3\t$5K")
        #expect(rows.count == 2)
        #expect(rows[1].base == 170_000 && rows[1].bonusRate == 0.2 && rows[1].years == 3 && rows[1].yearlyIncrease == 5_000)
    }

    @Test func rsuGrantVestsAfterCliffThenQuarterly() {
        // $200K granted March 2027, 4 years, 1-year cliff, quarterly.
        var eq = ForecastEquity()
        eq.grants = [ForecastGrant(value: 200_000, year: 2027, month: 3, years: 4, cliffMonths: 12, everyMonths: 3)]
        #expect(eq.vesting(in: 2027) == 0)
        #expect(abs(eq.vesting(in: 2028) - 87_500) < 0.01) // cliff 50K in March + 3 quarters
        #expect(abs(eq.vesting(in: 2029) - 50_000) < 0.01)
        let total = (2027...2032).reduce(0.0) { $0 + eq.vesting(in: $1) }
        #expect(abs(total - 200_000) < 0.01)
        // Refreshers stack and the haircut scales everything.
        eq.refresher = 40_000
        eq.refresherStartYear = 2028
        eq.refresherSchedule = ForecastGrant(value: 0, month: 1, years: 4, cliffMonths: 0, everyMonths: 12)
        eq.haircut = 0.25
        // 2029: original 50K + 2028 refresher's first yearly vest (10K, Jan 2029).
        #expect(abs(eq.vesting(in: 2029) - 60_000 * 0.75) < 0.01)
    }
}
