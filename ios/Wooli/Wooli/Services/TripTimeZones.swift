import Foundation

/// Which time zone a trip day is in (M3-1). Plan times stay local to their city;
/// this is what lets exports and headers know which zone that is.
enum TripTimeZones {
    /// The zone of the city the trip is in on `day`. On a travel day two cities
    /// share the date: the first is where you leave from, the last where you arrive.
    static func zone(on day: String, in trip: Trip, arriving: Bool = false) -> TimeZone? {
        let legs = trip.legs.filter { !$0.isHome && $0.contains(day) && $0.timeZone != nil }
        return (arriving ? legs.last : legs.first)?.timeZone
    }

    /// The moment "`day` at `minutes`" is in `zone`.
    static func instant(day: String, minutes: Int, zone: TimeZone) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2],
                                                  hour: minutes / 60, minute: minutes % 60))
    }

    /// Hours `zone` is ahead of `home` at `date` (negative = behind).
    static func offsetHours(of zone: TimeZone, from home: TimeZone, at date: Date) -> Double {
        Double(zone.secondsFromGMT(for: date) - home.secondsFromGMT(for: date)) / 3600
    }

    /// "+6 h", "−5½ h", "same time".
    static func offsetText(_ hours: Double) -> String {
        guard hours != 0 else { return "same time" }
        let whole = Int(abs(hours).rounded(.towardZero))
        let half = abs(hours) - Double(whole) >= 0.5 ? "½" : ""
        let quarter = abs(hours).truncatingRemainder(dividingBy: 0.5) != 0
        let number = quarter ? String(format: "%.2f", abs(hours)) : (whole == 0 && half == "½" ? "½" : "\(whole)\(half)")
        return (hours > 0 ? "+" : "−") + number + " h"
    }

    /// The note for a day header, "CET (+6 h from home)": only on the first day of
    /// a city whose zone differs from the city before it (or from home, for the first).
    /// `home` is passed in, never read from the device, so a trip looks the same from anywhere.
    static func headerNote(trip: Trip, day: String, home: TimeZone) -> String? {
        let cities = trip.legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }
        guard let index = cities.firstIndex(where: { $0.contains(day) }),
              cities[index].startDay == day,
              let zone = cities[index].timeZone else { return nil }
        let before = index > 0 ? (cities[index - 1].timeZone ?? home) : home
        guard zone.identifier != before.identifier else { return nil }
        let date = instant(day: day, minutes: 12 * 60, zone: zone) ?? .now
        let abbreviation = zone.abbreviation(for: date) ?? zone.identifier
        return "\(abbreviation) (\(offsetText(offsetHours(of: zone, from: home, at: date))) from home)"
    }
}
