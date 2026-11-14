import Foundation

/// A ready-to-paste prompt for planning the open trip with Claude (M4-7). Wooli makes no API calls:
/// the prompt is copied and you paste it into Claude, where Wooli's tools (set up once) can read and
/// edit the trip. Pure: trip and plans in, text out.
enum PlanPrompt {
    static func make(trip: Trip, items: [TripItem]) -> String {
        let items = TripExport.exportable(items)
        let name = trip.name.isEmpty ? "my trip" : trip.name
        var lines = ["Help me plan \(name), \(trip.dateRangeText)."]

        let cities = trip.legs.filter { !$0.isHome && !$0.name.isEmpty }
        if !cities.isEmpty {
            let route = cities.map { "\($0.name) (\($0.nights) night\($0.nights == 1 ? "" : "s"))" }.joined(separator: ", ")
            lines.append("Cities: \(route).")
        }
        let booked = items.filter { ($0.kind == .transit || $0.kind == .stay) && !$0.isUnbooked }
        if !booked.isEmpty {
            lines.append("Already booked: " + booked.map(TripBookings.what).joined(separator: "; ") + ".")
        }

        let todo = TripTodo.list(trip: trip, items: items)
        if todo.isEmpty {
            lines.append("Nothing obvious is missing; look for ways to improve what's there.")
        } else {
            lines.append("Still open:")
            lines += todo.map { "- \($0.title)" }
        }

        let ideas = items.filter { $0.day == nil || !trip.days.contains($0.day ?? "") }
        if !ideas.isEmpty {
            lines.append("Ideas I haven't scheduled: " + ideas.prefix(12).map(TripBookings.what).joined(separator: ", ") + ".")
        }

        lines.append("")
        lines.append("Use my Wooli tools: read this trip with wooli_trips, then suggest a plan and, once I agree, add it with wooli_add_to_trip or wooli_edit_trip. Don't change anything I've already booked.")
        return lines.joined(separator: "\n")
    }
}
