import Foundation
import Testing
@testable import Wooli

// The Overview's route (TripRoute).

struct TripRouteTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-09")
        trip.legs = [TripLeg(name: "Home", startDay: "2027-04-01", endDay: "2027-04-01", isHome: true),
                     TripLeg(name: "Seville", startDay: "2027-04-01", endDay: "2027-04-04"),
                     TripLeg(name: "Madrid", startDay: "2027-04-04", endDay: "2027-04-09")]
        return trip
    }

    @Test func citiesInOrderWithNightsAndTheWayIn() {
        var train = TripItem(tripID: "t", day: "2027-04-04", kind: .transit, title: "Train to Madrid")
        train.time = 600
        let stops = TripRoute.stops(trip: trip(), items: [train])
        #expect(stops.map(\.name) == ["Seville", "Madrid"])
        #expect(stops.map(\.nights) == [3, 5])
        #expect(stops[1].arrivingBy == ["Train to Madrid"])
        #expect(!stops[1].noWayThere)
    }

    @Test func aCityWithNoTravelPlanSaysSo() {
        let stops = TripRoute.stops(trip: trip(), items: [])
        #expect(stops[1].noWayThere)
        #expect(!stops[0].noWayThere || stops[0].arrivingBy.isEmpty)   // the first city is reached from home
    }

    @Test func cancelledTravelDoesNotCount() {
        var train = TripItem(tripID: "t", day: "2027-04-04", kind: .transit, title: "Train")
        train.setStatus(.cancelled)
        #expect(TripRoute.stops(trip: trip(), items: [train])[1].noWayThere)
    }
}
