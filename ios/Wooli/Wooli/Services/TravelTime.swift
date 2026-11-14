import Foundation

/// Getting from one stop to the next on a day (M3-2). Pure: the choice of mode,
/// the wording, the straight-line fallback and the day's total. The directions
/// lookup itself is a separate, cached step.
enum TravelMode: String, Codable, CaseIterable, Identifiable {
    case walk, transit, drive
    var id: String { rawValue }

    var label: String {
        switch self {
        case .walk: "walk"
        case .transit: "by transit"
        case .drive: "drive"
        }
    }

    var symbol: String {
        switch self {
        case .walk: "figure.walk"
        case .transit: "tram.fill"
        case .drive: "car.fill"
        }
    }
}

struct TravelEstimate: Codable, Hashable {
    var mode: TravelMode
    /// nil = no directions available: only the distance is known.
    var minutes: Int?
    var km: Double
}

enum TravelTime {
    /// Under this a walk is the default.
    static let walkKm = 1.5

    /// Short hops walk; longer ones use transit where Apple has it, else drive.
    static func defaultMode(km: Double, transitAvailable: Bool) -> TravelMode {
        if km < walkKm { return .walk }
        return transitAvailable ? .transit : .drive
    }

    /// "14 min walk", "1 h 5 min by transit", or the distance when there's no estimate ("2.1 km").
    static func text(_ estimate: TravelEstimate) -> String {
        guard let minutes = estimate.minutes else { return distanceText(estimate.km) }
        return "\(durationText(minutes)) \(estimate.mode.label)"
    }

    static func durationText(_ minutes: Int) -> String {
        guard minutes >= 60 else { return "\(max(minutes, 1)) min" }
        let h = minutes / 60, m = minutes % 60
        return m == 0 ? "\(h) h" : "\(h) h \(m) min"
    }

    static func distanceText(_ km: Double) -> String {
        km < 1 ? "\(Int((km * 1000 / 50).rounded()) * 50) m" : String(format: "%.1f km", km)
    }

    /// "4 stops · 1 h 10 min getting around". nil when there's nothing to say.
    static func daySummary(stops: Int, estimates: [TravelEstimate]) -> String? {
        guard stops > 1 else { return nil }
        let minutes = estimates.compactMap(\.minutes).reduce(0, +)
        let base = "\(stops) stops"
        return minutes > 0 ? "\(base) · \(durationText(minutes)) getting around" : base
    }

    /// The same pair of places and mode always has the same key, whichever way it was asked.
    static func cacheKey(from: TripPlace, to: TripPlace, mode: TravelMode) -> String {
        func point(_ p: TripPlace) -> String { String(format: "%.4f,%.4f", p.latitude, p.longitude) }
        return "\(point(from))>\(point(to))|\(mode.rawValue)"
    }

    static func km(from: TripPlace, to: TripPlace) -> Double {
        TripChecks.distanceKm(from.latitude, from.longitude, to.latitude, to.longitude)
    }

    /// The straight-line stand-in used offline or when directions fail.
    static func fallback(from: TripPlace, to: TripPlace) -> TravelEstimate {
        let km = km(from: from, to: to)
        return TravelEstimate(mode: defaultMode(km: km, transitAvailable: false), minutes: nil, km: km)
    }

    /// Consecutive plans with places on one day, in order: the pairs that get a connector.
    static func pairs(_ plans: [TripItem]) -> [(from: TripItem, to: TripItem)] {
        let placed = plans.filter { $0.place != nil && $0.kind != .stay }
        return zip(placed, placed.dropFirst()).map { ($0, $1) }
    }
}
