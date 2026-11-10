import Foundation
import SwiftData
import Testing
@testable import Wooli

// Unit tests for Wooli's pure logic (backlog O4). New insight math ships with tests here.

// MARK: - Helpers

private let cal = Calendar.current

private func day(_ y: Int, _ m: Int, _ d: Int, hour: Int = 12) -> Date {
    cal.date(from: DateComponents(year: y, month: m, day: d, hour: hour))!
}

@MainActor
private func makeContext() throws -> ModelContext {
    let schema = Schema([LocalTransaction.self, BudgetCategory.self, TransactionRule.self])
    let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true, cloudKitDatabase: .none)
    return ModelContext(try ModelContainer(for: schema, configurations: config))
}

private func tx(_ payee: String, _ amount: Double = -12, on date: Date = .now, account: String = "acct") -> LocalTransaction {
    LocalTransaction(providerTransactionId: UUID().uuidString, accountId: account, amount: amount,
                     transactionDescription: payee.uppercased(), payee: payee, transactedAt: date, isPending: false)
}

/// Runs the rules the way a sync does (oldest first, last match wins) and returns the category name.
@MainActor
private func file(_ payee: String, in context: ModelContext) throws -> String? {
    let rules = try context.fetch(FetchDescriptor<TransactionRule>(sortBy: [SortDescriptor(\.createdAt)]))
    let categories = try context.fetch(FetchDescriptor<BudgetCategory>())
    let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
    let t = tx(payee)
    RuleEngine.applyAll(rules, to: t, categories: byId)
    return t.categoryId.flatMap { byId[$0]?.name }
}

// MARK: - Starter rules (O7)

@MainActor
struct StarterRuleTests {
    @Test func narrowRulesBeatBroadOnes() throws {
        let context = try makeContext()
        DefaultCategories.seedIfNeeded(context)
        #expect(try file("Uber Eats", in: context) == "Takeout & Delivery")
        #expect(try file("Uber", in: context) == "Rideshare & Taxi")
        #expect(try file("Lyft", in: context) == "Rideshare & Taxi")
        #expect(try file("Amazon", in: context) == "Shopping")
        #expect(try file("Amazon Prime Video", in: context) == "Subscriptions")
        #expect(try file("Amazon Web Services", in: context) == "Subscriptions")
        #expect(try file("Target", in: context) == "Shopping")
        #expect(try file("Targeted Fitness", in: context) == nil)
    }

    @Test func orderSurvivesConsolidation() throws {
        let context = try makeContext()
        DefaultCategories.seedIfNeeded(context)
        RuleEngine.consolidate(context: context)
        #expect(try file("Uber Eats", in: context) == "Takeout & Delivery")
        #expect(try file("DoorDash", in: context) == "Takeout & Delivery")
        #expect(try file("Uber", in: context) == "Rideshare & Taxi")
        #expect(try file("Amazon Prime Video", in: context) == "Subscriptions")
    }

    @Test func repairFixesRulesSeededInTheOldOrder() throws {
        let context = try makeContext()
        DefaultCategories.seedIfNeeded(context)
        // Rebuild the pre-2026-11-09 starter set: uber eats oldest, "uber " after it, contains target.
        for rule in try context.fetch(FetchDescriptor<TransactionRule>()) { context.delete(rule) }
        let categories = try context.fetch(FetchDescriptor<BudgetCategory>())
        func id(_ name: String) -> String { categories.first { $0.parentId != nil && $0.name == name }!.id }
        let old: [(String, String)] = [("uber eats", "Takeout & Delivery"), ("target", "Shopping"), ("amazon", "Shopping"),
                                       ("netflix", "Subscriptions"), ("uber ", "Rideshare & Taxi")]
        for (i, (merchant, category)) in old.enumerated() {
            let rule = TransactionRule()
            rule.createdAt = Date.now.addingTimeInterval(Double(i - 100))
            rule.merchantMatch = "contains"
            rule.merchantTexts = [merchant]
            rule.setCategoryId = id(category)
            context.insert(rule)
        }
        try context.save()
        RuleEngine.consolidate(context: context)
        #expect(try file("Uber Eats", in: context) == "Rideshare & Taxi", "the old bug")
        #expect(try file("Targeted Fitness", in: context) == "Shopping", "the old bug")

        UserDefaults.standard.removeObject(forKey: "didStarterRulesRepair_v3")
        DefaultCategories.repairStarterRules(context: context)
        RuleEngine.consolidate(context: context)
        #expect(try file("Uber Eats", in: context) == "Takeout & Delivery")
        #expect(try file("Uber", in: context) == "Rideshare & Taxi")
        #expect(try file("Target", in: context) == "Shopping")
        #expect(try file("Targeted Fitness", in: context) == nil)
        #expect(try file("Amazon", in: context) == "Shopping")
        #expect(try file("Amazon Prime Video", in: context) == "Subscriptions")
    }
}

