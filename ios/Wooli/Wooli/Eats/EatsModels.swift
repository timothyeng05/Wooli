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
    /// "yyyy-MM-dd" you last went. Kept in step with `visits` (the latest
    /// one) so older builds, sorting and the ranking flow still have a date.
    var visitedDay: String = DayKey.key(.now)
    /// Every time you went, newest first. Places from before visits existed
    /// get one from `visitedDay` when they're read.
    var visits: [EatsVisit] = []
    var notes: String = ""
    /// The trip and trip item this came from; "" for places added in Eats.
    var tripID: String = ""
    var tripItemID: String = ""
    var createdAt: Date = .now
    /// CloudKit change tag etc. (your own places only).
    var systemFields: Data?

    static let recordType = "EatsPlace"
    /// A place you want to try. Its own record type, so it never counts as
    /// ranked (and older builds, which don't know it, skip it).
    static let wishRecordType = "EatsWish"

    init(name: String, place: TripPlace? = nil, visitedDay: String = DayKey.key(.now)) {
        self.name = name
        self.visitedDay = visitedDay
        visits = [EatsVisit(day: visitedDay)]
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

    /// Metres from `location`, if the place has a pin.
    func distance(from location: CLLocation) -> CLLocationDistance? {
        guard let latitude, let longitude else { return nil }
        return location.distance(from: CLLocation(latitude: latitude, longitude: longitude))
    }

    var tripPlace: TripPlace? {
        guard let latitude, let longitude else { return nil }
        return TripPlace(name: name, address: address, latitude: latitude, longitude: longitude, mapItemID: mapItemID)
    }

    var candidate: RankCandidate {
        RankCandidate(id: id, title: name,
                      subtitle: visitedDay.isEmpty ? "" : DayKey.date(visitedDay).formatted(.dateTime.month(.abbreviated).day().year()),
                      sentiment: sentiment, rank: rank,
                      detail: [address, notes].filter { !$0.isEmpty }.joined(separator: "\n\n"))
    }

    /// The first line of your notes — the cuisine, for places from Beli.
    /// Not a link (places saved from a reel keep its URL there).
    var cuisine: String? {
        guard let line = notes.split(separator: "\n").first?.trimmingCharacters(in: .whitespaces),
              !line.isEmpty, !line.hasPrefix("http") else { return nil }
        return line
    }

    /// The Instagram post this was saved from, if your notes have its link.
    var reelURL: URL? {
        notes.split(whereSeparator: \.isNewline).lazy
            .compactMap { URL(string: $0.trimmingCharacters(in: .whitespaces)) }
            .first(where: SharedPlaceHandoff.isInstagramPost)
    }

    /// The city from the address, for the City filter: the last part that
    /// isn't a country, a state code or a postcode ("Old Montreal, Montreal,
    /// QC, Canada" → Montreal; "Asakusa, Tokyo, Japan" → Tokyo).
    var city: String? {
        var parts = address.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        while parts.count > 1, let last = parts.last, Self.isRegion(last) { parts.removeLast() }
        guard let city = parts.last, !city.contains(where: \.isNumber) else { return nil }
        return city
    }

    private static let countries: Set<String> = Set(Locale.Region.isoRegions.compactMap {
        Locale(identifier: "en_US").localizedString(forRegionCode: $0.identifier)
    }).union(["USA", "UK", "UAE"])

    private static func isRegion(_ part: String) -> Bool {
        part.contains(where: \.isNumber) || (part.count <= 3 && part == part.uppercased()) || countries.contains(part)
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
        case id, name, address, latitude, longitude, mapItemID, sentiment, rank, visitedDay, visits, notes, tripID, tripItemID, createdAt, systemFields
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
        visits = (try? c.decodeIfPresent([EatsVisit].self, forKey: .visits)) ?? []
        if visits.isEmpty && !visitedDay.isEmpty { visits = [EatsVisit(day: visitedDay)] }
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        tripID = try c.decodeIfPresent(String.self, forKey: .tripID) ?? ""
        tripItemID = try c.decodeIfPresent(String.self, forKey: .tripItemID) ?? ""
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        systemFields = try c.decodeIfPresent(Data.self, forKey: .systemFields)
    }

    func record(in zoneID: CKRecordZone.ID, type: String = Self.recordType) -> CKRecord {
        let r = CKRecord.restoring(systemFields, type: type, id: CKRecord.ID(recordName: id, zoneID: zoneID))
        r["name"] = name
        r["address"] = address
        r["latitude"] = latitude
        r["longitude"] = longitude
        r["mapItemID"] = mapItemID
        r["sentiment"] = sentiment.rawValue
        r["rank"] = rank
        r["visitedDay"] = visitedDay
        r["visits"] = (try? JSONEncoder().encode(visits)).flatMap { String(data: $0, encoding: .utf8) }
        r["notes"] = notes
        r["tripID"] = tripID
        r["tripItemID"] = tripItemID
        r["createdAt"] = createdAt
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
        visits = (r["visits"] as? String).flatMap { try? JSONDecoder().decode([EatsVisit].self, from: Data($0.utf8)) } ?? []
        if visits.isEmpty && !visitedDay.isEmpty { visits = [EatsVisit(day: visitedDay)] }
        notes = r["notes"] as? String ?? ""
        tripID = r["tripID"] as? String ?? ""
        tripItemID = r["tripItemID"] as? String ?? ""
        createdAt = r["createdAt"] as? Date ?? r.creationDate ?? .now
        systemFields = keepSystemFields ? r.encodedSystemFields : nil
    }
}

