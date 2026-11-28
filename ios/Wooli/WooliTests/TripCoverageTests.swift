import Foundation
import Testing
@testable import Wooli

// The trip "Planning" heatmap (TripCoverage).

struct TripCoverageTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "Test", startDay: "2027-04-01", endDay: "2027-04-04")
        trip.legs = [TripLeg(name: "Home", startDay: "2027-04-01", endDay: "2027-04-01", isHome: true),
                     TripLeg(name: "A", startDay: "2027-04-01", endDay: "2027-04-03"),
                     TripLeg(name: "B", startDay: "2027-04-03", endDay: "2027-04-04")]
        return trip
    }

    private func item(_ day: String, _ kind: TripItem.Kind, _ title: String = "", time: Int? = nil,
                      notes: String = "", place: Bool = false, checkOut: String? = nil) -> TripItem {
        var item = TripItem(tripID: "t", day: day, kind: kind, title: title, time: time)
        item.notes = notes
        item.checkOutDay = checkOut
        if place { item.place = TripPlace(name: "Somewhere", latitude: 0, longitude: 0) }
        return item
    }

    @Test func placeholderMealsDontCount() {
        let items = [item("2027-04-01", .meal, "Breakfast", time: 480),
                     item("2027-04-01", .meal, "Dinner", time: 1140, place: true)]
        let day = TripCoverage.days(trip: trip(), items: items)[0]
        #expect(day.state(.breakfast) == .open)
        #expect(day.state(.lunch) == .open)
        #expect(day.state(.dinner) == .planned)
    }

    @Test func activitiesBucketByTimeAndUntimedFillTheFirstGap() {
        let items = [item("2027-04-02", .activity, "Late", time: 19 * 60),
                     item("2027-04-02", .activity, "Whenever")]
        let day = TripCoverage.days(trip: trip(), items: items)[1]
        #expect(day.state(.morning) == .planned)
        #expect(day.state(.afternoon) == .open)
        #expect(day.state(.evening) == .planned)
    }

    @Test func staysCoverNightsBeforeCheckOutAndTheLastDayHasNone() {
        let items = [item("2027-04-01", .stay, "Hotel", checkOut: "2027-04-03")]
        let days = TripCoverage.days(trip: trip(), items: items)
        #expect(days.map { $0.state(.stay) } == [.planned, .planned, .open, .none])
    }

    @Test func travelOnlyOnCityChangesAndNotBookedYetIsUnbooked() {
        let items = [item("2027-04-03", .transit, "Train A → B", notes: "Not booked yet · ~2 h"),
                     item("2027-04-02", .transit, "Day trip")]
        let days = TripCoverage.days(trip: trip(), items: items)
        #expect(days[0].state(.transit) == .open)       // home → A
        #expect(days[1].state(.transit) == .none)       // same city
        #expect(days[2].state(.transit) == .unbooked)   // A → B
        #expect(days[3].state(.transit) == .open)       // trip ends away from home
    }
}

// Points and miles on trip bookings (TripPoints.swift).

struct TripPointsTests {
    private func item(_ kind: TripItem.Kind, cost: Double? = nil, currency: String? = nil,
                      points: Double? = nil, program: String? = nil) -> TripItem {
        var item = TripItem(tripID: "t", day: "2027-04-01", kind: kind, title: "x")
        item.cost = cost
        item.currency = currency
        item.points = points
        item.pointsProgram = program
        return item
    }

    @Test func totalsKeepCashAndEachProgramApart() {
        let items = [item(.transit, cost: 3564, currency: "HKD", points: 238_000, program: "Asia Miles"),
                     item(.stay, points: 9_000, program: "World of Hyatt"),
                     item(.stay, points: 7_500, program: "World of Hyatt"),
                     item(.stay)]
        let costs = TripCosts(items: items)
        #expect(costs.totals == ["HKD": 3564])
        #expect(costs.points == ["Asia Miles": 238_000, "World of Hyatt": 16_500])
        #expect(costs.unpriced == 1)
        #expect(costs.lines.first { $0.id == "stays" }?.points == ["World of Hyatt": 16_500])
    }

