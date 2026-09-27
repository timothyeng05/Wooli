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
        .task {
            if app.mode == .live { ReviewWindow.pruneOlderTransactions(context: context) }
            RolloverService.closeMonths(context: context)
            RuleImporter.importIfPresent(context: context)
            RuleEngine.consolidate(context: context)
            Categorizer.refreshKeywordHints(context: context)
            syncIfStale()
            if app.mode != .onboarding {
                RecurringDetector.refresh(context: context)
                await app.autoCategorize(context: context)
            }
        }
        #if DEBUG
        .task {
            // Launch arguments for Simulator checks: `-sampleData` skips
            // onboarding, `-tab N` opens a tab, `-review` opens the review flow.
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-sampleData"), app.mode == .onboarding { app.startSample(context: context) }
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let n = Int(args[i + 1]) {
                let tabs: [AppTab] = [.dashboard, .accounts, .transactions, .reports, .menu]
                if tabs.indices.contains(n) { app.selectedTab = tabs[n] }
            }
            if args.contains("-review") { app.showReview = true }
            // `-module period|mood`: enable that module (seeding sample data) and open it.
            if let i = args.firstIndex(of: "-module"), i + 1 < args.count, let module = WooliModule(rawValue: args[i + 1]) {
                UserDefaults.standard.set(true, forKey: module.enabledKey)
                if app.mode == .sample { ModuleSampleData.seed(module, context: context) }
                app.selectedTab = .dashboard
                app.openModule = module
            }
            if args.contains("-selftest") { DebugSelfTest.run(context: context) }
        }
        #endif
        .onChange(of: scenePhase) { _, phase in
            // Face ID-protected modules lock again whenever the app leaves the screen.
            if phase == .background { ModuleLock.shared.lockAll() }
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
    @Query(filter: #Predicate<LocalAccount> { $0.isHidden || $0.hideTransactions })
    private var hiddenAccounts: [LocalAccount]

    private var reviewCount: Int {
        let hidden = Set(hiddenAccounts.map(\.providerAccountId))
        return toReview.filter { !hidden.contains($0.accountId) && ReviewWindow.contains($0.transactedAt) }.count
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
            Tab("Menu", systemImage: "line.3.horizontal", value: AppTab.menu) {
                MenuView()
            }
        }
        .fullScreenCover(isPresented: $app.showReview) {
            ReviewView()
        }
        .fullScreenCover(isPresented: $app.showCalibration) {
            ReviewView(isCalibration: true)
        }
    }
}

struct MenuView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Feedback") {
                    Button {
                        if let url = URL(string: "mailto:support@wooliapp.com?subject=Wooli%20Beta%20Feedback") {
                            #if os(iOS)
                            UIApplication.shared.open(url)
                            #endif
                        }
                    } label: {
                        Label("Send Feedback", systemImage: "envelope")
                    }
                    .foregroundStyle(Theme.text)
                }

                Section("Budget & Settings") {
                    NavigationLink(value: "budget") {
                        Label("Budget", systemImage: "map")
                    }
                    NavigationLink(value: "categories") {
                        Label("Categories", systemImage: "square.grid.2x2")
                    }
                    NavigationLink(value: "rules") {
                        Label("Rules", systemImage: "wand.and.stars")
                    }
                    NavigationLink(value: "recurring") {
                        Label("Recurring", systemImage: "arrow.triangle.2.circlepath")
                    }
                }
            }
            .navigationTitle("Menu")
            .navigationDestination(for: String.self) { val in
                switch val {
                case "budget": BudgetView()
                case "categories": CategoriesSettingsView()
                case "rules": RulesView()
                case "recurring": RecurringView()
                default: EmptyView()
                }
            }
        }
    }
}
