import Foundation
import CloudKit

// Trips live outside SwiftData: SwiftData can't share with another Apple ID,
// so trips sync through CloudKit directly (see `TripStore`). Each trip is its
// own record zone — in your private database if you made it, in the shared
// database if someone invited you — and the whole zone is what gets shared.

/// A calendar day as "yyyy-MM-dd". Trip days are stored this way rather than
/// as `Date`s so two people in different time zones see the same day.
enum DayKey {
    static func key(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func date(_ key: String) -> Date {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Calendar.current.startOfDay(for: .now) }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])) ?? .now
    }
}

/// One stop of a trip ("Kyushu", Jun 2–11). Days between legs' dates belong
/// to that leg; moving from one leg to the next is shown as a travel card.
struct TripLeg: Identifiable, Codable, Hashable {
    var id: String = UUID().uuidString
    var name: String = ""
    /// Shown on the leg's badge; empty (or the generic 📍) shows its number.
    var emoji: String = ""
    var startDay: String
    var endDay: String
    /// Where the trip starts from (home): its travel is the trip's way out,
    /// and it isn't numbered among the cities.
    var isHome: Bool = false

    func contains(_ day: String) -> Bool { day >= startDay && day <= endDay }

    var nights: Int {
        max(Calendar.current.dateComponents([.day], from: DayKey.date(startDay), to: DayKey.date(endDay)).day ?? 0, 0)
    }
}

extension Trip {
    /// The cities the trip is actually in: not home, and not a zero-night
    /// first or last stop (the city you leave from or fly back to, often
    /// added without marking it as home).
    var awayLegs: [TripLeg] {
        var away = legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }
        if away.count > 1, away.first?.nights == 0 { away.removeFirst() }
        if away.count > 1, away.last?.nights == 0 { away.removeLast() }
        return away
    }
}

extension TripLeg {
    enum CodingKeys: String, CodingKey { case id, name, emoji, startDay, endDay, isHome }

    // Field by field, so legs saved before `isHome` existed still open.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        emoji = try c.decodeIfPresent(String.self, forKey: .emoji) ?? ""
        startDay = try c.decode(String.self, forKey: .startDay)
        endDay = try c.decode(String.self, forKey: .endDay)
        isHome = try c.decodeIfPresent(Bool.self, forKey: .isHome) ?? false
    }
}

struct Trip: Identifiable, Codable, Hashable {
    var id: String = UUID().uuidString
    var name: String = ""
    var destination: String = ""
    var startDay: String = DayKey.key(.now)
    var endDay: String = DayKey.key(.now)
    var notes: String = ""
    /// Optional name per day ("Fukuoka → Kagoshima"), keyed by day.
    var dayTitles: [String: String] = [:]
    /// Stops in date order; empty for a single-place trip.
    var legs: [TripLeg] = []
    /// Empty for trips in your own iCloud; the owner's user record name for
    /// trips shared with you.
    var zoneOwner: String = ""
    /// You've shared this trip (owner side).
    var isShared: Bool = false
    /// CloudKit change tag etc. from the last save or fetch.
    var systemFields: Data?

    var isMine: Bool { zoneOwner.isEmpty }

    var zoneID: CKRecordZone.ID {
        CKRecordZone.ID(zoneName: Self.zonePrefix + id, ownerName: isMine ? CKCurrentUserDefaultName : zoneOwner)
    }

    var recordID: CKRecord.ID { CKRecord.ID(recordName: id, zoneID: zoneID) }

    /// Every day of the trip, in order.
    var days: [String] {
        let cal = Calendar.current
        let start = DayKey.date(startDay), end = max(DayKey.date(endDay), start)
        let count = (cal.dateComponents([.day], from: start, to: end).day ?? 0) + 1
        return (0..<min(count, 366)).map { DayKey.key(cal.date(byAdding: .day, value: $0, to: start)!) }
    }

    var dateRangeText: String {
        let start = DayKey.date(startDay), end = DayKey.date(endDay)
        return (start..<max(end, start).addingTimeInterval(1)).formatted(.interval.month(.abbreviated).day().year())
    }

    // Older saved files have no `dayTitles`; decode it as optional.
    enum CodingKeys: String, CodingKey {
        case id, name, destination, startDay, endDay, notes, dayTitles, legs, zoneOwner, isShared, systemFields
    }

