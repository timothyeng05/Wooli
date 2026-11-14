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

    @Test func codesMenuListsOnlyLiveBookingsWithCodes() {
        let items = [flight("2027-04-01", number: "CX1", from: "JFK", to: "HKG", code: "ABC123"),
                     flight("2027-04-02", number: "CX2", from: "HKG", to: "HGH", code: "ZZZ999", status: .cancelled),
                     flight("2027-04-03", number: "CA3", from: "HGH", to: "PEK")]
        let rows = BookingsList.withCodes(BookingsList.rows(trip: trip(), items: items))
        #expect(rows.map(\.confirmation) == ["ABC123"])
    }
}

// The confirmation reader (M2-3).

struct BookingImportTests {
    private let flightEmail = """
    Your trip is confirmed
    Booking reference: X7K2PQ
    Monday, 12 April 2027
    CX831  Depart 09:30  JFK  New York
    Arrive 14:05 +1  HKG  Hong Kong
    Economy
    Total price: USD 1,284.50
    """

    @Test func readsAFlightEmail() {
        let found = BookingImport.read(flightEmail, defaultYear: 2027)
        #expect(found.count == 1)
        let f = found[0]
        #expect(f.flightNumber == "CX831")
        #expect(f.from == "JFK" && f.to == "HKG")
        #expect(f.day == "2027-04-12")
        #expect(f.time == 9 * 60 + 30)
        #expect(f.arriveTime == 14 * 60 + 5 && f.arriveDayOffset == 1)
        #expect(f.confirmation == "X7K2PQ")
        #expect(f.price == 1284.5 && f.currency == "USD")
    }

    @Test func aRoundTripGivesTwoFlightsOnTheRightDays() {
        let text = """
        Confirmation code: ABC123
        Outbound  Apr 12, 2027
        CX831 JFK to HKG 09:30 - 14:05
        Return  Apr 20, 2027
        CX830 HKG to JFK 23:55 - 06:10
        """
        let found = BookingImport.read(text, defaultYear: 2027)
        #expect(found.map(\.flightNumber) == ["CX831", "CX830"])
        #expect(found.map(\.day) == ["2027-04-12", "2027-04-20"])
        #expect(found.allSatisfy { $0.confirmation == "ABC123" })
    }

    @Test func readsAHotel() {
        let text = """
        Reservation number 8841205
        Hyatt Regency Hangzhou
        Check-in: 3 Apr 2027 from 15:00
        Check-out: 5 Apr 2027
        Total CNY 2,400
        """
        let found = BookingImport.read(text, defaultYear: 2027)
        #expect(found.count == 1)
        #expect(found[0].kind == .stay)
        #expect(found[0].title == "Hyatt Regency Hangzhou")
        #expect(found[0].day == "2027-04-03" && found[0].checkOutDay == "2027-04-05")
        #expect(found[0].confirmation == "8841205")
        #expect(found[0].currency == "CNY")
    }

    @Test func aDateWithoutAYearUsesTheTripsYear() {
        let dates = BookingImport.findDates(in: "Depart 5 May", year: 2028)
        #expect(dates.first?.day == "2028-05-05")
    }

    @Test func importedPlansAreBookedAndMarkedAsImports() {
        var b = ImportedBooking()
        b.flightNumber = "CX831"; b.from = "JFK"; b.to = "HKG"; b.day = "2027-04-12"; b.confirmation = "X7K2PQ"
        let item = b.tripItem(tripID: "t")
        #expect(item.bookingStatus == .booked)
        #expect(item.extras?.source == "import")
        #expect(item.transport?.confirmation == "X7K2PQ")
        #expect(item.title == "CX831 JFK → HKG")
    }

    @Test func warnsWhenTheDateIsOutsideTheTrip() {
        let trip = Trip(id: "t", startDay: "2027-04-01", endDay: "2027-04-05")
        var b = ImportedBooking()
        b.day = "2027-06-01"
        #expect(b.warning(trip: trip) != nil)
        b.day = "2027-04-02"
        #expect(b.warning(trip: trip) == nil)
    }

    @Test func nothingFoundInPlainText() {
        #expect(BookingImport.read("Hello, see you soon", defaultYear: 2027).isEmpty)
    }
}

// Reading dropped files (M2-3).

