import Foundation
import Observation
import SwiftData

/// App-wide state: whether we're connected to SimpleFIN, showing sample data,
/// or not set up yet, plus the in-flight sync status.
enum AppTab: Hashable { case dashboard, accounts, transactions, reports, budget }

/// Screens reached from the hamburger sidebar, each opened as its own sheet
/// rather than a tab — keeps every screen's navigation container unambiguous
/// (a past attempt that routed these through the tab machinery caused double
/// back-arrows when a screen was reachable both as a "tab" and a push target).
enum SidebarDestination: String, Identifiable {
    case categories, rules, recurring, settings
    var id: String { rawValue }
}

@MainActor
@Observable
final class AppModel {
    /// `local`: no bank connection — the user enters accounts and
    /// transactions by hand, or didn't pick Budget. Can connect SimpleFIN later.
    enum Mode: String { case onboarding, live, sample, local }

    /// Whether onboarding still needs to check iCloud for existing data from
    /// another device before showing the welcome tour. Only relevant while
    /// `mode == .onboarding` — irrelevant (and never shown) once there's a
    /// Keychain credential, since that path already jumps straight to `.live`.
    /// `.foundExistingData` lets a relaunch show the "use iCloud data?"
    /// prompt again immediately, without re-waiting on CloudKit.
    enum OnboardingStage { case checkingICloud, foundExistingData, readyToShow }

    private static let modeKey = "appMode"
    private static let icloudCheckDoneKey = "didCheckICloudOnboarding"
    private static let icloudDataFoundKey = "icloudDataFoundOnboarding"

    var mode: Mode {
        didSet { UserDefaults.standard.set(mode.rawValue, forKey: Self.modeKey) }
    }
    var onboardingStage: OnboardingStage = .checkingICloud
    var isSyncing = false
    var syncError: String?
    var bankMessages: [String] = []
    var lastSyncAt: Date? = SyncService.lastSyncAt
    /// Which app is on screen. Always opens on Today.
    var space: AppSpace = .today {
        didSet { AppLineup.shared.noteOpened(space) }
    }
    var selectedTab: AppTab = .dashboard
    var isSidebarOpen = false
    var sidebarDestination: SidebarDestination?

    var isCategorizing = false
    var showReview = false
    /// The guided first-run review, shown once right after connecting a bank.
    var showCalibration = false

    /// Switch apps (from the drawer or a Today card).
    func open(_ space: AppSpace) {
        isSidebarOpen = false
        self.space = space
    }

    init() {
        let stored = UserDefaults.standard.string(forKey: Self.modeKey).flatMap(Mode.init) ?? .onboarding
        if SyncService.hasCredentials {
            // The key syncs through iCloud Keychain, so on a new iPhone it can
            // already be here before the app has ever run: go straight to the
            // user's (iCloud-synced) data instead of onboarding.
            mode = .live
        } else {
            // No key (iCloud Keychain off, or disconnected): reconnect.
            mode = stored == .sample || stored == .local ? stored : .onboarding
        }
        if mode == .onboarding {
            if !UserDefaults.standard.bool(forKey: Self.icloudCheckDoneKey) {
                onboardingStage = .checkingICloud
            } else if UserDefaults.standard.bool(forKey: Self.icloudDataFoundKey) {
                // Found data on a previous launch but the user never tapped
                // Continue — show the prompt again without re-waiting.
                onboardingStage = .foundExistingData
            } else {
                onboardingStage = .readyToShow
            }
        }
    }

    /// Records the one-time iCloud check's result so later launches don't
    /// wait on CloudKit again. `found == true` keeps re-showing the "use
    /// iCloud data?" prompt (instantly) until the user acts on it.
    func recordICloudCheckResult(found: Bool) {
        UserDefaults.standard.set(true, forKey: Self.icloudCheckDoneKey)
        UserDefaults.standard.set(found, forKey: Self.icloudDataFoundKey)
        onboardingStage = found ? .foundExistingData : .readyToShow
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
        mode = .sample
        RecurringDetector.refresh(context: context)
        Task { await autoCategorize(context: context) }
    }

    /// Finish onboarding without a bank: manual entry, or Budget off.
    /// Categories are seeded so Budget is ready either way.
    func startWithoutBank(context: ModelContext) {
        DefaultCategories.seedIfNeeded(context)
        mode = .local
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
        await BackgroundStore.make(context.container).refreshRecurring()
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
        // Recheck iCloud fresh next time — this device's view of "is there
        // existing data" just changed.
        UserDefaults.standard.removeObject(forKey: Self.icloudCheckDoneKey)
        UserDefaults.standard.removeObject(forKey: Self.icloudDataFoundKey)
        onboardingStage = .checkingICloud
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
        try? context.delete(model: Person.self)
        try? context.save()
    }
}
