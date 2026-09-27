import Foundation
import Observation
import SwiftData

/// App-wide state: whether we're connected to SimpleFIN, showing sample data,
/// or not set up yet, plus the in-flight sync status.
enum AppTab: Hashable, CaseIterable, Identifiable { case dashboard, accounts, transactions, reports, budget, categories, rules, recurring
    var id: AppTab { self }
    var title: String { switch self { case .dashboard: return "Dashboard"; case .accounts: return "Accounts"; case .transactions: return "Transactions"; case .reports: return "Reports"; case .budget: return "Budget"; case .categories: return "Categories"; case .rules: return "Rules"; case .recurring: return "Recurring" } }
    var symbol: String { switch self { case .dashboard: return "house"; case .accounts: return "square.stack.3d.up"; case .transactions: return "creditcard"; case .reports: return "chart.pie"; case .budget: return "map"; case .categories: return "square.grid.2x2"; case .rules: return "wand.and.stars"; case .recurring: return "arrow.triangle.2.circlepath" } }
}

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
    var isSidebarOpen = false

    var isCategorizing = false
    var showReview = false
    /// A module screen to push on the Dashboard (debug launch args, deep links).
    var openModule: WooliModule?
    /// The guided first-run review, shown once right after connecting a bank.
    var showCalibration = false

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
        showCalibration = true
    }

    func startSample(context: ModelContext) {
        DefaultCategories.seedIfNeeded(context)
        SampleData.load(into: context)
        for module in WooliModule.allCases where module.isEnabled { ModuleSampleData.seed(module, context: context) }
        mode = .sample
        RecurringDetector.refresh(context: context)
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
        RecurringDetector.refresh(context: context)
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
        try? context.delete(model: TransactionRule.self)
        try? context.delete(model: RecurringItem.self)
        try? context.delete(model: PeriodEntry.self)
        try? context.delete(model: MoodEntry.self)
        try? context.save()
    }
}
