import Foundation
import CoreLocation

// Airport and airline lookups for flight bookings, plus the flight-time and
// title math. Everything is on-device: no flight-data service.

struct Airport: Identifiable, Hashable {
    let code: String
    let name: String
    let city: String
    let country: String
    let latitude: Double
    let longitude: Double
    let timeZoneID: String
    /// A major hub; ranked first in search.
    let isLarge: Bool
    /// Other names people search by ("Tokyo" for Narita, "NYC", "TYO").
    let keywords: String

    var id: String { code }
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
    var timeZone: TimeZone { TimeZone(identifier: timeZoneID) ?? .current }
    /// "New York" — falls back to the airport's name for the few with no city.
    var place: String { city.isEmpty ? name : city }
}

enum Airports {
    /// Airports with scheduled passenger service, from `airports.tsv`
    /// (OurAirports, public domain; time zones from mwgg/Airports, MIT).
    /// Columns: code, name, city, country, lat, lon, time zone, L/M size,
    /// keywords. Rebuild with `ios/Wooli/tools/build_airports.py`.
    static let all: [Airport] = {
        guard let url = Bundle.main.url(forResource: "airports", withExtension: "tsv"),
              let text = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { line in
            let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
            guard f.count >= 8, let lat = Double(f[4]), let lon = Double(f[5]) else { return nil }
            return Airport(code: f[0], name: f[1], city: f[2], country: f[3], latitude: lat, longitude: lon,
                           timeZoneID: f[6], isLarge: f[7] == "L", keywords: f.count > 8 ? f[8] : "")
        }
    }()

    private static let byCode = Dictionary(all.map { ($0.code, $0) }, uniquingKeysWith: { a, _ in a })

    static func airport(_ code: String) -> Airport? {
        code.isEmpty ? nil : byCode[code.uppercased()]
    }

    /// "jfk", "hong kong", "heathrow" → best matches first.
    static func search(_ text: String) -> [Airport] {
        let query = text.trimmingCharacters(in: .whitespaces).lowercased()
        guard !query.isEmpty else { return [] }
        func rank(_ a: Airport) -> Int? {
            let code = a.code.lowercased(), city = a.city.lowercased(), name = a.name.lowercased(),
                keywords = a.keywords.lowercased()
            if code == query { return 0 }
            if city == query { return 1 }
            if code.hasPrefix(query) { return 2 }
            if city.hasPrefix(query) { return 3 }
            let words = "\(city) \(name) \(keywords)".split { !$0.isLetter && !$0.isNumber }
            if words.contains(where: { $0.hasPrefix(query) }) { return 4 }
            if name.contains(query) || city.contains(query) || keywords.contains(query) { return 5 }
            return nil
        }
        return all.compactMap { a in rank(a).map { (a, $0) } }
            .sorted { ($0.1, $0.0.isLarge ? 0 : 1, $0.0.code) < ($1.1, $1.0.isLarge ? 0 : 1, $1.0.code) }
            .prefix(40).map(\.0)
    }
}

enum Airlines {
    /// Airline from a flight number's two-character code ("CX831" → Cathay Pacific).
    static func name(forFlight number: String) -> String? {
        let compact = number.uppercased().filter { !$0.isWhitespace }
        guard compact.range(of: #"^[A-Z0-9]{2}\d{1,4}[A-Z]?$"#, options: .regularExpression) != nil else { return nil }
        return names[String(compact.prefix(2))]
    }

    private static let names: [String: String] = [
        "AA": "American Airlines", "AC": "Air Canada", "AF": "Air France", "AI": "Air India", "AK": "AirAsia",
        "AM": "Aeroméxico", "AS": "Alaska Airlines", "AY": "Finnair", "AZ": "ITA Airways", "B6": "JetBlue",
        "BA": "British Airways", "BR": "EVA Air", "BX": "Air Busan", "CA": "Air China", "CI": "China Airlines",
        "CX": "Cathay Pacific", "CZ": "China Southern", "DL": "Delta", "EI": "Aer Lingus", "EK": "Emirates",
        "ET": "Ethiopian Airlines", "EY": "Etihad", "F9": "Frontier", "FM": "Shanghai Airlines", "GA": "Garuda Indonesia",
        "GK": "Jetstar Japan", "HA": "Hawaiian Airlines", "HB": "Greater Bay Airlines", "HO": "Juneyao Air",
        "HU": "Hainan Airlines", "HX": "Hong Kong Airlines", "IB": "Iberia", "JL": "Japan Airlines", "JQ": "Jetstar",
        "KE": "Korean Air", "KL": "KLM", "LH": "Lufthansa", "LJ": "Jin Air", "LO": "LOT Polish", "LX": "Swiss",
        "MF": "Xiamen Airlines", "MH": "Malaysia Airlines", "MM": "Peach", "MU": "China Eastern", "NH": "ANA",
        "NK": "Spirit", "NZ": "Air New Zealand", "OS": "Austrian", "OZ": "Asiana", "PR": "Philippine Airlines",
        "QF": "Qantas", "QR": "Qatar Airways", "SK": "SAS", "SQ": "Singapore Airlines", "TG": "Thai Airways",
        "TK": "Turkish Airlines", "TP": "TAP Air Portugal", "TR": "Scoot", "TW": "T'way Air", "UA": "United",
        "UO": "HK Express", "VA": "Virgin Australia", "VJ": "VietJet", "VN": "Vietnam Airlines", "VS": "Virgin Atlantic",
        "WN": "Southwest", "WS": "WestJet", "ZE": "Eastar Jet", "ZH": "Shenzhen Airlines", "3U": "Sichuan Airlines",
        "5J": "Cebu Pacific", "7C": "Jeju Air", "9C": "Spring Airlines",
    ]
}

extension TripTransport {
    var from: Airport? { Airports.airport(fromAirport) }
    var to: Airport? { Airports.airport(toAirport) }

