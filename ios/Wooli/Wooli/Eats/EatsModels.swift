import SwiftUI
import CloudKit
import CoreLocation

// Eats: your own ranked list of places you've eaten, Beli-style. It syncs
// through CloudKit directly (not SwiftData, which can't share with another
// Apple Account) so friends can follow your list read-only; see `EatsBook`.

/// A place on someone's list.
struct EatsPlace: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var name: String = ""
    var address: String = ""
    var latitude: Double?
    var longitude: Double?
    var mapItemID: String = ""
    var sentiment: MealSentiment = .liked
    /// Order within the sentiment (higher = better); only the order matters.
    var rank: Double = 0
    /// "yyyy-MM-dd" you went.
    var visitedDay: String = DayKey.key(.now)
    var notes: String = ""
    /// The trip and trip item this came from; "" for places added in Eats.
    var tripID: String = ""
    var tripItemID: String = ""
    var createdAt: Date = .now
    /// On the Want to try list: saved, not ranked (its sentiment/rank mean nothing yet).
    var isWishlist: Bool = false
    /// CloudKit change tag etc. (your own places only).
    var systemFields: Data?

    static let recordType = "EatsPlace"

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

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var tripPlace: TripPlace? {
        guard let latitude, let longitude else { return nil }
        return TripPlace(name: name, address: address, latitude: latitude, longitude: longitude, mapItemID: mapItemID)
    }

    var candidate: RankCandidate {
        // A Want to try place has no feeling yet, so it never counts in rankings or scores.
        RankCandidate(id: id, title: name,
                      subtitle: visitedDay.isEmpty ? "" : DayKey.date(visitedDay).formatted(.dateTime.month(.abbreviated).day().year()),
                      sentiment: isWishlist ? nil : sentiment, rank: isWishlist ? nil : rank)
    }

    /// Same restaurant on two lists: Apple Maps place ID, or same name within 150 m.
    func isSamePlace(as other: EatsPlace) -> Bool {
        if !mapItemID.isEmpty && mapItemID == other.mapItemID { return true }
        guard name.caseInsensitiveCompare(other.name) == .orderedSame, let a = coordinate, let b = other.coordinate else { return false }
        return CLLocation(latitude: a.latitude, longitude: a.longitude)
            .distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude)) < 150
    }

    // Field by field, so records from newer or older versions still decode.
    enum CodingKeys: String, CodingKey {
        case id, name, address, latitude, longitude, mapItemID, sentiment, rank, visitedDay, notes, tripID, tripItemID, createdAt, isWishlist, systemFields
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        address = try c.decodeIfPresent(String.self, forKey: .address) ?? ""
        latitude = try c.decodeIfPresent(Double.self, forKey: .latitude)
        longitude = try c.decodeIfPresent(Double.self, forKey: .longitude)
        mapItemID = try c.decodeIfPresent(String.self, forKey: .mapItemID) ?? ""
        sentiment = (try? c.decodeIfPresent(MealSentiment.self, forKey: .sentiment)) ?? .liked
        rank = try c.decodeIfPresent(Double.self, forKey: .rank) ?? 0
        visitedDay = try c.decodeIfPresent(String.self, forKey: .visitedDay) ?? ""
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        tripID = try c.decodeIfPresent(String.self, forKey: .tripID) ?? ""
        tripItemID = try c.decodeIfPresent(String.self, forKey: .tripItemID) ?? ""
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        isWishlist = try c.decodeIfPresent(Bool.self, forKey: .isWishlist) ?? false
        systemFields = try c.decodeIfPresent(Data.self, forKey: .systemFields)
    }

    func record(in zoneID: CKRecordZone.ID) -> CKRecord {
        let r = CKRecord.restoring(systemFields, type: Self.recordType, id: CKRecord.ID(recordName: id, zoneID: zoneID))
        r["name"] = name
        r["address"] = address
        r["latitude"] = latitude
        r["longitude"] = longitude
        r["mapItemID"] = mapItemID
        r["sentiment"] = sentiment.rawValue
        r["rank"] = rank
        r["visitedDay"] = visitedDay
        r["notes"] = notes
        r["tripID"] = tripID
        r["tripItemID"] = tripItemID
        r["createdAt"] = createdAt
        r["wishlist"] = isWishlist ? 1 : 0
        return r
    }

    init(record r: CKRecord, keepSystemFields: Bool) {
        id = r.recordID.recordName
        name = r["name"] as? String ?? ""
        address = r["address"] as? String ?? ""
        latitude = r["latitude"] as? Double
        longitude = r["longitude"] as? Double
        mapItemID = r["mapItemID"] as? String ?? ""
        sentiment = (r["sentiment"] as? String).flatMap(MealSentiment.init) ?? .liked
        rank = r["rank"] as? Double ?? 0
        visitedDay = r["visitedDay"] as? String ?? ""
        notes = r["notes"] as? String ?? ""
        tripID = r["tripID"] as? String ?? ""
        tripItemID = r["tripItemID"] as? String ?? ""
        createdAt = r["createdAt"] as? Date ?? r.creationDate ?? .now
        isWishlist = (r["wishlist"] as? Int64 ?? 0) == 1
        systemFields = keepSystemFields ? r.encodedSystemFields : nil
    }
}

