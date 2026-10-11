#if DEBUG
import Foundation
import SwiftData

/// Exercises split + skip-review on sample data (launch with `-selftest`).
/// Results are left in the store for inspection.
@MainActor
enum DebugSelfTest {
    static func run(context: ModelContext) {
        let cycleFailures = CycleMath.selfTest()
        print(cycleFailures.isEmpty ? "SELFTEST CycleMath: pass" : "SELFTEST CycleMath FAIL: \(cycleFailures)")
        UserDefaults.standard.set(cycleFailures.joined(separator: "; "), forKey: "selftest.cycleMath")
        let txs = (try? context.fetch(FetchDescriptor<LocalTransaction>(sortBy: [SortDescriptor(\.transactedAt, order: .reverse)]))) ?? []
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        guard let groceries = categories.first(where: { $0.name == "Groceries" }),
              let supplies = categories.first(where: { $0.name == "Home Supplies" }),
              let transit = categories.first(where: { $0.name == "Transit" }) else { return }
        // Split the latest posted Whole Foods trip 70/30.
        if let trip = txs.first(where: { $0.title == "Whole Foods Market" && !$0.isPending && !$0.isSplit && $0.splitParentId.isEmpty }) {
            let total = abs(trip.amount)
            let a = (total * 0.7 * 100).rounded() / 100
            SplitService.split(trip, into: [.init(categoryId: groceries.id, amount: a), .init(categoryId: supplies.id, amount: total - a)],
                               categories: categories, context: context)
        }
        // A rule made from a transaction (as when reviewing) clears matches from review.
        if let coffee = categories.first(where: { $0.name == "Coffee" }),
           let starbucks = txs.first(where: { $0.title == "Starbucks" }) {
            let rule = TransactionRule()
            RuleEngine.seed(rule, from: starbucks, category: coffee)
            context.insert(rule)
            let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            RuleEngine.applyToExisting(rule, transactions: txs, categories: byId)
            starbucks.tags = ["Test tag"]
            try? context.save()
        }
        // Skip review for MTA Subway.
        if let mta = txs.first(where: { $0.title == "MTA Subway" }) {
            RuleEngine.autoApprove(mta, category: transit, context: context)
        }
    }
}
#endif
