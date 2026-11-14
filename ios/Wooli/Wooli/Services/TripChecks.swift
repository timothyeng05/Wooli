import Foundation

/// One amber warning on a plan (M3-4): a short reason, and which plan it's about.
struct TripWarning: Identifiable, Hashable {
    enum Kind: String {
        case outsideTrip, overlap, farFromCity, tightConnection, arrivesAfterDeparture, stayPastCity, stayOverlap
    }
    let kind: Kind
    let itemID: String
    /// The other plan in a pair (an overlap, a connection).
    var otherID: String?
    let message: String

    /// Stable, so "Ignore" can be stored on the plan and survive edits to other things.
    var id: String { [kind.rawValue, itemID, otherID ?? ""].joined(separator: ":") }
}

/// The trip's self-checks. Pure: plans and legs in, warnings out. A clean trip has none.
enum TripChecks {
    /// A plan this far from its day's city gets a warning.
    static let farKm = 80.0
    /// Less than this between landing and the next departure is a tight connection.
    static let tightMinutes = 90

    static func warnings(trip: Trip, items: [TripItem]) -> [TripWarning] {
        let items = TripExport.exportable(items)
        var found: [TripWarning] = []
        found += outside(trip, items)
        found += overlaps(items)
        found += farFromCity(trip, items)
        found += connections(items)
        found += stays(trip, items)
        // Ignored per plan, stored in its extras so it stays ignored for everyone.
        let ignored = Dictionary(uniqueKeysWithValues: items.map { ($0.id, Set($0.extras?.ignoredWarnings ?? [])) })
        return found.filter { !(ignored[$0.itemID]?.contains($0.id) ?? false) }
    }

    // MARK: Checks

    /// Dated before the first day or after the last.
    static func outside(_ trip: Trip, _ items: [TripItem]) -> [TripWarning] {
        items.compactMap { item in
            guard let day = item.day, day < trip.startDay || day > trip.endDay else { return nil }
            return TripWarning(kind: .outsideTrip, itemID: item.id,
                               message: "Dated \(day), outside the trip (\(trip.startDay) to \(trip.endDay))")
        }
    }

    /// Two plans with start and end times that overlap on the same day.
    static func overlaps(_ items: [TripItem]) -> [TripWarning] {
        let timed = items.compactMap { item -> (TripItem, Int, Int)? in
            guard item.day != nil, let start = item.time, item.kind != .stay else { return nil }
            var end = item.extras?.endTime
            if item.kind == .transit, item.transport?.arriveDayOffset == 0 { end = item.transport?.arriveTime ?? end }
            guard let end, end > start else { return nil }
            return (item, start, end)
        }
        var found: [TripWarning] = []
        for (i, a) in timed.enumerated() {
            for b in timed[(i + 1)...] where a.0.day == b.0.day && a.1 < b.2 && b.1 < a.2 {
                found.append(TripWarning(kind: .overlap, itemID: a.0.id, otherID: b.0.id,
                                         message: "Overlaps \(TripBookings.what(b.0)) at the same time"))
            }
        }
        return found
    }

    /// An activity or meal pinned more than `farKm` from its day's city (travel plans are exempt).
    static func farFromCity(_ trip: Trip, _ items: [TripItem]) -> [TripWarning] {
        items.compactMap { item in
            guard item.kind != .transit, let day = item.day, let place = item.place,
                  let leg = trip.legs.first(where: { !$0.isHome && $0.contains(day) && $0.hasLocation }),
                  let lat = leg.latitude, let lon = leg.longitude else { return nil }
            let km = distanceKm(lat, lon, place.latitude, place.longitude)
            guard km > farKm else { return nil }
            return TripWarning(kind: .farFromCity, itemID: item.id,
                               message: "\(Int(km.rounded())) km from \(leg.name)")
        }
    }

    /// Back-to-back travel: lands after the next departure, or with under 90 minutes to spare.
    static func connections(_ items: [TripItem]) -> [TripWarning] {
        let legs = items.compactMap { item -> (TripItem, Int, Int)? in
            guard item.kind == .transit, let day = item.day, let depart = item.time,
                  let arrive = item.transport?.arriveTime else { return nil }
            let offset = item.transport?.arriveDayOffset ?? 0
            return (item, dayNumber(day) * 1440 + depart, (dayNumber(day) + offset) * 1440 + arrive)
        }.sorted { $0.1 < $1.1 }
        var found: [TripWarning] = []
        for (a, b) in zip(legs, legs.dropFirst()) {
            let gap = b.1 - a.2
            if gap < 0 {
                found.append(TripWarning(kind: .arrivesAfterDeparture, itemID: a.0.id, otherID: b.0.id,
                                         message: "Lands after \(TripBookings.what(b.0)) leaves"))
            } else if gap < tightMinutes {
                found.append(TripWarning(kind: .tightConnection, itemID: a.0.id, otherID: b.0.id,
                                         message: "Only \(gap) min before \(TripBookings.what(b.0))"))
            }
        }
        return found
    }

    /// A stay that checks out after its city's last day, and stays that overlap.
    static func stays(_ trip: Trip, _ items: [TripItem]) -> [TripWarning] {
        let stays = items.filter { $0.kind == .stay && $0.day != nil && $0.stayEnd != nil }
            .sorted { ($0.day ?? "") < ($1.day ?? "") }
        var found: [TripWarning] = []
        for stay in stays {
            guard let day = stay.day, let end = stay.stayEnd else { continue }
            if let leg = trip.legs.first(where: { !$0.isHome && $0.contains(day) }), end > leg.endDay {
                found.append(TripWarning(kind: .stayPastCity, itemID: stay.id,
                                         message: "Checks out \(end), after \(leg.name) ends (\(leg.endDay))"))
            }
        }
        for (a, b) in zip(stays, stays.dropFirst()) {
            if let end = a.stayEnd, let next = b.day, end > next {
                found.append(TripWarning(kind: .stayOverlap, itemID: a.id, otherID: b.id,
                                         message: "Overlaps \(TripBookings.what(b)) by \(dayNumber(end) - dayNumber(next)) night(s)"))
            }
        }
        return found
    }

    // MARK: Helpers

    private static func dayNumber(_ key: String) -> Int {
        let reference = DayKey.date("2000-01-01")
        return Calendar.current.dateComponents([.day], from: reference, to: DayKey.date(key)).day ?? 0
    }

    /// Great-circle distance in kilometres.
    static func distanceKm(_ lat1: Double, _ lon1: Double, _ lat2: Double, _ lon2: Double) -> Double {
        let r = 6371.0, rad = Double.pi / 180
        let dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad
        let a = sin(dLat / 2) * sin(dLat / 2) + cos(lat1 * rad) * cos(lat2 * rad) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * r * asin(min(1, sqrt(a)))
    }
}
