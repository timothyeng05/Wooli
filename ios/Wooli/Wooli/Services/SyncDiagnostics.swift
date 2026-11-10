#if DEBUG
import Foundation
import SwiftData

/// `-diagnose [seconds]` (DEBUG): open the store without running any launch
/// job (bank sync, rules, rollover), let iCloud download for that many seconds
/// (default 0), print what the store holds — counts, duplicates and this
/// month's spending by category — and quit. For comparing two devices that
/// disagree, and for a new device's first iCloud download.
enum SyncDiagnostics {
    static var isRequested: Bool { ProcessInfo.processInfo.arguments.contains("-diagnose") }

    static var waitSeconds: Int {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-diagnose"), i + 1 < args.count else { return 0 }
        return Int(args[i + 1]) ?? 0
    }

    /// `-resetLocalData` (DEBUG): delete this device's local copy (the SwiftData
    /// store, trips/Eats files, settings) before the store opens, so it starts
    /// like a fresh install and downloads everything from iCloud again. Nothing
    /// in iCloud is deleted: removing the file isn't a CloudKit change.
    static func resetLocalDataIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("-resetLocalData") else { return }
        let fm = FileManager.default
        // With an app group, SwiftData keeps `default.store` in the group's
        // Application Support, not the app's own.
        var folders = [URL.applicationSupportDirectory]
        if let group = fm.containerURL(forSecurityApplicationGroupIdentifier: "group.com.timothyeng.wooli") {
            folders.append(group.appending(path: "Library/Application Support"))
        }
        for folder in folders {
            for item in (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [] {
                try? fm.removeItem(at: item)
                print("removed \(folder.deletingLastPathComponent().lastPathComponent)/\(item.lastPathComponent)")
            }
        }
        if let id = Bundle.main.bundleIdentifier { UserDefaults.standard.removePersistentDomain(forName: id) }
    }

    @MainActor static func report(container: ModelContainer) {
        let context = container.mainContext
        let transactions = (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? []
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        let accounts = (try? context.fetch(FetchDescriptor<LocalAccount>())) ?? []
        let rules = (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        let month = DateInterval.month(containing: .now)

        func dupes<T>(_ items: [T], _ key: (T) -> String) -> Int {
            Dictionary(grouping: items, by: key).values.filter { $0.count > 1 }.count
        }
        var out = "== Wooli store =="
        out += "\ntransactions \(transactions.count) (duplicate ids: \(dupes(transactions, \.providerTransactionId)))"
        if let oldest = transactions.map(\.transactedAt).min() { out += ", oldest \(oldest.formatted(date: .abbreviated, time: .omitted))" }
        out += "\ncategories \(categories.count) (duplicate names: \(dupes(categories) { "\($0.parentId ?? "")|\($0.name.lowercased())" }))"
        out += "\naccounts \(accounts.count) (hidden \(hidden.count)), rules \(rules.count)"

        let thisMonth = transactions.filter { month.contains($0.transactedAt) }
        let orphaned = thisMonth.filter { $0.categoryId != nil && byId[$0.categoryId!] == nil }
        out += "\nthis month: \(thisMonth.count) transactions, \(thisMonth.filter(\.needsReview).count) need review, "
            + "\(thisMonth.filter { $0.categoryId == nil }.count) uncategorized, \(orphaned.count) point at a missing category, "
            + "\(thisMonth.filter(\.isTransfer).count) transfers"
        let summary = MonthSummary(transactions: thisMonth, in: month, categories: byId, hiddenAccounts: hidden)
        out += "\nspending \(String(format: "%.2f", summary.spending)), income \(String(format: "%.2f", summary.income))"
        out += "\nby category:"
        for (id, amount) in summary.spendingByCategory.sorted(by: { $0.value > $1.value }) {
            out += "\n  \(byId[id]?.name ?? "? \(id)"): \(String(format: "%.2f", amount))"
        }
        print(out)
        fflush(stdout)
    }
}

import SwiftUI

/// Stands in for the app while `-diagnose` runs, so no launch job starts.
struct SyncDiagnosticsView: View {
    let container: ModelContainer

    var body: some View {
        Text("Diagnosing… (\(SyncDiagnostics.waitSeconds) s)")
            .padding(40)
            .task {
                let wait = SyncDiagnostics.waitSeconds
                for elapsed in stride(from: 30, to: wait, by: 30) {
                    try? await Task.sleep(for: .seconds(30))
                    print("-- after \(elapsed) s"); SyncDiagnostics.report(container: container)
                }
                try? await Task.sleep(for: .seconds(wait % 30 == 0 ? min(wait, 30) : wait % 30))
                SyncDiagnostics.report(container: container)
                exit(0)
            }
    }
}
#endif
