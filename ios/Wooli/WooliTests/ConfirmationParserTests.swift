import Foundation
import Testing
@testable import Wooli

// Reading pasted confirmation text without Apple Intelligence (ConfirmationParser).

struct ConfirmationParserTests {
    private let known: Set<String> = ["JFK", "HKG", "LHR"]
    private func parse(_ text: String) -> [ParsedBooking] {
        ConfirmationParser.parse(text, referenceYear: 2027, isAirport: { known.contains($0) })
    }

    @Test func oneFlightWithEverything() {
        let text = """
        Your booking is confirmed.
        Booking reference: ABC123
        CX831  JFK -> HKG
        Fri, Apr 9, 2027  7:45 PM
        Total: USD 1,284.50
        """
        let b = parse(text)
        #expect(b.count == 1)
        #expect(b[0].flightNumber == "CX831")
        #expect(b[0].from == "JFK" && b[0].to == "HKG")
        #expect(b[0].day == "2027-04-09")
        #expect(b[0].departMinutes == 19 * 60 + 45)
        #expect(b[0].confirmation == "ABC123")
        #expect(b[0].amount == 1284.50 && b[0].currency == "USD")
    }

    @Test func twoFlightsSplitByFlightNumber() {
        let text = "CX831 JFK HKG 2027-04-01 10:00  BA 26 HKG LHR 2027-04-15 23:30"
        let b = parse(text)
        #expect(b.map(\.flightNumber) == ["CX831", "BA26"])
        #expect(b[1].from == "HKG" && b[1].to == "LHR")
        #expect(b[1].day == "2027-04-15")
    }

    @Test func dayWithoutYearUsesTheReferenceYear() {
        #expect(ConfirmationParser.day(in: "Departs 9 April", referenceYear: 2027) == "2027-04-09")
        #expect(ConfirmationParser.day(in: "Market 12 sale", referenceYear: 2027) == nil)
    }

    @Test func timesHandleAmPm() {
        #expect(ConfirmationParser.minutes(in: "12:05 AM") == 5)
        #expect(ConfirmationParser.minutes(in: "12:05 PM") == 12 * 60 + 5)
        #expect(ConfirmationParser.minutes(in: "at 19:45") == 19 * 60 + 45)
    }

    @Test func plainWordsAreNotConfirmationCodes() {
        #expect(ConfirmationParser.confirmationCode(in: "Confirmation number: ABC123") == "ABC123")
        #expect(ConfirmationParser.confirmationCode(in: "Reference details attached") == nil)
    }

    @Test func totalReadsSymbolsAndTrailingCodes() {
        #expect(ConfirmationParser.total(in: "Total paid $420")?.currency == "USD")
        #expect(ConfirmationParser.total(in: "Total 38,000 JPY")?.amount == 38000)
        #expect(ConfirmationParser.total(in: "no price here") == nil)
    }

    @Test func nothingFoundWithoutAFlightNumber() {
        #expect(parse("Hotel Hyatt, 3 nights, Apr 2 2027").isEmpty)
    }

    @Test func hotelStayWithCheckInAndOut() {
        let text = """
        Booking confirmation
        Hyatt Regency Hangzhou
        Confirmation number: HZ4821
        Check-in: Apr 2, 2027  3:00 PM
        Check-out: Apr 5, 2027
        Total: USD 640
        """
        let b = parse(text)
        #expect(b.count == 1)
        #expect(b[0].kind == .stay)
        #expect(b[0].name == "Hyatt Regency Hangzhou")
        #expect(b[0].day == "2027-04-02" && b[0].checkOutDay == "2027-04-05")
        #expect(b[0].departMinutes == 15 * 60)
        #expect(b[0].confirmation == "HZ4821" && b[0].amount == 640)
    }

    @Test func flightsComeBeforeAStayInTheSameText() {
        let text = "CX831 JFK HKG 2027-04-01 10:00\nHotel Peninsula\nCheck-in 2027-04-02\nCheck-out 2027-04-04"
        let b = parse(text)
        #expect(b.map(\.kind) == [.flight, .stay])
        #expect(b[1].checkOutDay == "2027-04-04")
    }
}
