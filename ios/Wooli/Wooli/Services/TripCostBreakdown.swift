import Foundation

/// The Costs page's two bar lists (M2-4): where the money goes by kind of booking and
/// by city, in one currency. Pure: items and legs in, rows out.
struct CostBar: Identifiable, Equatable {
    let id: String
    let title: String
    /// In the budget currency.
    let amount: Double
    /// 0...1 of the largest bar, for drawing.
    let share: Double
}

enum TripCostBreakdown {
    /// By kind: flights and trains, stays, food, activities. Largest first. Cancelled plans are left out.
    static func byType(items: [TripItem], budget: String, rates: [String: Double]) -> [CostBar] {
        let costs = TripCosts(items: items)
        return bars(costs.lines.map { ($0.id, $0.title, ExchangeRates.convert($0.totals, to: budget, rates: rates).amount) })
    }

    /// By city: a plan counts for the city its day falls in (on a change day, the city you arrive in);
    /// plans on no city's day, or none, are "Other".
    static func byCity(trip: Trip, items: [TripItem], budget: String, rates: [String: Double]) -> [CostBar] {
        let cities = trip.legs.filter { !$0.isHome }
        var totals: [String: (title: String, totals: [String: Double])] = [:]
        for item in TripExport.exportable(items) where item.cost != nil {
            let leg = item.day.flatMap { day in cities.last { $0.contains(day) } }
            let key = leg?.id ?? "other"
            var entry = totals[key] ?? (leg?.name ?? "Other", [:])
            entry.totals[item.currencyCode, default: 0] += item.cost ?? 0
            totals[key] = entry
        }
        return bars(totals.map { ($0.key, $0.value.title, ExchangeRates.convert($0.value.totals, to: budget, rates: rates).amount) })
    }

    private static func bars(_ rows: [(id: String, title: String, amount: Double)]) -> [CostBar] {
        let rows = rows.filter { $0.amount > 0 }.sorted { ($0.amount, $1.title) > ($1.amount, $0.title) }
        let top = rows.first?.amount ?? 1
        return rows.map { CostBar(id: $0.id, title: $0.title, amount: $0.amount, share: $0.amount / top) }
    }
}
