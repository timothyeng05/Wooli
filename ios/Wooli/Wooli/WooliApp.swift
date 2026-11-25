import SwiftUI
import SwiftData

/// Starts the app, or on the Mac with `--mcp`, the read-only MCP server
/// Claude talks to (`WooliMCPServer`) instead of a window.
@main
enum WooliMain {
    static func main() {
        #if os(macOS)
        #if DEBUG
        if CommandLine.arguments.contains("--init-cloudkit-schema") { CloudKitSchemaInit.run() }
        #endif
        if CommandLine.arguments.contains("--mcp") {
            MainActor.assumeIsolated { WooliMCPServer.run() }
        }
        #endif
        WooliApp.main()
    }
}

struct WooliApp: App {
    /// Every synced model. New models go here (and in `Deduplicator` if two devices can create the same one).
    static let modelTypes: [any PersistentModel.Type] = [
        LocalAccount.self, LocalTransaction.self, BudgetCategory.self, MerchantRule.self, BalanceSnapshot.self,
        CategoryRule.self, TransactionRule.self, RecurringItem.self,
        PeriodEntry.self, Person.self, MovieEntry.self, RecipeEntry.self, SightEntry.self,
        ForecastScenario.self,
    ]
    static let schema = Schema(modelTypes)

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
        var configuration = ModelConfiguration(
            schema: schema,
            cloudKitDatabase: .private("iCloud.com.timothyeng.wooli")
        )
        if LaunchFlags.localStore {
            configuration = ModelConfiguration(schema: schema, cloudKitDatabase: .none)
        }
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
        Window("Keyboard Shortcuts", id: "shortcuts") { KeyboardShortcutsView() }
            .windowResizability(.contentSize)
        #endif

        #if os(macOS)
        // A trip in its own window, to keep beside Mail or a booking site.
        WindowGroup("Trip", id: "trip", for: String.self) { $tripID in
            if let tripID {
                NavigationStack {
                    MacTripWorkspace(tripID: tripID, inOwnWindow: true)
                }
                .environment(app)
                .tint(Theme.brand)
                .formStyle(.grouped)
                .frame(minWidth: 960, minHeight: 600)
            }
        }
        .modelContainer(container)
        .defaultSize(width: 1280, height: 820)

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
            .frame(minWidth: 900, minHeight: 600)
            #endif
    }
}

/// Debug-only launch switches.
enum LaunchFlags {
    /// `-localStore`: no iCloud at all — SwiftData stays on disk and CloudKit is
    /// never touched. For a preview build (own bundle id, no iCloud entitlement)
    /// that must never reach real, synced data.
    static let localStore: Bool = {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-localStore")
        #else
        false
        #endif
    }()
}
