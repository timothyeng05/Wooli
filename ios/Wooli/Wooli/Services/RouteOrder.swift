import Foundation

/// Order a day's loose plans to shorten the walk (M3-3): nearest neighbour first,
/// then 2-opt to untangle crossings. Plans with a time, travel and stays don't move;
/// the movable ones are shuffled among the slots the movable ones already hold.
/// Pure: coordinates in, new sort positions out.
enum RouteOrder {
    struct Stop {
        let id: String
        /// Where it sits in the day now (`TripItem.sortKey`).
        let sortKey: Double
        /// Untimed and placed, and not travel or a stay.
        let movable: Bool
        let latitude: Double
        let longitude: Double
    }

    struct Result: Equatable {
        /// New `order` values for every movable plan (id → order), including ones that keep their slot.
        var orders: [String: Double]
        var savedKm: Double
        /// Rough minutes saved at city speeds, to the nearest 5 (walking, transit and short drives mixed).
        var savedMinutes: Int { max(Int((savedKm / cityKmPerHour * 60 / 5).rounded()) * 5, 5) }
    }

    static let cityKmPerHour = 15.0
    /// Under this a day is already about as short as it gets.
    static let minimumSavingKm = 0.2

    /// nil = nothing worth changing. `start` is the day's stay; without one the first movable plan stays first.
    static func reorder(_ stops: [Stop], start: (latitude: Double, longitude: Double)?) -> Result? {
        let movable = stops.filter(\.movable)
        guard movable.count >= (start == nil ? 3 : 2) else { return nil }

        let slots = movable.map(\.sortKey)
        let original = length(of: movable, start: start)
        var sequence = nearestNeighbour(movable, start: start)
        improve(&sequence, start: start)
        let shorter = length(of: sequence, start: start)
        guard original - shorter >= minimumSavingKm else { return nil }

        // Put the new sequence into the old slots, keeping them strictly increasing.
        var orders: [String: Double] = [:]
        var previous = -Double.infinity
        for (index, stop) in sequence.enumerated() {
            let key = max(slots[index], previous + 1)
            previous = key
            orders[stop.id] = key
        }
        return Result(orders: orders, savedKm: original - shorter)
    }

    // MARK: Pieces

    private static func km(_ a: (Double, Double), _ b: (Double, Double)) -> Double {
        TripChecks.distanceKm(a.0, a.1, b.0, b.1)
    }

    private static func point(_ s: Stop) -> (Double, Double) { (s.latitude, s.longitude) }

    static func length(of path: [Stop], start: (latitude: Double, longitude: Double)?) -> Double {
        var total = 0.0
        var last = start.map { ($0.latitude, $0.longitude) }
        for stop in path {
            if let l = last { total += km(l, point(stop)) }
            last = point(stop)
        }
        return total
    }

    private static func nearestNeighbour(_ stops: [Stop], start: (latitude: Double, longitude: Double)?) -> [Stop] {
        var remaining = stops
        var result: [Stop] = []
        var current: (Double, Double)
        if let start {
            current = (start.latitude, start.longitude)
        } else {
            let first = remaining.removeFirst()   // no stay: the first plan stays first
            result.append(first)
            current = point(first)
        }
        while !remaining.isEmpty {
            let i = remaining.indices.min { km(current, point(remaining[$0])) < km(current, point(remaining[$1])) }!
            let next = remaining.remove(at: i)
            result.append(next)
            current = point(next)
        }
        return result
    }

    /// 2-opt on an open path: reverse a stretch whenever that makes it shorter.
    private static func improve(_ path: inout [Stop], start: (latitude: Double, longitude: Double)?) {
        let firstFree = start == nil ? 1 : 0
        var improved = true
        var rounds = 0
        while improved && rounds < 50 {
            improved = false
            rounds += 1
            guard path.count - firstFree >= 2 else { return }
            for i in firstFree..<(path.count - 1) {
                for j in (i + 1)..<path.count {
                    var candidate = path
                    candidate[i...j].reverse()
                    if length(of: candidate, start: start) + 1e-9 < length(of: path, start: start) {
                        path = candidate
                        improved = true
                    }
                }
            }
        }
    }
}