/// One time you went to a place.
struct EatsVisit: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    /// "yyyy-MM-dd"
    var day: String
    var note: String = ""
}

extension EatsPlace {
    /// Adds or updates a visit, keeping them newest first and `visitedDay`
    /// on the latest.
    mutating func setVisit(_ visit: EatsVisit) {
        if let i = visits.firstIndex(where: { $0.id == visit.id }) { visits[i] = visit } else { visits.append(visit) }
        sortVisits()
    }

    mutating func removeVisit(_ visit: EatsVisit) {
        visits.removeAll { $0.id == visit.id }
        sortVisits()
    }

    private mutating func sortVisits() {
        visits.sort { $0.day > $1.day }
        if let latest = visits.first { visitedDay = latest.day }
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
    // Raw values are stored; `mustTry` decodes as `liked` on older builds.
    case mustTry, liked, fine, disliked
    var id: String { rawValue }

    var label: String {
        switch self {
        case .mustTry: "Must try"
        case .liked: "I liked it!"
        case .fine: "It was fine"
        case .disliked: "I didn't like it"
        }
    }

    var symbol: String {
        switch self {
        case .mustTry: "star.fill"
        case .liked: "hand.thumbsup.fill"
        case .fine: "minus"
        case .disliked: "hand.thumbsdown.fill"
        }
    }

    var color: Color {
        switch self {
        case .mustTry: Color(hex: "#7c3aed")
        case .liked: Color(hex: "#22c55e")
        case .fine: Color(hex: "#f59e0b")
        case .disliked: Color(hex: "#ef4444")
        }
    }

    /// The scores this feeling can land on. Must-try and liked share the
    /// green band as one stack rank (must-trys on top), like Beli, so 10 is
    /// your single best meal and scores step down evenly from there.
    var band: ClosedRange<Double> {
        switch self {
        case .mustTry, .liked: 7.0...10.0
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
    /// More to jog your memory when you hold the card (address, notes).
    var detail: String = ""
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

    /// Each place's score, spread evenly across its band, so a score moves
    /// as you rank more places (like Beli). Must-try and liked are one band.
    static func scores(_ items: [RankCandidate]) -> [String: Double] {
        var scores: [String: Double] = [:]
        let bands: [[MealSentiment]] = [[.mustTry, .liked], [.fine], [.disliked]]
        for feelings in bands {
            let places = feelings.flatMap { group(of: $0, in: items) }
            let band = feelings[0].band
            for (i, place) in places.enumerated() {
                let t = places.count == 1 ? 0 : Double(i) / Double(places.count - 1)
                // Rounded down, so only your #1 shows 10.0.
                scores[place.id] = ((band.upperBound - (band.upperBound - band.lowerBound) * t) * 10 + 1e-9).rounded(.down) / 10
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
        let skipped = skippedIDs
        let candidates = TripStore.shared.items
            .filter { $0.kind == .meal && $0.place != nil && !linked.contains($0.id) && !skipped.contains($0.id)
                && ($0.day.map { $0 <= today } ?? false) }
            .sorted { ($0.day ?? "", $0.time ?? 0) > ($1.day ?? "", $1.time ?? 0) }
        var picked: [(item: TripItem, place: EatsPlace)] = []
        for item in candidates {
            guard let place = item.place.map({ EatsPlace(name: $0.name, place: $0) }),
                  !entries.contains(where: { $0.isSamePlace(as: place) }),
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
