import Foundation

// M2-2: the rows, header line and filters behind a trip's Bookings page.
// Pure (no SwiftUI) so it can be tested; `MacBookingsTable` draws it.

/// One line of the Bookings table: a travel plan, a stay, or any plan that
/// has a status or confirmation code.
struct BookingRow: Identifiable, Hashable {
    let item: TripItem
    let status: BookingStatus
    let city: String
    /// "CX831 JFK → HKG", "Hyatt Regency Hangzhou".
    let what: String
    let typeLabel: String
    let typeSymbol: String
    let confirmation: String
    let priceText: String
    /// "2027-04-01 0930" style keys, so text sorting is date sorting.
    let whenKey: String
    let untilKey: String
    let whenText: String
    let untilText: String
    /// Cash amount for sorting (0 when there is none).
    let costSort: Double

    var id: String { item.id }
    var statusRank: Int {
        switch status {
        case .planned, .idea: 0
        case .booked: 1
        case .cancelled: 2
        }
    }

    /// One line per row for Copy as Text.
    var plainText: String {
        var parts = [typeLabel + ": " + what]
        if !whenText.isEmpty { parts.append(untilText.isEmpty ? whenText : "\(whenText) → \(untilText)") }
        if !confirmation.isEmpty { parts.append("Confirmation \(confirmation)") }
        if !priceText.isEmpty { parts.append(priceText) }
        parts.append(status.label)
        return parts.joined(separator: " · ")
    }
}

enum BookingsFilter: Hashable {
    case all
    case booked
    case notBooked
    case noPrice
    case travelNotBooked
}

enum BookingsGrouping: String, CaseIterable, Identifiable {
    case none, type, city
    var id: String { rawValue }
    var label: String {
        switch self {
        case .none: "No Grouping"
        case .type: "Type"
        case .city: "City"
        }
    }
}

struct BookingsSummary: Equatable {
    var booked = 0
    /// Everything that counts (cancelled bookings don't).
    var total = 0
    var nightsWithoutBed = 0
    var travelDaysNotBooked = 0
    var notBooked = 0
    var withoutPrice = 0

    /// "9 of 14 booked · 3 nights without a bed · 2 travel days not booked".
    var parts: [(text: String, filter: BookingsFilter)] {
        var out: [(String, BookingsFilter)] = [("\(booked) of \(total) booked", .booked)]
        if nightsWithoutBed > 0 { out.append(("\(nightsWithoutBed) night\(nightsWithoutBed == 1 ? "" : "s") without a bed", .all)) }
        if travelDaysNotBooked > 0 {
            out.append(("\(travelDaysNotBooked) travel day\(travelDaysNotBooked == 1 ? "" : "s") not booked", .travelNotBooked))
        }
        return out
    }
}

enum BookingsList {
    /// Rows for every booking-like plan, in When order.
    static func rows(trip: Trip, items: [TripItem]) -> [BookingRow] {
        items.filter(isBooking).map { row($0, trip: trip) }
            .sorted { ($0.whenKey, $0.item.createdAt) < ($1.whenKey, $1.item.createdAt) }
    }

    /// Travel and stays, plus anything with a status or a confirmation code.
    static func isBooking(_ item: TripItem) -> Bool {
        if item.isHiddenPlaceholder || item.isMealPlaceholder { return false }
        if item.needsBooking { return true }
        if item.extras?.status != nil { return true }
        return !(item.transport?.confirmation ?? "").isEmpty
    }

    static func row(_ item: TripItem, trip: Trip) -> BookingRow {
        let status = item.bookingStatus ?? .booked
        let t = item.transport
        return BookingRow(
            item: item, status: status,
            city: item.day.flatMap { trip.leg(for: $0) }.map { $0.name } ?? "",
            what: what(item),
            typeLabel: typeLabel(item), typeSymbol: t?.mode.symbol ?? item.kind.symbol,
            confirmation: t?.confirmation.trimmingCharacters(in: .whitespaces) ?? "",
            priceText: item.priceText ?? "",
            whenKey: key(day: item.day, minutes: item.time),
            untilKey: key(day: untilDay(item), minutes: item.kind == .transit ? t?.arriveTime : nil),
            whenText: text(day: item.day, minutes: item.time),
            untilText: text(day: untilDay(item), minutes: item.kind == .transit ? t?.arriveTime : nil),
            costSort: item.cost ?? 0)
    }