    init(id: String = UUID().uuidString, name: String = "", destination: String = "", startDay: String = DayKey.key(.now),
         endDay: String = DayKey.key(.now), notes: String = "") {
        self.id = id
        self.name = name
        self.destination = destination
        self.startDay = startDay
        self.endDay = endDay
        self.notes = notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        destination = try c.decode(String.self, forKey: .destination)
        startDay = try c.decode(String.self, forKey: .startDay)
        endDay = try c.decode(String.self, forKey: .endDay)
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        dayTitles = try c.decodeIfPresent([String: String].self, forKey: .dayTitles) ?? [:]
        legs = try c.decodeIfPresent([TripLeg].self, forKey: .legs) ?? []
        zoneOwner = try c.decodeIfPresent(String.self, forKey: .zoneOwner) ?? ""
        isShared = try c.decodeIfPresent(Bool.self, forKey: .isShared) ?? false
        systemFields = try c.decodeIfPresent(Data.self, forKey: .systemFields)
    }

    static let zonePrefix = "trip-"
    static let recordType = "Trip"

    /// The leg a day belongs to. A day that ends one leg and starts the next
    /// (leave Hong Kong, arrive Chongqing) is the travel day, so it goes to
    /// the leg you arrive at.
    func leg(for day: String) -> TripLeg? {
        legs.first { $0.startDay == day } ?? legs.first { $0.contains(day) }
    }

    /// A city's number on its badge, not counting the home city.
    func number(of leg: TripLeg) -> Int {
        (legs.filter { !$0.isHome }.firstIndex { $0.id == leg.id } ?? 0) + 1
    }

    static func tripID(from zoneID: CKRecordZone.ID) -> String? {
        zoneID.zoneName.hasPrefix(zonePrefix) ? String(zoneID.zoneName.dropFirst(zonePrefix.count)) : nil
    }
}

struct TripPlace: Codable, Hashable {
    var name: String
    var address: String = ""
    var latitude: Double
    var longitude: Double
    /// Apple Maps place ID, when the place came from search.
    var mapItemID: String = ""

    var mapsURL: URL? {
        var parts = URLComponents(string: "https://maps.apple.com/")
        parts?.queryItems = [URLQueryItem(name: "q", value: name), URLQueryItem(name: "ll", value: "\(latitude),\(longitude)")]
        if !mapItemID.isEmpty { parts?.queryItems?.append(URLQueryItem(name: "place-id", value: mapItemID)) }
        return parts?.url
    }

    /// The same place in Google Maps (opens the app if installed). Searches
    /// by name and address so Google lands on its own listing; coordinates
    /// alone when there's no address.
    var googleMapsURL: URL? {
        var parts = URLComponents(string: "https://www.google.com/maps/search/")
        let query = address.isEmpty ? "\(latitude),\(longitude)" : "\(name), \(address)"
        parts?.queryItems = [URLQueryItem(name: "api", value: "1"), URLQueryItem(name: "query", value: query)]
        return parts?.url
    }
}

struct TripItem: Identifiable, Codable, Hashable {
    enum Kind: String, Codable, CaseIterable, Identifiable {
        case activity, meal, transit, stay, note
        var id: String { rawValue }

        /// What the add/edit picker offers. Notes are no longer offered, but
        /// old ones still open (and keep their kind) — `picker(for:)`.
        static func picker(for current: Kind) -> [Kind] {
            current == .note ? allCases : allCases.filter { $0 != .note }
        }

        var label: String {
            switch self {
            case .activity: "Activity"
            case .meal: "Food"
            case .transit: "Travel"
            case .stay: "Stay"
            case .note: "Note"
            }
        }

        var symbol: String {
            switch self {
            case .activity: "figure.walk"
            case .meal: "fork.knife"
            case .transit: "airplane"
            case .stay: "bed.double.fill"
            case .note: "note.text"
            }
        }

        /// Travel owns blue (matching the travel cards); the others each
        /// get their own color so a day reads at a glance.
        var colorHex: String {
            switch self {
            case .activity: "#e11d48"
            case .meal: "#facc15"
            case .transit: "#2563eb"
            case .stay: "#7c3aed"
            case .note: "#64748b"
            }
        }

        /// Only travel (departure) and stays (check-in) show a clock time;
        /// the rest are ordered by dragging.
        var usesTime: Bool { self == .transit || self == .stay }
    }

    var id: String = UUID().uuidString
    var tripID: String
    /// nil = not on a day yet (the trip's Ideas list).
    var day: String?
    var kind: Kind = .activity
    var title: String = ""
    /// Minutes after midnight, in the trip's local time.
    var time: Int?
    var place: TripPlace?
    var notes: String = ""
    /// Flight or train details, for travel items; nil uses the plain form.
    var transport: TripTransport?
    /// The day you check out, for stays over several nights; the stay is
    /// saved once on its check-in `day` and shown on every day it covers.
    /// nil = just the one day, as before.
    var checkOutDay: String?
    /// Where it was dragged to in its day, in the same minutes as `time`
    /// (it can fall between two times, or before or after them all). nil
    /// = sorted by its time. The time shown doesn't change.
    var order: Double?
    var createdAt: Date = .now
    var systemFields: Data?

