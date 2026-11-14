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
            whenText: start.map { text($0, timed: item.time != nil) } ?? "No day yet",
            untilKey: end ?? .distantFuture,
            untilText: end.map { text($0, timed: item.kind == .transit) } ?? "",
            confirmation: item.transport?.confirmation ?? "",
            cost: item.cost ?? 0,
            costText: item.priceText ?? "",
            city: item.day.flatMap { day in trip.legs.first { !$0.isHome && $0.contains(day) }?.name } ?? "",
            isTravelOrStay: item.kind == .transit || item.kind == .stay)
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
}
