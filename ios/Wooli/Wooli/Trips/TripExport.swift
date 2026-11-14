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

    // MARK: Calendar file (.ics)

    /// Flights, trains and stays, plus any plan with a time, as one iCalendar
    /// file. Flights use each airport's own time zone; everything else is
    /// "floating" local time, which Calendar shows as written. A file rather
    /// than EventKit, so no calendar permission is needed.
    static func calendar(trip: Trip, items: [TripItem], now: Date = .now) -> String {
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wooli//Trips//EN", "CALSCALE:GREGORIAN",
                     "X-WR-CALNAME:" + escape(title(trip))]
        let stamp = utc(now)
        for item in items.sorted(by: TripItem.dayOrder) {
            guard let day = item.day, !item.isCancelled, !item.isHiddenPlaceholder, !item.isMealPlaceholder else { continue }
            guard item.kind == .stay || item.kind == .transit || item.time != nil else { continue }
            var event = ["BEGIN:VEVENT", "UID:\(item.id)@wooli", "DTSTAMP:\(stamp)"]
            if item.kind == .stay {
                let end = item.stayEnd ?? nextDay(day)
                event.append("DTSTART;VALUE=DATE:\(compact(day))")
                event.append("DTEND;VALUE=DATE:\(compact(end))")
            } else {
                let start = item.time ?? 0
                let zones = flightZones(item)
                event.append(stampLine("DTSTART", day: day, minutes: start, zone: zones.from))
                if let t = item.transport, let arrive = t.arriveTime {
                    event.append(stampLine("DTEND", day: addDays(day, t.arriveDayOffset), minutes: arrive, zone: zones.to))
                } else if let end = item.extras?.endTime {
                    event.append(stampLine("DTEND", day: day, minutes: end, zone: zones.from))
                } else {
                    event.append(stampLine("DTEND", day: day, minutes: min(start + 60, 23 * 60 + 59), zone: zones.from))
                }
            }
            event.append("SUMMARY:" + escape(summary(item)))
            let detail = description(item)
            if !detail.isEmpty { event.append("DESCRIPTION:" + escape(detail)) }
            if let place = item.place {
                event.append("LOCATION:" + escape([place.name, place.address].filter { !$0.isEmpty }.joined(separator: ", ")))
            }
            event.append("END:VEVENT")
            lines.append(contentsOf: event)
        }
        lines.append("END:VCALENDAR")
        return lines.map(fold).joined(separator: "\r\n") + "\r\n"
    }

    private static func summary(_ item: TripItem) -> String {
        let name = item.title.isEmpty ? (item.transport?.suggestedTitle ?? item.kind.label) : item.title
        return item.kind == .stay ? "Stay: \(name)" : name
    }

    private static func description(_ item: TripItem) -> String {
        var parts: [String] = []
        if let t = item.transport {
            if !t.confirmation.isEmpty { parts.append("Confirmation \(t.confirmation)") }
            if !t.seats.isEmpty { parts.append("Seat \(t.seats)") }
        }
        let note = TripItem.strippingNotBooked(item.notes).trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { parts.append(note) }
        return parts.joined(separator: "\n")
    }

    /// Time zones for the two ends of a flight; nil = floating.
    private static func flightZones(_ item: TripItem) -> (from: TimeZone?, to: TimeZone?) {
        guard let t = item.transport, t.mode == .flight else { return (nil, nil) }
        return (t.from?.timeZone, t.to?.timeZone)
    }

    private static func stampLine(_ name: String, day: String, minutes: Int, zone: TimeZone?) -> String {
        let value = "\(compact(day))T" + String(format: "%02d%02d00", minutes / 60, minutes % 60)
        return zone.map { "\(name);TZID=\($0.identifier):\(value)" } ?? "\(name):\(value)"
    }

    static func compact(_ day: String) -> String { day.replacingOccurrences(of: "-", with: "") }

    private static func addDays(_ day: String, _ n: Int) -> String {
        guard n != 0 else { return day }
        return DayKey.key(Calendar.current.date(byAdding: .day, value: n, to: DayKey.date(day)) ?? DayKey.date(day))
    }

    private static func nextDay(_ day: String) -> String { addDays(day, 1) }

    private static func utc(_ date: Date) -> String {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        return String(format: "%04d%02d%02dT%02d%02d%02dZ", c.year!, c.month!, c.day!, c.hour!, c.minute!, c.second!)
    }

    static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,").replacingOccurrences(of: "\n", with: "\\n")
    }

    /// Lines over 75 bytes continue on the next line after a space.
    private static func fold(_ line: String) -> String {
        guard line.utf8.count > 75 else { return line }
        var out = "", current = 0
        for ch in line {
            let size = String(ch).utf8.count
            if current + size > 74 { out += "\r\n "; current = 1 }
            out.append(ch)
            current += size
        }
        return out
    }
}
