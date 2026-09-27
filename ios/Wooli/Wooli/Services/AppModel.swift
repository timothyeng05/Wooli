import Foundation
import Observation
import SwiftData

/// App-wide state: whether we're connected to SimpleFIN, showing sample data,
/// or not set up yet, plus the in-flight sync status.
enum AppTab: Hashable { case dashboard, accounts, transactions, reports, budget }

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
    var selectedTab: AppTab = .dashboard
    var isCategorizing = false
    var showReview = false

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.modeKey).flatMap(Mode.init) ?? .onboarding
        if SyncService.hasCredentials {
            // The key syncs through iCloud Keychain, so on a new iPhone it can
            // already be here before the app has ever run: go straight to the
            // user's (iCloud-synced) data instead of onboarding.
            mode = .live
        } else {
            // No key (iCloud Keychain off, or disconnected): reconnect.
            mode = stored == .sample ? .sample : .onboarding
        }
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
        Task { await autoCategorize(context: context) }
    }

    func sync(context: ModelContext) async {
        guard mode == .live, !isSyncing else { return }
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }
        do {
            let summary = try await SyncService.sync(context: context)
            ReviewWindow.pruneOlderTransactions(context: context)
            bankMessages = summary.bankMessages
            lastSyncAt = SyncService.lastSyncAt
        } catch {
            syncError = error.localizedDescription
        }
        Task { await autoCategorize(context: context) }
    }

    /// Let the on-device model suggest categories for anything still uncategorized.
    func autoCategorize(context: ModelContext) async {
        guard !isCategorizing else {
            // A rule changed mid-run: go around again when this pass ends.
            rerunCategorizer = true
            return
        }
        isCategorizing = true
        defer { isCategorizing = false }
        repeat {
            rerunCategorizer = false
            await AICategorizer.run(context: context)
        } while rerunCategorizer
    }

    private var rerunCategorizer = false

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
        try? context.delete(model: BalanceSnapshot.self)
        try? context.delete(model: CategoryRule.self)
        try? context.save()
    }
}