// MARK: - Rule matching

@MainActor
struct RuleMatchingTests {
    private func rule(_ mode: String, _ texts: [String]) -> TransactionRule {
        let r = TransactionRule()
        r.merchantMatch = mode
        r.merchantTexts = texts
        r.setCategoryId = "x"
        return r
    }

    @Test func containsIsCaseInsensitiveAndTrimsTheNeedle() {
        #expect(RuleEngine.matches(rule("contains", ["uber "]), tx("Uber Eats")))
        #expect(RuleEngine.matches(rule("contains", ["STARBUCKS"]), tx("Starbucks Reserve")))
        #expect(!RuleEngine.matches(rule("contains", ["lyft"]), tx("Uber")))
    }

    @Test func exactNeedsTheWholeName() {
        #expect(RuleEngine.matches(rule("exact", ["target"]), tx("Target")))
        #expect(!RuleEngine.matches(rule("exact", ["target"]), tx("Targeted Fitness")))
        #expect(RuleEngine.matches(rule("exact", ["target", "target.com"]), tx("Target.com")))
    }

    @Test func ruleWithoutConditionsMatchesNothing() {
        let r = TransactionRule()
        r.setCategoryId = "x"
        #expect(!RuleEngine.matches(r, tx("Anything")))
    }
}

// MARK: - Cadence

struct CadenceTests {
    @Test func monthlyClampsToShortMonths() {
        let next = Cadence.monthly.next(after: day(2026, 1, 31))
        #expect(cal.component(.month, from: next) == 2)
        #expect(cal.component(.day, from: next) == 28)
    }

    @Test func weeklyAndBiweeklyStepBothWays() {
        let start = day(2026, 3, 10)
        for cadence in [Cadence.weekly, .biweekly] {
            #expect(cadence.previous(before: cadence.next(after: start)) == start)
        }
        #expect(cal.dateComponents([.day], from: start, to: Cadence.biweekly.next(after: start)).day == 14)
    }

    @Test func semimonthlyAlternatesHalves() {
        #expect(cal.component(.day, from: Cadence.semimonthly.next(after: day(2026, 4, 1))) == 15)
        let fromSecondHalf = Cadence.semimonthly.next(after: day(2026, 4, 16))
        #expect(cal.component(.month, from: fromSecondHalf) == 5)
        #expect(cal.component(.day, from: fromSecondHalf) == 1)
    }

    @Test func quarterlyAndYearly() {
        #expect(cal.component(.month, from: Cadence.quarterly.next(after: day(2026, 1, 15))) == 4)
        #expect(cal.component(.year, from: Cadence.yearly.next(after: day(2026, 1, 15))) == 2027)
    }
}

// MARK: - Running spending total

