import Foundation

/// What the finished trips add up to (M4-1): countries, cities, nights away and flights.
/// Pure: trips and plans in, numbers out. Only trips that ended before `today` count.
struct TravelStats: Equatable {
    var trips = 0
    var countries: [String] = []     // ISO region codes, sorted
    var cities = 0
    var nights = 0
    var flights = 0
}

enum TravelStatsMaker {
    static func stats(trips: [Trip], items: [TripItem], today: String) -> TravelStats {
        let past = trips.filter { $0.endDay < today }
        let ids = Set(past.map(\.id))
        var countries = Set<String>()
        var cities = Set<String>()
        var nights = 0
        for trip in past {
            nights += max(trip.days.count - 1, 0)
            for leg in trip.legs where !leg.isHome && !leg.name.isEmpty {
                let country = leg.countryCode?.uppercased() ?? ""
                if !country.isEmpty { countries.insert(country) }
                cities.insert(country + "|" + leg.name.lowercased())
            }
        }
        let flights = items.filter {
            ids.contains($0.tripID) && !$0.isCancelled && $0.kind == .transit && $0.transport?.mode == .flight
        }.count
        return TravelStats(trips: past.count, countries: countries.sorted(), cities: cities.count, nights: nights, flights: flights)
    }

    /// "Spain 2026 · 9 nights · 3 cities · 4 flights": the line under a finished trip.
    static func recap(trip: Trip, items: [TripItem]) -> String {
        let nights = max(trip.days.count - 1, 0)
        let cities = trip.legs.filter { !$0.isHome && !$0.name.isEmpty }.count
        let flights = items.filter { $0.tripID == trip.id && !$0.isCancelled && $0.kind == .transit && $0.transport?.mode == .flight }.count
        var parts = [trip.name.isEmpty ? "Trip" : trip.name, "\(nights) night\(nights == 1 ? "" : "s")"]
        if cities > 0 { parts.append("\(cities) cit\(cities == 1 ? "y" : "ies")") }
        if flights > 0 { parts.append("\(flights) flight\(flights == 1 ? "" : "s")") }
        return parts.joined(separator: " · ")
    }

    /// 🇪🇸 from "ES": the two regional-indicator letters. Empty for anything that isn't two letters.
    static func flag(_ code: String) -> String {
        let letters = code.uppercased().unicodeScalars
        guard letters.count == 2, letters.allSatisfy({ ("A"..."Z").contains(Character($0)) }) else { return "" }
        return String(String.UnicodeScalarView(letters.compactMap { Unicode.Scalar(0x1F1E6 + $0.value - 65) }))
    }

    static func countryName(_ code: String) -> String {
        Locale.current.localizedString(forRegionCode: code) ?? code
    }
}