struct BookingFilesTests {
    @Test func readsAPlainEmail() {
        let raw = "Subject: Your flight\r\nContent-Type: text/plain\r\n\r\nCX831 JFK to HKG\r\nBooking reference: X7K2PQ"
        let text = BookingFiles.emlText(raw)
        #expect(text.contains("Your flight"))
        #expect(text.contains("X7K2PQ"))
    }

    @Test func prefersThePlainPartOfAMultipartEmail() {
        let raw = """
        Subject: Hotel
        Content-Type: multipart/alternative; boundary="BB"

        --BB
        Content-Type: text/plain

        Check-in: 3 Apr 2027
        --BB
        Content-Type: text/html

        <p>Check-in: 3 Apr 2027</p><p>Extra</p>
        --BB--
        """
        let text = BookingFiles.emlText(raw)
        #expect(text.contains("Check-in: 3 Apr 2027"))
        #expect(!text.contains("<p>"))
        #expect(!text.contains("Extra"))
    }

    @Test func decodesQuotedPrintableAndHTML() {
        #expect(BookingFiles.decodeQuotedPrintable("Caf=C3=A9 booking=\nref") == "Café bookingref")
        #expect(BookingFiles.stripHTML("<div>Total&nbsp;<b>$40</b></div>").contains("Total"))
    }

    @Test func decodesBase64Bodies() {
        let body = Data("Booking reference: ZZ99AA".utf8).base64EncodedString()
        let raw = "Subject: x\nContent-Type: text/plain\nContent-Transfer-Encoding: base64\n\n\(body)"
        #expect(BookingFiles.emlText(raw).contains("ZZ99AA"))
    }
}

// Importing the same confirmation twice (M2-3).

struct BookingImportDuplicateTests {
    private func booking() -> ImportedBooking {
        var b = ImportedBooking()
        b.flightNumber = "CX831"; b.from = "JFK"; b.to = "HKG"; b.day = "2027-04-12"; b.confirmation = "X7K2PQ"; b.time = 570
        return b
    }

    @Test func theSameFlightOnTheSameDayIsADuplicate() {
        let saved = booking().tripItem(tripID: "t")
        #expect(BookingImport.duplicate(of: booking(), in: [saved])?.id == saved.id)
        var other = booking(); other.day = "2027-04-13"
        #expect(BookingImport.duplicate(of: other, in: [saved]) == nil)
    }

    @Test func updatingKeepsTheIdAndNotes() {
        var saved = TripItem(tripID: "t", day: "2027-04-12", kind: .transit, title: "Flight to HK")
        saved.transport = { var t = TripTransport(mode: .flight); t.flightNumber = "CX831"; return t }()
        saved.notes = "Not booked yet · aisle seat"
        saved.setStatus(.planned)
        saved.notes = "aisle seat"
        let updated = booking().updating(saved)
        #expect(updated.id == saved.id)
        #expect(updated.notes == "aisle seat")
        #expect(updated.transport?.confirmation == "X7K2PQ")
        #expect(updated.bookingStatus == .booked)
    }

    @Test func aStaysDuplicateNeedsTheSameNameAndCheckIn() {
        var b = ImportedBooking(); b.kind = .stay; b.title = "Hyatt Regency Hangzhou"; b.day = "2027-04-03"
        let saved = b.tripItem(tripID: "t")
        #expect(BookingImport.duplicate(of: b, in: [saved]) != nil)
        b.title = "Another Hotel"
        #expect(BookingImport.duplicate(of: b, in: [saved]) == nil)
    }
}

// Trip export (M2-5).

