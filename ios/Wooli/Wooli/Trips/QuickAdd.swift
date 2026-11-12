import Foundation
import MapKit

/// What typing into the quick-add field means: the words to search for, and
/// anything the text already says (a kind, a time, a flight number).
struct QuickAddRequest: Equatable {
    /// Text left to search for once prefixes and a trailing time are taken out.
    var query = ""
    /// Forced by a prefix like "hotel " or "train ".
    var kind: TripItem.Kind?
    /// Minutes after midnight, from "7pm" or "19:30" at the end.
    var time: Int?
    /// "Lunch" and the like: puts the plan in that meal's slot.
    var mealTitle: String?
    /// "CX831" when the whole text is a flight number.
    var flightNumber: String?
}

enum QuickAddParser {
    private static let prefixes: [(word: String, kind: TripItem.Kind, meal: String?)] = [
        ("hotel", .stay, nil), ("stay", .stay, nil),
        ("train", .transit, nil), ("fly", .transit, nil), ("flight", .transit, nil), ("bus", .transit, nil), ("ferry", .transit, nil),
        ("breakfast", .meal, "Breakfast"), ("lunch", .meal, "Lunch"), ("dinner", .meal, "Dinner"),
        ("eat", .meal, nil), ("coffee", .meal, nil),
    ]

    static func parse(_ text: String) -> QuickAddRequest {
        var request = QuickAddRequest()
        var rest = text.trimmingCharacters(in: .whitespacesAndNewlines)

        // A prefix word: "dinner il mercato" is a Food plan in the Dinner slot.
        let lower = rest.lowercased()
        for entry in prefixes where lower == entry.word || lower.hasPrefix(entry.word + " ") {
            request.kind = entry.kind
            request.mealTitle = entry.meal
            rest = String(rest.dropFirst(entry.word.count)).trimmingCharacters(in: .whitespaces)
            break
        }

        // A time at the end: 7pm, 7:30 pm, 19:30.
        if let match = firstMatch(#"\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)$|\s(\d{1,2}):(\d{2})$"#, in: rest) {
            let hour: Int, minute: Int
            if let h = match[1], let ampm = match[3] {
                var hh = Int(h) ?? 0
                if hh == 12 { hh = 0 }
                hour = hh + (ampm.lowercased() == "pm" ? 12 : 0)
                minute = match[2].flatMap(Int.init) ?? 0
            } else {
                hour = match[4].flatMap(Int.init) ?? 0
                minute = match[5].flatMap(Int.init) ?? 0
            }
            if hour < 24 && minute < 60 {
                request.time = hour * 60 + minute
                rest = String(rest.dropLast(match[0]?.count ?? 0)).trimmingCharacters(in: .whitespaces)
            }
        }

        // A flight number is the whole of what's left: two characters (one a letter), then 1–4 digits.
        if let match = firstMatch(#"^([A-Za-z][A-Za-z0-9]|[0-9][A-Za-z])\s?(\d{1,4})$"#, in: rest) {
            request.flightNumber = ((match[1] ?? "") + (match[2] ?? "")).uppercased()
            request.kind = .transit
        }

        if request.mealTitle != nil, request.time == nil {
            request.time = TripItem.mealSlots.first { $0.title == request.mealTitle }?.time
        }
        request.query = rest
        return request
    }

    /// The plan type an Apple Maps place suggests; wrong guesses are one click to change.
    static func kind(forCategory category: MKPointOfInterestCategory?) -> TripItem.Kind {
        guard let category else { return .activity }
        switch category {
        case .restaurant, .cafe, .bakery, .brewery, .winery, .nightlife, .foodMarket: return .meal
        case .hotel: return .stay
        case .airport, .publicTransport: return .transit
        default: return .activity
        }
    }

    /// Capture groups of the first match (index 0 is the whole match); nil for groups that didn't take part.
    private static func firstMatch(_ pattern: String, in text: String) -> [String?]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let m = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            Range(m.range(at: i), in: text).map { String(text[$0]) }
        }
    }
}

extension PlaceSearcher {
    /// Keeps searches near a point, for a leg whose coordinates are known.
    func focus(near center: CLLocationCoordinate2D, meters: CLLocationDistance = 40_000) {
        setRegion(MKCoordinateRegion(center: center, latitudinalMeters: meters, longitudinalMeters: meters))
    }
}
