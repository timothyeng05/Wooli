import Foundation
import Testing
@testable import Wooli

// Travel time between stops (TravelTime).

struct TravelTimeTests {
    private let a = TripPlace(name: "A", latitude: 37.3860, longitude: -5.9930)
    private let b = TripPlace(name: "B", latitude: 37.3890, longitude: -5.9845)   // about 0.8 km
    private let far = TripPlace(name: "Far", latitude: 37.45, longitude: -5.85)

    @Test func modeByDistance() {
        #expect(TravelTime.defaultMode(km: 0.8, transitAvailable: true) == .walk)
        #expect(TravelTime.defaultMode(km: 3, transitAvailable: true) == .transit)
        #expect(TravelTime.defaultMode(km: 3, transitAvailable: false) == .drive)
    }

    @Test func wording() {
        #expect(TravelTime.text(TravelEstimate(mode: .walk, minutes: 14, km: 1)) == "14 min walk")
        #expect(TravelTime.text(TravelEstimate(mode: .transit, minutes: 65, km: 9)) == "1 h 5 min by transit")
        #expect(TravelTime.text(TravelEstimate(mode: .drive, minutes: 120, km: 90)) == "2 h drive")
        #expect(TravelTime.text(TravelEstimate(mode: .walk, minutes: nil, km: 2.14)) == "2.1 km")
        #expect(TravelTime.text(TravelEstimate(mode: .walk, minutes: nil, km: 0.43)) == "450 m")
    }

    @Test func daySummarySumsOnlyKnownEstimates() {
        let e = [TravelEstimate(mode: .walk, minutes: 14, km: 1), TravelEstimate(mode: .transit, minutes: 56, km: 9),
                 TravelEstimate(mode: .drive, minutes: nil, km: 5)]
        #expect(TravelTime.daySummary(stops: 4, estimates: e) == "4 stops · 1 h 10 min getting around")
        #expect(TravelTime.daySummary(stops: 1, estimates: e) == nil)
        #expect(TravelTime.daySummary(stops: 3, estimates: []) == "3 stops")
    }

    @Test func cacheKeyIsStableAndPerMode() {
        #expect(TravelTime.cacheKey(from: a, to: b, mode: .walk) == TravelTime.cacheKey(from: a, to: b, mode: .walk))
        #expect(TravelTime.cacheKey(from: a, to: b, mode: .walk) != TravelTime.cacheKey(from: a, to: b, mode: .drive))
        #expect(TravelTime.cacheKey(from: a, to: b, mode: .walk) != TravelTime.cacheKey(from: b, to: a, mode: .walk))
    }

    @Test func fallbackUsesStraightLineDistance() {
        let e = TravelTime.fallback(from: a, to: b)
        #expect(e.minutes == nil && e.mode == .walk && e.km > 0.5 && e.km < 1.2)
        #expect(TravelTime.fallback(from: a, to: far).mode == .drive)
    }

    @Test func connectorsOnlyBetweenPlacedPlansInOrder() {
        var one = TripItem(tripID: "t", day: "d", kind: .activity, title: "1"); one.place = a
        let none = TripItem(tripID: "t", day: "d", kind: .activity, title: "no place")
        var two = TripItem(tripID: "t", day: "d", kind: .meal, title: "2"); two.place = b
        var hotel = TripItem(tripID: "t", day: "d", kind: .stay, title: "Hotel"); hotel.place = far
        let pairs = TravelTime.pairs([one, none, two, hotel])
        #expect(pairs.count == 1 && pairs[0].from.id == one.id && pairs[0].to.id == two.id)
    }
}
