// Checks Wooli's place search around the world, the way "Find a place"
// runs it: Apple's as-you-type suggestions (MKLocalSearchCompleter) kept to
// the area around the place, then Google Places for anything Apple misses.
//
//   swift tools/PlaceSearchCheck/main.swift [places.json …]
//
// With no arguments it checks the built-in list below (restaurants, sights
// and train stations on every continent). Pass JSON files of
// [{"name", "latitude", "longitude", "address"?}] to check your own places,
// e.g. exported from the app's trips.json / eats.json (tools/PlaceSearchCheck/README.md).
// Google is asked only when Apple misses, and only if GOOGLE_PLACES_API_KEY
// is in Config/Secrets.xcconfig.

import CoreLocation
import Foundation
import MapKit

struct Case: Decodable {
    let name: String
    let latitude: Double
    let longitude: Double
    var address: String? = nil
    var area: String? = nil
}

/// Built-in cases: name, where, and the pin it should land near.
let builtIn: [Case] = [
    // Asia
    .init(name: "Ichiran Shibuya", latitude: 35.6614, longitude: 139.7010, area: "Tokyo"),
    .init(name: "Tsukiji Outer Market", latitude: 35.6654, longitude: 139.7707, area: "Tokyo"),
    .init(name: "Kyoto Station", latitude: 34.9858, longitude: 135.7588, area: "Kyoto"),
    .init(name: "Fushimi Inari Taisha", latitude: 34.9671, longitude: 135.7727, area: "Kyoto"),
    .init(name: "Gwangjang Market", latitude: 37.5701, longitude: 126.9996, area: "Seoul"),
    .init(name: "Seoul Station", latitude: 37.5547, longitude: 126.9707, area: "Seoul"),
    .init(name: "Tim Ho Wan Sham Shui Po", latitude: 22.3317, longitude: 114.1607, area: "Hong Kong"),
    .init(name: "Din Tai Fung Xinyi", latitude: 25.0330, longitude: 121.5300, area: "Taipei"),
    .init(name: "Jay Fai", latitude: 13.7527, longitude: 100.5047, area: "Bangkok"),
    .init(name: "Bangkok Hua Lamphong", latitude: 13.7378, longitude: 100.5172, area: "Bangkok"),
    .init(name: "Pho Gia Truyen Bat Dan", latitude: 21.0337, longitude: 105.8466, area: "Hanoi"),
    .init(name: "Lau Pa Sat", latitude: 1.2806, longitude: 103.8504, area: "Singapore"),
    .init(name: "Chhatrapati Shivaji Maharaj Terminus", latitude: 18.9398, longitude: 72.8355, area: "Mumbai"),
    .init(name: "Karim's", latitude: 28.6497, longitude: 77.2337, area: "Delhi"),
    .init(name: "Nanxiang Steamed Bun", latitude: 31.2272, longitude: 121.4921, area: "Shanghai"),
    .init(name: "Shanghai Hongqiao Railway Station", latitude: 31.1945, longitude: 121.3200, area: "Shanghai"),
    .init(name: "Kuanzhai Alley", latitude: 30.6698, longitude: 104.0539, area: "Chengdu"),
    // Europe and Middle East
    .init(name: "Le Comptoir du Relais", latitude: 48.8521, longitude: 2.3389, area: "Paris"),
    .init(name: "Gare du Nord", latitude: 48.8809, longitude: 2.3553, area: "Paris"),
    .init(name: "Dishoom Covent Garden", latitude: 51.5124, longitude: -0.1271, area: "London"),
    .init(name: "Roscioli", latitude: 41.8938, longitude: 12.4734, area: "Rome"),
    .init(name: "Sagrada Familia", latitude: 41.4036, longitude: 2.1744, area: "Barcelona"),
    .init(name: "Bar Cañete", latitude: 41.3800, longitude: 2.1720, area: "Barcelona"),
    .init(name: "Madrid Atocha", latitude: 40.4065, longitude: -3.6896, area: "Madrid"),
    .init(name: "Sobrino de Botín", latitude: 40.4141, longitude: -3.7081, area: "Madrid"),
    .init(name: "Karaköy Güllüoğlu", latitude: 41.0225, longitude: 28.9772, area: "Istanbul"),
    .init(name: "Jemaa el-Fnaa", latitude: 31.6258, longitude: -7.9891, area: "Marrakech"),
    // Africa and Oceania
    .init(name: "The Test Kitchen", latitude: -33.9271, longitude: 18.4573, area: "Cape Town"),
    .init(name: "Table Mountain Aerial Cableway", latitude: -33.9480, longitude: 18.4030, area: "Cape Town"),
    .init(name: "Sydney Opera House", latitude: -33.8568, longitude: 151.2153, area: "Sydney"),
    .init(name: "Central Station Sydney", latitude: -33.8832, longitude: 151.2070, area: "Sydney"),
    .init(name: "Fergburger", latitude: -45.0313, longitude: 168.6588, area: "Queenstown"),
    // Americas
    .init(name: "Katz's Delicatessen", latitude: 40.7223, longitude: -73.9874, area: "New York"),
    .init(name: "Grand Central Terminal", latitude: 40.7527, longitude: -73.9772, area: "New York"),
    .init(name: "Pujol", latitude: 19.4328, longitude: -99.1940, area: "Mexico City"),
    .init(name: "El Califa de León", latitude: 19.4269, longitude: -99.1574, area: "Mexico City"),
    .init(name: "Central Restaurante", latitude: -12.1473, longitude: -77.0219, area: "Lima"),
    .init(name: "Don Julio", latitude: -34.5866, longitude: -58.4250, area: "Buenos Aires"),
    .init(name: "Cristo Redentor", latitude: -22.9519, longitude: -43.2105, area: "Rio de Janeiro"),
    .init(name: "Union Station Toronto", latitude: 43.6453, longitude: -79.3806, area: "Toronto"),
]

