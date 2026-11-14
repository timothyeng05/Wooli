import Foundation
import Testing
@testable import Wooli

// The "Plan with Claude" prompt (PlanPrompt).

struct PlanPromptTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "Seville", startDay: "2026-12-27", endDay: "2026-12-29")
        trip.legs = [TripLeg(name: "Seville", startDay: "2026-12-27", endDay: "2026-12-29")]
        return trip
    }

    @Test func namesTheTripCitiesAndWhatIsBooked() {
        var hotel = TripItem(tripID: "t", day: "2026-12-27", kind: .stay, title: "Hotel Alfonso"); hotel.checkOutDay = "2026-12-29"
        hotel.setStatus(.booked)
        let out = PlanPrompt.make(trip: trip(), items: [hotel])
        #expect(out.hasPrefix("Help me plan Seville"))
        #expect(out.contains("Cities: Seville (2 nights)."))
        #expect(out.contains("Already booked: Hotel Alfonso."))
        #expect(out.contains("wooli_trips"))
    }

    @Test func listsWhatIsStillOpenAndUnscheduledIdeas() {
        let idea = TripItem(tripID: "t", day: nil, kind: .activity, title: "Alcázar")
        let out = PlanPrompt.make(trip: trip(), items: [idea])
        #expect(out.contains("Still open:"))
        #expect(out.contains("- No bed"))
        #expect(out.contains("Ideas I haven't scheduled: Alcázar."))
    }

    @Test func unbookedTravelIsNotCalledBooked() {
        var train = TripItem(tripID: "t", day: "2026-12-28", kind: .transit, title: "Train"); train.setStatus(.planned)
        #expect(!PlanPrompt.make(trip: trip(), items: [train]).contains("Already booked"))
    }
}
