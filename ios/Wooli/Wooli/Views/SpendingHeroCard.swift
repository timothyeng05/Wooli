import SwiftUI

/// The Dashboard's hero: how much is left to spend this month, as a road through the month
/// with a pin for today. Taps through to the full pace and month-over-month charts.
struct SpendingHeroCard: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger
    let month: DateInterval
    let target: Double
    let recurring: [RecurringItem]

    var body: some View {
        let current = cumulativeSpending(transactions, in: month, through: .now,
                                         categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let spent = current.last?.value ?? 0
        let daysInMonth = Calendar.current.range(of: .day, in: .month, for: month.start)?.count ?? 30
        let dayOfMonth = min(max(current.count, 1), daysInMonth)
        let pace = SpendingPace(target: target, month: month, items: recurring, transactions: transactions, ledger: ledger)
        let expectedToday = target > 0 && !pace.expected.isEmpty ? pace.expected[min(dayOfMonth, pace.expected.count) - 1] : 0
        let paceDiff = expectedToday - spent
        let over = target > 0 && spent > target
        let lastDay = Calendar.current.date(byAdding: .day, value: -1, to: month.end) ?? month.end

        NavigationLink {
            SpendingDetailView(transactions: transactions, ledger: ledger, month: month, target: target, recurring: recurring)
        } label: {
            HeroCard(eyebrow: "Left to spend") {
                if target > 0 {
                    Text("\(abs(target - spent).currency(cents: false)) \(over ? "over" : "left")")
                        .wooliFont(.amount)
                    Text("of \(target.currency(cents: false)) planned")
                        .font(.footnote)
                } else {
                    Text(spent.currency(cents: false)).wooliFont(.amount)
                    Text("spent this month · set a budget on the Budget tab to see your pace")
                        .font(.footnote)
                }
                RouteProgress(
                    progress: Double(dayOfMonth) / Double(daysInMonth),
                    startLabel: month.start.formatted(.dateTime.month(.abbreviated).day()),
                    middleLabel: target > 0
                        ? "Day \(dayOfMonth) · \(abs(paceDiff).currency(cents: false)) \(paceDiff >= 0 ? "under" : "over") your usual pace"
                        : "Day \(dayOfMonth)",
                    endLabel: lastDay.formatted(.dateTime.month(.abbreviated).day()))
            }
        }
        .buttonStyle(.plain)
    }
}

/// The full Spending Pace chart and this-month-vs-last chart, one tap from the hero.
struct SpendingDetailView: View {
    let transactions: [LocalTransaction]
    let ledger: Ledger
    let month: DateInterval
    let target: Double
    let recurring: [RecurringItem]

    var body: some View {
        ScrollView {
            VStack(spacing: Space.l) {
                PaceCard(transactions: transactions, ledger: ledger, month: month, target: target, recurring: recurring)
                SpendingComparisonCard(transactions: transactions, ledger: ledger)
            }
            .padding(Space.l)
        }
        .pageBackground()
        .navigationTitle("Spending")
        .navigationBarTitleDisplayMode(.inline)
    }
}
