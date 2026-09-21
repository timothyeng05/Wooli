import SwiftUI
import SwiftData

@main
struct WooliApp: App {
    let container: ModelContainer

    init() {
        let schema = Schema([LocalAccount.self, LocalTransaction.self])
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
        }
        .modelContainer(container)
    }
}
