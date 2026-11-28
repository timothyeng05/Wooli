import Foundation
import Testing
@testable import Wooli

// Forecast taxes: 2026 brackets on salary entered before tax.

struct ForecastTaxTests {
    @Test func nycSingle250kMatchesHandCalculation() {
        let bill = ForecastTax.bill([.init(id: "me", wages: 250_000, pretax: 0, region: .newYorkCity, otherRate: 0)], joint: false)
        // Federal on $233,900 taxable; FICA with wage base and 0.9% over $200K; NY + NYC on $242,000.
        #expect(abs(bill.federal - 51_304) < 1)
        #expect(abs(bill.payroll - 15_514) < 1)
        #expect(abs(bill.state - (13_962.45 + 9_255.09)) < 1)
    }

    @Test func pretax401kLowersIncomeTaxButNotPayroll() {
        let none = ForecastTax.bill([.init(id: "a", wages: 250_000, pretax: 0, region: .newYorkCity, otherRate: 0)], joint: false)
        let maxed = ForecastTax.bill([.init(id: "a", wages: 250_000, pretax: 24_500, region: .newYorkCity, otherRate: 0)], joint: false)
        #expect(maxed.federal < none.federal - 7_000)
        #expect(maxed.payroll == none.payroll)
    }

    @Test func jointFilingPoolsFederalBrackets() {
        let earners: [ForecastTax.Earner] = [.init(id: "a", wages: 250_000, pretax: 0, region: .connecticut, otherRate: 0),
                                             .init(id: "b", wages: 50_000, pretax: 0, region: .connecticut, otherRate: 0)]
        let single = ForecastTax.bill(earners, joint: false)
        let joint = ForecastTax.bill(earners, joint: true)
        #expect(joint.federal < single.federal)
    }

    @Test func plansSavedBeforeTaxesStillLoad() throws {
        let old = ##"{"name":"Old","icon":"safari","people":[{"id":"p","name":"Me","birthYear":1998,"retirementAge":65,"endAge":90,"socialSecurityMonthly":0,"socialSecurityAge":67,"colorHex":"#000","emoji":""}],"incomes":[{"id":"i","name":"Pay","ownerId":"p","yearlyAmount":100000,"raise":0}],"accounts":[],"yearlyExpenses":50000,"useActualExpenses":false,"events":[],"settings":{"inflation":0.03,"investmentGrowth":0.07,"cashGrowth":0.03,"volatility":0.12,"showTodaysDollars":true,"retirementAccessAge":60},"savingsSplit":{},"withdrawalOrder":[]}"##
        let plan = try JSONDecoder().decode(ForecastPlan.self, from: Data(old.utf8))
        #expect(plan.name == "Old")
        #expect(plan.incomes[0].isBeforeTax == false)
        #expect(plan.filing == .single)
    }

    @Test func salaryIsTaxedAndPretaxGoesToRetirementAccount() {
        var plan = ForecastPlan()
        plan.people = [ForecastPerson(id: "me", name: "Me", birthYear: 1998)]
        plan.accounts = [ForecastAccount(id: "401", name: "401(k)", kind: .retirement, balance: 0)]
        var salary = ForecastIncome(id: "s", name: "Salary", ownerId: "me", yearlyAmount: 250_000)
        salary.isBeforeTax = true
        salary.retirementContribution = 24_500
        plan.incomes = [salary]
        plan.yearlyExpenses = 100_000
        plan.useActualExpenses = false
        let y = ForecastEngine.project(plan, startYear: 2026, firstYearFraction: 1).years[0]
        let taxes = y.expenses.filter { $0.id.hasPrefix("tax-") }.reduce(0) { $0 + $1.amount }
        #expect(taxes > 70_000 && taxes < 90_000)
        #expect(y.accounts.first { $0.id == "401" }!.deposits == 24_500)
    }
}
