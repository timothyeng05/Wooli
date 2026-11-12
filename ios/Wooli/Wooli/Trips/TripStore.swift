import Foundation
import CloudKit
import Observation
import os

/// Trips and their items, kept on this iPhone (a JSON file, so they open
/// offline) and synced with CloudKit by two `CKSyncEngine`s: one for trips
/// you made (private database) and one for trips shared with you (shared
/// database). Edits are saved locally first and sent when iCloud is reachable.
/// The same engines carry Eats lists (`EatsBook`): anything in an "eats" zone
/// is handed to it, since Apple recommends one sync engine per database.
@MainActor
@Observable
final class TripStore: CKSyncEngineDelegate {
    static let shared = TripStore()
    static let containerID = "iCloud.com.timothyeng.wooli"

    private(set) var trips: [Trip] = []
    private(set) var items: [TripItem] = []
    /// False when no iCloud account is signed in: trips stay on this iPhone.
    private(set) var iCloudAvailable = true
    var lastError: String?
    /// A trip to open right away (e.g. after accepting an invite).
    var tripToOpen: String?
    /// File → New Trip… on the Mac asks the trips list to open its sheet.
    var newTripRequested = false

    /// The window's undo stack (set by the Mac trip page); nil on the iPhone.
    @ObservationIgnored weak var undoManager: UndoManager?
    @ObservationIgnored let container = CKContainer(identifier: containerID)
    @ObservationIgnored private var privateEngine: CKSyncEngine?
    @ObservationIgnored private var sharedEngine: CKSyncEngine?
    /// Saves per trip/item since launch, and the count each record had when it
    /// was last handed to the engine. The engine clears a queued save once it
    /// succeeds, even if the record was edited again while it was uploading;
    /// the two counts tell us when that happened so the newer edit is queued again.
    @ObservationIgnored private var editCount: [String: Int] = [:]
    @ObservationIgnored private var sentEditCount: [String: Int] = [:]
    @ObservationIgnored private var privateState: CKSyncEngine.State.Serialization?
    @ObservationIgnored private var sharedState: CKSyncEngine.State.Serialization?
    @ObservationIgnored private let log = Logger(subsystem: "com.timothyeng.wooli", category: "Trips")

    /// The budget's SwiftData store syncs through the same container; the
    /// trip engines must never fetch (or touch) its zone.
    private static let budgetZoneID = CKRecordZone.ID(zoneName: "com.apple.coredata.cloudkit.zone", ownerName: CKCurrentUserDefaultName)

    private struct Saved: Codable {
        var trips: [Trip]
        var items: [TripItem]
        var privateState: CKSyncEngine.State.Serialization?
        var sharedState: CKSyncEngine.State.Serialization?
        /// CloudKit environment the sync state belongs to; nil in files
        /// written before this was stored (always development builds).
        var environment: String?
        /// Trips still need uploading to this environment (kept until an
        /// upload goes through, e.g. once the production schema is deployed).
        var needsFullUpload: Bool?
    }

    /// Builds installed from Xcode sync with CloudKit's development
    /// environment; TestFlight and App Store builds with production. On a
    /// device only development-signed builds carry an embedded provisioning
    /// profile; the Simulator always uses development.
    private static let environment: String = {
        #if targetEnvironment(simulator)
        return "development"
        #elseif os(macOS)
        // A Mac app carries its CloudKit environment as an entitlement (Wooli-macOS*.entitlements).
        guard let task = SecTaskCreateFromSelf(nil),
              let value = SecTaskCopyValueForEntitlement(task, "com.apple.developer.icloud-container-environment" as CFString, nil) as? String
        else { return "production" }
        return value.lowercased()
        #else
        return Bundle.main.path(forResource: "embedded", ofType: "mobileprovision") == nil ? "production" : "development"
        #endif
    }()
    @ObservationIgnored private var needsFullUpload = false

