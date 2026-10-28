import Foundation

/// How the travel items on a moving day fit together: the legs that get you
/// to the next city, side trips that come back the same day (they stay in
/// the day as plans), car pick-ups along the way, and other people's travel
/// you're meeting.
enum TravelLegs {
    /// One way of getting around, with its icon and word.
    struct Mode: Equatable {
        let symbol: String
        let label: String

        static let flight = Mode(symbol: "airplane", label: "Flight")
        static let train = Mode(symbol: "tram.fill", label: "Train")
        static let ferry = Mode(symbol: "ferry.fill", label: "Ferry")
        static let drive = Mode(symbol: "car.fill", label: "Drive")
        static let bus = Mode(symbol: "bus.fill", label: "Bus")
        static let taxi = Mode(symbol: "car.side.fill", label: "Taxi")
        static let walk = Mode(symbol: "figure.walk", label: "Walk")
        static let carHire = Mode(symbol: "key.fill", label: "Car hire")
        static let other = Mode(symbol: "arrow.right", label: "Travel")
    }

    static func mode(of item: TripItem) -> Mode {
        if let transport = item.transport { return transport.mode == .flight ? .flight : .train }
        let title = item.title.lowercased()
        if ["rent a car", "rental car", "car rental", "pickup", "pick up", "pick-up", "dropoff", "drop off", "drop-off"]
            .contains(where: title.contains) { return .carHire }
        if item.title.range(of: #"\b[A-Z][A-Z0-9] ?\d{2,4}\b"#, options: .regularExpression) != nil { return .flight }
        // A title that starts with how you go says it best ("Train to Haneda
        // Airport", "Bus to Odawara Station"); then the rest of the title; notes last.
        let leading: [(String, Mode)] = [("train", .train), ("shinkansen", .train), ("subway", .train), ("bus", .bus),
                                         ("ferry", .ferry), ("boat", .ferry), ("drive", .drive), ("flight", .flight),
                                         ("uber", .taxi), ("taxi", .taxi), ("walk", .walk)]
        if let first = title.split(separator: " ").first, let hit = leading.first(where: { first.hasPrefix($0.0) }) { return hit.1 }
        let byTitle = mode(inText: " \(title) ")
        return byTitle != .other ? byTitle : mode(inText: " \(item.notes.lowercased()) ")
    }

    private static func mode(inText text: String) -> Mode {
        func has(_ words: [String]) -> Bool { words.contains { text.contains($0) } }
        if has(["flight", "airport", "✈", "airline", "airways", " fly "]) { return .flight }
        if has(["ferry", "boat", "cruise"]) { return .ferry }
        if text.hasPrefix(" bus") { return .bus }
        if has(["shinkansen", "train", " jr ", "rail", "station", "ktx", "subway", "metro", "tozan"]) { return .train }
        if has(["uber", "taxi", "lyft", "grab"]) { return .taxi }
        if has([" bus "]) { return .bus }
        if has(["drive", " car ", "road trip"]) { return .drive }
        if has(["walk"]) { return .walk }
        return .other
    }

    /// "Hakata → Kagoshima-Chūō" for a ticket, else the title, else the mode.
    static func title(of item: TripItem) -> String {
        if !item.title.isEmpty { return item.title }
        if let suggested = item.transport?.suggestedTitle, !suggested.isEmpty { return suggested }
        return mode(of: item).label
    }

    /// Where a leg goes, read from its ticket or a title like "A to B" / "A → B".
    static func ends(of item: TripItem) -> (from: String, to: String)? {
        if let t = item.transport {
            switch t.mode {
            case .flight where !t.fromAirport.isEmpty && !t.toAirport.isEmpty: return (t.fromAirport, t.toAirport)
            case .train: if let a = t.fromStation?.name, let b = t.toStation?.name { return (a, b) }
            default: break
            }
        }
        for separator in [" → ", " to ", "->"] {
            let parts = item.title.components(separatedBy: separator)
            guard parts.count == 2 else { continue }
            func clean(_ s: String) -> String {
                s.replacingOccurrences(of: #"\b(ferry|train|flight|drive|bus|subway|shinkansen)\b"#, with: "",
                                       options: [.regularExpression, .caseInsensitive])
                    .trimmingCharacters(in: .whitespaces.union(.punctuationCharacters)).lowercased()
            }
            let a = clean(parts[0]), b = clean(parts[1])
            if !a.isEmpty && !b.isEmpty { return (a, b) }
        }
        return nil
    }

    /// Someone else's booking you're meeting: "[Mom / Jojo] HKG → FUK".
    static func isSomeoneElse(_ item: TripItem) -> Bool {
        item.title.trimmingCharacters(in: .whitespaces).hasPrefix("[")
    }

    /// Out-and-back pairs on the same day (Kagoshima → Sakurajima, then
    /// Sakurajima → Kagoshima): a day trip, not part of moving cities.
    static func sideTripIDs(in items: [TripItem]) -> Set<String> {
        var ids = Set<String>()
        for (i, out) in items.enumerated() {
            guard let a = ends(of: out) else { continue }
            if let back = items[(i + 1)...].first(where: { ends(of: $0).map { $0.from == a.to && $0.to == a.from } ?? false }) {
                ids.insert(out.id)
                ids.insert(back.id)
            }
        }
        return ids
    }

    /// Minutes the leg takes: from its ticket's arrival, or "Duration: 1h 30m".
    static func minutes(of item: TripItem) -> Int? {
        if let t = item.transport, let arrive = t.arriveTime, let depart = item.time {
            // Flights count each end in its own time zone.
            if let minutes = t.durationMinutes(departDay: item.day, departTime: depart) { return minutes }
            // Otherwise by the clock; arriving earlier than you left means the next day.
            let minutes = arrive + t.arriveDayOffset * 1440 - depart
            return minutes > 0 ? minutes : minutes + 1440 > 0 ? minutes + 1440 : nil
        }
        guard let match = item.notes.firstMatch(of: /Duration: (?:(\d+)h)? ?(?:(\d+)m)?/) else { return nil }
        let total = (Int(match.1 ?? "") ?? 0) * 60 + (Int(match.2 ?? "") ?? 0)
        return total > 0 ? total : nil
    }

    /// The modes of a route in order, without repeats or car pick-ups:
    /// [ferry, car] for "ferry over, then drive".
    static func modes(of route: [TripItem]) -> [Mode] {
        route.map(mode(of:)).filter { $0 != .carHire }.reduce(into: []) { if $0.last != $1 { $0.append($1) } }
    }

    /// The way you mainly travelled: the longest leg, else the last one.
    static func mainMode(of route: [TripItem]) -> Mode? {
        let legs = route.filter { mode(of: $0) != .carHire }
        return legs.max { (minutes(of: $0) ?? 0) < (minutes(of: $1) ?? 0) }.map(mode(of:))
            .flatMap { main in legs.allSatisfy { minutes(of: $0) == nil } ? legs.last.map(mode(of:)) : main }
    }
}
