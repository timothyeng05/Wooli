import Foundation

/// One row of the trip's To do list (M3-5): what to do next, and where to go to do it.
struct TripTodoItem: Identifiable, Hashable {
    /// In urgency order: a night with no bed matters before an empty afternoon.
    enum Kind: Int {
        case noBed, unbookedTravel, warnings, unpriced, emptyDays, ideas
    }
    let kind: Kind
    let title: String
    /// The day to scroll to.
    var day: String?
    /// The plan to select.
    var itemID: String?

    var id: String { "\(kind.rawValue):\(day ?? ""):\(itemID ?? "")" }
}

/// A short generated list, most urgent first. Pure: plans in, rows out.
/// An empty list means "Nothing left to plan".
enum TripTodo {
    static func list(trip: Trip, items: [TripItem]) -> [TripTodoItem] {
        let items = TripExport.exportable(items)
        var rows: [TripTodoItem] = []

        // Nights without a bed, one row per run of nights.
        let bedless = TripCoverage.days(trip: trip, items: items).filter { $0.state(.stay) == .open }.map(\.day)
        for run in runs(bedless, in: trip.days) {
            let city = trip.legs.first { !$0.isHome && $0.contains(run[0]) }.map { " in \($0.name)" } ?? ""
            let when = run.count == 1 ? shortDay(run[0]) : "\(shortDay(run[0])) to \(shortDay(run[run.count - 1]))"
            rows.append(TripTodoItem(kind: .noBed, title: "No bed \(when)\(city)", day: run[0]))
        }

        // Travel still to book.
        for item in items where item.kind == .transit && item.isUnbooked && item.day != nil {
            rows.append(TripTodoItem(kind: .unbookedTravel, title: "Book \(TripBookings.what(item))", day: item.day, itemID: item.id))
        }

        // Warnings from the trip checks (the Warnings card has the detail and Ignore).
        let warnings = TripChecks.warnings(trip: trip, items: items)
        if let first = warnings.first {
            let day = items.first { $0.id == first.itemID }?.day
            rows.append(TripTodoItem(kind: .warnings,
                                     title: "\(warnings.count) thing\(warnings.count == 1 ? "" : "s") to check",
                                     day: day, itemID: first.itemID))
        }

        // Travel and stays with no price.
        let unpriced = items.filter { ($0.kind == .transit || $0.kind == .stay) && $0.cost == nil && $0.points == nil && $0.day != nil }
            .sorted { ($0.day ?? "") < ($1.day ?? "") }
        if let first = unpriced.first {
            rows.append(TripTodoItem(kind: .unpriced,
                                     title: "\(unpriced.count) booking\(unpriced.count == 1 ? "" : "s") without a price",
                                     day: first.day, itemID: first.id))
        }

        // Days with nothing on them.
        let planned = Set(items.compactMap(\.day))
        let empty = trip.days.filter { !planned.contains($0) }
        if let first = empty.first {
            rows.append(TripTodoItem(kind: .emptyDays,
                                     title: "\(empty.count) day\(empty.count == 1 ? "" : "s") with nothing planned", day: first))
        }

        // Ideas not on a day yet.
        let days = Set(trip.days)
        let ideas = items.filter { $0.day.map { !days.contains($0) } ?? true }
        if let first = ideas.first {
            rows.append(TripTodoItem(kind: .ideas, title: "\(ideas.count) idea\(ideas.count == 1 ? "" : "s") waiting", itemID: first.id))
        }

        return rows.sorted { ($0.kind.rawValue, $0.day ?? "") < ($1.kind.rawValue, $1.day ?? "") }
    }

    /// Groups days that follow each other in the trip.
    static func runs(_ days: [String], in tripDays: [String]) -> [[String]] {
        let index = Dictionary(uniqueKeysWithValues: tripDays.enumerated().map { ($1, $0) })
        var result: [[String]] = []
        for day in days.sorted() {
            if let last = result.last?.last, let a = index[last], let b = index[day], b == a + 1 {
                result[result.count - 1].append(day)
            } else {
                result.append([day])
            }
        }
        return result
    }

    private static func shortDay(_ day: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MMM d"
        return f.string(from: DayKey.date(day))
    }
}