struct Outcome {
    let place: Case
    let partial: String
    let partialCount: Int
    let fullCount: Int
    /// Apple listed it among the suggestions for its full name.
    let appleFound: Bool
    /// nil when Google wasn't asked.
    let googleFound: Bool?
}

// MARK: - Apple suggestions

@MainActor
final class Completer: NSObject, MKLocalSearchCompleterDelegate {
    private let completer = MKLocalSearchCompleter()
    private var waiting: CheckedContinuation<[MKLocalSearchCompletion], Never>?

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.pointOfInterest, .address]
    }

    /// Suggestions for `text` within ~25 km of `center`, as the app asks
    /// when a trip has a destination.
    func suggestions(_ text: String, near center: CLLocationCoordinate2D) async -> [MKLocalSearchCompletion] {
        completer.region = MKCoordinateRegion(center: center, latitudinalMeters: 50_000, longitudinalMeters: 50_000)
        completer.regionPriority = .required
        return await withCheckedContinuation { continuation in
            waiting = continuation
            completer.queryFragment = text
            // The completer stays quiet for some fragments: give up after 8 s.
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(8))
                self.finish(self.completer.results)
            }
        }
    }

    private func finish(_ results: [MKLocalSearchCompletion]) {
        waiting?.resume(returning: results)
        waiting = nil
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        MainActor.assumeIsolated { finish(completer.results) }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        MainActor.assumeIsolated { finish([]) }
    }
}

// MARK: - Google

func googleKey() -> String? {
    let secrets = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        .appendingPathComponent("../../Config/Secrets.xcconfig").standardized
    guard let text = try? String(contentsOf: secrets, encoding: .utf8) else { return nil }
    for line in text.split(separator: "\n") where line.hasPrefix("GOOGLE_PLACES_API_KEY") {
        let value = line.split(separator: "=", maxSplits: 1).last?.trimmingCharacters(in: .whitespaces) ?? ""
        return value.isEmpty ? nil : value
    }
    return nil
}

