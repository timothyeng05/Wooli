#if os(macOS)
import SwiftData
import SwiftUI

/// What the Mac sidebar can show: an app, one of Budget's pages, or a Budget tool.
enum MacSection: Hashable {
    case space(AppSpace)
    case budget(AppTab)
    case tool(SidebarDestination)
}

/// The Mac window, laid out like iCloud on the web: an app switcher at the
/// top right (the iPhone's ☰ drawer), and a sidebar only for an app that has
/// pages of its own (Budget's tabs and tools). The screens are the iPhone's.
struct MacShellView: View {
    let reviewCount: Int
    @Environment(AppModel.self) private var app
    @Environment(\.openSettings) private var openSettings
    @State private var lineup = AppLineup.shared
    @State private var tool: SidebarDestination?
    /// Held here so the sidebar button (and ⌃⌘S) always folds the sidebar,
    /// whatever the screen beside it puts in the toolbar.
    @State private var columns: NavigationSplitViewVisibility = .all
    @State private var showingApps = false

    private var selection: Binding<MacSection?> {
        Binding {
            if let tool { return .tool(tool) }
            let space = lineup.isEnabled(app.space) ? app.space : .today
            return space == .budget ? .budget(app.selectedTab) : .space(space)
        } set: { section in
            switch section {
            case .space(let space): tool = nil; app.space = space
            case .budget(let tab): tool = nil; app.space = .budget; app.selectedTab = tab
            case .tool(let destination): tool = destination; app.space = .budget
            case nil: break
            }
        }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            sidebar
                .navigationSplitViewColumnWidth(min: 68, ideal: 68, max: 68)
                .toolbar(removing: .sidebarToggle)
        } detail: {
            // Scroll views stay window-wide (scroll bar at the edge, background
            // to the edges); only their content is centred at a readable width.
            detail
                .id(selection.wrappedValue)
                .readableContentWidth(wideSelection ? ReadableWidth.dashboard : ReadableWidth.max)
        }
        .toolbar {
            if hasSidebar {
                ToolbarItem(placement: .navigation) {
                    Button(columns == .detailOnly ? "Show Sidebar" : "Hide Sidebar", systemImage: "sidebar.left") {
                        withAnimation(.snappy) { columns = columns == .detailOnly ? .all : .detailOnly }
                    }
                    .help("Show or hide the sidebar (⌃⌘S)")
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Apps", systemImage: "square.grid.3x3.fill") { showingApps.toggle() }
                    .help("Switch apps")
                    .popover(isPresented: $showingApps, arrowEdge: .bottom) {
                        MacAppSwitcher(current: app.space, reviewCount: reviewCount) { space in
                            showingApps = false
                            selection.wrappedValue = space == .budget ? .budget(app.selectedTab) : .space(space)
                        } settings: {
                            showingApps = false
                            openSettings()
                        }
                    }
            }
        }
        // An app with its own pages opens with them beside it; the rest get the whole window.
        .onChange(of: hasSidebar, initial: true) { _, has in
            withAnimation(.snappy) { columns = has ? .all : .detailOnly }
        }
        .frame(minWidth: 860, minHeight: 560)
        // Screens shared with the iPhone still ask for the drawer's sheets; on
        // the Mac those are sidebar items and the Settings window.
        .onChange(of: app.sidebarDestination) { _, destination in
            guard let destination else { return }
            app.sidebarDestination = nil
            if destination == .settings { openSettings() } else { selection.wrappedValue = .tool(destination) }
        }
    }

    // MARK: Sidebar

    /// Only Budget has pages of its own to list.
    private var hasSidebar: Bool {
        switch selection.wrappedValue {
        case .budget, .tool: true
        default: false
        }
    }

    /// Budget's pages lay out in columns, so they get more room than a list.
    private var wideSelection: Bool {
        if case .budget = selection.wrappedValue { return true }
        return false
    }

    /// An icon-only rail, like Muse: names show as tooltips, so the page gets the room.
    private var sidebar: some View {
        List(selection: selection) {
            Section {
                row(.budget(.dashboard), "Dashboard", "house")
                row(.budget(.accounts), "Accounts", "square.stack.3d.up")
                row(.budget(.transactions), "Transactions", "creditcard", badge: reviewCount)
                row(.budget(.reports), "Reports", "chart.pie")
                row(.budget(.budget), "Plan", "map")
            } header: {
                AppIconTile(.budget, size: 28)
                    .frame(maxWidth: .infinity)
                    .padding(.bottom, Space.xs)
                    .help(AppSpace.budget.title)
            }
            Section {
                row(.tool(.categories), "Categories", "square.grid.2x2")
                row(.tool(.rules), "Rules", "wand.and.stars")
                row(.tool(.recurring), "Recurring", "arrow.triangle.2.circlepath")
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: Space.m) {
                SyncButton()
                    .buttonStyle(.borderless)
                    .labelStyle(.iconOnly)
                Button("Settings", systemImage: "gearshape") { openSettings() }
                    .buttonStyle(.borderless)
                    .labelStyle(.iconOnly)
                    .help("Settings (⌘,)")
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Space.m)
        }
    }

