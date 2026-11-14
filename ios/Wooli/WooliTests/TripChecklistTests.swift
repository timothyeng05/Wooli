import Foundation
import Testing
@testable import Wooli

// A trip's checklist (TripChecklist).

struct TripChecklistTests {
    @Test func addingTrimsAndIgnoresEmptyAndDuplicates() {
        var list = TripChecklist.adding("  Passport ", group: "Documents", to: [])
        #expect(list.count == 1 && list[0].title == "Passport" && list[0].group == "Documents")
        list = TripChecklist.adding("passport", group: "Documents", to: list)     // same title, same group
        #expect(list.count == 1)
        list = TripChecklist.adding("Passport", group: "Packing", to: list)       // another group: fine
        #expect(list.count == 2)
        #expect(TripChecklist.adding("   ", to: list).count == 2)
    }

    @Test func toggleRemoveAndProgress() {
        var list = TripChecklist.adding("A", to: TripChecklist.adding("B", to: []))
        let id = list[0].id
        list = TripChecklist.toggling(id, in: list)
        #expect(TripChecklist.progress(list) == (1, 2))
        #expect(TripChecklist.clearingDone(list).count == 1)
        #expect(TripChecklist.removing(id, from: list).count == 1)
    }

    @Test func groupsKeepFirstSeenOrderWithUngroupedFirst() {
        var list: [ChecklistItem] = []
        list = TripChecklist.adding("Adapter", group: "Packing", to: list)
        list = TripChecklist.adding("Visa", group: "Documents", to: list)
        list = TripChecklist.adding("Call bank", to: list)
        list = TripChecklist.adding("Socks", group: "Packing", to: list)
        let groups = TripChecklist.groups(list)
        #expect(groups.map(\.name) == ["", "Packing", "Documents"])
        #expect(groups[1].items.map(\.title) == ["Adapter", "Socks"])
    }

    @Test func startingFromCopiesTitlesWithNewIdsAndNothingTicked() {
        var source = TripChecklist.adding("Passport", group: "Documents", to: [])
        source = TripChecklist.toggling(source[0].id, in: source)
        let copy = TripChecklist.startingFrom(source)
        #expect(copy.count == 1 && copy[0].title == "Passport" && copy[0].group == "Documents")
        #expect(copy[0].id != source[0].id && !copy[0].done)
    }

    @Test func lastTripsListPrefersTheTripBeforeThisOne() {
        func trip(_ id: String, _ start: String, list: [String]) -> Trip {
            var t = Trip(id: id, name: id, startDay: start, endDay: start)
            t.extras.checklist = list.map { ChecklistItem(title: $0) }
            return t
        }
        let now = trip("now", "2027-06-01", list: [])
        let old = trip("old", "2026-01-01", list: ["A"])
        let recent = trip("recent", "2027-02-01", list: ["B"])
        let later = trip("later", "2028-01-01", list: ["C"])
        #expect(TripChecklist.lastTripsList(for: now, among: [now, old, recent, later])?.from.id == "recent")
        // Nothing before it: fall back to the most recent other trip with a list.
        #expect(TripChecklist.lastTripsList(for: old, among: [old, later])?.from.id == "later")
        #expect(TripChecklist.lastTripsList(for: now, among: [now, trip("empty", "2026-05-01", list: [])]) == nil)
    }
}
