import Foundation
import Testing
@testable import Wooli

// The Overview status line (TripOverview).

struct TripOverviewTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-05")
        trip.legs = [TripLeg(name: "Seville", startDay: "2027-04-01", endDay: "2027-04-03"),
                     TripLeg(name: "Madrid", startDay: "2027-04-03", endDay: "2027-04-05")]
        return trip
    }

    @Test func countdownBeforeTheTrip() {
        #expect(TripOverview.status(trip: trip(), today: "2027-03-20") == "In 12 days")
        #expect(TripOverview.status(trip: trip(), today: "2027-03-31") == "Tomorrow")
    }

    @Test func dayAndCityDuringTheTrip() {
        #expect(TripOverview.status(trip: trip(), today: "2027-04-02") == "Day 2 of 5 · Seville")
        // On a change day you've arrived: the later city.
        #expect(TripOverview.status(trip: trip(), today: "2027-04-03") == "Day 3 of 5 · Madrid")
    }

    @Test func endedAfterTheTrip() {
        #expect(TripOverview.status(trip: trip(), today: "2027-04-09") == "Ended")
    }
}
