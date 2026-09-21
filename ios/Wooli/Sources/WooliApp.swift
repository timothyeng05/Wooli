import SwiftUI
import SwiftData

@main
struct WooliApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: [LocalAccount.self, LocalTransaction.self])
    }
}
