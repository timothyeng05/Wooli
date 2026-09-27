import SwiftUI
import SwiftData

struct RootView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if app.mode == .onboarding {
                WelcomeView()
            } else {
                MainTabView()
            }
        }
        .animation(.default, value: app.mode)
        .task { syncIfStale() }
        #if DEBUG
        .task {
            // `-sampleData` launch argument: skip onboarding (for Simulator checks).
            if ProcessInfo.processInfo.arguments.contains("-sampleData"), app.mode == .onboarding {
                app.startSample(context: context)
            }
        }
        #endif
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { syncIfStale() }
        }
    }

    /// Refresh on launch and when returning to the app, at most every 30 min
    /// (SimpleFIN allows a limited number of requests per day).
    private func syncIfStale() {
        guard app.mode == .live else { return }
        if (app.lastSyncAt ?? .distantPast).timeIntervalSinceNow < -30 * 60 {
            Task { await app.sync(context: context) }
        }
    }
}

struct MainTabView: View {
    @Query(filter: #Predicate<LocalTransaction> { $0.needsReview && !$0.isHidden })
    private var toReview: [LocalTransaction]
    @Query(filter: #Predicate<LocalAccount> { $0.isHidden })
    private var hiddenAccounts: [LocalAccount]

    private var reviewCount: Int {
        let hidden = Set(hiddenAccounts.map(\.providerAccountId))
        return toReview.filter { !hidden.contains($0.accountId) }.count
    }

    @State private var selection = MainTabView.initialTab

    private static var initialTab: Int {
        #if DEBUG
        // `-tab N` launch argument opens a specific tab.
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let n = Int(args[i + 1]) { return n }
        #endif
        return 0
    }

    var body: some View {
        TabView(selection: $selection) {
            Tab("Overview", systemImage: "chart.pie.fill", value: 0) {
                OverviewView()
            }
            Tab("Transactions", systemImage: "list.bullet.rectangle.portrait.fill", value: 1) {
                TransactionsView()
            }
            .badge(reviewCount)
            Tab("Budget", systemImage: "gauge.with.dots.needle.67percent", value: 2) {
                BudgetView()
            }
            Tab("Accounts", systemImage: "building.columns.fill", value: 3) {
                AccountsView()
            }
        }
    }
}
