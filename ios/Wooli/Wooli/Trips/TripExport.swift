import Foundation

/// Getting a trip out of the app (M2-5): text, Markdown and a calendar file.
/// Pure builders so they can be tested; the Mac menu only copies or saves the result.
enum TripExport {
    /// Plans that belong in anything handed to someone else.
    static func exportable(_ items: [TripItem]) -> [TripItem] {
        items.filter { !$0.isCancelled && !$0.isHiddenPlaceholder }
    }

    // MARK: Text and Markdown

    static func text(trip: Trip, items: [TripItem], markdown: Bool = false) -> String {
        let items = exportable(items)
        var out: [String] = []
        out.append(markdown ? "# \(title(trip))" : title(trip))
        out.append(trip.dateRangeText)
        for day in trip.days {
            // A stay shows on its check-in day only; the nights after are implied.
            let plans = items.filter { $0.day == day }.sorted(by: TripItem.dayOrder)
            guard !plans.isEmpty else { continue }
            let city = trip.legs.first { !$0.isHome && $0.contains(day) }?.name
            let heading = [dayLabel(day), city].compactMap { $0 }.joined(separator: " · ")
            out.append("")
            out.append(markdown ? "## \(heading)" : heading)
            for plan in plans { out.append(contentsOf: lines(plan, markdown: markdown)) }
        }
        let days = Set(trip.days)
        let ideas = items.filter { $0.day.map { !days.contains($0) } ?? true }.sorted(by: TripItem.dayOrder)
        if !ideas.isEmpty {
            out.append("")
            out.append(markdown ? "## Ideas" : "Ideas")
            for plan in ideas { out.append(contentsOf: lines(plan, markdown: markdown)) }
        }
        return out.joined(separator: "\n") + "\n"
    }

    private static func title(_ trip: Trip) -> String { trip.name.isEmpty ? "Trip" : trip.name }

    private static func lines(_ item: TripItem, markdown: Bool) -> [String] {
        var head = TripBookings.what(item)
        if let end = item.stayEnd { head += " (until \(dayLabel(end)))" }
        if let time = item.timeText { head = "\(time)  \(head)" }
        if let status = item.bookingStatus, status == .planned || status == .idea { head += " [not booked]" }
        var details: [String] = []
        if let address = item.place?.address, !address.isEmpty { details.append(address) }
        if let code = item.transport?.confirmation, !code.isEmpty { details.append("Confirmation \(code)") }
        if let price = item.priceText { details.append(price) }
        let note = TripItem.strippingNotBooked(item.notes).trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { details.append(note.replacingOccurrences(of: "\n", with: " ")) }
        let first = markdown ? "- \(head)" : "  \(head)"
        return [first] + details.map { markdown ? "  - \($0)" : "      \($0)" }
    }

    private static func dayLabel(_ day: String) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE, MMM d"
        return f.string(from: DayKey.date(day))
    }

    // MARK: Calendar file (.ics)

    /// Timed plans become timed events (floating times until time zones per city ship, M3-1),
    /// untimed plans and stays become all-day events. `stamp` is injectable for tests.
    static func ics(trip: Trip, items: [TripItem], stamp: Date = .now) -> String {
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wooli//Trips//EN", "CALSCALE:GREGORIAN"]
        let dtstamp = utc(stamp)
        for item in exportable(items) {
            guard let day = item.day else { continue }
            lines += ["BEGIN:VEVENT", "UID:\(item.id)@wooli", "DTSTAMP:\(dtstamp)",
                      "SUMMARY:\(escape(TripBookings.what(item)))"]
            if let time = item.time, item.kind != .stay {
                // Real zones when the cities have them (as UTC, so no VTIMEZONE is needed); floating otherwise.
                let startZone = TripTimeZones.zone(on: day, in: trip)
                let finish = endDay(item, day: day)
                let endZone = item.kind == .transit ? (TripTimeZones.zone(on: finish, in: trip, arriving: true) ?? startZone) : startZone
                lines.append("DTSTART:\(stamp(day, time, startZone))")
                lines.append("DTEND:\(stamp(finish, endMinutes(item, start: time), endZone))")
            } else {
                lines.append("DTSTART;VALUE=DATE:\(compact(day))")
                let end = item.stayEnd ?? shifted(day, by: 1)
                lines.append("DTEND;VALUE=DATE:\(compact(end))")
            }
            if let place = item.place {
                lines.append("LOCATION:\(escape([place.name, place.address].filter { !$0.isEmpty }.joined(separator: ", ")))")
            }
            var description: [String] = []
            if let code = item.transport?.confirmation, !code.isEmpty { description.append("Confirmation \(code)") }
            let note = TripItem.strippingNotBooked(item.notes).trimmingCharacters(in: .whitespacesAndNewlines)
            if !note.isEmpty { description.append(note) }
            if !description.isEmpty { lines.append("DESCRIPTION:\(escape(description.joined(separator: "\n")))") }
            lines.append("END:VEVENT")
        }
        lines.append("END:VCALENDAR")
        return lines.flatMap(fold).joined(separator: "\r\n") + "\r\n"
    }

    /// A flight ends at its arrival; anything else lasts an hour.
    private static func endDay(_ item: TripItem, day: String) -> String {
        if item.kind == .transit, let t = item.transport, t.arriveTime != nil {
            return shifted(day, by: t.arriveDayOffset)
        }
        return day
    }

    private static func endMinutes(_ item: TripItem, start: Int) -> Int {
        if item.kind == .transit, let arrive = item.transport?.arriveTime { return arrive }
        return min(start + 60, 24 * 60 - 1)
    }

    private static func shifted(_ day: String, by days: Int) -> String {
        DayKey.key(Calendar.current.date(byAdding: .day, value: days, to: DayKey.date(day)) ?? DayKey.date(day))
    }

    private static func stamp(_ day: String, _ minutes: Int, _ zone: TimeZone?) -> String {
        guard let zone, let moment = TripTimeZones.instant(day: day, minutes: minutes, zone: zone) else {
            return local(day, minutes: minutes)
        }
        return utc(moment)
    }

    private static func compact(_ day: String) -> String { day.replacingOccurrences(of: "-", with: "") }

    private static func local(_ day: String, minutes: Int) -> String {
        compact(day) + String(format: "T%02d%02d00", minutes / 60, minutes % 60)
    }

    private static func utc(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
        return f.string(from: date)
    }

    private static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: ";", with: "\\;")
            .replacingOccurrences(of: ",", with: "\\,")
            .replacingOccurrences(of: "\n", with: "\\n")
    }

    /// Lines over 75 characters continue on the next line after a space.
    private static func fold(_ line: String) -> [String] {
        var result: [String] = []
        var rest = Substring(line)
        var limit = 75
        while rest.count > limit {
            result.append((result.isEmpty ? "" : " ") + rest.prefix(limit))
            rest = rest.dropFirst(limit)
            limit = 74
        }
        result.append((result.isEmpty ? "" : " ") + rest)
        return result
    }
}
