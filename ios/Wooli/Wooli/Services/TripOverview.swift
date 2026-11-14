import Foundation

/// The Overview's one-line status (M3-5): a countdown before the trip, the day
/// and city during it, and "Ended" after. Pure: `today` is a day key passed in,
/// so a trip reads the same whatever zone the Mac is in.
enum TripOverview {
    static func status(trip: Trip, today: String) -> String {
        if today < trip.startDay {
            let days = dayCount(from: today, to: trip.startDay)
            return days == 1 ? "Tomorrow" : "In \(days) days"
        }
        if today > trip.endDay { return "Ended" }
        let day = dayCount(from: trip.startDay, to: today) + 1
        let city = trip.legs.last { !$0.isHome && $0.contains(today) }?.name
        return ["Day \(day) of \(trip.days.count)", city].compactMap { $0 }.joined(separator: " · ")
    }

    private static func dayCount(from a: String, to b: String) -> Int {
        Calendar.current.dateComponents([.day], from: DayKey.date(a), to: DayKey.date(b)).day ?? 0
    }
}
