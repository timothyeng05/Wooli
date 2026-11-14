import Foundation
import Testing
@testable import Wooli

// The Bookings page (M2-2): rows, header line, filters.

struct BookingsListTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "Test", startDay: "2027-04-01", endDay: "2027-04-05")
        trip.legs = [TripLeg(name: "Hong Kong", startDay: "2027-04-01", endDay: "2027-04-03"),
                     TripLeg(name: "Hangzhou", startDay: "2027-04-03", endDay: "2027-04-05")]
        return trip
    }

    private func flight(_ day: String, number: String, from: String, to: String, code: String = "",
                        status: BookingStatus? = nil, time: Int? = 600) -> TripItem {
        var t = TripTransport(mode: .flight)
        t.flightNumber = number
        t.fromAirport = from
        t.toAirport = to
        t.confirmation = code
        var item = TripItem(tripID: "t", day: day, kind: .transit, title: "Flight", time: time)
        item.transport = t
        item.setStatus(status)
        return item
    }

    private func stay(_ day: String, out: String?, title: String = "Hotel", status: BookingStatus? = nil) -> TripItem {
        var item = TripItem(tripID: "t", day: day, kind: .stay, title: title)
        item.checkOutDay = out
        item.setStatus(status)
        return item
    }

    @Test func rowsCoverTravelAndStaysAndSortByWhen() {
        let items = [stay("2027-04-02", out: "2027-04-04"),
                     flight("2027-04-01", number: "CX831", from: "JFK", to: "HKG"),
                     TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Peak"),
                     TripItem(tripID: "t", day: "2027-04-02", kind: .meal, title: "Lunch")]
        let rows = BookingsList.rows(trip: trip(), items: items)
        #expect(rows.count == 2)
        #expect(rows[0].what == "CX831 JFK → HKG")
        #expect(rows[0].city == "Hong Kong")
        #expect(rows[1].what == "Hotel")
        #expect(rows[1].untilText.isEmpty == false)
    }

    @Test func anActivityWithAStatusIsABooking() {
        var item = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Tea ceremony")
        item.setStatus(.booked)
        #expect(BookingsList.isBooking(item))
    }

    @Test func overnightFlightArrivesNextDay() {
        var item = flight("2027-04-01", number: "CX831", from: "JFK", to: "HKG")
        item.transport?.arriveDayOffset = 1
        item.transport?.arriveTime = 5 * 60
        #expect(BookingsList.untilDay(item) == "2027-04-02")
    }

    @Test func summaryCountsBookedNightsAndTravelDays() {
        let items = [flight("2027-04-01", number: "CX1", from: "JFK", to: "HKG", status: .booked),
                     flight("2027-04-03", number: "CA2", from: "HKG", to: "HGH", status: .planned),
                     stay("2027-04-01", out: "2027-04-03", status: .booked),
                     stay("2027-04-03", out: "2027-04-04", status: .cancelled)]
        let rows = BookingsList.rows(trip: trip(), items: items)
        let s = BookingsList.summary(trip: trip(), rows: rows)
        #expect(s.total == 3)          // the cancelled stay doesn't count
        #expect(s.booked == 2)
        #expect(s.travelDaysNotBooked == 1)
        // Nights Apr 1-4 exist; Apr 1 and 2 are covered; Apr 3 (cancelled) and Apr 4 are not.
        #expect(s.nightsWithoutBed == 2)
    }

    @Test func notBookedPrefixStillReadsAsNotBooked() {
        var item = stay("2027-04-01", out: "2027-04-02")
        item.notes = "Not booked yet · ask about breakfast"
        let row = BookingsList.row(item, trip: trip())
        #expect(row.status == .planned)
        #expect(BookingsList.notBookedCount(trip: trip(), items: [item]) == 1)
    }

    @Test func filtersAndSearch() {
        let items = [flight("2027-04-01", number: "CX1", from: "JFK", to: "HKG", code: "ABC123", status: .booked),
                     flight("2027-04-03", number: "CA2", from: "HKG", to: "HGH", status: .planned)]
        let rows = BookingsList.rows(trip: trip(), items: items)
        #expect(BookingsList.apply(.notBooked, search: "", to: rows).count == 1)
        #expect(BookingsList.apply(.all, search: "abc123", to: rows).count == 1)
        #expect(BookingsList.apply(.noPrice, search: "", to: rows).count == 2)
        #expect(BookingsList.apply(.travelNotBooked, search: "hgh", to: rows).first?.what == "CA2 HKG → HGH")
    }

    @Test func copyAsTextHasOneLinePerBooking() {
        let rows = BookingsList.rows(trip: trip(), items: [flight("2027-04-01", number: "CX1", from: "JFK", to: "HKG", code: "ABC123")])
        let text = BookingsList.text(rows)
        #expect(text.contains("Confirmation ABC123"))
        #expect(!text.contains("\n"))
    }
}
