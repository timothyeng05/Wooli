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
            TripStore.shared.start()
            ICloudSyncService.autoPushOnceIfNeeded(context: context)
            if app.mode == .live { TransactionRetention.pruneOlderTransactions(context: context) }
            if app.mode == .sample { SampleData.rollForward(context: context) }
            DefaultCategories.injectStarterRulesIfMissing(context: context)
            RolloverService.closeMonths(context: context)
            RuleImporter.importIfPresent(context: context)
            WebDataImporter.importIfPresent(context: context)
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
            // onboarding, `-tab N` opens a Budget tab, `-review` opens the review flow.
            // For a true first launch, delete the app and run
            // `xcrun simctl keychain booted reset` (the SimpleFIN key survives deletion).
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-sampleData"), app.mode == .onboarding { app.startSample(context: context) }
            if let i = args.firstIndex(of: "-tab"), i + 1 < args.count, let n = Int(args[i + 1]) {
                let tabs: [AppTab] = [.dashboard, .accounts, .transactions, .reports, .budget]
                if tabs.indices.contains(n) { app.space = .budget; app.selectedTab = tabs[n] }
            }
            // `-space trips`: open that app instead of Today.
            if let i = args.firstIndex(of: "-space"), i + 1 < args.count, let space = AppSpace(rawValue: args[i + 1]) { app.space = space }
            if args.contains("-review") { app.showReview = true }
            // `-drawer`: open the ☰ app switcher.
            if args.contains("-drawer") { app.isSidebarOpen = true }
            // `-calibration`: the first-run review shown after connecting a bank.
            if args.contains("-calibration") { app.showCalibration = true }
            // `-module period`: enable that module (seeding sample data) and open it.
            if let i = args.firstIndex(of: "-module"), i + 1 < args.count, let module = WooliModule(rawValue: args[i + 1]) {
                if app.mode == .sample { ModuleSampleData.seed(module, context: context) }
                if let space = AppSpace.allCases.first(where: { $0.module == module }) {
                    AppLineup.shared.setEnabled(space, true)
                    app.space = space
                }
            }
            if args.contains("-selftest") { DebugSelfTest.run(context: context) }
            // `-sampleTrip`: add a demo trip (stays on this device unless iCloud is signed in).
            if args.contains("-sampleTrip") { TripStore.shared.addSampleTrip() }
            // `-openTrip [name]`: open a trip (the first, or one whose name contains `name`) straight away.
            if let i = args.firstIndex(of: "-openTrip") {
                let name = i + 1 < args.count && !args[i + 1].hasPrefix("-") ? args[i + 1] : ""
                TripStore.shared.tripToOpen = TripStore.shared.trips.first { name.isEmpty || $0.name.localizedCaseInsensitiveContains(name) }?.id
            }
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

/// The super-app shell: shows the current app (`AppSpace`) and hosts what's
/// shared by every app — the ☰ app-switcher drawer, review/calibration flows,
/// trip invites.
struct MainTabView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.scenePhase) private var scenePhase
    @State private var trips = TripStore.shared
    @State private var eats = EatsBook.shared
    @State private var inbox = SharedPlaceInbox.shared
    @State private var lineup = AppLineup.shared
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
            SpaceRoot(space: lineup.isEnabled(app.space) ? app.space : .today, reviewCount: reviewCount)
                .id(app.space)
                .transition(.opacity)

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
        // Swipe in from the left edge to open the ☰ drawer — except on a
        // pushed screen, where that swipe is iOS's "back".
        .simultaneousGesture(
            DragGesture(minimumDistance: 12, coordinateSpace: .global).onChanged { drag in
                guard !app.isSidebarOpen, drag.startLocation.x < 28,
                      drag.translation.width > 60, abs(drag.translation.height) < drag.translation.width,
                      !NavigationDepth.isShowingPushedScreen else { return }
                app.isSidebarOpen = true
            }
        )
        .animation(.easeInOut(duration: 0.25), value: app.isSidebarOpen)
        .animation(.easeInOut(duration: 0.2), value: app.space)
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
            if phase == .active { inbox.check() }
            guard phase == .background else { return }
            ReviewReminder.scheduleOrCancel(reviewCount: reviewCount)
        }
        // A place shared from Apple Maps (the share extension opens wooli://).
        .onAppear { inbox.check() }
        .onOpenURL { _ in inbox.check() }
        .sheet(item: $inbox.current, onDismiss: inbox.dismissed) { place in
            SharedPlaceSheet(place: place)
        }
        // A trip someone just invited you to.
        .sheet(item: Binding(get: { trips.tripToOpen.map(TripRoute.init) }, set: { trips.tripToOpen = $0?.id })) { route in
            NavigationStack {
                TripDetailView(tripID: route.id)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Close") { trips.tripToOpen = nil } }
                    }
            }
        }
        // A friend who just shared their Eats list with you.
        .sheet(item: Binding(get: { eats.friendToShow.map(TripRoute.init) }, set: { eats.friendToShow = $0?.id })) { route in
            NavigationStack {
                FriendListView(friendID: route.id)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("Close") { eats.friendToShow = nil } }
                    }
            }
        }
        .alert("Trips", isPresented: Binding(get: { trips.lastError != nil }, set: { if !$0 { trips.lastError = nil } })) {
            Button("OK") { trips.lastError = nil }
        } message: {
            Text(trips.lastError ?? "")
        }
    }
}

