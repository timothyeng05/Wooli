import Foundation
import Testing
@testable import Wooli

// Duplicate a trip as a template (TripTemplate).

struct TripTemplateTests {
    private func source() -> (Trip, [TripItem]) {
        var trip = Trip(id: "old", name: "Spain", startDay: "2026-05-01", endDay: "2026-05-04")
        trip.legs = [TripLeg(name: "Seville", startDay: "2026-05-01", endDay: "2026-05-04")]
        trip.legs[0].timeZoneID = "Europe/Madrid"
        trip.extras.budget = 3000
        trip.extras.checklist = [ChecklistItem(title: "Passport", done: true)]
        var flight = TripItem(tripID: "old", day: "2026-05-01", kind: .transit, time: 600); flight.cost = 500
        var hotel = TripItem(tripID: "old", day: "2026-05-01", kind: .stay, title: "Hotel"); hotel.cost = 400
        var walk = TripItem(tripID: "old", day: "2026-05-02", kind: .activity, title: "Cathedral"); walk.cost = 15
        walk.notes = "Not booked yet · go early"
        var tour = TripItem(tripID: "old", day: "2026-05-03", kind: .activity, title: "Tour", time: 600)
        let idea = TripItem(tripID: "old", day: nil, kind: .activity, title: "Alcázar")
        return (trip, [flight, hotel, walk, tour, idea])
    }

    @Test func keepsCitiesIdeasAndUntimedPlansOnly() {
        let (trip, items) = source()
        let copy = TripTemplate.make(from: trip, items: items, newStart: "2027-09-10")
        #expect(Set(copy.items.map(\.title)) == ["Cathedral", "Alcázar"])
        #expect(copy.trip.legs.map(\.name) == ["Seville"] && copy.trip.legs[0].timeZoneID == "Europe/Madrid")
    }

    @Test func shiftsDatesAndMakesNewIds() {
        let (trip, items) = source()
        let copy = TripTemplate.make(from: trip, items: items, newStart: "2027-09-10")
        #expect(copy.trip.startDay == "2027-09-10" && copy.trip.endDay == "2027-09-13")
        #expect(copy.trip.legs[0].startDay == "2027-09-10" && copy.trip.legs[0].endDay == "2027-09-13")
        let cathedral = copy.items.first { $0.title == "Cathedral" }
        #expect(cathedral?.day == "2027-09-11")
        #expect(copy.trip.id != "old" && copy.items.allSatisfy { $0.tripID == copy.trip.id })
        #expect(copy.items.first { $0.title == "Alcázar" }?.day == nil)
    }

    @Test func dropsPricesAndBookingHistoryButKeepsBudgetAndATidyChecklist() {
        let (trip, items) = source()
        let copy = TripTemplate.make(from: trip, items: items, newStart: "2027-09-10")
        let cathedral = copy.items.first { $0.title == "Cathedral" }
        #expect(cathedral?.cost == nil && cathedral?.bookingStatus == nil && cathedral?.notes == "go early")
        #expect(copy.trip.extras.budget == 3000)
        #expect(copy.trip.extras.checklist?.first?.title == "Passport" && copy.trip.extras.checklist?.first?.done == false)
        #expect(copy.trip.name == "Spain copy")
    }

    @Test func aSharedTripBecomesYoursAndStaysUnshared() {
        var (trip, items) = source()
        trip.zoneOwner = "someone"; trip.isShared = true
        let copy = TripTemplate.make(from: trip, items: items, newStart: trip.startDay, name: "Spain again")
        #expect(copy.trip.isMine && !copy.trip.isShared && copy.trip.name == "Spain again")
    }
}