    @Test func pointsTextUsesTheProgramsUnit() {
        #expect(item(.stay, points: 7_500, program: "World of Hyatt").pointsText == "7,500 Hyatt points")
        #expect(item(.stay, points: 100, program: "Krisflyer").pointsText == "100 Krisflyer")
        #expect(item(.stay).priceText == nil)
    }

    @Test func estimateOnlyCountsValuedPrograms() {
        let points = ["World of Hyatt": 10_000.0, "Asia Miles": 50_000]
        #expect(PointValues.estimate(points, values: [:]) == nil)
        #expect(PointValues.estimate(points, values: ["World of Hyatt": 1.5]) == 150)
    }
}

// Leg locations, extras and booking status (TripModels.swift).

struct TripExtrasTests {
    @Test func oldSavedTripsAndLegsStillDecode() throws {
        let json = """
        {"id":"t","name":"Old","destination":"","startDay":"2027-01-01","endDay":"2027-01-02",
         "legs":[{"id":"l","name":"Madrid","startDay":"2027-01-01","endDay":"2027-01-02"}]}
        """
        let trip = try JSONDecoder().decode(Trip.self, from: Data(json.utf8))
        #expect(trip.extras.isEmpty)
        #expect(trip.legs[0].latitude == nil && trip.legs[0].timeZoneID == nil)
        let item = try JSONDecoder().decode(TripItem.self, from: Data(#"{"id":"i","tripID":"t","kind":"meal","title":"x","notes":"","createdAt":0}"#.utf8))
        #expect(item.extras == nil)
    }

    @Test func extrasSurviveTheRecordRoundTrip() {
        var trip = Trip(id: "t", name: "T")
        trip.extras.budget = 8000
        trip.legs = [TripLeg(name: "Seville", startDay: trip.startDay, endDay: trip.endDay)]
        trip.legs[0].timeZoneID = "Europe/Madrid"
        var back = Trip(id: "t", name: "T")
        back.apply(trip.record())
        #expect(back.extras.budget == 8000)
        #expect(back.legs[0].timeZoneID == "Europe/Madrid")

        var item = TripItem(tripID: "t")
        item.setStatus(.booked)
        item.extras?.url = "https://example.com"
        let again = TripItem(record: item.record(in: trip.zoneID), tripID: "t")
        #expect(again.bookingStatus == .booked)
        #expect(again.extras?.url == "https://example.com")
    }

    @Test func recordsWithoutExtrasDontWriteTheField() {
        let trip = Trip(id: "t", name: "T")
        #expect(trip.record()["extras"] == nil)
        #expect(TripItem(tripID: "t").record(in: trip.zoneID)["extras"] == nil)
    }

    @Test func extrasMergeKeyByKey() {
        var mine = TripExtras(); mine.budget = 5000; mine.travelers = 2
        var theirs = TripExtras(); theirs.budgetCurrency = "EUR"; theirs.travelers = 3
        let merged = mine.merging(theirs)
        #expect(merged.budget == 5000 && merged.budgetCurrency == "EUR" && merged.travelers == 3)
    }

    @Test func statusFallsBackToTheNotesPrefixAndSettingOneDropsIt() {
        var item = TripItem(tripID: "t", kind: .transit)
        #expect(item.bookingStatus == nil && !item.isUnbooked)
        item.notes = "Not booked yet · ~2 h"
        #expect(item.isUnbooked)
        item.setStatus(.booked)
        #expect(!item.isUnbooked)
        #expect(item.notes == "~2 h")
    }

    @Test func onlyTravelAndStaysDrawAsUnbookedAndShowAStatus() {
        var flight = TripItem(tripID: "t", kind: .transit)
        flight.notes = "Not booked yet"
        #expect(flight.drawsAsUnbooked && flight.showsStatus)
        flight.setStatus(.booked)
        #expect(!flight.drawsAsUnbooked)

        var dinner = TripItem(tripID: "t", kind: .activity)
        #expect(!dinner.showsStatus && !dinner.drawsAsUnbooked)
        dinner.setStatus(.booked)   // a reservation
        #expect(dinner.showsStatus && !dinner.drawsAsUnbooked)
        dinner.setStatus(nil)
        #expect(!dinner.showsStatus && dinner.extras == nil)
    }

    @Test func cancelledPlansDropOutOfCostsAndCoverage() {
        var flight = TripItem(tripID: "t", day: "2027-04-01", kind: .transit, title: "Flight")
        flight.cost = 500
        flight.currency = "USD"
        flight.setStatus(.cancelled)
        #expect(TripCosts(items: [flight]).totals.isEmpty)
    }
}

// Open slots: derived from coverage, never records (TripCoverage.openSlots).

struct OpenSlotTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "Test", startDay: "2027-04-01", endDay: "2027-04-03")
        trip.legs = [TripLeg(name: "A", startDay: "2027-04-01", endDay: "2027-04-03")]
        return trip
    }

    @Test func aNewTripShowsEveryMealAndNightOpenWithNoRecords() {
        let slots = TripCoverage.openSlots(trip: trip(), items: [])
        #expect(slots["2027-04-01"]?.map(\.title) == ["Breakfast", "Lunch", "Dinner", "No stay tonight"])
        #expect(slots["2027-04-03"]?.map(\.title) == ["Breakfast", "Lunch", "Dinner"])   // no night after the last day
    }

    @Test func aPlannedMealOrStayClosesItsSlot() {
        var dinner = TripItem(tripID: "t", day: "2027-04-01", kind: .meal, title: "Dinner at Sukiyabashi", time: 19 * 60)
        dinner.place = TripPlace(name: "Sukiyabashi", latitude: 0, longitude: 0)
        var stay = TripItem(tripID: "t", day: "2027-04-01", kind: .stay, title: "Hotel")
        stay.checkOutDay = "2027-04-03"
        let slots = TripCoverage.openSlots(trip: trip(), items: [dinner, stay])
        #expect(slots["2027-04-01"]?.map(\.title) == ["Breakfast", "Lunch"])
        #expect(slots["2027-04-02"]?.map(\.title) == ["Breakfast", "Lunch", "Dinner"])
    }

    @Test func aSlotTheUserStartedOnStandsInForItself() {
        var started = TripItem(tripID: "t", day: "2027-04-01", kind: .meal, title: "Lunch", time: 750)
        started.extras = ItemExtras(); started.extras?.source = "slot"
        let slots = TripCoverage.openSlots(trip: trip(), items: [started])
        #expect(slots["2027-04-01"]?.contains { $0.title == "Lunch" } == false)
        #expect(!started.isHiddenPlaceholder)
    }

    @Test func oldPlaceholderRecordsAreHiddenButStillPlaceholders() {
        let old = TripItem(tripID: "t", day: "2027-04-01", kind: .meal, title: "Lunch", time: 750)
        #expect(old.isMealPlaceholder && old.isHiddenPlaceholder)
    }
}

