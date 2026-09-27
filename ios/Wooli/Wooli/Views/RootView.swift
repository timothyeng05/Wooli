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
        .tint(Theme.brand)
        .task { syncIfStale() }
        #if DEBUG
        .task {
            // Launch arguments for Simulator checks: `-sampleData` skips
            // onboarding, `-tab N` opens a tab, `-review` opens the review flow.
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-sampleData"), app.mode == .onboarding { app.startSample(context: context) }
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let n = Int(args[i + 1]) {
                let tabs: [AppTab] = [.dashboard, .accounts, .transactions, .reports, .budget]
                if tabs.indices.contains(n) { app.selectedTab = tabs[n] }
            }
            if args.contains("-review") { app.showReview = true }
        }
        #endif
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            // iCloud may have delivered copies of records while we were away.
            Deduplicator.run(context: context)
            syncIfStale()
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
    @Environment(AppModel.self) private var app
    @Query(filter: #Predicate<LocalTransaction> { $0.needsReview && !$0.isHidden })
    private var toReview: [LocalTransaction]
    @Query(filter: #Predicate<LocalAccount> { $0.isHidden })
    private var hiddenAccounts: [LocalAccount]

    private var reviewCount: Int {
        let hidden = Set(hiddenAccounts.map(\.providerAccountId))
        return toReview.filter { !hidden.contains($0.accountId) }.count
    }

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.selectedTab) {
            Tab("Dashboard", systemImage: "house", value: AppTab.dashboard) {
                DashboardView()
            }
            Tab("Accounts", systemImage: "square.stack.3d.up", value: AppTab.accounts) {
                AccountsView()
            }
            Tab("Transactions", systemImage: "creditcard", value: AppTab.transactions) {
                TransactionsView()
            }
            .badge(reviewCount)
            Tab("Reports", systemImage: "chart.pie", value: AppTab.reports) {
                ReportsView()
            }
            Tab("Budget", systemImage: "map", value: AppTab.budget) {
                BudgetView()
            }
        }
        .fullScreenCover(isPresented: $app.showReview) {
            ReviewView()
        }
    }
}