    /// Icon only; the name is the tooltip and VoiceOver label. A red dot stands in for the count.
    private func row(_ section: MacSection, _ title: String, _ systemImage: String, badge: Int = 0) -> some View {
        Label(title, systemImage: systemImage)
            .labelStyle(.iconOnly)
            .font(.title3)
            .frame(maxWidth: .infinity, minHeight: 30)
            .overlay(alignment: .topTrailing) {
                if badge > 0 { Circle().fill(Theme.expense).frame(width: 8, height: 8).offset(x: -4, y: 2) }
            }
            .help(title)
            .tag(section)
    }

    // MARK: Detail

    @ViewBuilder
    private var detail: some View {
        switch selection.wrappedValue ?? .space(.today) {
        case .space(let space):
            spaceScreen(space).appGuide(space, ready: space.module == nil)
        case .budget(let tab):
            Group {
                switch tab {
                case .dashboard: DashboardView()
                case .accounts: AccountsView()
                case .transactions: TransactionsView()
                case .reports: ReportsView()
                case .budget: NavigationStack { BudgetView() }
                }
            }
            .appGuide(.budget)
        case .tool(let destination):
            NavigationStack {
                switch destination {
                case .categories: CategoriesSettingsView()
                case .rules: RulesView()
                case .recurring, .settings: RecurringView()
                }
            }
        }
    }

    @ViewBuilder
    private func spaceScreen(_ space: AppSpace) -> some View {
        switch space {
        case .today: TodayView()
        case .budget: DashboardView()
        case .trips: NavigationStack { TripsListView() }
        case .eats: NavigationStack { EatsListView() }
        case .sights: NavigationStack { SightsListView() }
        case .movies: NavigationStack { MoviesListView() }
        case .recipes: NavigationStack { RecipesListView() }
        case .period: NavigationStack { moduleScreen(.period) }
        }
    }
}

/// The app switcher at the top right, like iCloud's: every app as its clay
/// icon in a grid, then the rest of Wooli.
struct MacAppSwitcher: View {
    let current: AppSpace
    let reviewCount: Int
    let open: (AppSpace) -> Void
    let settings: () -> Void
    @State private var lineup = AppLineup.shared

    var body: some View {
        VStack(alignment: .leading, spacing: Space.l) {
            Text("Apps").font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
            LazyVGrid(columns: Array(repeating: GridItem(.fixed(84), spacing: Space.s), count: 4), spacing: Space.l) {
                ForEach([AppSpace.today] + lineup.installed.filter { $0 != .today }) { space in
                    Button { open(space) } label: {
                        VStack(spacing: Space.s) {
                            AppIconTile(space, size: 60)
                                .overlay(alignment: .topTrailing) {
                                    if space == .budget, reviewCount > 0 {
                                        Text("\(reviewCount)").font(.caption2.weight(.bold)).foregroundStyle(.white)
                                            .padding(.horizontal, 6).padding(.vertical, 2)
                                            .background(Theme.expense, in: Capsule())
                                            .offset(x: 6, y: -6)
                                    }
                                }
                                .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
                            Text(space.title).font(.callout)
                                .foregroundStyle(space == current ? Theme.brand : Theme.textSecondary)
                                .fontWeight(space == current ? .semibold : .regular)
                        }
                        .frame(width: 84)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            Divider()
            Text("More").font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
            VStack(alignment: .leading, spacing: Space.m) {
                SyncButton()
                    .buttonStyle(.borderless)
                    .labelStyle(.titleAndIcon)
                Button("Settings", systemImage: "gearshape", action: settings)
                    .buttonStyle(.borderless)
                Button("Customize Apps", systemImage: "sparkles", action: settings)
                    .buttonStyle(.borderless)
                    .help("Choose and order your apps in Settings")
            }
            .font(.body)
        }
        .padding(Space.xl)
        .frame(width: 4 * 84 + 3 * Space.s + 2 * Space.xl)
        // Wooli's colours are drawn for its own light card, not the system's popover material.
        .presentationBackground(Theme.card)
    }
}

/// Menu-bar commands for the Mac app.
struct WooliCommands: Commands {
    let app: AppModel
    let container: ModelContainer

    var body: some Commands {
        SidebarCommands()
        CommandGroup(after: .newItem) {
            Button("Sync Bank") { Task { await app.sync(context: container.mainContext) } }
                .keyboardShortcut("r")
                .disabled(app.mode != .live || app.isSyncing)
        }
        CommandMenu("Go") {
            Button("Today") { app.space = .today }.keyboardShortcut("0")
            Button("Dashboard") { app.space = .budget; app.selectedTab = .dashboard }.keyboardShortcut("1")
            Button("Accounts") { app.space = .budget; app.selectedTab = .accounts }.keyboardShortcut("2")
            Button("Transactions") { app.space = .budget; app.selectedTab = .transactions }.keyboardShortcut("3")
            Button("Reports") { app.space = .budget; app.selectedTab = .reports }.keyboardShortcut("4")
            Button("Plan") { app.space = .budget; app.selectedTab = .budget }.keyboardShortcut("5")
            Divider()
            Button("Review Transactions") { app.showReview = true }
                .keyboardShortcut("r", modifiers: [.command, .shift])
        }
        CommandGroup(replacing: .help) {
            Button("Send Feedback…") {
                if let url = URL(string: "mailto:support@wooliapp.com?subject=Wooli%20Beta%20Feedback") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }
}
#endif
