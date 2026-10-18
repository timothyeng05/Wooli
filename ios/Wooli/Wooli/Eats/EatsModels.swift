import SwiftUI
import SwiftData
import CoreLocation

// Eats: your own ranked list of places you've eaten, Beli-style. Personal,
// so it lives in SwiftData (this phone + your iCloud), not in the shared
// trip zones. Trip meals flow in to be ranked and keep a link to the trip.

/// A place you've ranked. Rules for CloudKit (see `Models/Models.swift`):
/// every property has a default, no unique constraints, links are string ids.
@Model
final class EatsEntry {
    var id: String = UUID().uuidString
    var name: String = ""
    var address: String = ""
    var latitude: Double?
    var longitude: Double?
    var mapItemID: String = ""
    var sentimentRaw: String = MealSentiment.liked.rawValue
    /// Order within the sentiment (higher = better); only the order matters.
    var rank: Double = 0
    /// "yyyy-MM-dd" you went.
    var visitedDay: String = ""
    var notes: String = ""
    /// The trip and trip item this came from; "" for places added in Eats.
    var tripID: String = ""
    var tripItemID: String = ""
    var createdAt: Date = Date.now

    init(name: String, place: TripPlace? = nil, visitedDay: String = DayKey.key(.now)) {
        self.name = name
        self.visitedDay = visitedDay
        if let place {
            address = place.address
            latitude = place.latitude
            longitude = place.longitude
            mapItemID = place.mapItemID
        }
    }

    var sentiment: MealSentiment {
        get { MealSentiment(rawValue: sentimentRaw) ?? .liked }
        set { sentimentRaw = newValue.rawValue }
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var candidate: RankCandidate {
        RankCandidate(id: id, title: name, subtitle: visitedDay.isEmpty ? "" : DayKey.date(visitedDay).formatted(.dateTime.month(.abbreviated).day().year()),
                      sentiment: sentiment, rank: rank)
    }
}

enum MealSentiment: String, Codable, CaseIterable, Identifiable {
    case liked, fine, disliked
    var id: String { rawValue }

    var label: String {
        switch self {
        case .liked: "I liked it!"
        case .fine: "It was fine"
        case .disliked: "I didn't like it"
        }
    }

    var symbol: String {
        switch self {
        case .liked: "hand.thumbsup.fill"
        case .fine: "minus"
        case .disliked: "hand.thumbsdown.fill"
        }
    }

    var color: Color {
        switch self {
        case .liked: Color(hex: "#22c55e")
        case .fine: Color(hex: "#f59e0b")
        case .disliked: Color(hex: "#ef4444")
        }
    }

    /// The scores this feeling can land on.
    var band: ClosedRange<Double> {
        switch self {
        case .liked: 7.0...10.0
        case .fine: 4.0...6.9
        case .disliked: 0.0...3.9
        }
    }
}

/// What the ranking flow compares: a snapshot of a place, ranked or not.
struct RankCandidate: Identifiable, Hashable {
    let id: String
    var title: String
    var subtitle: String = ""
    var sentiment: MealSentiment?
    var rank: Double?
}

enum EatsRanking {
    /// Ranked places, best first.
    static func ordered(_ items: [RankCandidate]) -> [RankCandidate] {
        MealSentiment.allCases.flatMap { group(of: $0, in: items) }
    }

    /// Places with that feeling, best first.
    static func group(of sentiment: MealSentiment, in items: [RankCandidate]) -> [RankCandidate] {
        items.filter { $0.sentiment == sentiment && $0.rank != nil }.sorted { ($0.rank ?? 0) > ($1.rank ?? 0) }
    }

    /// Each place's score, spread evenly across its feeling's band, so a
    /// score moves as you rank more places (like Beli).
    static func scores(_ items: [RankCandidate]) -> [String: Double] {
        var scores: [String: Double] = [:]
        for sentiment in MealSentiment.allCases {
            let places = group(of: sentiment, in: items)
            let band = sentiment.band
            for (i, place) in places.enumerated() {
                let t = places.count == 1 ? 0 : Double(i) / Double(places.count - 1)
                scores[place.id] = ((band.upperBound - (band.upperBound - band.lowerBound) * t) * 10).rounded() / 10
            }
        }
        return scores
    }

    static func color(_ score: Double) -> Color {
        score >= 7 ? MealSentiment.liked.color : score >= 4 ? MealSentiment.fine.color : MealSentiment.disliked.color
    }

    /// Trip meals waiting to be ranked: food on days that have started,
    /// not yet in Eats and not skipped.
    @MainActor
    static func toRank(entries: [EatsEntry]) -> [TripItem] {
        let today = DayKey.key(.now)
        let linked = Set(entries.map(\.tripItemID))
        let skipped = skippedIDs
        return TripStore.shared.items
            .filter { $0.kind == .meal && !linked.contains($0.id) && !skipped.contains($0.id) && ($0.day.map { $0 <= today } ?? false) }
            .sorted { ($0.day ?? "", $0.time ?? 0) > ($1.day ?? "", $1.time ?? 0) }
    }

    private static let skippedKey = "eats.skippedTripItems"
    static var skippedIDs: Set<String> { Set(UserDefaults.standard.stringArray(forKey: skippedKey) ?? []) }
    static func skip(_ itemID: String) {
        UserDefaults.standard.set(Array(skippedIDs.union([itemID])), forKey: skippedKey)
    }
}

extension TripItem {
    /// How this trip meal looks in the ranking flow.
    @MainActor
    var rankCandidate: RankCandidate {
        RankCandidate(id: id, title: title.isEmpty ? (place?.name ?? "Meal") : title,
                      subtitle: [TripStore.shared.trip(tripID)?.name, day.map { DayKey.date($0).formatted(.dateTime.month(.abbreviated).day()) }]
                        .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
    }
}