/// Someone whose list you follow (they shared it with you).
struct EatsFriend: Codable, Identifiable, Hashable {
    /// Their iCloud user record name (the owner of the shared zone).
    var id: String
    var name: String = "Friend"
    var places: [EatsPlace] = []

    var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.map { String($0.prefix(1)) }.joined().uppercased()
    }

    var scores: [String: Double] { EatsRanking.scores(places.map(\.candidate)) }
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
    /// pinned to a real Apple Maps place (so "Lunch: figure out" or "ramen
    /// at A or B" notes stay out), not on your list yet, not skipped, and
    /// each restaurant once. Newest first.
    @MainActor
    static func toRank(entries: [EatsPlace]) -> [TripItem] {
        let today = DayKey.key(.now)
        let linked = Set(entries.map(\.tripItemID))
        let ranked = entries.filter { !$0.isWishlist } // a Want to try place you've now been to still needs ranking
        let skipped = skippedIDs
        let candidates = TripStore.shared.items
            .filter { $0.kind == .meal && $0.place != nil && !linked.contains($0.id) && !skipped.contains($0.id)
                && ($0.day.map { $0 <= today } ?? false) }
            .sorted { ($0.day ?? "", $0.time ?? 0) > ($1.day ?? "", $1.time ?? 0) }
        var picked: [(item: TripItem, place: EatsPlace)] = []
        for item in candidates {
            guard let place = item.place.map({ EatsPlace(name: $0.name, place: $0) }),
                  !ranked.contains(where: { $0.isSamePlace(as: place) }),
                  !picked.contains(where: { $0.place.isSamePlace(as: place) }) else { continue }
            picked.append((item, place))
        }
        return picked.map(\.item)
    }

    private static let skippedKey = "eats.skippedTripItems"
    static var skippedIDs: Set<String> { Set(UserDefaults.standard.stringArray(forKey: skippedKey) ?? []) }
    static func skip(_ itemIDs: [String]) {
        UserDefaults.standard.set(Array(skippedIDs.union(itemIDs)), forKey: skippedKey)
    }
}

extension TripItem {
    /// How this trip meal looks in the ranking flow.
    @MainActor
    var rankCandidate: RankCandidate {
        // The restaurant's name, not the itinerary note ("7:00pm Monolith (French…)").
        RankCandidate(id: id, title: place?.name ?? (title.isEmpty ? "Meal" : title),
                      subtitle: [TripStore.shared.trip(tripID)?.name, day.map { DayKey.date($0).formatted(.dateTime.month(.abbreviated).day()) }]
                        .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
    }
}
