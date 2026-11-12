import Foundation
import MapKit

/// A city picked while setting up a trip: where it is, and how long you stay.
struct SetupCity: Identifiable, Codable, Hashable {
    var id = UUID().uuidString
    var name: String
    var latitude: Double?
    var longitude: Double?
    var timeZoneID: String?
    var countryCode: String?
    var mapItemID: String?
    var nights = 2

    /// "Madrid, Spain".
    var display: String {
        [name, countryCode.flatMap { Locale.current.localizedString(forRegionCode: $0) }]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }

    func leg(start: String, end: String, isHome: Bool = false) -> TripLeg {
        var leg = TripLeg(name: name, emoji: isHome ? "🏠" : "", startDay: start, endDay: end, isHome: isHome)
        leg.latitude = latitude
        leg.longitude = longitude
        leg.timeZoneID = timeZoneID
        leg.countryCode = countryCode
        leg.mapItemID = mapItemID
        return leg
    }
}

/// Turns the cities and nights picked in the new-trip sheet into a trip.
/// Pure, so the date arithmetic is tested.
enum TripSetup {
    /// Legs in order from `start`: each city runs for its nights, and the day
    /// you leave one is the day you arrive at the next (a travel day). With a
    /// home city, it opens and closes the trip.
    static func legs(start: Date, home: SetupCity?, cities: [SetupCity]) -> (legs: [TripLeg], endDay: String) {
        let cal = Calendar.current
        var cursor = cal.startOfDay(for: start)
        var legs: [TripLeg] = []
        if let home { legs.append(home.leg(start: DayKey.key(cursor), end: DayKey.key(cursor), isHome: true)) }
        for city in cities {
            let end = cal.date(byAdding: .day, value: max(city.nights, 1), to: cursor) ?? cursor
            legs.append(city.leg(start: DayKey.key(cursor), end: DayKey.key(end)))
            cursor = end
        }
        if let home, !cities.isEmpty {
            var back = home
            back.id = UUID().uuidString
            legs.append(back.leg(start: DayKey.key(cursor), end: DayKey.key(cursor), isHome: true))
        }
        return (legs, DayKey.key(cursor))
    }

    /// "Madrid, Seville & Barcelona"; more than three become "Madrid, Seville + 2 more".
    static func name(for cities: [SetupCity]) -> String {
        let names = cities.map(\.name).filter { !$0.isEmpty }
        switch names.count {
        case 0: return ""
        case 1: return names[0]
        case 2, 3: return names.dropLast().joined(separator: ", ") + " & " + names.last!
        default: return names.prefix(2).joined(separator: ", ") + " + \(names.count - 2) more"
        }
    }

    /// The countries when they're known ("Spain"), else the city names.
    static func destination(for cities: [SetupCity]) -> String {
        var countries: [String] = []
        for city in cities {
            guard let code = city.countryCode, let country = Locale.current.localizedString(forRegionCode: code),
                  !countries.contains(country) else { continue }
            countries.append(country)
        }
        return countries.isEmpty ? cities.map(\.name).joined(separator: ", ") : countries.joined(separator: ", ")
    }

    static func trip(name: String, start: Date, home: SetupCity?, cities: [SetupCity]) -> Trip {
        let (legs, end) = legs(start: start, home: home, cities: cities)
        var trip = Trip(name: name.trimmingCharacters(in: .whitespaces), destination: destination(for: cities),
                        startDay: DayKey.key(start), endDay: end)
        trip.legs = legs
        return trip
    }

    // MARK: Home city, remembered between trips (per device)

    private static let homeKey = "trips.homeCity"

    static var savedHome: SetupCity? {
        get { UserDefaults.standard.data(forKey: homeKey).flatMap { try? JSONDecoder().decode(SetupCity.self, from: $0) } }
        set { UserDefaults.standard.set(newValue.flatMap { try? JSONEncoder().encode($0) }, forKey: homeKey) }
    }
}

/// City suggestions as you type, from Apple Maps (places by name and address,
/// not businesses). Picking one looks it up for its coordinates and time zone.
@MainActor @Observable
final class CitySearcher {
    var text = "" {
        didSet {
            let query = text.trimmingCharacters(in: .whitespaces)
            if query.isEmpty { results = []; completer.cancel() } else { completer.queryFragment = query }
        }
    }
    private(set) var results: [MKLocalSearchCompletion] = []

    @ObservationIgnored private let completer = MKLocalSearchCompleter()
    @ObservationIgnored private let listener = Listener()

    init() {
        completer.resultTypes = .address
        completer.delegate = listener
        listener.onUpdate = { [weak self] found in
            // Street addresses have numbers; cities and regions don't.
            self?.results = Array(found.filter { !$0.title.contains(where: \.isNumber) }.prefix(5))
        }
    }

    func resolve(_ completion: MKLocalSearchCompletion) async -> SetupCity? {
        let request = MKLocalSearch.Request(completion: completion)
        request.resultTypes = .address
        guard let item = try? await MKLocalSearch(request: request).start().mapItems.first else { return nil }
        let place = item.placemark
        return SetupCity(name: place.locality ?? place.name ?? completion.title,
                         latitude: place.coordinate.latitude, longitude: place.coordinate.longitude,
                         timeZoneID: item.timeZone?.identifier, countryCode: place.isoCountryCode,
                         mapItemID: item.identifier?.rawValue)
    }

    private final class Listener: NSObject, MKLocalSearchCompleterDelegate {
        var onUpdate: (([MKLocalSearchCompletion]) -> Void)?

        nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
            let found = completer.results
            DispatchQueue.main.async { MainActor.assumeIsolated { self.onUpdate?(found) } }
        }

        nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {}
    }
}
