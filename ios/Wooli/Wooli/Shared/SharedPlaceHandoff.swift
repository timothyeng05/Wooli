import Foundation

// Compiled into both the app and the share extension (WooliShare): a place
// shared from Apple Maps waits in the App Group container until the app
// opens and adds it to Eats or a trip.

/// A place shared to Wooli, waiting for the app to pick it up.
struct SharedPlace: Codable, Identifiable, Hashable {
    enum Destination: String, Codable {
        case eats, eatsWishlist, tripIdeas
    }

    var id: String = UUID().uuidString
    var name: String
    var address: String = ""
    var latitude: Double
    var longitude: Double
    /// Apple Maps place ID ("I…"), when Maps gave one.
    var mapItemID: String = ""
    /// A restaurant, café, bar…: saved to a trip as a meal, not an activity.
    var isFood: Bool = false
    var destination: Destination
    var sharedAt: Date = .now
}

enum SharedPlaceHandoff {
    static let appGroup = "group.com.timothyeng.wooli"
    /// Opens the app from the extension; any wooli:// URL makes it check the inbox.
    static let openURL = URL(string: "wooli://shared-place")!

    private static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appending(path: "shared-places.json")
    }

    static func pending() -> [SharedPlace] {
        guard let fileURL, let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? JSONDecoder().decode([SharedPlace].self, from: data)) ?? []
    }

    /// Queued, so sharing two places before opening Wooli keeps both.
    @discardableResult
    static func add(_ place: SharedPlace) -> Bool {
        guard let fileURL else { return false }
        do {
            try JSONEncoder().encode(pending() + [place]).write(to: fileURL, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    static func remove(_ id: String) {
        guard let fileURL else { return }
        let rest = pending().filter { $0.id != id }
        if rest.isEmpty {
            try? FileManager.default.removeItem(at: fileURL)
        } else {
            try? JSONEncoder().encode(rest).write(to: fileURL, options: .atomic)
        }
    }
}