    static func typeLabel(_ item: TripItem) -> String {
        if let mode = item.transport?.mode { return mode.label }
        return item.kind.label
    }

    static func what(_ item: TripItem) -> String {
        if let t = item.transport, t.mode == .flight {
            let route = [t.fromAirport, t.toAirport].filter { !$0.isEmpty }.joined(separator: " → ")
            let line = [t.flightNumber, route].filter { !$0.isEmpty }.joined(separator: " ")
            if !line.isEmpty { return line }
        }
        return item.title.isEmpty ? item.kind.label : item.title
    }

    /// Arrival day of a trip, check-out day of a stay.
    static func untilDay(_ item: TripItem) -> String? {
        switch item.kind {
        case .stay: return item.stayEnd
        case .transit:
            guard let day = item.day else { return nil }
            let offset = item.transport?.arriveDayOffset ?? 0
            guard offset != 0 else { return item.transport?.arriveTime == nil ? nil : day }
            return DayKey.key(Calendar.current.date(byAdding: .day, value: offset, to: DayKey.date(day)) ?? DayKey.date(day))
        default: return nil
        }
    }

    private static func key(day: String?, minutes: Int?) -> String {
        guard let day else { return "9999-99-99" }
        return day + String(format: " %04d", minutes ?? 0)
    }

    private static func text(day: String?, minutes: Int?) -> String {
        guard let day else { return "" }
        var out = DayKey.date(day).formatted(.dateTime.month(.abbreviated).day())
        if let minutes {
            let date = Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now
            out += ", " + date.formatted(date: .omitted, time: .shortened)
        }
        return out
    }

    // MARK: Header line and filters

    static func summary(trip: Trip, rows: [BookingRow]) -> BookingsSummary {
        var s = BookingsSummary()
        let live = rows.filter { $0.status != .cancelled }
        s.total = live.count
        s.booked = live.filter { $0.status == .booked }.count
        s.notBooked = live.filter { $0.statusRank == 0 }.count
        s.withoutPrice = live.filter { $0.priceText.isEmpty }.count
        s.travelDaysNotBooked = Set(live.filter { $0.item.kind == .transit && $0.statusRank == 0 }.compactMap { $0.item.day }).count
        s.nightsWithoutBed = nightsWithoutBed(trip: trip, stays: live.map(\.item).filter { $0.kind == .stay })
        return s
    }

    /// Nights of the trip (not the last day) that no stay covers. Nights
    /// inside a home-only leg don't count: you sleep in your own bed.
    static func nightsWithoutBed(trip: Trip, stays: [TripItem]) -> Int {
        let nights = trip.days.dropLast()
        let covered = Set(stays.flatMap { stay -> [String] in
            guard let day = stay.day else { return [] }
            guard let end = stay.stayEnd else { return [day] }
            return trip.days.filter { $0 >= day && $0 < end }
        })
        let homeOnly = trip.legs.filter(\.isHome)
        return nights.filter { night in
            !covered.contains(night) && !homeOnly.contains { $0.contains(night) && $0.startDay != $0.endDay }
        }.count
    }

    static func apply(_ filter: BookingsFilter, search: String, to rows: [BookingRow]) -> [BookingRow] {
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()
        return rows.filter { row in
            switch filter {
            case .all: true
            case .booked: row.status == .booked
            case .notBooked: row.statusRank == 0
            case .noPrice: row.statusRank != 2 && row.priceText.isEmpty
            case .travelNotBooked: row.item.kind == .transit && row.statusRank == 0
            }
        }.filter { row in
            guard !query.isEmpty else { return true }
            return [row.what, row.typeLabel, row.city, row.confirmation, row.whenText, row.item.notes]
                .contains { $0.lowercased().contains(query) }
        }
    }

    /// Plain text for Copy as Text: one line per booking.
    static func text(_ rows: [BookingRow]) -> String {
        rows.map(\.plainText).joined(separator: "\n")
    }

    /// Count the sidebar badge shows.
    static func notBookedCount(trip: Trip, items: [TripItem]) -> Int {
        items.filter { isBooking($0) && $0.needsBooking && $0.isUnbooked }.count
    }
}