/// Whether Google's text search, biased like the app's, has the place within 1 km.
func googleFinds(_ place: Case, key: String) async -> Bool {
    var request = URLRequest(url: URL(string: "https://places.googleapis.com/v1/places:searchText")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(key, forHTTPHeaderField: "X-Goog-Api-Key")
    request.setValue("com.timothyeng.wooli", forHTTPHeaderField: "X-Ios-Bundle-Identifier")
    request.setValue("places.displayName,places.location", forHTTPHeaderField: "X-Goog-FieldMask")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
        "textQuery": place.name, "pageSize": 10,
        "locationBias": ["circle": ["center": ["latitude": place.latitude, "longitude": place.longitude], "radius": 25_000]],
    ])
    struct Response: Decodable {
        struct Place: Decodable { struct L: Decodable { let latitude: Double; let longitude: Double }; let location: L? }
        let places: [Place]?
    }
    guard let (data, _) = try? await URLSession.shared.data(for: request),
          let response = try? JSONDecoder().decode(Response.self, from: data) else { return false }
    let pin = CLLocation(latitude: place.latitude, longitude: place.longitude)
    return (response.places ?? []).contains { p in
        guard let l = p.location else { return false }
        return CLLocation(latitude: l.latitude, longitude: l.longitude).distance(from: pin) < 1_000
    }
}

// MARK: - Matching

func normalized(_ s: String) -> String {
    s.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
        .filter { $0.isLetter || $0.isNumber }
}

/// A suggestion "is" the place when one name contains the other, or they share a long start.
func matches(_ suggestion: MKLocalSearchCompletion, _ place: Case) -> Bool {
    let a = normalized(suggestion.title), b = normalized(place.name)
    guard !a.isEmpty, !b.isEmpty else { return false }
    return a.contains(b) || b.contains(a) || (a.prefix(8) == b.prefix(8) && b.count >= 8)
}

/// What you'd have typed partway: half the name, at least 3 characters.
func partial(of name: String) -> String {
    let n = max(3, min(name.count, (name.count + 1) / 2))
    return String(name.prefix(n)).trimmingCharacters(in: .whitespaces)
}

// MARK: - Run

let files = CommandLine.arguments.dropFirst()
var cases = builtIn
if !files.isEmpty {
    cases = files.flatMap { path -> [Case] in
        guard let data = FileManager.default.contents(atPath: path),
              let list = try? JSONDecoder().decode([Case].self, from: data) else {
            print("Couldn't read \(path)"); return []
        }
        return list
    }
}

let key = googleKey()
print("Checking \(cases.count) places. Google fallback: \(key == nil ? "off (no key)" : "on")\n")

let completer = Completer()
var outcomes: [Outcome] = []
for (i, place) in cases.enumerated() {
    let center = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
    let typed = partial(of: place.name)
    let partialResults = await completer.suggestions(typed, near: center)
    try? await Task.sleep(for: .milliseconds(1000))
    let fullResults = await completer.suggestions(place.name, near: center)
    try? await Task.sleep(for: .milliseconds(1000))
    let found = fullResults.contains { matches($0, place) } || partialResults.contains { matches($0, place) }
    var google: Bool?
    if !found, let key { google = await googleFinds(place, key: key) }
    let outcome = Outcome(place: place, partial: typed, partialCount: partialResults.count,
                          fullCount: fullResults.count, appleFound: found, googleFound: google)
    outcomes.append(outcome)
    let mark = found ? "✓ Apple" : google == true ? "✓ Google" : "✗ neither"
    print(String(format: "%3d  %-9@ %2d sugg for \"%@\"  %@%@", i + 1, mark as NSString, outcome.partialCount,
                 typed as NSString, place.name as NSString, place.area.map { "  (\($0))" } ?? ""))
}

// MARK: - Summary

let total = outcomes.count
let several = outcomes.filter { $0.partialCount >= 3 }.count
let apple = outcomes.filter(\.appleFound).count
let google = outcomes.filter { $0.googleFound == true }.count
let neither = outcomes.filter { !$0.appleFound && $0.googleFound != true }
func pct(_ n: Int) -> String { total == 0 ? "–" : "\(Int((Double(n) / Double(total) * 100).rounded()))%" }

print("""

Summary (\(total) places)
  3+ suggestions while typing:  \(several)  \(pct(several))
  Found on Apple:               \(apple)  \(pct(apple))
  Found only on Google:         \(google)  \(pct(google))
  Found on neither:             \(neither.count)  \(pct(neither.count))
""")
if !neither.isEmpty {
    print("Not found:")
    for o in neither { print("  - \(o.place.name)\(o.place.area.map { " (\($0))" } ?? "")") }
}
// A failed check exits non-zero so it can gate a script.
exit(several * 10 >= total * 8 && neither.count * 10 <= total ? 0 : 1)
