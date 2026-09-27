import Foundation
import Observation
import SwiftData

/// App-wide state: whether we're connected to SimpleFIN, showing sample data,
/// or not set up yet, plus the in-flight sync status.
@MainActor
@Observable
final class AppModel {
    enum Mode: String { case onboarding, live, sample }

    private static let modeKey = "appMode"

    var mode: Mode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: Self.modeKey) }
    }
    var isSyncing = false
    var syncError: String?
    var bankMessages: [String] = []
    var lastSyncAt: Date? = SyncService.lastSyncAt

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.modeKey).flatMap(Mode.init) ?? .onboarding
        // If the Keychain entry is gone (e.g. restored to a new phone — it's
        // device-only on purpose), fall back to onboarding to reconnect.
        mode = (stored == .live && !SyncService.hasCredentials) ? .onboarding : stored
    }

    func connect(setupToken: String, context: ModelContext) async throws {
        try await SyncService.connect(setupToken: setupToken)
        if mode == .sample { eraseLocalData(context: context) }
        DefaultCategories.seedIfNeeded(context)
        mode = .live
        await sync(context: context)
    }

    func startSample(context: ModelContext) {
        DefaultCategories.seedIfNeeded(context)
        SampleData.load(into: context)
        mode = .sample
    }

    func sync(context: ModelContext) async {
        guard mode == .live, !isSyncing else { return }
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }
        do {
            let summary = try await SyncService.sync(context: context)
            bankMessages = summary.bankMessages
            lastSyncAt = SyncService.lastSyncAt
        } catch {
            syncError = error.localizedDescription
        }
    }

    /// Removes the SimpleFIN connection and every account, transaction,
    /// category and rule stored by this app.
    func disconnectAndErase(context: ModelContext) {
        SyncService.disconnect()
        eraseLocalData(context: context)
        lastSyncAt = nil
        bankMessages = []
        syncError = nil
        mode = .onboarding
    }

    private func eraseLocalData(context: ModelContext) {
        try? context.delete(model: LocalTransaction.self)
        try? context.delete(model: LocalAccount.self)
        try? context.delete(model: MerchantRule.self)
        try? context.delete(model: BudgetCategory.self)
        try? context.save()
    }
}