    /// The typed airline, or the one the flight number points to.
    var airlineName: String? {
        airline.isEmpty ? Airlines.name(forFlight: flightNumber) : airline
    }

    /// "CX831 JFK → HKG" / "Tokyo → Kyoto" — used when the title is left empty.
    var suggestedTitle: String {
        switch mode {
        case .flight:
            let route = fromAirport.isEmpty || toAirport.isEmpty ? "" : "\(fromAirport) → \(toAirport)"
            return [flightNumber, route].filter { !$0.isEmpty }.joined(separator: " ")
        case .train:
            switch (fromStation?.name, toStation?.name) {
            case (let a?, let b?): return "\(a) → \(b)"
            case (nil, let b?): return "Train to \(b)"
            case (let a?, nil): return "Train from \(a)"
            case (nil, nil): return ""
            }
        }
    }

    /// Door-to-door time, with each end in its own time zone (flights) —
    /// nil until both times are known, or if they don't add up.
    func durationMinutes(departDay: String?, departTime: Int?) -> Int? {
        guard let departDay, let departTime, let arriveTime else { return nil }
        let zones: (TimeZone, TimeZone)
        switch mode {
        case .flight:
            guard let from, let to else { return nil }
            zones = (from.timeZone, to.timeZone)
        case .train:
            zones = (.current, .current)
        }
        func instant(in zone: TimeZone, addingDays days: Int, minutes: Int) -> Date? {
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = zone
            let parts = departDay.split(separator: "-").compactMap { Int($0) }
            guard parts.count == 3,
                  let start = cal.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
                  let day = cal.date(byAdding: .day, value: days, to: start) else { return nil }
            return cal.date(byAdding: .minute, value: minutes, to: day)
        }
        guard let depart = instant(in: zones.0, addingDays: 0, minutes: departTime),
              let arrive = instant(in: zones.1, addingDays: arriveDayOffset, minutes: arriveTime) else { return nil }
        let minutes = Int(arrive.timeIntervalSince(depart) / 60)
        return (1..<(48 * 60)).contains(minutes) ? minutes : nil
    }

    /// Both ends are filled in, so the suggested title names the route.
    var hasRoute: Bool {
        switch mode {
        case .flight: from != nil && to != nil
        case .train: fromStation != nil && toStation != nil
        }
    }

    /// Picks the arrival day: the first of same day / next day / two days
    /// later that gives a real flight time across the time zones. Without
    /// both airports, an arrival earlier on the clock means the next day.
    func inferringArrivalDay(departDay: String?, departTime: Int?) -> TripTransport {
        guard let departTime, let arriveTime else { return self }
        var t = self
        for offset in 0...2 {
            t.arriveDayOffset = offset
            if t.durationMinutes(departDay: departDay, departTime: departTime) != nil { return t }
        }
        t.arriveDayOffset = arriveTime < departTime ? 1 : 0
        return t
    }

    static func durationText(_ minutes: Int) -> String {
        minutes < 60 ? "\(minutes)m" : minutes % 60 == 0 ? "\(minutes / 60)h" : "\(minutes / 60)h \(minutes % 60)m"
    }

    /// Straight-line (great-circle) distance between the two ends.
    var distanceKm: Double? {
        let ends: (CLLocationCoordinate2D, CLLocationCoordinate2D)?
        switch mode {
        case .flight: ends = from.flatMap { a in to.map { (a.coordinate, $0.coordinate) } }
        case .train: ends = fromStation.flatMap { a in toStation.map { (a.coordinate, $0.coordinate) } }
        }
        guard let ends else { return nil }
        return CLLocation(latitude: ends.0.latitude, longitude: ends.0.longitude)
            .distance(from: CLLocation(latitude: ends.1.latitude, longitude: ends.1.longitude)) / 1000
    }
}

extension TripPlace {
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}