// New-trip setup: cities and nights to legs (TripSetup).

struct TripSetupTests {
    private func city(_ name: String, _ nights: Int, _ cc: String = "ES") -> SetupCity {
        var c = SetupCity(name: name, latitude: 1, longitude: 2, timeZoneID: "Europe/Madrid", countryCode: cc)
        c.nights = nights
        return c
    }

    private func date(_ key: String) -> Date { DayKey.date(key) }

    @Test func nightsChainIntoLegsAndTheEndDay() {
        let (legs, end) = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("Madrid", 2), city("Seville", 2), city("Barcelona", 5)])
        #expect(legs.map(\.startDay) == ["2026-12-24", "2026-12-26", "2026-12-28"])
        #expect(legs.map(\.endDay) == ["2026-12-26", "2026-12-28", "2027-01-02"])
        #expect(end == "2027-01-02")
        #expect(legs.allSatisfy { $0.latitude == 1 && $0.timeZoneID == "Europe/Madrid" && $0.countryCode == "ES" })
    }

    @Test func aHomeCityOpensAndClosesTheTripAndNightsAreAtLeastOne() {
        let home = city("New York", 0, "US")
        let (legs, end) = TripSetup.legs(start: date("2027-04-01"), home: home, cities: [city("Lisbon", 0)])
        #expect(legs.map(\.isHome) == [true, false, true])
        #expect(legs[1].endDay == "2027-04-02" && end == "2027-04-02")
        #expect(legs[0].id != legs[2].id)
        #expect(legs[0].startDay == "2027-04-01" && legs[2].startDay == "2027-04-02")
    }

    @Test func namesAndDestinations() {
        #expect(TripSetup.name(for: []) == "")
        #expect(TripSetup.name(for: [city("Madrid", 1)]) == "Madrid")
        #expect(TripSetup.name(for: [city("Madrid", 1), city("Seville", 1), city("Barcelona", 1)]) == "Madrid, Seville & Barcelona")
        #expect(TripSetup.name(for: ["A", "B", "C", "D"].map { city($0, 1) }) == "A, B + 2 more")
        #expect(TripSetup.destination(for: [city("Madrid", 1), city("Seville", 1), city("Lisbon", 1, "PT")]).contains("Portugal"))
        #expect(TripSetup.destination(for: [SetupCity(name: "Atlantis")]) == "Atlantis")
    }

    @Test func theTripGetsItsDatesNameAndLegs() {
        let trip = TripSetup.trip(name: "  Spain  ", start: date("2026-12-24"), home: nil, cities: [city("Madrid", 3)])
        #expect(trip.name == "Spain" && trip.startDay == "2026-12-24" && trip.endDay == "2026-12-27" && trip.legs.count == 1)
        #expect(trip.days.count == 4)
    }
}

