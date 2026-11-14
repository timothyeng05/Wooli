import Foundation
import Testing
@testable import Wooli

// The Bookings table's rows (TripBookings).

struct TripBookingsTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "Test", startDay: "2027-04-01", endDay: "2027-04-04")
        trip.legs = [TripLeg(name: "Home", startDay: "2027-04-01", endDay: "2027-04-01", isHome: true),
                     TripLeg(name: "Hangzhou", startDay: "2027-04-02", endDay: "2027-04-04")]
        return trip
    }

    @Test func travelAndStaysAlwaysListed_othersOnlyWithStatusOrCode() {
        let flight = TripItem(tripID: "t", day: "2027-04-01", kind: .transit)
        let stay = TripItem(tripID: "t", day: "2027-04-02", kind: .stay, title: "Hyatt")
        let plain = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Museum")
        var reserved = TripItem(tripID: "t", day: "2027-04-02", kind: .meal, title: "Dinner")
        reserved.setStatus(.booked)
        let rows = TripBookings.rows(trip: trip(), items: [flight, stay, plain, reserved])
        #expect(Set(rows.map(\.id)) == [flight.id, stay.id, reserved.id])
    }

    @Test func flightReadsAsNumberAndRoute() {
        var item = TripItem(tripID: "t", day: "2027-04-01", kind: .transit)
        var t = TripTransport(mode: .flight)
        t.flightNumber = "CX831"; t.fromAirport = "JFK"; t.toAirport = "HKG"; t.confirmation = "ABC123"
        item.transport = t
        let row = TripBookings.row(item, trip: trip())
        #expect(row.what == "CX831 JFK → HKG")
        #expect(row.confirmation == "ABC123")
        #expect(row.kindLabel == "Flight")
    }

    @Test func statusRanksAndCityComeFromTheItem() {
        var stay = TripItem(tripID: "t", day: "2027-04-02", kind: .stay, title: "Hyatt")
        stay.notes = "Not booked yet"
        #expect(TripBookings.row(stay, trip: trip()).statusRank == 0)
        #expect(TripBookings.row(stay, trip: trip()).city == "Hangzhou")
        stay.setStatus(.cancelled)
        #expect(TripBookings.row(stay, trip: trip()).statusRank == 2)
    }

    @Test func summaryAndBadgeIgnoreCancelled() {
        var a = TripItem(tripID: "t", day: "2027-04-01", kind: .transit); a.setStatus(.booked)
        var b = TripItem(tripID: "t", day: "2027-04-02", kind: .stay); b.setStatus(.planned)
        var c = TripItem(tripID: "t", day: "2027-04-03", kind: .stay); c.setStatus(.cancelled)
        let rows = TripBookings.rows(trip: trip(), items: [a, b, c])
        #expect(TripBookings.summary(rows) == "1 of 2 booked")
        #expect(TripBookings.notBookedCount([a, b, c]) == 1)
    }

    private func rows() -> [BookingRow] {
        var flight = TripItem(tripID: "t", day: "2027-04-01", kind: .transit); flight.setStatus(.booked); flight.cost = 500
        flight.transport = TripTransport(mode: .flight)
        var stay = TripItem(tripID: "t", day: "2027-04-02", kind: .stay, title: "Hyatt"); stay.setStatus(.planned)
        var stay2 = TripItem(tripID: "t", day: "2027-04-03", kind: .stay, title: "Inn"); stay2.setStatus(.cancelled)
        return TripBookings.rows(trip: trip(), items: [flight, stay, stay2])
    }

    @Test func headerCountsSplitStatusAndMissingPrices() {
        let c = TripBookings.headerCounts(rows())
        #expect(c == TripBookings.HeaderCounts(booked: 1, needBooking: 2, notBooked: 1, cancelled: 1, withoutPrice: 1))
    }

    @Test func groupingKeepsFirstSeenOrderAndRowsTogether() {
        let groups = TripBookings.grouped(rows(), by: .type)
        #expect(groups.map(\.label) == ["Flight", "Stay"])
        #expect(groups[1].rows.count == 2)
        #expect(TripBookings.grouped(rows(), by: .none).count == 1)
        #expect(TripBookings.grouped(rows(), by: .status).map(\.label) == ["Booked", "Not booked", "Cancelled"])
    }
}
