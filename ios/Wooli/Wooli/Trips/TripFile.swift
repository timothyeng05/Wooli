import Foundation

/// A trip as a `.woolitrip` file (M2-5): the same JSON as `TripStore.ImportBundle`,
/// so Claude's imports and these files are one format. Opening one makes a
/// **new** trip with new ids, so it never overwrites anything.
enum TripFile {
    static let fileExtension = "woolitrip"

    static func data(trip: Trip, items: [TripItem]) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        // Old empty meal slots stay behind; they were never shown.
        let plans = items.filter { !$0.isHiddenPlaceholder }
        return try encoder.encode(TripStore.ImportBundle(trip: trip, items: plans))
    }

    /// The trip and its plans as a fresh copy: new ids, no iCloud bookkeeping,
    /// and always yours (not a shared trip's owner).
    static func newTrip(from data: Data) throws -> (trip: Trip, items: [TripItem]) {
        let bundle = try JSONDecoder().decode(TripStore.ImportBundle.self, from: data)
        var trip = bundle.trip
        let id = UUID().uuidString
        trip.id = id
        trip.systemFields = nil
        trip.zoneOwner = ""
        trip.isShared = false
        let items = bundle.items.map { original -> TripItem in
            var item = original
            item.id = UUID().uuidString
            item.tripID = id
            item.systemFields = nil
            return item
        }
        return (trip, items)
    }
}