// Quick add: what typed text means (QuickAddParser).

struct QuickAddParserTests {
    @Test func plainTextIsJustTheQuery() {
        let r = QuickAddParser.parse("  El Rinconcillo ")
        #expect(r == QuickAddRequest(query: "El Rinconcillo"))
    }

    @Test func prefixesPickTheKind() {
        #expect(QuickAddParser.parse("hotel Alfonso XIII").kind == .stay)
        #expect(QuickAddParser.parse("hotel Alfonso XIII").query == "Alfonso XIII")
        #expect(QuickAddParser.parse("train Madrid Atocha").kind == .transit)
        #expect(QuickAddParser.parse("coffee").kind == .meal)
        #expect(QuickAddParser.parse("hotelier").kind == nil)   // not a prefix word
    }

    @Test func mealWordsSetTheSlotTime() {
        let r = QuickAddParser.parse("dinner Casa Lola")
        #expect(r.kind == .meal && r.mealTitle == "Dinner" && r.time == 19 * 60 && r.query == "Casa Lola")
    }

    @Test func aTrailingTimeIsTakenOut() {
        #expect(QuickAddParser.parse("Flamenco show 7pm").time == 19 * 60)
        #expect(QuickAddParser.parse("Flamenco show 7:30 pm").time == 19 * 60 + 30)
        #expect(QuickAddParser.parse("Flamenco show 19:30").time == 19 * 60 + 30)
        #expect(QuickAddParser.parse("Tapas 12am").time == 0)
        #expect(QuickAddParser.parse("Flamenco show 7pm").query == "Flamenco show")
        #expect(QuickAddParser.parse("Plaza 25").time == nil)   // a number, not a time
    }

    @Test func flightNumbers() {
        #expect(QuickAddParser.parse("cx831").flightNumber == "CX831")
        #expect(QuickAddParser.parse("IB 6250").flightNumber == "IB6250")
        #expect(QuickAddParser.parse("fly BA 117 9am").flightNumber == "BA117")
        #expect(QuickAddParser.parse("fly BA 117 9am").time == 9 * 60)
        #expect(QuickAddParser.parse("Madrid").flightNumber == nil)
        #expect(QuickAddParser.parse("Cx831").kind == .transit)
    }

    @Test func mapCategoriesSuggestAKind() {
        #expect(QuickAddParser.kind(forCategory: .restaurant) == .meal)
        #expect(QuickAddParser.kind(forCategory: .hotel) == .stay)
        #expect(QuickAddParser.kind(forCategory: .airport) == .transit)
        #expect(QuickAddParser.kind(forCategory: .museum) == .activity)
        #expect(QuickAddParser.kind(forCategory: nil) == .activity)
    }
}

