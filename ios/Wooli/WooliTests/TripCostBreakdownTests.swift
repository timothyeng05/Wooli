import Foundation
import Testing
@testable import Wooli

// Costs by type and city (TripCostBreakdown).

struct TripCostBreakdownTests {
    private func trip() -> Trip {
        var trip = Trip(id: "t", name: "T", startDay: "2027-04-01", endDay: "2027-04-06")
        trip.legs = [TripLeg(name: "Seville", startDay: "2027-04-01", endDay: "2027-04-03"),
                     TripLeg(name: "Madrid", startDay: "2027-04-03", endDay: "2027-04-06")]
        return trip
    }

    private func item(_ day: String?, _ kind: TripItem.Kind, _ cost: Double, _ currency: String = "USD") -> TripItem {
        var i = TripItem(tripID: "t", day: day, kind: kind, title: "x")
        i.cost = cost; i.currency = currency
        return i
    }

    @Test func byTypeConvertsAndSortsLargestFirst() {
        let items = [item("2027-04-01", .transit, 500), item("2027-04-02", .stay, 90_000, "JPY"), item("2027-04-02", .meal, 40)]
        let bars = TripCostBreakdown.byType(items: items, budget: "USD", rates: ["JPY": 0.0065])
        #expect(bars.map(\.title) == ["Stays", "Flights & trains", "Food"])      // 585, 500, 40
    }

    @Test func byCityUsesTheArrivalCityOnAChangeDay() {
        let items = [item("2027-04-02", .stay, 100), item("2027-04-03", .stay, 300), item(nil, .activity, 50)]
        let bars = TripCostBreakdown.byCity(trip: trip(), items: items, budget: "USD", rates: [:])
        #expect(bars.map(\.title) == ["Madrid", "Seville", "Other"])
        #expect(bars.map(\.amount) == [300, 100, 50])
        #expect(bars[0].share == 1 && abs(bars[1].share - 1.0 / 3.0) < 0.0001)
    }

    @Test func cancelledAndUnconvertibleAreLeftOut() {
        var gone = item("2027-04-02", .stay, 999); gone.setStatus(.cancelled)
        let thb = item("2027-04-02", .meal, 900, "THB")     // no rate: can't be shown in USD
        let bars = TripCostBreakdown.byCity(trip: trip(), items: [gone, thb], budget: "USD", rates: [:])
        #expect(bars.isEmpty)
    }
}
