import Foundation

/// One line of a trip's Bookings table (M2-2). Plain values so the table can
/// sort on any column; the plan itself is looked up by `id`.
struct BookingRow: Identifiable {
    let id: String
    var status: BookingStatus?
    /// Sort order for the Status column: not booked first, since those need action.
    var statusRank: Int
    var kindLabel: String
    var symbol: String
    var what: String
    var whenKey: Date
    var whenText: String
    var untilKey: Date
    var untilText: String
    var confirmation: String
    var cost: Double
    var costText: String
    var city: String
    /// A flight, train, bus or stay (the plans that need a booking).
    var isTravelOrStay: Bool
}

enum TripBookings {
    /// Travel and stays always; anything else once it has a status or a confirmation code.
    static func includes(_ item: TripItem) -> Bool {
        if item.isHiddenPlaceholder { return false }
        if item.kind == .transit || item.kind == .stay { return true }
        return item.bookingStatus != nil || !(item.transport?.confirmation ?? "").isEmpty
    }

    static func rows(trip: Trip, items: [TripItem]) -> [BookingRow] {
        items.filter(includes).map { row($0, trip: trip) }
    }

    /// "CX831 JFK → HKG", "Hyatt Regency Hangzhou", or the plan's own title.
    static func what(_ item: TripItem) -> String {
        if let t = item.transport {
            let from = [t.fromAirport, t.fromStation?.name ?? ""].first { !$0.isEmpty }
            let to = [t.toAirport, t.toStation?.name ?? ""].first { !$0.isEmpty }
            let route = (from != nil && to != nil) ? "\(from!) → \(to!)" : nil
            let text = [t.flightNumber, route].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ")
            if !text.isEmpty { return text }
        }
        if !item.title.isEmpty { return item.title }
        return item.place?.name ?? item.kind.label
    }

    static func row(_ item: TripItem, trip: Trip) -> BookingRow {
        let start = moment(item.day, minutes: item.time)
        var end: Date?
        if let stayEnd = item.stayEnd {
            end = moment(stayEnd, minutes: nil)
        } else if item.kind == .transit, let day = item.day, let t = item.transport, let arrive = t.arriveTime {
            let date = DayKey.date(day)
            end = Calendar.current.date(byAdding: .day, value: t.arriveDayOffset, to: date)
                .flatMap { Calendar.current.date(byAdding: .minute, value: arrive, to: $0) }
        }
        let status = item.bookingStatus
        let rank: Int
        switch status {
        case .planned, .idea: rank = 0
        case .booked: rank = 1
        case .cancelled: rank = 2
        case nil: rank = 3
        }
        return BookingRow(
            id: item.id,
            status: status == .idea ? .planned : status,
            statusRank: rank,
            kindLabel: item.transport.map { $0.mode.label } ?? item.kind.label,
            symbol: item.transport.map { $0.mode.symbol } ?? item.kind.symbol,
            what: what(item),
            whenKey: start ?? .distantFuture,
            whenText: start.map { text($0, timed: item.time != nil) + zoneSuffix(item.day, in: trip, arriving: false, timed: item.time != nil) } ?? "No day yet",
            untilKey: end ?? .distantFuture,
            untilText: end.map { text($0, timed: item.kind == .transit) + zoneSuffix(end.map(DayKey.key), in: trip, arriving: true, timed: item.kind == .transit) } ?? "",
            confirmation: item.transport?.confirmation ?? "",
            cost: item.cost ?? 0,
            costText: item.priceText ?? "",
            city: item.day.flatMap { day in trip.legs.first { !$0.isHome && $0.contains(day) }?.name } ?? "",
            isTravelOrStay: item.kind == .transit || item.kind == .stay)
    }

    /// " JST" after a time, when the city's zone is known (M3-1); nothing for dates alone.
    static func zoneSuffix(_ day: String?, in trip: Trip, arriving: Bool, timed: Bool) -> String {
        guard timed, let day, let zone = TripTimeZones.zone(on: day, in: trip, arriving: arriving) else { return "" }
        let date = TripTimeZones.instant(day: day, minutes: 12 * 60, zone: zone) ?? .now
        return " " + (zone.abbreviation(for: date) ?? zone.identifier)
    }

    private static func moment(_ day: String?, minutes: Int?) -> Date? {
        guard let day else { return nil }
        let date = DayKey.date(day)
        guard let minutes else { return date }
        return Calendar.current.date(byAdding: .minute, value: minutes, to: date)
    }

    private static func text(_ date: Date, timed: Bool) -> String {
        let day = date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        return timed ? day + ", " + date.formatted(date: .omitted, time: .shortened) : day
    }

    /// "9 of 14 booked": cancelled plans don't count either way.
    static func summary(_ rows: [BookingRow]) -> String {
        let live = rows.filter { $0.isTravelOrStay && $0.status != .cancelled }
        let booked = live.filter { $0.status == .booked }.count
        return "\(booked) of \(live.count) booked"
    }

    /// The sidebar badge: travel and stays still to book.
    static func notBookedCount(_ items: [TripItem]) -> Int {
        items.filter { ($0.kind == .transit || $0.kind == .stay) && !$0.isHiddenPlaceholder && $0.isUnbooked }.count
    }

    /// One line per plan, for Copy as Text.
    static func copyText(_ rows: [BookingRow]) -> String {
        rows.map { row in
            [row.status?.label ?? "", row.what, row.whenText, row.confirmation]
                .filter { !$0.isEmpty }.joined(separator: " · ")
        }.joined(separator: "\n")
    }

    // MARK: Grouping and the header line

    enum Grouping: String, CaseIterable, Identifiable {
        case none = "None", type = "Type", city = "City", status = "Status"
        var id: String { rawValue }
    }

    /// The label a row is grouped under.
    static func groupLabel(_ row: BookingRow, by grouping: Grouping) -> String {
        switch grouping {
        case .none: ""
        case .type: row.kindLabel
        case .city: row.city.isEmpty ? "No city" : row.city
        case .status: row.status?.label ?? "Not set"
        }
    }

    /// Rows with the same group label together (groups in the order of their first row), each group
    /// in the order given. A `Table` can't show section headers, so the table sorts by this instead.
    static func grouped(_ rows: [BookingRow], by grouping: Grouping) -> [(label: String, rows: [BookingRow])] {
        guard grouping != .none else { return [("", rows)] }
        var order: [String] = []
        var buckets: [String: [BookingRow]] = [:]
        for row in rows {
            let label = groupLabel(row, by: grouping)
            if buckets[label] == nil { order.append(label) }
            buckets[label, default: []].append(row)
        }
        return order.map { ($0, buckets[$0] ?? []) }
    }

    /// The parts of the header line, each of which filters the table when clicked.
    struct HeaderCounts: Equatable {
        var booked = 0
        var needBooking = 0
        var notBooked = 0
        var cancelled = 0
        var withoutPrice = 0
    }

    static func headerCounts(_ rows: [BookingRow]) -> HeaderCounts {
        var c = HeaderCounts()
        for row in rows {
            if row.status == .cancelled { c.cancelled += 1; continue }
            if row.isTravelOrStay {
                c.needBooking += 1
                if row.status == .booked { c.booked += 1 }
                if row.status == .planned { c.notBooked += 1 }
                if row.cost == 0 && row.costText.isEmpty { c.withoutPrice += 1 }
            }
        }
        return c
    }
}
