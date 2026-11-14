import Foundation
import Testing
@testable import Wooli

// Export then import of a .woolitrip gives the same trip with new ids (TripFile).

struct TripFileTests {
    @Test func roundTripKeepsContentAndMakesNewIds() throws {
        var trip = Trip(id: "old", name: "China", startDay: "2027-04-01", endDay: "2027-04-03")
        trip.legs = [TripLeg(name: "Hangzhou", startDay: "2027-04-01", endDay: "2027-04-03")]
        trip.extras.budget = 8000
        var flight = TripItem(tripID: "old", day: "2027-04-01", kind: .transit, time: 600)
        var t = TripTransport(mode: .flight)
        t.flightNumber = "CX831"; t.confirmation = "ABC123"
        flight.transport = t
        flight.cost = 500
        flight.setStatus(.booked)
        let stay = TripItem(tripID: "old", day: "2027-04-01", kind: .stay, title: "Hyatt")

        let data = try TripFile.data(trip: trip, items: [flight, stay])
        let copy = try TripFile.newTrip(from: data)

        #expect(copy.trip.id != "old")
        #expect(copy.trip.name == "China" && copy.trip.legs.map(\.name) == ["Hangzhou"])
        #expect(copy.trip.extras.budget == 8000)
        #expect(copy.items.count == 2)
        #expect(copy.items.allSatisfy { $0.tripID == copy.trip.id })
        #expect(Set(copy.items.map(\.id)).isDisjoint(with: [flight.id, stay.id]))
        let flown = copy.items.first { $0.kind == .transit }
        #expect(flown?.transport?.flightNumber == "CX831" && flown?.transport?.confirmation == "ABC123")
        #expect(flown?.cost == 500 && flown?.bookingStatus == .booked)
    }

    @Test func aSharedTripComesBackAsYours() throws {
        var trip = Trip(id: "x", name: "Shared")
        trip.zoneOwner = "someone"
        trip.isShared = true
        let copy = try TripFile.newTrip(from: TripFile.data(trip: trip, items: []))
        #expect(copy.trip.isMine && !copy.trip.isShared)
    }

    @Test func notATripFileThrows() {
        #expect(throws: (any Error).self) { try TripFile.newTrip(from: Data("hello".utf8)) }
    }
}
