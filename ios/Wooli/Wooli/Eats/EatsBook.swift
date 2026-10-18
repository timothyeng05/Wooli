import Foundation
import CloudKit
import Observation
import os

/// Your Eats list and the lists friends share with you. Kept on this
/// iPhone as a JSON file and synced through CloudKit: your places live in
/// one zone ("eats") in your private database, shared read-only with the
/// friends you invite; their zones show up in your shared database.
///
/// CloudKit traffic rides on `TripStore`'s sync engines (one engine per
/// database, as Apple recommends); TripStore hands over anything in an
/// "eats" zone through the hooks at the bottom.
@MainActor
@Observable
final class EatsBook {
    static let shared = EatsBook()
    static let zoneName = "eats"
    static let myZoneID = CKRecordZone.ID(zoneName: zoneName, ownerName: CKCurrentUserDefaultName)

    private(set) var mine: [EatsPlace] = []
    private(set) var friends: [EatsFriend] = []
    /// You've shared your list with someone.
    private(set) var isSharing = false
    /// A friend whose list to open right away (after accepting their invite).
    var friendToShow: String?
    var lastError: String?

    @ObservationIgnored private var started = false
    @ObservationIgnored private let log = Logger(subsystem: "com.timothyeng.wooli", category: "Eats")

    private struct Saved: Codable {
        var mine: [EatsPlace]
        var friends: [EatsFriend]
        var isSharing: Bool
    }

