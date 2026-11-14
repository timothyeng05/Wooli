import Foundation
import Testing
@testable import Wooli

// Leg time zones (TripTimeZones) and the .ics that uses them.

struct TripTimeZonesTests {
    private let tokyo = TimeZone(identifier: "Asia/Tokyo")!
    private let honolulu = TimeZone(identifier: "Pacific/Honolulu")!
    private let madrid = TimeZone(identifier: "Europe/Madrid")!
    private let newYork = TimeZone(identifier: "America/New_York")!

    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-10")
        var jp = TripLeg(name: "Tokyo", startDay: "2027-04-01", endDay: "2027-04-02"); jp.timeZoneID = "Asia/Tokyo"
        var hi = TripLeg(name: "Honolulu", startDay: "2027-04-02", endDay: "2027-04-10"); hi.timeZoneID = "Pacific/Honolulu"
        trip.legs = [jp, hi]
        return trip
    }

    @Test func westboundDateLineFlightLandsEarlierOnTheClockButLaterInTime() throws {
        // Leaves Tokyo 18:00 on Apr 2, lands Honolulu 07:00 the same calendar day: 8 hours in the air.
        let out = try #require(TripTimeZones.instant(day: "2027-04-02", minutes: 18 * 60, zone: tokyo))
        let back = try #require(TripTimeZones.instant(day: "2027-04-02", minutes: 7 * 60, zone: honolulu))
        #expect(back.timeIntervalSince(out) == 8 * 3600)
    }

    @Test func travelDayUsesLeavingZoneForDepartureAndArrivingZoneForArrival() {
        #expect(TripTimeZones.zone(on: "2027-04-02", in: trip())?.identifier == "Asia/Tokyo")
        #expect(TripTimeZones.zone(on: "2027-04-02", in: trip(), arriving: true)?.identifier == "Pacific/Honolulu")
    }

    @Test func overnightFlightInTheCalendarFileEndsInTheArrivalZone() {
        var item = TripItem(tripID: "t", day: "2027-04-01", kind: .transit, time: 22 * 60)
        var t = TripTransport(mode: .flight)
        t.arriveTime = 9 * 60; t.arriveDayOffset = 1   // lands Apr 2, 09:00 Honolulu time
        item.transport = t
        let out = TripExport.ics(trip: trip(), items: [item], stamp: Date(timeIntervalSince1970: 0))
        #expect(out.contains("DTSTART:20270401T130000Z"))   // 22:00 JST
        #expect(out.contains("DTEND:20270402T190000Z"))     // 09:00 HST
    }

    @Test func headerNoteAppearsOnlyWhenTheZoneChanges() {
        let note = TripTimeZones.headerNote(trip: trip(), day: "2027-04-02", home: newYork)
        #expect(note?.contains("from home") == true)
        #expect(TripTimeZones.headerNote(trip: trip(), day: "2027-04-05", home: newYork) == nil)
        // Same zone as the previous city: nothing to say.
        var same = trip(); same.legs[1].timeZoneID = "Asia/Tokyo"
        #expect(TripTimeZones.headerNote(trip: same, day: "2027-04-02", home: tokyo) == nil)
    }

    @Test func offsetIsMeasuredFromHomeNotFromTheDevice() {
        let date = DateComponents(calendar: .init(identifier: .gregorian), timeZone: .gmt, year: 2027, month: 1, day: 15, hour: 12).date!
        #expect(TripTimeZones.offsetHours(of: madrid, from: newYork, at: date) == 6)
        #expect(TripTimeZones.offsetHours(of: newYork, from: madrid, at: date) == -6)
        #expect(TripTimeZones.offsetText(6) == "+6 h")
        #expect(TripTimeZones.offsetText(-5.5) == "−5½ h")
        #expect(TripTimeZones.offsetText(0) == "same time")
    }
}
