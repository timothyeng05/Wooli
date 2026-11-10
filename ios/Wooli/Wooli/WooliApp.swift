import SwiftUI
import SwiftData

/// Starts the app, or on the Mac with `--mcp`, the read-only MCP server
/// Claude talks to (`WooliMCPServer`) instead of a window.
@main
enum WooliMain {
    static func main() {
        #if os(macOS)
        if CommandLine.arguments.contains("--mcp") {
            MainActor.assumeIsolated { WooliMCPServer.run() }
        }
        #endif
        WooliApp.main()
    }
}

struct WooliApp: App {
    /// Every synced model. New models go here (and in `Deduplicator` if two devices can create the same one).
    static let schema = Schema([LocalAccount.self, LocalTransaction.self, BudgetCategory.self, MerchantRule.self, BalanceSnapshot.self,
                                CategoryRule.self, TransactionRule.self, RecurringItem.self,
                                PeriodEntry.self, Person.self, MovieEntry.self, RecipeEntry.self, SightEntry.self])

    let container: ModelContainer
    @State private var app = AppModel()
    /// Hands iCloud trip invites to `TripStore` (see `WooliSceneDelegate`).
    #if os(iOS)
    @UIApplicationDelegateAdaptor(WooliAppDelegate.self) private var appDelegate
    #else
    @NSApplicationDelegateAdaptor(WooliAppDelegate.self) private var appDelegate
    #endif

    init() {
        #if DEBUG
        SyncDiagnostics.resetLocalDataIfRequested()
        #endif
        let schema = Self.schema
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
            #if DEBUG
            if SyncDiagnostics.isRequested {
                SyncDiagnosticsView(container: container)
            } else {
                mainView
            }
            #else
            mainView
            #endif
        }
        .modelContainer(container)
        #if os(macOS)
        .defaultSize(width: 1240, height: 820)
        .commands { WooliCommands(app: app, container: container) }
        #endif

        #if os(macOS)
        Settings {
            SettingsView()
                .environment(app)
                .tint(Theme.brand)
                .formStyle(.grouped)
                .frame(minWidth: 560, idealWidth: 620, minHeight: 600, idealHeight: 720)
        }
        .modelContainer(container)
        #endif
    }

    private var mainView: some View {
        RootView()
            .environment(app)
            #if os(macOS)
            // Grouped forms look like the iPhone's and like macOS's own Settings.
            .formStyle(.grouped)
            #endif
    }
}