    private static var fileURL: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "Eats", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "eats.json")
    }

    /// Loads on first use, so nothing (e.g. TripStore resetting sync state
    /// at launch) can save over the file before it's read.
    private init() {
        if let data = try? Data(contentsOf: Self.fileURL), let saved = try? JSONDecoder().decode(Saved.self, from: data) {
            mine = saved.mine
            friends = saved.friends
            isSharing = saved.isSharing
        }
    }

    /// Called by `TripStore.start()` once its sync engines exist.
    func start() {
        guard !started else { return }
        started = true
        // Places added while offline or before signing in to iCloud.
        let unsent = mine.filter { $0.systemFields == nil }.map(recordID)
        if !unsent.isEmpty { TripStore.shared.queueEats(saving: unsent) }
    }

    private func persist() {
        do {
            try JSONEncoder().encode(Saved(mine: mine, friends: friends, isSharing: isSharing)).write(to: Self.fileURL, options: .atomic)
        } catch {
            log.error("Couldn't save Eats: \(error)")
        }
    }

    private func recordID(_ place: EatsPlace) -> CKRecord.ID { CKRecord.ID(recordName: place.id, zoneID: Self.myZoneID) }

    // MARK: - Reading

    /// Places you've ranked.
    var ranked: [EatsPlace] { mine.filter { !$0.isWishlist } }
    /// Your Want to try list, newest first.
    var wishlist: [EatsPlace] { mine.filter(\.isWishlist).sorted { $0.createdAt > $1.createdAt } }

    /// Your place for a trip meal, once ranked.
    func place(forTripItem itemID: String) -> EatsPlace? { mine.first { $0.tripItemID == itemID } }

    func friend(_ id: String) -> EatsFriend? { friends.first { $0.id == id } }

    struct FriendScore: Identifiable {
        let friend: EatsFriend
        let score: Double
        var id: String { friend.id }
    }

    /// Friends who've ranked the same restaurant, with their score.
    func friendScores(for place: EatsPlace) -> [FriendScore] {
        friends.compactMap { friend in
            guard let theirs = friend.places.first(where: { !$0.isWishlist && $0.isSamePlace(as: place) }),
                  let score = friend.scores[theirs.id] else { return nil }
            return FriendScore(friend: friend, score: score)
        }
    }

    // MARK: - Editing

    func save(_ place: EatsPlace) {
        if let i = mine.firstIndex(where: { $0.id == place.id }) {
            var place = place
            place.systemFields = mine[i].systemFields
            mine[i] = place
        } else {
            mine.append(place)
        }
        persist()
        TripStore.shared.queueEats(saving: [recordID(place)])
    }

    func delete(_ place: EatsPlace) {
        mine.removeAll { $0.id == place.id }
        persist()
        TripStore.shared.queueEats(deleting: [recordID(place)])
    }

    /// Save a place to try (from Apple Maps search).
    func addToWishlist(_ tripPlace: TripPlace) {
        var place = EatsPlace(name: tripPlace.name, place: tripPlace)
        guard !mine.contains(where: { $0.isSamePlace(as: place) }) else { return }
        place.isWishlist = true
        save(place)
    }

    /// You went to a Want to try place: it joins your ranked list.
    func markBeen(_ place: EatsPlace, sentiment: MealSentiment, rank: Double) {
        var place = place
        place.isWishlist = false
        place.sentiment = sentiment
        place.rank = rank
        place.visitedDay = DayKey.key(.now)
        save(place)
    }

    /// Adds a ranked trip meal, linked back to its trip. If it was on your
    /// Want to try list, that entry moves over instead of a copy.
    func add(_ item: TripItem, sentiment: MealSentiment, rank: Double) {
        let fresh = EatsPlace(name: item.rankCandidate.title, place: item.place, visitedDay: item.day ?? DayKey.key(.now))
        var place = wishlist.first { $0.isSamePlace(as: fresh) }.map { wish in
            var wish = wish
            wish.isWishlist = false
            wish.visitedDay = fresh.visitedDay
            return wish
        } ?? fresh
        place.tripID = item.tripID
        place.tripItemID = item.id
        place.sentiment = sentiment
        place.rank = rank
        save(place)
    }

    // MARK: - Friends

    /// The share for your list, created the first time.
    func share() async throws -> CKShare {
        let share = try await TripStore.shared.eatsShare()
        isSharing = true
        persist()
        return share
    }

    /// Stop following a friend's list (they can invite you again).
    func unfollow(_ friend: EatsFriend) {
        friends.removeAll { $0.id == friend.id }
        persist()
        TripStore.shared.leaveSharedZone(CKRecordZone.ID(zoneName: Self.zoneName, ownerName: friend.id))
    }

    func didAccept(_ metadata: CKShare.Metadata) {
        let owner = metadata.share.recordID.zoneID.ownerName
        let name = metadata.ownerIdentity.nameComponents?.formatted() ?? "Friend"
        if let i = friends.firstIndex(where: { $0.id == owner }) {
            friends[i].name = name
        } else {
            friends.append(EatsFriend(id: owner, name: name))
        }
        persist()
        friendToShow = owner
    }

    func setSharing(_ sharing: Bool) {
        guard isSharing != sharing else { return }
        isSharing = sharing
        persist()
    }

    // MARK: - Sync hooks (called by TripStore)

    static func isEatsZone(_ zoneID: CKRecordZone.ID) -> Bool { zoneID.zoneName == zoneName }

    private static func isMine(_ zoneID: CKRecordZone.ID) -> Bool { zoneID.ownerName == CKCurrentUserDefaultName }

    var allMyRecordIDs: [CKRecord.ID] { mine.map(recordID) }

    func record(for recordID: CKRecord.ID) -> CKRecord? {
        mine.first { $0.id == recordID.recordName }?.record(in: Self.myZoneID)
    }

    func apply(_ record: CKRecord) {
        let zoneID = record.recordID.zoneID
        if record.recordType == CKRecord.SystemType.share {
            if Self.isMine(zoneID) {
                isSharing = true
            } else if let share = record as? CKShare {
                let name = share.owner.userIdentity.nameComponents?.formatted()
                updateFriend(zoneID.ownerName) { friend in if let name, !name.isEmpty { friend.name = name } }
            }
        } else if record.recordType == EatsPlace.recordType {
            let place = EatsPlace(record: record, keepSystemFields: Self.isMine(zoneID))
            if Self.isMine(zoneID) {
                if let i = mine.firstIndex(where: { $0.id == place.id }) { mine[i] = place } else { mine.append(place) }
            } else {
                updateFriend(zoneID.ownerName) { friend in
                    if let i = friend.places.firstIndex(where: { $0.id == place.id }) { friend.places[i] = place } else { friend.places.append(place) }
                }
            }
        }
        persist()
    }

    private func updateFriend(_ owner: String, _ change: (inout EatsFriend) -> Void) {
        if let i = friends.firstIndex(where: { $0.id == owner }) {
            change(&friends[i])
        } else {
            var friend = EatsFriend(id: owner)
            change(&friend)
            friends.append(friend)
        }
    }

    func removeRecord(_ recordID: CKRecord.ID, isShare: Bool) {
        let zoneID = recordID.zoneID
        if Self.isMine(zoneID) {
            if isShare { isSharing = false } else { mine.removeAll { $0.id == recordID.recordName } }
        } else if isShare {
            friends.removeAll { $0.id == zoneID.ownerName }
        } else {
            updateFriend(zoneID.ownerName) { $0.places.removeAll { $0.id == recordID.recordName } }
        }
        persist()
    }

    /// A zone went away: a friend stopped sharing (or you left), or — for
    /// your own — it was deleted on the server, so upload everything again.
    func removeZone(_ zoneID: CKRecordZone.ID) {
        if Self.isMine(zoneID) {
            resetSync()
            TripStore.shared.queueEats(saving: allMyRecordIDs)
        } else {
            friends.removeAll { $0.id == zoneID.ownerName }
            persist()
        }
    }

    func storeSystemFields(of record: CKRecord) {
        guard let i = mine.firstIndex(where: { $0.id == record.recordID.recordName }) else { return }
        mine[i].systemFields = record.encodedSystemFields
        persist()
    }

    func clearSystemFields(_ recordName: String) {
        guard let i = mine.firstIndex(where: { $0.id == recordName }) else { return }
        mine[i].systemFields = nil
        persist()
    }

    /// New CloudKit environment or account: forget sync bookkeeping and
    /// friends (their shares belong to the old one). Your places stay
    /// unless `keepMine` is false (someone else's iCloud now) — then
    /// they're copied aside first, like trips.
    func resetSync(keepMine: Bool = true) {
        if !keepMine, !mine.isEmpty, let data = try? Data(contentsOf: Self.fileURL) {
            let stamp = Date.now.formatted(.iso8601).replacingOccurrences(of: ":", with: "-")
            try? data.write(to: Self.fileURL.deletingLastPathComponent().appending(path: "eats-\(stamp)-account-switch.json"))
        }
        mine = keepMine ? mine.map { place in
            var place = place
            place.systemFields = nil
            return place
        } : []
        friends = []
        isSharing = false
        persist()
    }
}
