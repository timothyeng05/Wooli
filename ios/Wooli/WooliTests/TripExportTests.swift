import Foundation
import Testing
@testable import Wooli

// Text, Markdown and calendar export (TripExport).

struct TripExportTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "China", startDay: "2027-04-01", endDay: "2027-04-03")
        trip.legs = [TripLeg(name: "Hangzhou", startDay: "2027-04-01", endDay: "2027-04-03")]
        return trip
    }

    private func flight() -> TripItem {
        var item = TripItem(tripID: "t", day: "2027-04-01", kind: .transit, time: 10 * 60)
        var t = TripTransport(mode: .flight)
        t.flightNumber = "CX831"; t.fromAirport = "JFK"; t.toAirport = "HKG"; t.confirmation = "ABC123"
        t.arriveTime = 14 * 60; t.arriveDayOffset = 1
        item.transport = t
        return item
    }

    @Test func textHasDaysCodesAndSkipsCancelled() {
        var gone = TripItem(tripID: "t", day: "2027-04-01", kind: .activity, title: "Cancelled tour")
        gone.setStatus(.cancelled)
        let out = TripExport.text(trip: trip(), items: [flight(), gone])
        #expect(out.hasPrefix("China\n"))
        #expect(out.contains("Thu, Apr 1 · Hangzhou"))
        #expect(out.contains("CX831 JFK → HKG"))
        #expect(out.contains("Confirmation ABC123"))
        #expect(!out.contains("Cancelled tour"))
    }

    @Test func markdownUsesHeadingsAndBullets() {
        let out = TripExport.text(trip: trip(), items: [flight()], markdown: true)
        #expect(out.hasPrefix("# China\n"))
        #expect(out.contains("## Thu, Apr 1"))
        #expect(out.contains("- "))
    }

    @Test func ideasGoLast() {
        let idea = TripItem(tripID: "t", day: nil, kind: .activity, title: "Tiger Leaping Gorge")
        let out = TripExport.text(trip: trip(), items: [idea, flight()])
        #expect(out.range(of: "Ideas")!.lowerBound > out.range(of: "CX831")!.lowerBound)
        #expect(out.contains("Tiger Leaping Gorge"))
    }

    @Test func icsFlightEndsAtArrivalNextDay() {
        let out = TripExport.ics(trip: trip(), items: [flight()], stamp: Date(timeIntervalSince1970: 0))
        #expect(out.hasPrefix("BEGIN:VCALENDAR\r\n"))
        #expect(out.contains("DTSTART:20270401T100000"))
        #expect(out.contains("DTEND:20270402T140000"))
        #expect(out.contains("DTSTAMP:19700101T000000Z"))
        #expect(out.hasSuffix("END:VCALENDAR\r\n"))
    }

    @Test func icsStayIsAllDayAndTextIsEscaped() {
        var stay = TripItem(tripID: "t", day: "2027-04-01", kind: .stay, title: "Hyatt, West Lake")
        stay.checkOutDay = "2027-04-03"
        let out = TripExport.ics(trip: trip(), items: [stay])
        #expect(out.contains("DTSTART;VALUE=DATE:20270401"))
        #expect(out.contains("DTEND;VALUE=DATE:20270403"))
        #expect(out.contains("SUMMARY:Hyatt\\, West Lake"))
    }

    @Test func untimedPlansAreAllDayAndIdeasAreLeftOut() {
        let walk = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Walk")
        let idea = TripItem(tripID: "t", day: nil, kind: .activity, title: "Someday")
        let out = TripExport.ics(trip: trip(), items: [walk, idea])
        #expect(out.contains("DTSTART;VALUE=DATE:20270402"))
        #expect(out.contains("DTEND;VALUE=DATE:20270403"))
        #expect(!out.contains("Someday"))
    }
}
