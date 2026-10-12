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
            ICloudSyncService.autoPushOnceIfNeeded(context: context)
            if app.mode == .live { ReviewWindow.pruneOlderTransactions(context: context) }
            DefaultCategories.injectStarterRulesIfMissing(context: context)
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
                let tabs: [AppTab] = [.dashboard, .accounts, .transactions, .reports, .budget]
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
    @Environment(\.scenePhase) private var scenePhase
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
        ZStack(alignment: .leading) {
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

            if app.isSidebarOpen {
                Color.black.opacity(0.35)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.25)) {
                            app.isSidebarOpen = false
                        }
                    }
                    .transition(.opacity)

                SidebarDrawer()
                    .frame(width: 290)
                    .ignoresSafeArea(edges: .vertical)
                    .transition(.move(edge: .leading))
                    .zIndex(1)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: app.isSidebarOpen)
        .sheet(item: $app.sidebarDestination) { dest in
            switch dest {
            case .categories:
                NavigationStack {
                    CategoriesSettingsView()
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") { app.sidebarDestination = nil }
                            }
                        }
                }
            case .rules:
                NavigationStack {
                    RulesView()
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") { app.sidebarDestination = nil }
                            }
                        }
                }
            case .recurring:
                NavigationStack {
                    RecurringView()
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") { app.sidebarDestination = nil }
                            }
                        }
                }
            case .settings:
                SettingsView()
            }
        }
        .fullScreenCover(isPresented: $app.showReview) {
            ReviewView()
        }
        .fullScreenCover(isPresented: $app.showCalibration) {
            ReviewView(isCalibration: true)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .background else { return }
            ReviewReminder.scheduleOrCancel(reviewCount: reviewCount)
        }
    }
}

struct SidebarDrawer: View {
    @Environment(AppModel.self) private var app
    @AppStorage("displayName") private var displayName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis.circle.fill")
                        .font(.title)
                        .foregroundStyle(Theme.brand)
                    Text("Wooli")
                        .font(.title2.bold())
                        .foregroundStyle(Theme.text)
                    Spacer()
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            app.isSidebarOpen = false
                        }
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(Theme.textTertiary)
                    }
                }

                if !displayName.isEmpty {
                    Text("Hello, \(displayName)")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 64)
            .padding(.bottom, 20)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    Text("MANAGE")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.textTertiary)
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 4)

                    sidebarButton(title: "Categories", systemImage: "square.grid.2x2", destination: .categories)
                    sidebarButton(title: "Rules", systemImage: "wand.and.stars", destination: .rules)
                    sidebarButton(title: "Recurring", systemImage: "arrow.triangle.2.circlepath", destination: .recurring)

                    Divider()
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)

                    Text("APP")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Theme.textTertiary)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 4)

                    sidebarButton(title: "Settings", systemImage: "gearshape", destination: .settings)

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            app.isSidebarOpen = false
                        }
                        if let url = URL(string: "mailto:support@wooliapp.com?subject=Wooli%20Beta%20Feedback") {
                            #if os(iOS)
                            UIApplication.shared.open(url)
                            #endif
                        }
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "envelope")
                                .font(.body)
                                .frame(width: 24)
                                .foregroundStyle(Theme.textSecondary)
                            Text("Send Feedback")
                                .font(.body)
                                .foregroundStyle(Theme.text)
                            Spacer()
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.vertical, 8)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(Color(UIColor.systemBackground))
        .gesture(
            DragGesture().onEnded { val in
                if val.translation.width < -40 {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        app.isSidebarOpen = false
                    }
                }
            }
        )
    }

    private func sidebarButton(title: String, systemImage: String, destination: SidebarDestination) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                app.isSidebarOpen = false
            }
            app.sidebarDestination = destination
        } label: {
            HStack(spacing: 14) {
                Image(systemName: systemImage)
                    .font(.body)
                    .frame(width: 24)
                    .foregroundStyle(Theme.brand)
                Text(title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(Theme.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
