import SwiftUI
import SwiftData

@main
struct WooliApp: App {
    let container: ModelContainer
    @State private var app = AppModel()

    init() {
        let schema = Schema([LocalAccount.self, LocalTransaction.self, BudgetCategory.self, MerchantRule.self, BalanceSnapshot.self,
                             CategoryRule.self, TransactionRule.self, RecurringItem.self,
                             PeriodEntry.self, MoodEntry.self])
        // `.automatic` syncs through the user's own private iCloud database once
        // the iCloud/CloudKit capability is added (see README); without it the
        // store is simply local to this device.
        let configuration = ModelConfiguration(schema: schema, cloudKitDatabase: .automatic)
        do {
            container = try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
        }
        .modelContainer(container)
    }
}
