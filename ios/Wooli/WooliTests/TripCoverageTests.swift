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

    @Test func cancelledPlansDropOutOfCostsAndCoverage() {
        var flight = TripItem(tripID: "t", day: "2027-04-01", kind: .transit, title: "Flight")
        flight.cost = 500
        flight.currency = "USD"
        flight.setStatus(.cancelled)
        #expect(TripCosts(items: [flight]).totals.isEmpty)
    }
}