    /// Marks a plan being dragged between rows, so other dropped text is ignored.
    static let dragPrefix = "wooli-trip-item:"

    /// Untimed plans with no dragged place go last in their day.
    static let untimedKey = 1_000_000_000.0

    /// Where this sits in its day: its dragged place, else its time.
    var sortKey: Double { order ?? time.map(Double.init) ?? Self.untimedKey }

    /// A day's order: dragged place or time, then the order added.
    static func dayOrder(_ a: TripItem, _ b: TripItem) -> Bool {
        (a.sortKey, a.createdAt) < (b.sortKey, b.createdAt)
    }

    static let recordType = "TripItem"

    /// Empty meal slots added to every day of a new trip (travel days too —
    /// you still eat), with times so they sort through the day.
    static let mealSlots: [(title: String, time: Int)] = [("Breakfast", 8 * 60), ("Lunch", 12 * 60 + 30), ("Dinner", 19 * 60)]

    static func mealPlaceholders(for trip: Trip) -> [TripItem] {
        trip.days.flatMap { day in
            mealSlots.map { TripItem(tripID: trip.id, day: day, kind: .meal, title: $0.title, time: $0.time) }
        }
    }

    /// A meal slot nobody has filled in yet.
    var isMealPlaceholder: Bool {
        kind == .meal && place == nil && notes.isEmpty && Self.mealSlots.contains { $0.title == title }
    }

    /// A multi-night stay's check-out, when it's after check-in.
    var stayEnd: String? {
        guard kind == .stay, let day, let checkOutDay, checkOutDay > day else { return nil }
        return checkOutDay
    }

    var nights: Int {
        guard let day, let end = stayEnd else { return 0 }
        return max(Calendar.current.dateComponents([.day], from: DayKey.date(day), to: DayKey.date(end)).day ?? 0, 0)
    }

    /// The stay carries on into `other` (a later night, or check-out day).
    func staysOver(_ other: String) -> Bool {
        guard let day, let end = stayEnd else { return false }
        return other > day && other <= end
    }

    /// "Check-in · 3 nights", "Night 2 of 3", "Check-out".
    func stayLabel(on other: String) -> String? {
        guard let end = stayEnd else { return nil }
        if other == day { return "Check-in · \(nights) night\(nights == 1 ? "" : "s")" }
        if other == end { return "Check-out" }
        guard let day else { return nil }
        let night = (Calendar.current.dateComponents([.day], from: DayKey.date(day), to: DayKey.date(other)).day ?? 0) + 1
        return "Night \(night) of \(nights)"
    }

    var timeText: String? {
        guard kind.usesTime, let time else { return nil }
        let date = Calendar.current.date(bySettingHour: time / 60, minute: time % 60, second: 0, of: .now) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }
}

/// A flight or train booking. It departs on the item's `day` at its `time`.
struct TripTransport: Codable, Hashable {
    enum Mode: String, Codable, CaseIterable, Identifiable {
        case flight, train
        var id: String { rawValue }
        var label: String { self == .flight ? "Flight" : "Train" }
        var symbol: String { self == .flight ? "airplane" : "tram.fill" }
    }

    var mode: Mode = .flight
    // Flight
    var flightNumber: String = ""
    var airline: String = ""
    /// IATA codes ("JFK").
    var fromAirport: String = ""
    var toAirport: String = ""
    var departTerminal: String = ""
    var arriveTerminal: String = ""
    var cabin: String = ""
    // Train
    var fromStation: TripPlace?
    var toStation: TripPlace?
    // Both
    /// Minutes after midnight, local time where you arrive.
    var arriveTime: Int?
    /// Days after departure that you arrive (overnight flights).
    var arriveDayOffset: Int = 0
    var seats: String = ""
    var confirmation: String = ""

    init(mode: Mode = .flight) { self.mode = mode }

    // Decode field by field so a record saved by a newer version (with
    // fields this one doesn't know) or an older one still opens.
    enum CodingKeys: String, CodingKey {
        case mode, flightNumber, airline, fromAirport, toAirport, departTerminal, arriveTerminal, cabin,
             fromStation, toStation, arriveTime, arriveDayOffset, seats, confirmation
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mode = (try? c.decodeIfPresent(Mode.self, forKey: .mode)) ?? .flight
        flightNumber = try c.decodeIfPresent(String.self, forKey: .flightNumber) ?? ""
        airline = try c.decodeIfPresent(String.self, forKey: .airline) ?? ""
        fromAirport = try c.decodeIfPresent(String.self, forKey: .fromAirport) ?? ""
        toAirport = try c.decodeIfPresent(String.self, forKey: .toAirport) ?? ""
        departTerminal = try c.decodeIfPresent(String.self, forKey: .departTerminal) ?? ""
        arriveTerminal = try c.decodeIfPresent(String.self, forKey: .arriveTerminal) ?? ""
        cabin = try c.decodeIfPresent(String.self, forKey: .cabin) ?? ""
        fromStation = try c.decodeIfPresent(TripPlace.self, forKey: .fromStation)
        toStation = try c.decodeIfPresent(TripPlace.self, forKey: .toStation)
        arriveTime = try c.decodeIfPresent(Int.self, forKey: .arriveTime)
        arriveDayOffset = try c.decodeIfPresent(Int.self, forKey: .arriveDayOffset) ?? 0
        seats = try c.decodeIfPresent(String.self, forKey: .seats) ?? ""
        confirmation = try c.decodeIfPresent(String.self, forKey: .confirmation) ?? ""
    }
}

