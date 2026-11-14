import Foundation

/// The trip as a route (M3-5): the cities in order with their nights, and the
/// travel plans filed between each pair. Pure.
struct TripRouteStop: Identifiable, Hashable {
    let legID: String
    let name: String
    let nights: Int
    let startDay: String
    /// What gets you here from the city before ("CX831 JFK → HKG", "Train to Lijiang"); empty = nothing booked.
    let arrivingBy: [String]
    /// True when the city before it has no travel plan to get here.
    var noWayThere: Bool { arrivingBy.isEmpty }
    var id: String { legID }
}

enum TripRoute {
    static func stops(trip: Trip, items: [TripItem]) -> [TripRouteStop] {
        let items = TripExport.exportable(items)
        let cities = trip.legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }
        return cities.enumerated().map { index, leg in
            // Travel on the day you arrive (the leg's first day) counts as the way in.
            let travel = index == 0 ? [] : items.filter { $0.kind == .transit && $0.day == leg.startDay }
                .sorted(by: TripItem.dayOrder).map(TripBookings.what)
            return TripRouteStop(legID: leg.id, name: leg.name, nights: leg.nights, startDay: leg.startDay, arrivingBy: travel)
        }
    }
}
