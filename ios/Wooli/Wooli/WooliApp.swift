import SwiftUI
import SwiftData

@main
struct WooliApp: App {
    let container: ModelContainer
    @State private var app = AppModel()
    /// Hands iCloud trip invites to `TripStore` (see `WooliSceneDelegate`).
    @UIApplicationDelegateAdaptor(WooliAppDelegate.self) private var appDelegate

    init() {
        let schema = Schema([LocalAccount.self, LocalTransaction.self, BudgetCategory.self, MerchantRule.self, BalanceSnapshot.self,
                             CategoryRule.self, TransactionRule.self, RecurringItem.self,
                             PeriodEntry.self, Person.self, MovieEntry.self, RecipeEntry.self])
        let configuration = ModelConfiguration(
            schema: schema,
            cloudKitDatabase: .private("iCloud.com.timothyeng.wooli")
        )
        do {
            container = try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
        #if DEBUG
        // `-sampleApps`: fill Eats, Movies and Recipes for screenshots.
        if ProcessInfo.processInfo.arguments.contains("-sampleApps") {
            ModuleSampleData.seedApps(context: container.mainContext)
        }
        #endif
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
        }
        .modelContainer(container)
    }
}