// MARK: - CloudKit records

extension CKRecord {
    /// Rebuild from saved system fields (keeps the change tag), or start fresh.
    static func restoring(_ systemFields: Data?, type: String, id: CKRecord.ID) -> CKRecord {
        if let systemFields, let coder = try? NSKeyedUnarchiver(forReadingFrom: systemFields) {
            coder.requiresSecureCoding = true
            defer { coder.finishDecoding() }
            if let record = CKRecord(coder: coder) { return record }
        }
        return CKRecord(recordType: type, recordID: id)
    }

    var encodedSystemFields: Data {
        let coder = NSKeyedArchiver(requiringSecureCoding: true)
        encodeSystemFields(with: coder)
        coder.finishEncoding()
        return coder.encodedData
    }
}

extension Trip {
    func record() -> CKRecord {
        let r = CKRecord.restoring(systemFields, type: Self.recordType, id: recordID)
        r["name"] = name
        r["destination"] = destination
        r["startDay"] = startDay
        r["endDay"] = endDay
        r["notes"] = notes
        r["dayTitles"] = (try? JSONEncoder().encode(dayTitles)).flatMap { String(data: $0, encoding: .utf8) }
        r["legs"] = (try? JSONEncoder().encode(legs)).flatMap { String(data: $0, encoding: .utf8) }
        return r
    }

    mutating func apply(_ r: CKRecord) {
        name = r["name"] as? String ?? name
        destination = r["destination"] as? String ?? destination
        startDay = r["startDay"] as? String ?? startDay
        endDay = r["endDay"] as? String ?? endDay
        notes = r["notes"] as? String ?? notes
        if let json = r["dayTitles"] as? String, let titles = try? JSONDecoder().decode([String: String].self, from: Data(json.utf8)) {
            dayTitles = titles
        }
        if let json = r["legs"] as? String, let decoded = try? JSONDecoder().decode([TripLeg].self, from: Data(json.utf8)) {
            legs = decoded
        }
        systemFields = r.encodedSystemFields
    }
}

extension TripItem {
    func record(in zoneID: CKRecordZone.ID) -> CKRecord {
        let r = CKRecord.restoring(systemFields, type: Self.recordType, id: CKRecord.ID(recordName: id, zoneID: zoneID))
        r["day"] = day
        r["kind"] = kind.rawValue
        r["title"] = title
        r["time"] = time.map { Int64($0) }
        r["notes"] = notes
        r["createdAt"] = createdAt
        r["placeName"] = place?.name
        r["placeAddress"] = place?.address
        r["latitude"] = place?.latitude
        r["longitude"] = place?.longitude
        r["mapItemID"] = place?.mapItemID
        r["transport"] = transport.flatMap { try? JSONEncoder().encode($0) }.flatMap { String(data: $0, encoding: .utf8) }
        r["checkOutDay"] = checkOutDay
        // Only once dragged: a field Production's schema doesn't have yet fails
        // the whole save (deploy it from the CloudKit Console first).
        if let order { r["order"] = order }
        return r
    }

    init(record r: CKRecord, tripID: String) {
        self.init(id: r.recordID.recordName, tripID: tripID)
        day = r["day"] as? String
        kind = (r["kind"] as? String).flatMap(Kind.init) ?? .activity
        title = r["title"] as? String ?? ""
        time = (r["time"] as? Int64).map { Int($0) }
        notes = r["notes"] as? String ?? ""
        createdAt = r["createdAt"] as? Date ?? r.creationDate ?? .now
        if let name = r["placeName"] as? String, let lat = r["latitude"] as? Double, let lon = r["longitude"] as? Double {
            place = TripPlace(name: name, address: r["placeAddress"] as? String ?? "", latitude: lat, longitude: lon,
                              mapItemID: r["mapItemID"] as? String ?? "")
        }
        if let json = r["transport"] as? String {
            transport = try? JSONDecoder().decode(TripTransport.self, from: Data(json.utf8))
        }
        checkOutDay = r["checkOutDay"] as? String
        order = r["order"] as? Double
        systemFields = r.encodedSystemFields
    }
}
