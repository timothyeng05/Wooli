import CoreData
import Foundation
import SwiftData

/// Waits briefly for CloudKit's first import to finish, then reports whether
/// real data actually showed up. SwiftData's CloudKit sync is implemented on
/// top of `NSPersistentCloudKitContainer`, so that's the only place this
/// event is observable — there's no separate SwiftData-native notification.
///
/// Only used during onboarding when there's no SimpleFIN credential yet: if
/// credentials are already in iCloud Keychain, `AppModel` already jumps
/// straight to `.live` without waiting on anything.
enum CloudKitImportWatcher {
    @MainActor
    static func checkForExistingData(context: ModelContext, timeout: TimeInterval = 5) async -> Bool {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { try? await Task.sleep(for: .seconds(timeout)) }
            group.addTask { await waitForNextImport() }
            await group.next()
            group.cancelAll()
        }
        let hasAccounts = ((try? context.fetchCount(FetchDescriptor<LocalAccount>())) ?? 0) > 0
        let hasCategories = ((try? context.fetchCount(FetchDescriptor<BudgetCategory>())) ?? 0) > 0
        return hasAccounts || hasCategories
    }

    /// Runs for the app's lifetime: every time CloudKit finishes delivering
    /// an import, re-runs Deduplicator. Syncs and foreground transitions
    /// already trigger a dedup pass, but an import can land in between those
    /// — most commonly right after a fresh install, where this device's own
    /// SimpleFIN sync creates "new" uncategorized rows for transactions that
    /// turn out to already have a categorized copy arriving from iCloud a
    /// few seconds later. Without this, those duplicates sit around until
    /// the next foreground transition.
    @MainActor
    static func observeImports(context: ModelContext) async {
        while true {
            await waitForNextImport()
            Deduplicator.run(context: context)
        }
    }

    private static func waitForNextImport() async {
        let notifications = NotificationCenter.default.notifications(named: NSPersistentCloudKitContainer.eventChangedNotification)
        for await note in notifications {
            guard let event = note.userInfo?[NSPersistentCloudKitContainer.eventNotificationUserInfoKey]
                    as? NSPersistentCloudKitContainer.Event,
                  event.type == .import, event.endDate != nil else { continue }
            return
        }
    }
}