@MainActor
struct CumulativeSpendingTests {
    @Test func countsOnlyVisibleSpendingInTheMonth() throws {
        let context = try makeContext()
        DefaultCategories.seedIfNeeded(context)
        let categories = try context.fetch(FetchDescriptor<BudgetCategory>())
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let salary = categories.first { $0.name == "Salary" }!
        let month = cal.dateInterval(of: .month, for: day(2026, 3, 15))!

        let paycheck = tx("Employer", 2_000, on: day(2026, 3, 2))
        paycheck.categoryId = salary.id
        let hidden = tx("Hidden", -500, on: day(2026, 3, 3))
        hidden.isHidden = true
        let transactions = [
            tx("Coffee", -5, on: day(2026, 3, 1)),
            tx("Groceries", -45, on: day(2026, 3, 3)),
            paycheck, hidden,
            tx("Other account", -100, on: day(2026, 3, 3), account: "hidden-acct"),
            tx("Last month", -999, on: day(2026, 2, 28)),
        ]
        let points = cumulativeSpending(transactions, in: month, categories: byId, hiddenAccounts: ["hidden-acct"])
        #expect(points.first?.value == 5)
        #expect(points.count >= 3)
        #expect(points[2].value == 50)
        #expect(points.last?.value == 50)
    }
}

// MARK: - People (O2)

struct PersonFilterTests {
    @Test func sharedAccountsCountForEveryone() {
        let account = LocalAccount(providerAccountId: "a", name: "Joint", institutionName: "Bank", currency: "USD",
                                   balance: 0, balanceDate: .now, kind: .checking)
        #expect(account.counts(forPerson: nil))
        #expect(account.counts(forPerson: "maya"))
        account.ownerId = "sam"
        #expect(account.counts(forPerson: nil))
        #expect(account.counts(forPerson: "sam"))
        #expect(!account.counts(forPerson: "maya"))
    }
}

// MARK: - Period math

struct CycleMathTests {
    @Test func selfChecksPass() {
        #expect(CycleMath.selfTest() == [])
    }
}

// MARK: - Eats scale

struct EatsScaleTests {
    private func place(_ id: String, _ feeling: MealSentiment, _ rank: Double) -> RankCandidate {
        RankCandidate(id: id, title: id, sentiment: feeling, rank: rank)
    }

    @Test func feelingsFillTheirThirds() {
        let items = [place("a", .liked, 3), place("b", .liked, 2), place("c", .liked, 1),
                     place("d", .fine, 1), place("e", .disliked, 2), place("f", .disliked, 1)]
        let scores = EatsRanking.scores(items)
        #expect(scores["a"] == 10.0)
        #expect(scores["c"] == 6.7)
        #expect(scores["d"] == 6.6)
        #expect(scores["e"] == 3.3)
        #expect(scores["f"] == 1.0)
    }

    @Test func olderMustTrysSitOnTopOfLiked() {
        let items = [place("old", .mustTry, 0), place("new", .liked, 5)]
        let scores = EatsRanking.scores(items)
        #expect(scores["old"] == 10.0)
        #expect(scores["new"] == 6.7)
    }

    @Test func moviesKeepTheirBands() {
        let items = [place("a", .fine, 2), place("b", .fine, 1)]
        let scores = EatsRanking.scores(items, scale: .movies)
        #expect(scores["a"] == 6.9)
        #expect(scores["b"] == 4.0)
    }

    @Test func verdictsFollowTheThirds() {
        #expect(EatsVerdict.label(for: 10) == "Must try")
        #expect(EatsVerdict.label(for: 8.0) == "Safe bet")
        #expect(EatsVerdict.label(for: 6.7) == "Average")
        #expect(EatsVerdict.label(for: 6.6) == "Plan B")
        #expect(EatsVerdict.label(for: 3.4) == "Skip")
        #expect(EatsVerdict.label(for: 3.3) == "Avoid")
        #expect(EatsVerdict.label(for: 1.0) == "Do you even love yourself")
        #expect(EatsVerdict.options(for: .fine).map(\.score) == [6, 5, 4])
    }

    @Test func stampTiersUseTheThirds() {
        #expect(RankStamp.Tier(score: 6.7) == .loved)
        #expect(RankStamp.Tier(score: 6.7, scale: .movies) == .fine)
    }
}