/// The root screen of each app. Budget keeps its own tab bar; the others are
/// a single navigation stack with the ☰ switcher in the top-left.
private struct SpaceRoot: View {
    let space: AppSpace
    let reviewCount: Int
    @Environment(AppModel.self) private var app

    var body: some View {
        switch space {
        case .today:
            TodayView()
        case .budget:
            BudgetTabView(reviewCount: reviewCount)
        case .trips:
            NavigationStack {
                TripsListView()
                    .toolbar { ToolbarItem(placement: .topBarLeading) { HamburgerButton() } }
            }
        case .eats:
            NavigationStack {
                EatsListView()
                    .toolbar { ToolbarItem(placement: .topBarLeading) { HamburgerButton() } }
            }
        case .movies:
            NavigationStack {
                MoviesListView()
                    .toolbar { ToolbarItem(placement: .topBarLeading) { HamburgerButton() } }
            }
        case .period:
            NavigationStack {
                moduleScreen(.period)
                    .toolbar { ToolbarItem(placement: .topBarLeading) { HamburgerButton() } }
            }
        }
    }
}

/// The Budget app: the original five tabs.
private struct BudgetTabView: View {
    let reviewCount: Int
    @Environment(AppModel.self) private var app

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
                // BudgetView is also pushed from the Dashboard, so the tab supplies its own stack.
                NavigationStack {
                    BudgetView()
                        .toolbar { ToolbarItem(placement: .topBarLeading) { HamburgerButton() } }
                }
            }
        }
    }
}

/// ☰ drawer: switch apps at the top, then tools for the current app, then app-wide items.
struct SidebarDrawer: View {
    @Environment(AppModel.self) private var app
    @State private var lineup = AppLineup.shared
    @AppStorage("displayName") private var displayName = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    WooliLogo(size: 30)
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
                    sectionTitle("APPS").padding(.top, 16)

                    spaceButton(.today)
                    ForEach(lineup.installed) { spaceButton($0) }

                    if app.space == .budget {
                        Divider()
                            .padding(.vertical, 12)
                            .padding(.horizontal, 16)

                        sectionTitle("BUDGET TOOLS")

                        sidebarButton(title: "Categories", systemImage: "square.grid.2x2", destination: .categories)
                        sidebarButton(title: "Rules", systemImage: "wand.and.stars", destination: .rules)
                        sidebarButton(title: "Recurring", systemImage: "arrow.triangle.2.circlepath", destination: .recurring)
                    }

                    Divider()
                        .padding(.vertical, 12)
                        .padding(.horizontal, 16)

                    sectionTitle("WOOLI")

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

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(Theme.textTertiary)
            .padding(.horizontal, 20)
            .padding(.bottom, 4)
    }

    private func spaceButton(_ space: AppSpace) -> some View {
        let isCurrent = app.space == space
        return Button {
            withAnimation(.easeInOut(duration: 0.2)) { app.open(space) }
        } label: {
            HStack(spacing: 12) {
                AppIconTile(space, size: 30)
                Text(space.title)
                    .font(.body.weight(isCurrent ? .semibold : .medium))
                    .foregroundStyle(Theme.text)
                Spacer()
                if isCurrent {
                    Image(systemName: "checkmark")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Theme.brand)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isCurrent ? Theme.brandSoft : .clear, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .padding(.horizontal, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
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

/// Whether a NavigationStack on screen has pushed past its root, so the
/// left-edge swipe belongs to "back" rather than the drawer.
@MainActor
enum NavigationDepth {
    static var isShowingPushedScreen: Bool {
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
        return windows.filter(\.isKeyWindow).contains { $0.rootViewController.map(hasPushed) ?? false }
    }

    private static func hasPushed(_ vc: UIViewController) -> Bool {
        if let nav = vc as? UINavigationController, nav.viewIfLoaded?.window != nil, nav.viewControllers.count > 1 { return true }
        return vc.children.contains(where: hasPushed)
    }
}
