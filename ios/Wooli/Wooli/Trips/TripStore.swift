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

    @ObservationIgnored let container = CKContainer(identifier: containerID)
    @ObservationIgnored private var privateEngine: CKSyncEngine?
    @ObservationIgnored private var sharedEngine: CKSyncEngine?
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
    }

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
            save(trip)
            for var item in bundle.items {
                item.systemFields = items.first { $0.id == item.id }?.systemFields
                save(item)
            }
            log.info("Imported trip \(bundle.trip.name) with \(bundle.items.count) items")
        }
    }

    // MARK: - Reading

    func trip(_ id: String) -> Trip? { trips.first { $0.id == id } }

    func items(in tripID: String) -> [TripItem] { items.filter { $0.tripID == tripID } }

    /// A day's items: timed ones by time, then the rest in the order added.
    func items(in tripID: String, day: String?) -> [TripItem] {
        items.filter { $0.tripID == tripID && $0.day == day }
            .sorted { ($0.time ?? Int.max, $0.createdAt) < ($1.time ?? Int.max, $1.createdAt) }
    }

    // MARK: - Editing

    func save(_ trip: Trip) {
        let isNew = !trips.contains { $0.id == trip.id }
        if let i = trips.firstIndex(where: { $0.id == trip.id }) { trips[i] = trip } else { trips.append(trip) }
        persist()
        guard let engine = engine(for: trip) else { return }
        if isNew && trip.isMine {
            engine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: trip.zoneID))])
        }
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(trip.recordID)])
    }

    func save(_ item: TripItem) {
        if let i = items.firstIndex(where: { $0.id == item.id }) { items[i] = item } else { items.append(item) }
        persist()
        guard let trip = trip(item.tripID), let engine = engine(for: trip) else { return }
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(CKRecord.ID(recordName: item.id, zoneID: trip.zoneID))])
    }

    func delete(_ item: TripItem) {
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
    /// Demo trip for Simulator checks (`-sampleTrip`): three days in Tokyo,
    /// starting next week. Added once.
    func addSampleTrip() {
        guard !trips.contains(where: { $0.name == "Tokyo (sample)" }) else { return }
        let cal = Calendar.current
        let start = cal.date(byAdding: .day, value: 7, to: .now)!
        let trip = Trip(name: "Tokyo (sample)", destination: "Tokyo", startDay: DayKey.key(start),
                        endDay: DayKey.key(cal.date(byAdding: .day, value: 2, to: start)!))
        save(trip)
        let day1 = DayKey.key(start), day2 = DayKey.key(cal.date(byAdding: .day, value: 1, to: start)!)
        let samples: [(String?, TripItem.Kind, String, Int?, Double, Double)] = [
            (day1, .stay, "Park Hyatt Tokyo", 15 * 60, 35.6856, 139.6907),
            (day1, .activity, "Meiji Jingu", 10 * 60, 35.6764, 139.6993),
            (day1, .meal, "Ichiran Shibuya", 13 * 60, 35.6611, 139.7011),
            (day1, .activity, "Shibuya Sky", 18 * 60, 35.6585, 139.7023),
            (day2, .meal, "Tsukiji Outer Market", 8 * 60, 35.6655, 139.7707),
            (day2, .activity, "teamLab Planets", 11 * 60, 35.6491, 139.7898),
            (day2, .activity, "Senso-ji", 16 * 60, 35.7148, 139.7967),
            (nil, .activity, "Fushimi Inari day trip", nil, 34.9671, 135.7727),
            (nil, .meal, "Omoide Yokocho", nil, 35.6930, 139.6995),
        ]
        for (i, s) in samples.enumerated() {
            save(TripItem(tripID: trip.id, day: s.0, kind: s.1, title: s.2, time: s.3,
                          place: TripPlace(name: s.2, latitude: s.4, longitude: s.5),
                          createdAt: Date.now.addingTimeInterval(Double(i))))
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
            for record in sent.savedRecords { storeSystemFields(of: record) }
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
        if let trip = trip(recordID.recordName) { return trip.record() }
        if let item = items.first(where: { $0.id == recordID.recordName }) { return item.record(in: recordID.zoneID) }
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
        default:
            // Network and rate-limit errors are retried by the engine.
            log.error("Save failed for \(recordID.recordName): \(failure.error)")
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