    private static var fileURL: URL {
        let dir = URL.applicationSupportDirectory.appending(path: "Trips", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appending(path: "trips.json")
    }

    // MARK: - Start up

    func start() {
        guard privateEngine == nil else { return }
        load()
        startEngines()
        EatsBook.shared.start()
        if needsFullUpload { uploadEverythingMine() }
        importPendingFile()
        Task { await refreshAccountStatus() }
    }

    private func startEngines() {
        privateEngine = CKSyncEngine(.init(database: container.privateCloudDatabase, stateSerialization: privateState, delegate: self))
        sharedEngine = CKSyncEngine(.init(database: container.sharedCloudDatabase, stateSerialization: sharedState, delegate: self))
    }

    func refreshAccountStatus() async {
        iCloudAvailable = (try? await container.accountStatus()) == .available
    }

    /// Pull to refresh.
    func fetchChanges() async {
        await refreshAccountStatus()
        do {
            try await privateEngine?.fetchChanges()
            try await sharedEngine?.fetchChanges()
        } catch {
            log.error("Fetch failed: \(error)")
        }
    }

    private func load() {
        guard let data = try? Data(contentsOf: Self.fileURL),
              let saved = try? JSONDecoder().decode(Saved.self, from: data) else { return }
        trips = saved.trips
        items = saved.items
        privateState = saved.privateState
        sharedState = saved.sharedState
        needsFullUpload = saved.needsFullUpload ?? false
        if (saved.environment ?? "development") != Self.environment { moveToNewEnvironment() }
    }

    /// This build syncs with the other CloudKit environment (e.g. a TestFlight
    /// build installed over one from Xcode): none of these trips exist there
    /// yet. Forget the old sync bookkeeping and upload the trips you own;
    /// trips shared with you lived in the old environment and need a new invite.
    private func moveToNewEnvironment() {
        log.info("CloudKit environment changed to \(Self.environment); re-uploading trips")
        backUpLocalTrips(reason: "environment-\(Self.environment)")
        privateState = nil
        sharedState = nil
        let sharedWithMe = Set(trips.filter { !$0.isMine }.map(\.id))
        trips = trips.filter(\.isMine).map { trip in
            var trip = trip
            trip.systemFields = nil
            trip.isShared = false
            return trip
        }
        items = items.filter { !sharedWithMe.contains($0.tripID) }.map { item in
            var item = item
            item.systemFields = nil
            return item
        }
        needsFullUpload = true
        persist()
        EatsBook.shared.resetSync()
    }

    /// Copies the local trips file aside (Application Support/Trips/backups)
    /// before anything clears it, keeping the five most recent copies.
    private func backUpLocalTrips(reason: String) {
        guard !trips.isEmpty, let data = try? Data(contentsOf: Self.fileURL) else { return }
        let dir = Self.fileURL.deletingLastPathComponent().appending(path: "backups", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let stamp = Date.now.formatted(.iso8601).replacingOccurrences(of: ":", with: "-")
        try? data.write(to: dir.appending(path: "trips-\(stamp)-\(reason).json"))
        let old = ((try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? [])
            .sorted { $0.lastPathComponent > $1.lastPathComponent }.dropFirst(5)
        for url in old { try? FileManager.default.removeItem(at: url) }
        log.info("Backed up \(self.trips.count) trips before \(reason)")
    }

    /// Queue every trip you own (zone, trip and items) for upload.
    private func uploadEverythingMine() {
        for trip in trips where trip.isMine {
            privateEngine?.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
            privateEngine?.state.add(pendingRecordZoneChanges: [.saveRecord(trip.recordID)]
                + items(in: trip.id).map { .saveRecord(CKRecord.ID(recordName: $0.id, zoneID: trip.zoneID)) })
        }
        queueEats(saving: EatsBook.shared.allMyRecordIDs)
    }

    private func persist() {
        let saved = Saved(trips: trips, items: items, privateState: privateState, sharedState: sharedState,
                          environment: Self.environment, needsFullUpload: needsFullUpload)
        do {
            try JSONEncoder().encode(saved).write(to: Self.fileURL, options: .atomic)
        } catch {
            log.error("Couldn't save trips: \(error)")
        }
    }

    // MARK: - Import

    /// A trip handed over as a file, e.g. converted from the Wooli web app.
    struct ImportBundle: Codable {
        var trip: Trip
        var items: [TripItem]
        /// Only add `items`; leave the trip itself as this device has it. Set by
        /// Claude's `wooli_add_to_trip`, whose copy of the trip may be out of date.
        var itemsOnly: Bool?
    }

    /// Where an import is picked up from, for writers in the same app (the Mac's MCP server).
    static var pendingImportURL: URL { importURL }

    private static var importURL: URL { URL.documentsDirectory.appending(path: "trip-import.json") }

    /// Imports `Documents/trip-import.json` if present (one bundle or a list),
    /// through the normal save path so it syncs, then deletes the file.
    /// Saves are by id, so importing a corrected file again updates the trip
    /// and its items in place instead of adding copies.
    private func importPendingFile() {
        guard let data = try? Data(contentsOf: Self.importURL) else { return }
        defer { try? FileManager.default.removeItem(at: Self.importURL) }
        let bundles = (try? JSONDecoder().decode([ImportBundle].self, from: data))
            ?? (try? JSONDecoder().decode(ImportBundle.self, from: data)).map { [$0] } ?? []
        if bundles.isEmpty { log.error("Trip import file couldn't be read") }
        for bundle in bundles {
            var trip = bundle.trip
            // Keep this device's sync bookkeeping for a trip it already has.
            if let existing = self.trip(trip.id) {
                trip.systemFields = existing.systemFields
                trip.zoneOwner = existing.zoneOwner
                trip.isShared = existing.isShared
            }
            if bundle.itemsOnly != true || self.trip(trip.id) == nil { save(trip) }
            for var item in bundle.items {
                item.systemFields = items.first { $0.id == item.id }?.systemFields
                save(item)
            }
            log.info("Imported trip \(bundle.trip.name) with \(bundle.items.count) items")
        }
    }

    // MARK: - Reading

    func trip(_ id: String) -> Trip? { trips.first { $0.id == id } }

    func items(in tripID: String) -> [TripItem] { items.filter { $0.tripID == tripID && !$0.isHiddenPlaceholder } }

    /// Old empty Breakfast / Lunch / Dinner records, hidden from every list.
    func hiddenPlaceholders(in tripID: String) -> [TripItem] {
        items.filter { $0.tripID == tripID && $0.isHiddenPlaceholder }
    }

    /// A day's items: by where they were dragged or their time, then the
    /// rest in the order added.
    func items(in tripID: String, day: String?) -> [TripItem] {
        items.filter { $0.tripID == tripID && $0.day == day && !$0.isHiddenPlaceholder }.sorted(by: TripItem.dayOrder)
    }

    // MARK: - Open slots

    /// The plan an open slot becomes, not saved yet. An old empty record for
    /// the same slot is reused, so filling it in never leaves two.
    func item(for slot: OpenSlot, tripID: String) -> TripItem {
        if slot.kind == .meal, let old = hiddenPlaceholders(in: tripID).first(where: { $0.day == slot.day && $0.title == slot.title }) {
            return old
        }
        var item = TripItem(tripID: tripID, day: slot.day, kind: slot.kind == .meal ? .meal : .stay,
                            title: slot.kind == .meal ? slot.title : "", time: slot.time)
        item.checkOutDay = slot.kind == .stay ? DayKey.key(Calendar.current.date(byAdding: .day, value: 1, to: DayKey.date(slot.day))!) : nil
        return item
    }

    /// Saves an open slot as a plan so it can be selected and edited in place.
    @discardableResult
    func materialize(_ slot: OpenSlot, tripID: String) -> TripItem {
        var item = item(for: slot, tripID: tripID)
        var extras = item.extras ?? ItemExtras()
        extras.source = "slot"
        item.extras = extras
        save(item)
        return item
    }

    /// Deletes this trip's old empty meal records for everyone on it.
    func removeEmptyMealSlots(tripID: String) {
        for item in hiddenPlaceholders(in: tripID) { delete(item) }
    }

    // MARK: - Editing

    func save(_ trip: Trip) {
        let before = self.trip(trip.id)
        write(trip)
        // A new trip isn't undoable (undoing would delete it for everyone it's shared with).
        guard let before, let undoManager else { return }
        undoManager.registerUndo(withTarget: self) { $0.save(before) }
        undoManager.setActionName("Edit Trip")
    }

    private func write(_ trip: Trip) {
        var trip = trip
        let isNew = !trips.contains { $0.id == trip.id }
        // A screen's copy can be older than what the last upload stored: keep the newest change tag.
        if let i = trips.firstIndex(where: { $0.id == trip.id }) {
            trip.systemFields = trips[i].systemFields ?? trip.systemFields
            trips[i] = trip
        } else {
            trips.append(trip)
        }
        editCount[trip.id, default: 0] += 1
        persist()
        guard let engine = engine(for: trip) else { return }
        if isNew && trip.isMine {
            engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
        }
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(trip.recordID)])
    }

    /// Saves a plan and, on the Mac, lets ⌘Z take it back: an add is undone by
    /// deleting it, an edit by putting the old copy back. All the saves in one
    /// click or drag are one undo step (the undo manager groups by event).
    func save(_ item: TripItem) {
        let before = items.first { $0.id == item.id }
        write(item)
        guard let undoManager else { return }
        undoManager.registerUndo(withTarget: self) { store in
            if let before {
                store.save(before)
            } else if let current = store.items.first(where: { $0.id == item.id }) {
                store.delete(current)
            }
        }
        undoManager.setActionName(before == nil ? "Add Plan" : "Edit Plan")
    }

    private func write(_ item: TripItem) {
        var item = item
        if let i = items.firstIndex(where: { $0.id == item.id }) {
            item.systemFields = items[i].systemFields ?? item.systemFields
            items[i] = item
        } else {
            items.append(item)
        }
        editCount[item.id, default: 0] += 1
        persist()
        guard let trip = trip(item.tripID), let engine = engine(for: trip) else { return }
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(CKRecord.ID(recordName: item.id, zoneID: trip.zoneID))])
    }

    func delete(_ item: TripItem) {
        remove(item)
        guard let undoManager else { return }
        undoManager.registerUndo(withTarget: self) { store in
            // Back as the same plan, but as a new CloudKit record: the old one was deleted.
            var restored = item
            restored.systemFields = nil
            store.save(restored)
        }
        undoManager.setActionName("Delete Plan")
    }

    private func remove(_ item: TripItem) {
        items.removeAll { $0.id == item.id }
        persist()
        guard let trip = trip(item.tripID), let engine = engine(for: trip) else { return }
        engine.state.add(pendingRecordZoneChanges: [.deleteRecord(CKRecord.ID(recordName: item.id, zoneID: trip.zoneID))])
    }

    /// Deleting your own trip removes it for everyone; for a trip shared
    /// with you, deleting its zone from your shared database leaves it.
    func delete(_ trip: Trip) {
        removeLocally(tripID: trip.id)
        engine(for: trip)?.state.add(pendingDatabaseChanges: [.deleteZone(trip.zoneID)])
    }

    private func removeLocally(tripID: String) {
        trips.removeAll { $0.id == tripID }
        items.removeAll { $0.tripID == tripID }
        persist()
    }

    private func engine(for trip: Trip) -> CKSyncEngine? { trip.isMine ? privateEngine : sharedEngine }

    #if DEBUG
    /// Demo trip for Simulator checks and screenshots (`-sampleTrip`): a
    /// week in Japan starting next week — fly into Tokyo, train to Kyoto,
    /// then Osaka — with stays, sights, meals and ideas. Added once.
    func addSampleTrip() {
        guard !trips.contains(where: { $0.name == "Japan in autumn" }) else { return }
        let cal = Calendar.current
        let start = cal.date(byAdding: .day, value: 7, to: .now)!
        func day(_ n: Int) -> String { DayKey.key(cal.date(byAdding: .day, value: n - 1, to: start)!) }
        var trip = Trip(name: "Japan in autumn", destination: "Japan", startDay: day(1), endDay: day(7))
        trip.legs = [TripLeg(name: "Tokyo", emoji: "🗼", startDay: day(1), endDay: day(3)),
                     TripLeg(name: "Kyoto", emoji: "⛩️", startDay: day(3), endDay: day(5)),
                     TripLeg(name: "Osaka", emoji: "🏯", startDay: day(5), endDay: day(7))]
        save(trip)

        let samples: [(String?, TripItem.Kind, String, Int?, Double, Double, String?)] = [
            (day(1), .stay, "Park Hyatt Tokyo", 15 * 60, 35.6856, 139.6907, day(3)),
            (day(1), .activity, "Meiji Jingu", 10 * 60, 35.6764, 139.6993, nil),
            (day(1), .meal, "Ichiran Shibuya", 13 * 60, 35.6611, 139.7011, nil),
            (day(1), .activity, "Shibuya Sky", 18 * 60, 35.6585, 139.7023, nil),
            (day(2), .meal, "Tsukiji Outer Market", 8 * 60, 35.6655, 139.7707, nil),
            (day(2), .activity, "teamLab Planets", 11 * 60, 35.6491, 139.7898, nil),
            (day(2), .activity, "Senso-ji", 16 * 60, 35.7148, 139.7967, nil),
            (day(3), .stay, "Ace Hotel Kyoto", 15 * 60, 35.0050, 135.7640, day(5)),
            (day(3), .meal, "Nishiki Market", 13 * 60, 35.0050, 135.7649, nil),
            (day(4), .activity, "Fushimi Inari Taisha", 7 * 60, 34.9671, 135.7727, nil),
            (day(4), .activity, "Arashiyama Bamboo Grove", 11 * 60, 35.0170, 135.6713, nil),
            (day(4), .activity, "Kinkaku-ji", 15 * 60, 35.0394, 135.7292, nil),
            (day(5), .stay, "Conrad Osaka", 15 * 60, 34.6946, 135.4930, day(7)),
            (day(5), .activity, "Osaka Castle", 16 * 60, 34.6873, 135.5262, nil),
            (day(6), .meal, "Kuromon Market", 10 * 60, 34.6656, 135.5066, nil),
            (day(6), .activity, "Dotonbori", 19 * 60, 34.6687, 135.5013, nil),
            (nil, .activity, "Nara Park day trip", nil, 34.6851, 135.8430, nil),
            (nil, .meal, "Omoide Yokocho", nil, 35.6930, 139.6995, nil),
        ]
        for (i, s) in samples.enumerated() {
            var item = TripItem(tripID: trip.id, day: s.0, kind: s.1, title: s.2, time: s.3,
                                place: TripPlace(name: s.2, latitude: s.4, longitude: s.5),
                                createdAt: Date.now.addingTimeInterval(Double(i)))
            item.checkOutDay = s.6
            save(item)
        }

        var flight = TripTransport(mode: .flight)
        flight.flightNumber = "CX548"
        flight.airline = "Cathay Pacific"
        flight.fromAirport = "HKG"
        flight.toAirport = "HND"
        flight.arriveTime = 6 * 60 + 20
        flight.arriveTerminal = "3"
        flight.cabin = "Economy"
        flight.seats = "42A, 42B"
        flight.confirmation = "QX7M2P"
        save(TripItem(tripID: trip.id, day: day(1), kind: .transit, title: "CX548 Hong Kong → Tokyo", time: 1 * 60 + 5,
                      transport: flight, createdAt: Date.now.addingTimeInterval(-3)))
        for (n, from, to, depart, arrive, a, b) in [
            (3, "Tokyo Station", "Kyoto Station", 9 * 60, 11 * 60 + 15, (35.6812, 139.7671), (34.9858, 135.7588)),
            (5, "Kyoto Station", "Shin-Osaka Station", 11 * 60, 11 * 60 + 15, (34.9858, 135.7588), (34.7334, 135.5001)),
        ] {
            var train = TripTransport(mode: .train)
            train.fromStation = TripPlace(name: from, latitude: a.0, longitude: a.1)
            train.toStation = TripPlace(name: to, latitude: b.0, longitude: b.1)
            train.arriveTime = arrive
            train.seats = "Car 7 · 12D, 12E"
            save(TripItem(tripID: trip.id, day: day(n), kind: .transit, title: "Shinkansen \(from) → \(to)", time: depart,
                          transport: train, createdAt: Date.now.addingTimeInterval(-2)))
        }
    }
    #endif

    // MARK: - Sharing

    /// The trip's share, creating it the first time. The zone has to exist
    /// in iCloud first, so pending changes are sent before sharing. If the
    /// server-side zone is gone (e.g. a CloudKit reset during testing) while
    /// the device still thinks the trip is synced, recreate it and push the
    /// trip again before sharing, the same recovery `handleFailedSave` does
    /// for ordinary record saves.
    func share(for trip: Trip) async throws -> CKShare {
        let shareID = CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: trip.zoneID)
        let database = trip.isMine ? container.privateCloudDatabase : container.sharedCloudDatabase
        do {
            if let existing = try await database.record(for: shareID) as? CKShare { return existing }
        } catch let error as CKError where error.code == .zoneNotFound {
            guard trip.isMine else { throw error }
            try await recreateZone(for: trip)
        } catch is CKError {
            // No share yet (e.g. unknownItem): fall through to create one.
        }
        guard trip.isMine else { throw CKError(.unknownItem) }
        // The zone and records have to be in iCloud before they can be shared.
        privateEngine?.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
        privateEngine?.state.add(pendingRecordZoneChanges: [.saveRecord(trip.recordID)])
        try await privateEngine?.sendChanges()
        do {
            return try await createShare(for: trip)
        } catch let error as CKError where error.code == .zoneNotFound {
            try await recreateZone(for: trip)
            return try await createShare(for: trip)
        }
    }

    private func createShare(for trip: Trip) async throws -> CKShare {
        let share = CKShare(recordZoneID: trip.zoneID)
        share[CKShare.SystemFieldKey.title] = trip.name
        _ = try await container.privateCloudDatabase.modifyRecords(saving: [share], deleting: [])
        setShared(true, tripID: trip.id)
        return share
    }

    /// Recreates a trip's zone and pushes its record plus items back up.
    private func recreateZone(for trip: Trip) async throws {
        guard let engine = privateEngine else { return }
        engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(trip.recordID)]
            + items(in: trip.id).map { .saveRecord(CKRecord.ID(recordName: $0.id, zoneID: trip.zoneID)) })
        try await engine.sendChanges()
    }

    func setShared(_ shared: Bool, tripID: String) {
        guard let i = trips.firstIndex(where: { $0.id == tripID }), trips[i].isShared != shared else { return }
        trips[i].isShared = shared
        persist()
    }

    /// Someone tapped an invite link (see `WooliSceneDelegate`).
    func accept(_ metadata: CKShare.Metadata) async {
        do {
            _ = try await container.accept(metadata)
            // Before fetching, so a partner's list lands as your list, not a friend's.
            if EatsBook.isEatsZone(metadata.share.recordID.zoneID) { EatsBook.shared.didAccept(metadata) }
            try await sharedEngine?.fetchChanges()
            if EatsBook.shared.inPartnersList { await downloadPartnersList() }
            if let tripID = Trip.tripID(from: metadata.share.recordID.zoneID) { tripToOpen = tripID }
        } catch {
            lastError = "Couldn't accept the invite: \(error.localizedDescription)"
        }
    }

    // MARK: - Eats

    /// Queue changes to an Eats list: yours through the private database
    /// (its zone is created on first save), your partner's joint list
    /// through the shared one.
    func queueEats(saving: [CKRecord.ID] = [], deleting: [CKRecord.ID] = []) {
        for ownZone in [true, false] {
            let save = saving.filter { ($0.zoneID.ownerName == CKCurrentUserDefaultName) == ownZone }
            let delete = deleting.filter { ($0.zoneID.ownerName == CKCurrentUserDefaultName) == ownZone }
            guard let engine = ownZone ? privateEngine : sharedEngine, !(save.isEmpty && delete.isEmpty) else { continue }
            if ownZone && !save.isEmpty { engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: EatsBook.myZoneID))]) }
            engine.state.add(pendingRecordZoneChanges: save.map { .saveRecord($0) } + delete.map { .deleteRecord($0) })
        }
    }

    /// Everything in your partner's list, read straight from iCloud. The sync
    /// engine only sends what changed since it last looked, so a list this
    /// phone already saw (e.g. followed as a friend before) would stay empty.
    func downloadPartnersList() async {
        guard EatsBook.shared.inPartnersList else { return }
        let zoneID = EatsBook.shared.listZoneID
        var token: CKServerChangeToken?
        do {
            while true {
                let changes = try await container.sharedCloudDatabase.recordZoneChanges(inZoneWith: zoneID, since: token)
                for (_, result) in changes.modificationResultsByID {
                    if case .success(let modification) = result { EatsBook.shared.apply(modification.record) }
                }
                token = changes.changeToken
                if !changes.moreComing { break }
            }
        } catch {
            log.error("Couldn't download the shared Eats list: \(error)")
            EatsBook.shared.lastError = "Couldn't load your shared list: \(error.localizedDescription)"
        }
    }

    /// Makes your Eats partner an administrator of your list's share, so they
    /// can invite and manage friends too (iCloud only lets the owner and
    /// administrators add people).
    func promotePartners(in share: CKShare) async {
        let partners = share.participants.filter(EatsBook.isUnpromotedPartner)
        guard !partners.isEmpty else { return }
        for partner in partners { partner.role = .administrator }
        do {
            _ = try await container.privateCloudDatabase.modifyRecords(saving: [share], deleting: [])
        } catch {
            log.error("Couldn't make the Eats partner an administrator: \(error)")
        }
    }

    /// The share of your partner's Eats list, from the shared database.
    func partnersEatsShare(_ zoneID: CKRecordZone.ID) async throws -> CKShare {
        let shareID = CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zoneID)
        guard let share = try await container.sharedCloudDatabase.record(for: shareID) as? CKShare else { throw CKError(.unknownItem) }
        return share
    }

    /// Leave a zone someone shared with you (an Eats list you follow).
    func leaveSharedZone(_ zoneID: CKRecordZone.ID) {
        sharedEngine?.state.add(pendingDatabaseChanges: [.deleteZone(zoneID)])
    }

    /// The read-only share for your Eats list, created the first time.
    func eatsShare() async throws -> CKShare {
        let zoneID = EatsBook.myZoneID
        let shareID = CKRecord.ID(recordName: CKRecordNameZoneWideShare, zoneID: zoneID)
        do {
            if let existing = try await container.privateCloudDatabase.record(for: shareID) as? CKShare { return existing }
        } catch is CKError {
            // No zone or share yet: create them below.
        }
        privateEngine?.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: zoneID))])
        try await privateEngine?.sendChanges()
        let share = CKShare(recordZoneID: zoneID)
        share[CKShare.SystemFieldKey.title] = "My Eats list"
        share.publicPermission = .none
        _ = try await container.privateCloudDatabase.modifyRecords(saving: [share], deleting: [])
        return share
    }

    // MARK: - CKSyncEngineDelegate

    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        let isShared = syncEngine === sharedEngine
        switch event {
        case .stateUpdate(let update):
            if isShared { sharedState = update.stateSerialization } else { privateState = update.stateSerialization }
            persist()

        case .accountChange(let change):
            handleAccountChange(change)

        case .fetchedDatabaseChanges(let changes):
            // A trip zone disappeared: the owner deleted it, or stopped sharing.
            for deletion in changes.deletions {
                if let tripID = Trip.tripID(from: deletion.zoneID) { removeLocally(tripID: tripID) }
                if EatsBook.isEatsZone(deletion.zoneID) { EatsBook.shared.removeZone(deletion.zoneID) }
            }

        case .fetchedRecordZoneChanges(let changes):
            // A record with an edit still waiting to go up keeps the edit:
            // only the server's change tag is taken, so the upload wins.
            // (Without this, re-downloading a whole environment replaced
            // fresh edits with the server's old copies.)
            let unsent = Set(syncEngine.state.pendingRecordZoneChanges.compactMap { change -> CKRecord.ID? in
                if case .saveRecord(let id) = change { id } else { nil }
            })
            for modification in changes.modifications {
                if unsent.contains(modification.record.recordID), hasLocalCopy(of: modification.record.recordID) {
                    storeSystemFields(of: modification.record)
                } else {
                    apply(modification.record)
                }
            }
            for deletion in changes.deletions {
                if EatsBook.isEatsZone(deletion.recordID.zoneID) {
                    EatsBook.shared.removeRecord(deletion.recordID, isShare: deletion.recordType == CKRecord.SystemType.share)
                    continue
                }
                guard let tripID = Trip.tripID(from: deletion.recordID.zoneID) else { continue }
                if deletion.recordType == CKRecord.SystemType.share {
                    setShared(false, tripID: tripID)
                } else {
                    items.removeAll { $0.id == deletion.recordID.recordName }
                }
            }
            persist()

        case .sentRecordZoneChanges(let sent):
            for record in sent.savedRecords {
                storeSystemFields(of: record)
                // Edited again while this upload was in flight: the engine just cleared that save.
                let name = record.recordID.recordName
                if let sentCount = sentEditCount[name], sentCount != editCount[name, default: 0] {
                    syncEngine.state.add(pendingRecordZoneChanges: [.saveRecord(record.recordID)])
                }
            }
            for failure in sent.failedRecordSaves { handleFailedSave(failure, engine: syncEngine) }
            if needsFullUpload && !sent.savedRecords.isEmpty && sent.failedRecordSaves.isEmpty { needsFullUpload = false }
            persist()

        case .sentDatabaseChanges, .willFetchChanges, .willFetchRecordZoneChanges, .didFetchRecordZoneChanges,
             .didFetchChanges, .willSendChanges, .didSendChanges:
            break

        @unknown default:
            break
        }
    }

    func nextRecordZoneChangeBatch(_ context: CKSyncEngine.SendChangesContext, syncEngine: CKSyncEngine) async -> CKSyncEngine.RecordZoneChangeBatch? {
        let pending = syncEngine.state.pendingRecordZoneChanges.filter { context.options.scope.contains($0) }
        guard !pending.isEmpty else { return nil }
        return await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: pending) { recordID in
            await self.record(for: recordID, engine: syncEngine)
        }
    }

    func nextFetchChangesOptions(_ context: CKSyncEngine.FetchChangesContext, syncEngine: CKSyncEngine) async -> CKSyncEngine.FetchChangesOptions {
        CKSyncEngine.FetchChangesOptions(scope: .allExcluding([Self.budgetZoneID]))
    }

    // MARK: - Sync helpers

    private func record(for recordID: CKRecord.ID, engine: CKSyncEngine) -> CKRecord? {
        if EatsBook.isEatsZone(recordID.zoneID) {
            if let record = EatsBook.shared.record(for: recordID) { return record }
            engine.state.remove(pendingRecordZoneChanges: [.saveRecord(recordID)])
            return nil
        }
        if let trip = trip(recordID.recordName) {
            sentEditCount[trip.id] = editCount[trip.id, default: 0]
            return trip.record()
        }
        if let item = items.first(where: { $0.id == recordID.recordName }) {
            sentEditCount[item.id] = editCount[item.id, default: 0]
            return item.record(in: recordID.zoneID)
        }
        // Deleted here since it was queued: nothing to send.
        engine.state.remove(pendingRecordZoneChanges: [.saveRecord(recordID)])
        return nil
    }

    private func apply(_ record: CKRecord) {
        let zoneID = record.recordID.zoneID
        if EatsBook.isEatsZone(zoneID) {
            EatsBook.shared.apply(record)
            return
        }
        guard let tripID = Trip.tripID(from: zoneID) else { return }
        switch record.recordType {
        case Trip.recordType:
            var trip = trip(tripID) ?? Trip(id: tripID)
            trip.zoneOwner = zoneID.ownerName == CKCurrentUserDefaultName ? "" : zoneID.ownerName
            trip.apply(record)
            if let i = trips.firstIndex(where: { $0.id == tripID }) { trips[i] = trip } else { trips.append(trip) }
        case TripItem.recordType:
            let item = TripItem(record: record, tripID: tripID)
            if let i = items.firstIndex(where: { $0.id == item.id }) { items[i] = item } else { items.append(item) }
        case CKRecord.SystemType.share:
            if zoneID.ownerName == CKCurrentUserDefaultName { setShared(true, tripID: tripID) }
        default:
            break
        }
    }

    private func hasLocalCopy(of recordID: CKRecord.ID) -> Bool {
        if EatsBook.isEatsZone(recordID.zoneID) { return EatsBook.shared.record(for: recordID) != nil }
        return trip(recordID.recordName) != nil || items.contains { $0.id == recordID.recordName }
    }

    private func storeSystemFields(of record: CKRecord) {
        if EatsBook.isEatsZone(record.recordID.zoneID) {
            EatsBook.shared.storeSystemFields(of: record)
            return
        }
        let fields = record.encodedSystemFields
        if let i = trips.firstIndex(where: { $0.id == record.recordID.recordName }) {
            trips[i].systemFields = fields
        } else if let i = items.firstIndex(where: { $0.id == record.recordID.recordName }) {
            items[i].systemFields = fields
        }
    }

    private func handleFailedSave(_ failure: CKSyncEngine.Event.SentRecordZoneChanges.FailedRecordSave, engine: CKSyncEngine) {
        let recordID = failure.record.recordID
        switch failure.error.code {
        case .serverRecordChanged:
            // Someone else saved first. Take their change tag and send ours
            // again: the last edit to a field wins.
            if let server = failure.error.serverRecord { storeSystemFields(of: server) }
            engine.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
        case .zoneNotFound:
            if EatsBook.isEatsZone(recordID.zoneID) {
                guard recordID.zoneID.ownerName == CKCurrentUserDefaultName else {
                    EatsBook.shared.removeZone(recordID.zoneID) // Your partner's list is gone.
                    return
                }
                engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: recordID.zoneID))])
                engine.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
                return
            }
            guard let tripID = Trip.tripID(from: recordID.zoneID), let trip = trip(tripID) else { return }
            if trip.isMine {
                engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
                engine.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
            } else {
                removeLocally(tripID: tripID) // The owner deleted it.
            }
        case .unknownItem:
            // Deleted on the server; saving again recreates it from scratch.
            if let i = trips.firstIndex(where: { $0.id == recordID.recordName }) { trips[i].systemFields = nil }
            if let i = items.firstIndex(where: { $0.id == recordID.recordName }) { items[i].systemFields = nil }
            EatsBook.shared.clearSystemFields(recordID.recordName)
            engine.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
        case .permissionFailure:
            if EatsBook.isEatsZone(recordID.zoneID) {
                EatsBook.shared.lastError = "You can view this list but not edit it."
            } else {
                lastError = "You can view this trip but not edit it."
            }
        case .networkUnavailable, .networkFailure, .serviceUnavailable, .requestRateLimited, .zoneBusy:
            // Retried by the engine.
            log.error("Save failed for \(recordID.recordName): \(failure.error)")
        default:
            log.error("Save failed for \(recordID.recordName): \(failure.error)")
            // Say so for Eats: otherwise a list that never reaches iCloud (e.g.
            // the production schema isn't deployed) looks fine on this phone
            // and empty on your partner's.
            if EatsBook.isEatsZone(recordID.zoneID) {
                EatsBook.shared.lastError = "Your Eats list couldn't sync to iCloud: \(failure.error.localizedDescription)"
            }
        }
    }

    private func handleAccountChange(_ change: CKSyncEngine.Event.AccountChange) {
        switch change.changeType {
        case .signIn:
            // Trips made before signing in: send them up.
            iCloudAvailable = true
            uploadEverythingMine()
        case .signOut:
            // Keep the trips on this iPhone; they sync again on sign-in.
            iCloudAvailable = false
            privateState = nil
            sharedState = nil
            needsFullUpload = true
            persist()
            startEngines()
        case .switchAccounts:
            // Someone else's iCloud now: their trips aren't these. Never just
            // delete — a mistaken "switch" (seen when a TestFlight build met
            // data from an Xcode build) wiped trips. Keep a copy first.
            backUpLocalTrips(reason: "account-switch")
            EatsBook.shared.resetSync(keepMine: false)
            trips = []
            items = []
            privateState = nil
            sharedState = nil
            persist()
            startEngines()
            Task { await refreshAccountStatus() }
        @unknown default:
            break
        }
    }
}
