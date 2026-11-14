import Foundation

// M2-5: getting a trip out of Wooli. Pure builders (no SwiftUI) for the
// day-by-day text and Markdown, the calendar file and the trip file, so each
// can be tested; the Mac views just hand the result to the pasteboard,
// a save panel or the print system.

struct ExportOptions: Equatable {
    var costs = false
    var notes = true
    var markdown = false
}

enum TripExport {
    // MARK: Itinerary as text

    /// A day-by-day itinerary: cover lines, then each day under its city.
    /// Cancelled plans, empty meal slots and Ideas are left out.
    static func itinerary(trip: Trip, items: [TripItem], options: ExportOptions = ExportOptions()) -> String {
        let md = options.markdown
        var out: [String] = []
        out.append(md ? "# \(title(trip))" : title(trip).uppercased())
        var cover = [trip.dateRangeText]
        let cities = trip.awayLegs.map(\.name).filter { !$0.isEmpty }
        if !cities.isEmpty { cover.append(cities.joined(separator: " → ")) }
        out.append(cover.joined(separator: " · "))

        var lastLeg: String?
        for day in trip.days {
            let plans = plans(on: day, in: items)
            let leg = trip.leg(for: day)
            if let leg, leg.id != lastLeg, !leg.isHome, !leg.name.isEmpty {
                out.append("")
                out.append(md ? "## \(leg.name)" : leg.name)
                lastLeg = leg.id
            }
            out.append("")
            let heading = dayHeading(day, title: trip.dayTitles[day])
            out.append(md ? "### \(heading)" : heading)
            if plans.isEmpty {
                out.append(md ? "_Nothing planned_" : "  Nothing planned")
                continue
            }
            for item in plans {
                let (first, rest) = lines(item, options: options)
                out.append((md ? "- " : "  ") + first)
                out.append(contentsOf: rest.map { (md ? "  " : "    ") + $0 })
            }
        }
        return out.joined(separator: "\n") + "\n"
    }

    static func title(_ trip: Trip) -> String { trip.name.isEmpty ? "Trip" : trip.name }

    static func dayHeading(_ day: String, title: String?) -> String {
        let date = DayKey.date(day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        guard let title, !title.isEmpty else { return date }
        return "\(date) · \(title)"
    }

    /// What's on `day`: plans placed there, plus a stay's check-out on its last day, in the day's order.
    static func plans(on day: String, in items: [TripItem]) -> [TripItem] {
        items.filter { $0.day == day && !$0.isHiddenPlaceholder && !$0.isMealPlaceholder && !$0.isCancelled }
            .sorted(by: TripItem.dayOrder)
    }

    /// The plan's headline, then detail lines (booking, address, notes).
    static func lines(_ item: TripItem, options: ExportOptions) -> (String, [String]) {
        var head = item.timeText.map { "\($0)  " } ?? ""
        head += item.title.isEmpty ? (item.transport?.suggestedTitle ?? item.kind.label) : item.title
        var details: [String] = []
        if let t = item.transport {
            var trip: [String] = []
            if t.mode == .flight, let airline = t.airlineName { trip.append(airline) }
            if let arrive = arrival(t) { trip.append(arrive) }
            if !t.departTerminal.isEmpty { trip.append("Terminal \(t.departTerminal)") }
            if !t.seats.isEmpty { trip.append("Seat \(t.seats)") }
            if !t.cabin.isEmpty { trip.append(t.cabin) }
            if !trip.isEmpty { details.append(trip.joined(separator: " · ")) }
            if !t.confirmation.isEmpty { details.append("Confirmation \(t.confirmation)") }
        }
        if item.kind == .stay {
            var stay: [String] = []
            if let end = item.stayEnd {
                stay.append("\(item.nights) night\(item.nights == 1 ? "" : "s"), out \(DayKey.date(end).formatted(.dateTime.month(.abbreviated).day()))")
            }
            if !stay.isEmpty { details.append(stay.joined(separator: " · ")) }
        }
        if let place = item.place, !place.address.isEmpty, place.address != item.title { details.append(place.address) }
        if item.isUnbooked, item.needsBooking { details.append("Not booked yet") }
        if options.costs, let price = item.priceText { details.append(price) }
        if options.notes {
            let note = TripItem.strippingNotBooked(item.notes).trimmingCharacters(in: .whitespacesAndNewlines)
            if !note.isEmpty {
                details.append(contentsOf: note.split(whereSeparator: \.isNewline).map { String($0) })
            }
        }
        return (head, details)
    }

    private static func arrival(_ t: TripTransport) -> String? {
        guard let minutes = t.arriveTime else { return nil }
        let date = Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now
        let text = date.formatted(date: .omitted, time: .shortened)
        return "arrives \(text)" + (t.arriveDayOffset > 0 ? " +\(t.arriveDayOffset)" : "")
    }
}
