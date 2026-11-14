import Foundation
import Testing
@testable import Wooli

// Order a day by shortest route (RouteOrder).

struct RouteOrderTests {
    /// Stops along a line of longitude; `x` is km-ish east of the hotel (0.01° ≈ 0.9 km at this latitude).
    private func stop(_ id: String, _ x: Double, key: Double = TripItem.untimedKey, movable: Bool = true) -> RouteOrder.Stop {
        RouteOrder.Stop(id: id, sortKey: key, movable: movable, latitude: 37.39, longitude: -6.0 + x * 0.01)
    }
    private let hotel = (latitude: 37.39, longitude: -6.0)

    @Test func straightensAZigZag() throws {
        // From the hotel: 5, 1, 4, 2 is a zig-zag; 1, 2, 4, 5 is the straight walk.
        let stops = [stop("five", 5, key: 1), stop("one", 1, key: 2), stop("four", 4, key: 3), stop("two", 2, key: 4)]
        let result = try #require(RouteOrder.reorder(stops, start: hotel))
        let order = result.orders.sorted { $0.value < $1.value }.map(\.key)
        #expect(order == ["one", "two", "four", "five"])
        #expect(result.savedKm > 1)
        #expect(result.savedMinutes >= 5)
    }

    @Test func alreadyShortestReturnsNil() {
        let stops = [stop("one", 1, key: 1), stop("two", 2, key: 2), stop("three", 3, key: 3)]
        #expect(RouteOrder.reorder(stops, start: hotel) == nil)
    }

    @Test func timedPlansAndTheirSlotsStayPut() throws {
        // The timed plan sits second (key 600) and isn't movable: the others only trade places.
        let stops = [stop("far", 8, key: 100), stop("lunch", 4, key: 600, movable: false),
                     stop("near", 1, key: 700), stop("mid", 3, key: 800)]
        let result = try #require(RouteOrder.reorder(stops, start: hotel))
        #expect(result.orders["lunch"] == nil)
        // Slots are 100, 700, 800 in that order; the new sequence is near, mid, far.
        #expect(result.orders["near"] == 100 && result.orders["mid"] == 700 && result.orders["far"] == 800)
    }

    @Test func withoutAStayTheFirstPlanStaysFirst() throws {
        let stops = [stop("a", 0, key: 1), stop("c", 6, key: 2), stop("b", 3, key: 3)]
        let result = try #require(RouteOrder.reorder(stops, start: nil))
        #expect(result.orders["a"] == 1)             // still first, in its own slot
        #expect(result.orders["b"] == 2 && result.orders["c"] == 3)
    }

    @Test func tooFewPlansToReorder() {
        #expect(RouteOrder.reorder([stop("a", 1), stop("b", 2)], start: nil) == nil)
        #expect(RouteOrder.reorder([stop("a", 1)], start: hotel) == nil)
    }

    @Test func equalSlotsGetDistinctOrders() throws {
        // All untimed: every slot is the same key, so the new orders must still be strictly increasing.
        let stops = [stop("five", 5), stop("one", 1), stop("four", 4), stop("two", 2)]
        let result = try #require(RouteOrder.reorder(stops, start: hotel))
        let values = result.orders.sorted { $0.value < $1.value }.map(\.value)
        #expect(Set(values).count == values.count)
        #expect(result.orders.sorted { $0.value < $1.value }.map(\.key) == ["one", "two", "four", "five"])
    }
}
