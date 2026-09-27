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
    @Query(filter: #Predicate<LocalTransaction> { $0.needsReview && !$0.isHidden })
    private var toReview: [LocalTransaction]
    @Query(filter: #Predicate<LocalAccount> { $0.isHidden })
    private var hiddenAccounts: [LocalAccount]

    private var reviewCount: Int {
        let hidden = Set(hiddenAccounts.map(\.providerAccountId))
        return toReview.filter { !hidden.contains($0.accountId) && ReviewWindow.contains($0.transactedAt) }.count
    }

    var body: some View {
        @Bindable var app = app
        
        ZStack(alignment: .leading) {
            // Main Content Area
            TabView(selection: $app.selectedTab) {
                ForEach(AppTab.allCases) { tab in
                    innerView(for: tab)
                        .tag(tab)
                        .toolbar(.hidden, for: .tabBar)
                }
            }
            .disabled(app.isSidebarOpen)
            
            // Dimmed Overlay
            if app.isSidebarOpen {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation(.spring()) {
                            app.isSidebarOpen = false
                        }
                    }
            }
            
            // Sidebar Drawer
            if app.isSidebarOpen {
                SidebarDrawer(reviewCount: reviewCount)
                    .frame(width: 280)
                    .ignoresSafeArea(edges: .bottom)
                    .transition(.move(edge: .leading))
            }
        }
        .fullScreenCover(isPresented: $app.showReview) {
            ReviewView()
        }
        .fullScreenCover(isPresented: $app.showCalibration) {
            ReviewView(isCalibration: true)
        }
    }
    
    @ViewBuilder
    private func innerView(for tab: AppTab) -> some View {
        switch tab {
        case .dashboard: DashboardView()
        case .accounts: AccountsView()
        case .transactions: TransactionsView()
        case .reports: ReportsView()
        case .budget: BudgetView()
        case .categories: CategoriesSettingsView()
        case .rules: RulesView()
        case .recurring: RecurringView()
        }
    }
}

struct HamburgerMenuModifier: ViewModifier {
    @Environment(AppModel.self) private var app
    
    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                            app.isSidebarOpen.toggle()
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal")
                            .imageScale(.large)
                            .foregroundColor(Theme.brand)
                    }
                }
            }
    }
}

extension View {
    func hamburgerMenu() -> some View {
        modifier(HamburgerMenuModifier())
    }
}

struct SidebarDrawer: View {
    @Environment(AppModel.self) private var app
    let reviewCount: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Wooli")
                    .font(.largeTitle.bold())
                    .foregroundColor(Theme.brand)
                Spacer()
            }
            .padding()
            .padding(.top, 50)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 5) {
                    sidebarButton(for: .dashboard)
                    sidebarButton(for: .accounts)
                    sidebarButton(for: .transactions, badge: reviewCount)
                    sidebarButton(for: .reports)
                    
                    Divider().padding(.vertical, 10)
                    
                    Text("Budget")
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                        .padding(.bottom, 5)
                    
                    sidebarButton(for: .budget)
                    sidebarButton(for: .categories)
                    sidebarButton(for: .rules)
                    sidebarButton(for: .recurring)
                }
                .padding(.vertical)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.systemBackground))
    }
    
    @ViewBuilder
    private func sidebarButton(for tab: AppTab, badge: Int = 0) -> some View {
        Button {
            app.selectedTab = tab
            withAnimation(.spring()) {
                app.isSidebarOpen = false
            }
        } label: {
            HStack(spacing: 16) {
                Image(systemName: tab.symbol)
                    .frame(width: 24)
                    .font(.system(size: 18, weight: .medium))
                
                Text(tab.title)
                    .font(.body.weight(app.selectedTab == tab ? .semibold : .regular))
                
                Spacer()
                
                if badge > 0 {
                    Text("\(badge)")
                        .font(.caption.bold())
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red)
                        .clipShape(Capsule())
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
            .background(app.selectedTab == tab ? Theme.brand.opacity(0.15) : Color.clear)
            .foregroundColor(app.selectedTab == tab ? Theme.brand : .primary)
            .cornerRadius(10)
            .padding(.horizontal, 12)
        }
    }
}
