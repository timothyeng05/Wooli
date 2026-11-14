import Foundation
import Testing
@testable import Wooli

// Trip warnings (TripChecks).

struct TripChecksTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-06")
        var seville = TripLeg(name: "Seville", startDay: "2027-04-01", endDay: "2027-04-03")
        seville.latitude = 37.39; seville.longitude = -5.99
        var madrid = TripLeg(name: "Madrid", startDay: "2027-04-03", endDay: "2027-04-06")
        madrid.latitude = 40.42; madrid.longitude = -3.70
        trip.legs = [seville, madrid]
        return trip
    }

    private func flight(_ day: String, depart: Int, arrive: Int, offset: Int = 0, number: String = "XX100") -> TripItem {
        var item = TripItem(tripID: "t", day: day, kind: .transit, time: depart)
        var t = TripTransport(mode: .flight)
        t.flightNumber = number; t.arriveTime = arrive; t.arriveDayOffset = offset
        item.transport = t
        return item
    }

    @Test func aCleanTripHasNoWarnings() {
        let walk = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Walk")
        #expect(TripChecks.warnings(trip: trip(), items: [walk, flight("2027-04-03", depart: 600, arrive: 700)]).isEmpty)
    }

    @Test func datedOutsideTheTrip() {
        let early = TripItem(tripID: "t", day: "2027-03-30", kind: .activity, title: "Early")
        let w = TripChecks.warnings(trip: trip(), items: [early])
        #expect(w.map(\.kind) == [.outsideTrip])
    }

    @Test func farActivityWarnsButTravelDoesNot() {
        var far = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Prado")
        far.place = TripPlace(name: "Prado", latitude: 40.41, longitude: -3.69)   // Madrid, on a Seville day
        var near = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Cathedral")
        near.place = TripPlace(name: "Cathedral", latitude: 37.386, longitude: -5.993)
        var train = TripItem(tripID: "t", day: "2027-04-02", kind: .transit)
        train.place = far.place
        let w = TripChecks.warnings(trip: trip(), items: [far, near, train])
        #expect(w.map(\.kind) == [.farFromCity] && w[0].itemID == far.id)
    }

    @Test func overlappingFixedTimes() {
        var a = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Tour", time: 600)
        a.extras = ItemExtras(); a.extras?.endTime = 720
        var b = TripItem(tripID: "t", day: "2027-04-02", kind: .meal, title: "Lunch", time: 700)
        b.extras = ItemExtras(); b.extras?.endTime = 800
        var c = TripItem(tripID: "t", day: "2027-04-02", kind: .meal, title: "Dinner", time: 1100)
        c.extras = ItemExtras(); c.extras?.endTime = 1200
        #expect(TripChecks.overlaps([a, b, c]).count == 1)
    }

    @Test func tightAndImpossibleConnections() {
        let first = flight("2027-04-03", depart: 600, arrive: 700, number: "AA1")
        let tight = flight("2027-04-03", depart: 760, arrive: 900, number: "AA2")     // 60 min after landing
        let late = flight("2027-04-03", depart: 800, arrive: 1000, number: "AA3")
        #expect(TripChecks.connections([first, tight]).map(\.kind) == [.tightConnection])
        #expect(TripChecks.connections([first, flight("2027-04-03", depart: 650, arrive: 800)]).map(\.kind) == [.arrivesAfterDeparture])
        #expect(TripChecks.connections([first, late]).isEmpty)
    }

    @Test func overnightFlightIsMeasuredAcrossMidnight() {
        let red = flight("2027-04-01", depart: 22 * 60, arrive: 6 * 60, offset: 1)
        let next = flight("2027-04-02", depart: 6 * 60 + 30, arrive: 9 * 60)
        #expect(TripChecks.connections([red, next]).map(\.kind) == [.tightConnection])
    }

    @Test func stayChecksOutAfterTheCityEnds() {
        var stay = TripItem(tripID: "t", day: "2027-04-01", kind: .stay, title: "Hotel")
        stay.checkOutDay = "2027-04-04"
        #expect(TripChecks.stays(trip(), [stay]).map(\.kind) == [.stayPastCity])
    }

    @Test func overlappingStays() {
        var a = TripItem(tripID: "t", day: "2027-04-01", kind: .stay, title: "A"); a.checkOutDay = "2027-04-03"
        var b = TripItem(tripID: "t", day: "2027-04-02", kind: .stay, title: "B"); b.checkOutDay = "2027-04-03"
        #expect(TripChecks.stays(trip(), [a, b]).contains { $0.kind == .stayOverlap })
    }

    @Test func ignoredWarningsStayIgnored() {
        var early = TripItem(tripID: "t", day: "2027-03-30", kind: .activity, title: "Early")
        let id = TripChecks.warnings(trip: trip(), items: [early])[0].id
        early.extras = ItemExtras(); early.extras?.ignoredWarnings = [id]
        #expect(TripChecks.warnings(trip: trip(), items: [early]).isEmpty)
    }
}
