import Foundation
import SwiftData

@MainActor
enum SyncService {
    static let accessURLKey = \"simplefin-access-url\"
    static let lastSyncKey = \"lastSimpleFinSyncAt\"

    static var hasCredentials: Bool {
        KeychainHelper.load(forKey: accessURLKey) != nil
    }

    static var lastSyncAt: Date? {
        UserDefaults.standard.object(forKey: lastSyncKey) as? Date
    }

    static func connect(setupToken: String) async throws {
        let accessURL = try await SimpleFinClient.claimSetupToken(setupToken)
        KeychainHelper.save(accessURL, forKey: accessURLKey)
    }

    static func disconnect() {
        KeychainHelper.delete(forKey: accessURLKey)
        UserDefaults.standard.removeObject(forKey: lastSyncKey)
    }

    struct Summary {
        var newTransactions = 0
        var bankMessages: [String] = []
    }

    /// Pull accounts + transactions straight from SimpleFIN and merge them into
    /// the local store. User edits (category, review state, notes, hidden) are
    /// never overwritten by a sync.
    static func sync(context: ModelContext) async throws -> Summary {
        let store = BackgroundStore(modelContainer: context.container)
        return try await store.sync()
    }
}
