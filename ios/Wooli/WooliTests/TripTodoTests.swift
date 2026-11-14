import Foundation
import Testing
@testable import Wooli

// The Overview's To do list (TripTodo).

struct TripTodoTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-05")
        trip.legs = [TripLeg(name: "Dali", startDay: "2027-04-01", endDay: "2027-04-05")]
        return trip
    }

    private func stay(_ from: String, _ to: String) -> TripItem {
        var s = TripItem(tripID: "t", day: from, kind: .stay, title: "Hotel")
        s.checkOutDay = to; s.cost = 100
        return s
    }

    @Test func fullyPlannedTripHasNothingToDo() {
        let items = [stay("2027-04-01", "2027-04-05"),
                     TripItem(tripID: "t", day: "2027-04-02", kind: .activity, title: "A"),
                     TripItem(tripID: "t", day: "2027-04-03", kind: .activity, title: "B"),
                     TripItem(tripID: "t", day: "2027-04-04", kind: .activity, title: "C"),
                     TripItem(tripID: "t", day: "2027-04-05", kind: .activity, title: "D")]
        let rows = TripTodo.list(trip: trip(), items: items)
        #expect(rows.filter { $0.kind != .unpriced && $0.kind != .emptyDays }.isEmpty)
    }

    @Test func runsOfNightsWithoutABedBecomeOneRow() {
        let items = [stay("2027-04-01", "2027-04-02")]    // nights of Apr 2, 3, 4 are open
        let rows = TripTodo.list(trip: trip(), items: items).filter { $0.kind == .noBed }
        #expect(rows.count == 1)
        #expect(rows[0].title == "No bed Apr 2 to Apr 4 in Dali")
        #expect(rows[0].day == "2027-04-02")
    }

    @Test func unbookedTravelAndUnpricedAndIdeas() {
        var train = TripItem(tripID: "t", day: "2027-04-03", kind: .transit, title: "Train to Lijiang")
        train.setStatus(.planned)
        let idea = TripItem(tripID: "t", day: nil, kind: .activity, title: "Gorge")
        let rows = TripTodo.list(trip: trip(), items: [stay("2027-04-01", "2027-04-05"), train, idea])
        #expect(rows.contains { $0.kind == .unbookedTravel && $0.title == "Book Train to Lijiang" && $0.itemID == train.id })
        #expect(rows.contains { $0.kind == .unpriced && $0.title == "1 booking without a price" })
        #expect(rows.contains { $0.kind == .ideas && $0.title == "1 idea waiting" })
    }

    @Test func mostUrgentFirst() {
        let idea = TripItem(tripID: "t", day: nil, kind: .activity, title: "Gorge")
        let rows = TripTodo.list(trip: trip(), items: [idea])
        #expect(rows.first?.kind == .noBed)
        #expect(rows.last?.kind == .ideas)
    }

    @Test func cancelledPlansDontCount() {
        var gone = stay("2027-04-01", "2027-04-05"); gone.setStatus(.cancelled)
        #expect(TripTodo.list(trip: trip(), items: [gone]).contains { $0.kind == .noBed })
    }

    @Test func runsGroupOnlyConsecutiveTripDays() {
        let days = ["a", "b", "c", "d", "e"]
        #expect(TripTodo.runs(["a", "b", "d"], in: days) == [["a", "b"], ["d"]])
    }
}