struct TripExportTests {
    private func sample() -> (Trip, [TripItem]) {
        var trip = Trip(id: "t", name: "Spring in China", startDay: "2027-04-01", endDay: "2027-04-03")
        trip.legs = [TripLeg(name: "Hong Kong", startDay: "2027-04-01", endDay: "2027-04-02"),
                     TripLeg(name: "Hangzhou", startDay: "2027-04-02", endDay: "2027-04-03")]
        var t = TripTransport(mode: .flight)
        t.flightNumber = "CX831"; t.fromAirport = "JFK"; t.toAirport = "HKG"; t.confirmation = "X7K2PQ"; t.seats = "12A"
        var flight = TripItem(tripID: "t", day: "2027-04-01", kind: .transit, title: "CX831 JFK → HKG", time: 570)
        flight.transport = t
        var hotel = TripItem(tripID: "t", day: "2027-04-02", kind: .stay, title: "Hyatt Regency Hangzhou")
        hotel.checkOutDay = "2027-04-03"
        hotel.cost = 400; hotel.currency = "USD"
        hotel.notes = "Late check-in"
        var cancelled = TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "Cancelled tour")
        cancelled.setStatus(.cancelled)
        let slot = TripItem(tripID: "t", day: "2027-04-02", kind: .meal, title: "Lunch", time: 750)
        return (trip, [flight, hotel, cancelled, slot])
    }

    @Test func textHasCitiesDaysAndConfirmationCodes() {
        let (trip, items) = sample()
        let text = TripExport.itinerary(trip: trip, items: items)
        #expect(text.contains("SPRING IN CHINA"))
        #expect(text.contains("Hong Kong → Hangzhou"))
        #expect(text.contains("Confirmation X7K2PQ"))
        #expect(text.contains("Seat 12A"))
        #expect(text.contains("Hyatt Regency Hangzhou"))
        #expect(text.contains("Late check-in"))
        #expect(!text.contains("Cancelled tour"))
        #expect(!text.contains("Lunch"))
    }

    @Test func costsAreOffUnlessAsked() {
        let (trip, items) = sample()
        #expect(!TripExport.itinerary(trip: trip, items: items).contains("$400"))
        #expect(TripExport.itinerary(trip: trip, items: items, options: ExportOptions(costs: true)).contains("400"))
    }

    @Test func markdownUsesHeadingsAndBullets() {
        let (trip, items) = sample()
        let md = TripExport.itinerary(trip: trip, items: items, options: ExportOptions(markdown: true))
        #expect(md.hasPrefix("# Spring in China"))
        #expect(md.contains("## Hong Kong"))
        #expect(md.contains("- "))
    }

    @Test func notesCanBeLeftOut() {
        let (trip, items) = sample()
        #expect(!TripExport.itinerary(trip: trip, items: items, options: ExportOptions(notes: false)).contains("Late check-in"))
    }
}

struct TripCalendarFileTests {
    @Test func flightsCarryEachEndsTimeZone() {
        var t = TripTransport(mode: .flight)
        t.flightNumber = "CX831"; t.fromAirport = "JFK"; t.toAirport = "HKG"; t.arriveTime = 14 * 60 + 5; t.arriveDayOffset = 1
        var flight = TripItem(tripID: "t", day: "2027-04-12", kind: .transit, title: "CX831 JFK → HKG", time: 9 * 60 + 30)
        flight.transport = t
        let trip = Trip(id: "t", name: "Trip", startDay: "2027-04-12", endDay: "2027-04-15")
        let ics = TripExport.calendar(trip: trip, items: [flight])
        #expect(ics.contains("BEGIN:VCALENDAR") && ics.contains("END:VCALENDAR"))
        #expect(ics.contains("DTSTART;TZID=America/New_York:20270412T093000"))
        #expect(ics.contains("DTEND;TZID=Asia/Hong_Kong:20270413T140500"))
        #expect(ics.contains("\r\n"))
    }

    @Test func staysAreAllDaySpansAndCancelledOrUntimedPlansAreSkipped() {
        var hotel = TripItem(tripID: "t", day: "2027-04-12", kind: .stay, title: "Hyatt, Hangzhou")
        hotel.checkOutDay = "2027-04-14"
        let untimed = TripItem(tripID: "t", day: "2027-04-12", kind: .activity, title: "Wander")
        var cancelled = TripItem(tripID: "t", day: "2027-04-12", kind: .stay, title: "Gone")
        cancelled.setStatus(.cancelled)
        let trip = Trip(id: "t", name: "Trip", startDay: "2027-04-12", endDay: "2027-04-15")
        let ics = TripExport.calendar(trip: trip, items: [hotel, untimed, cancelled])
        #expect(ics.contains("DTSTART;VALUE=DATE:20270412"))
        #expect(ics.contains("DTEND;VALUE=DATE:20270414"))
        #expect(ics.contains("SUMMARY:Stay: Hyatt\\, Hangzhou"))
        #expect(!ics.contains("Wander") && !ics.contains("Gone"))
    }
}