// Undo for trip edits (TripStore registers with the window's UndoManager).

@MainActor
struct TripUndoTests {
    private func step(_ um: UndoManager, _ work: () -> Void) {
        um.beginUndoGrouping()
        work()
        um.endUndoGrouping()
    }

    @Test func addEditAndDeleteEachUndoAndRedo() {
        let store = TripStore.shared
        let um = UndoManager()
        um.groupsByEvent = false
        var trip = Trip(id: "undo-test-trip", name: "Undo", startDay: "2027-04-01", endDay: "2027-04-02")
        store.undoManager = nil
        store.save(trip)
        defer { store.undoManager = nil; store.delete(trip) }
        store.undoManager = um

        var item = TripItem(id: "undo-test-item", tripID: trip.id, day: "2027-04-01", kind: .activity, title: "Louvre")
        step(um) { store.save(item) }
        #expect(store.items.contains { $0.id == item.id })
        um.undo()
        #expect(!store.items.contains { $0.id == item.id })
        um.redo()
        #expect(store.items.contains { $0.id == item.id })

        item.title = "Orsay"
        step(um) { store.save(item) }
        um.undo()
        #expect(store.items.first { $0.id == item.id }?.title == "Louvre")
        um.redo()
        #expect(store.items.first { $0.id == item.id }?.title == "Orsay")

        step(um) { store.delete(item) }
        #expect(!store.items.contains { $0.id == item.id })
        um.undo()
        #expect(store.items.first { $0.id == item.id }?.title == "Orsay")

        // Several plans changed in one step come back in one undo.
        var b = item; b.id = "undo-test-item-2"; b.title = "Rodin"
        step(um) { store.save(b); store.delete(item) }
        um.undo()
        #expect(store.items.contains { $0.id == item.id } && !store.items.contains { $0.id == b.id })

        trip.name = "Renamed"
        step(um) { store.save(trip) }
        um.undo()
        #expect(store.trip(trip.id)?.name == "Undo")
    }
}

// Edit Trip: plans move with their city (TripSetup.remap).

struct TripEditRemapTests {
    private func date(_ s: String) -> Date { DayKey.date(s) }
    private func city(_ id: String, _ nights: Int) -> SetupCity {
        var c = SetupCity(name: id); c.id = id; c.nights = nights; return c
    }
    private func plan(_ id: String, _ day: String?) -> TripItem {
        var item = TripItem(tripID: "t", day: day, kind: .activity, title: id); item.id = id; return item
    }

    @Test func aPlanStaysOnItsCitysDayWhenAnEarlierCityGrows() {
        let old = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("M", 2), city("S", 2)])
        let new = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("M", 4), city("S", 2)])
        let days = Trip(name: "T", startDay: "2026-12-24", endDay: new.endDay).days
        // Seville's day 2 was Dec 27; with Madrid longer it's Dec 29.
        let moves = TripSetup.remap(items: [plan("a", "2026-12-27")], oldLegs: old.legs, newLegs: new.legs, newDays: days)
        #expect(moves["a"] == .some("2026-12-29"))
    }

    @Test func shorteningACityMovesTheExtraPlansToIdeasNotAwayForever() {
        let old = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("M", 4)])
        let new = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("M", 2)])
        let days = Trip(name: "T", startDay: "2026-12-24", endDay: new.endDay).days
        let moves = TripSetup.remap(items: [plan("keep", "2026-12-25"), plan("drop", "2026-12-27"), plan("idea", nil)],
                                    oldLegs: old.legs, newLegs: new.legs, newDays: days)
        #expect(moves["keep"] == nil)
        #expect(moves["drop"] == .some(nil))
        #expect(moves["idea"] == nil)
    }

    @Test func aSavedCityComesBackWithItsNightsAndId() {
        let legs = TripSetup.legs(start: date("2026-12-24"), home: nil, cities: [city("M", 3)]).legs
        let back = SetupCity(leg: legs[0])
        #expect(back.id == "M" && back.nights == 3)
    }
}
