import Foundation

// Compiled into both the app and the share extension (WooliShare): a place
// shared from Apple Maps (or an Instagram reel) waits in the App Group
// container until the app opens and adds it to Eats or a trip.

/// A place shared to Wooli, waiting for the app to pick it up.
struct SharedPlace: Codable, Identifiable, Hashable {
    enum Destination: String, Codable {
        case eats, eatsWishlist, tripIdeas, sights
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

/// An Instagram reel or post shared to Wooli; the app reads its caption and
/// saves it as a recipe or looks for places in it, whichever it reads as.
struct SharedReel: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var url: URL
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

    // MARK: Reels (their own file, so older app builds never see them)

    private static var reelsURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appending(path: "shared-reels.json")
    }

    static func pendingReels() -> [SharedReel] {
        guard let reelsURL, let data = try? Data(contentsOf: reelsURL) else { return [] }
        return (try? JSONDecoder().decode([SharedReel].self, from: data)) ?? []
    }

    @discardableResult
    static func add(_ reel: SharedReel) -> Bool {
        guard let reelsURL else { return false }
        do {
            // Sharing the same reel twice queues it once.
            let others = pendingReels().filter { $0.url != reel.url }
            try JSONEncoder().encode(others + [reel]).write(to: reelsURL, options: .atomic)
            return true
        } catch {
            return false
        }
    }

    /// Removes every queued copy of that reel.
    static func removeReel(_ url: URL) {
        guard let reelsURL else { return }
        let rest = pendingReels().filter { $0.url != url }
        if rest.isEmpty {
            try? FileManager.default.removeItem(at: reelsURL)
        } else {
            try? JSONEncoder().encode(rest).write(to: reelsURL, options: .atomic)
        }
    }

    /// instagram.com/reel/…, /reels/…, /p/… or /tv/… links.
    static func isInstagramPost(_ url: URL) -> Bool {
        guard url.host?.hasSuffix("instagram.com") == true else { return false }
        return ["reel", "reels", "p", "tv"].contains(url.pathComponents.dropFirst().first ?? "")
    }
}
