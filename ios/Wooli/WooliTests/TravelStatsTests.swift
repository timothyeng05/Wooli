import Foundation
import Testing
@testable import Wooli

// Places you've been (TravelStatsMaker).

struct TravelStatsTests {
    private func trip(_ id: String, _ start: String, _ end: String, cities: [(String, String?)]) -> Trip {
        var t = Trip(id: id, name: id, startDay: start, endDay: end)
        t.legs = [TripLeg(name: "Home", startDay: start, endDay: start, isHome: true)] + cities.map { name, country in
            var leg = TripLeg(name: name, startDay: start, endDay: end)
            leg.countryCode = country
            return leg
        }
        return t
    }

    private func flight(_ tripID: String) -> TripItem {
        var i = TripItem(tripID: tripID, day: "2026-05-01", kind: .transit)
        i.transport = TripTransport(mode: .flight)
        return i
    }

    @Test func onlyFinishedTripsCount() {
        let spain = trip("spain", "2026-05-01", "2026-05-10", cities: [("Seville", "es"), ("Madrid", "ES")])
        let japan = trip("japan", "2026-11-01", "2026-11-08", cities: [("Tokyo", "JP")])
        let future = trip("future", "2027-04-01", "2027-04-05", cities: [("Lima", "PE")])
        let stats = TravelStatsMaker.stats(trips: [spain, japan, future], items: [flight("spain"), flight("spain"), flight("future")], today: "2026-12-01")
        #expect(stats.trips == 2)
        #expect(stats.countries == ["ES", "JP"])
        #expect(stats.cities == 3)
        #expect(stats.nights == 9 + 7)
        #expect(stats.flights == 2)
    }

    @Test func theSameCityTwiceCountsOnceAndCancelledFlightsDont() {
        let a = trip("a", "2025-01-01", "2025-01-03", cities: [("Lisbon", "PT")])
        let b = trip("b", "2026-01-01", "2026-01-03", cities: [("lisbon", "PT")])
        var gone = flight("a"); gone.setStatus(.cancelled)
        let stats = TravelStatsMaker.stats(trips: [a, b], items: [gone, flight("b")], today: "2027-01-01")
        #expect(stats.cities == 1 && stats.countries == ["PT"] && stats.flights == 1)
    }

    @Test func recapLine() {
        let t = trip("Spain 2026", "2026-05-01", "2026-05-10", cities: [("Seville", "ES"), ("Madrid", "ES")])
        #expect(TravelStatsMaker.recap(trip: t, items: [flight("Spain 2026")]) == "Spain 2026 · 9 nights · 2 cities · 1 flight")
        let bare = Trip(id: "b", name: "", startDay: "2026-05-01", endDay: "2026-05-01")
        #expect(TravelStatsMaker.recap(trip: bare, items: []) == "Trip · 0 nights")
    }

    @Test func flagsFromRegionCodes() {
        #expect(TravelStatsMaker.flag("ES") == "🇪🇸")
        #expect(TravelStatsMaker.flag("jp") == "🇯🇵")
        #expect(TravelStatsMaker.flag("X") == "" && TravelStatsMaker.flag("USA") == "")
    }
}
