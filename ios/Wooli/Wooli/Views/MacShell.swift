#if os(macOS)
import SwiftData
import SwiftUI

/// What the Mac sidebar can show: an app, one of Budget's pages, or a Budget tool.
enum MacSection: Hashable {
    case space(AppSpace)
    case budget(AppTab)
    case tool(SidebarDestination)
}

/// The Mac window: a sidebar of every app (Budget opened out into its pages
/// and tools) beside the selected screen. It replaces the iPhone's ☰ drawer
/// and Budget's tab bar; the screens themselves are the iPhone's.
struct MacShellView: View {
    let reviewCount: Int
    @Environment(AppModel.self) private var app
    @Environment(\.openSettings) private var openSettings
    @State private var lineup = AppLineup.shared
    @State private var tool: SidebarDestination?

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
        NavigationSplitView {
            sidebar
                .navigationSplitViewColumnWidth(min: 200, ideal: 230, max: 300)
        } detail: {
            // Scroll views stay window-wide (scroll bar at the edge, background
            // to the edges); only their content is centred at a readable width.
            detail
                .id(selection.wrappedValue)
                .readableContentWidth()
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

    private var sidebar: some View {
        List(selection: selection) {
            Section {
                row(.space(.today), AppSpace.today.title, AppSpace.today.systemImage)
            }

            if lineup.isEnabled(.budget) {
                Section("Budget") {
                    row(.budget(.dashboard), "Dashboard", "house")
                    row(.budget(.accounts), "Accounts", "square.stack.3d.up")
                    row(.budget(.transactions), "Transactions", "creditcard", badge: reviewCount)
                    row(.budget(.reports), "Reports", "chart.pie")
                    row(.budget(.budget), "Plan", "map")
                    row(.tool(.categories), "Categories", "square.grid.2x2")
                    row(.tool(.rules), "Rules", "wand.and.stars")
                    row(.tool(.recurring), "Recurring", "arrow.triangle.2.circlepath")
                }
            }

            ForEach(AppTheme.allCases) { theme in
                let apps = lineup.installed.filter { $0.theme == theme && $0 != .budget }
                if !apps.isEmpty {
                    Section(theme.title) {
                        ForEach(apps) { space in
                            row(.space(space), space.title, space.systemImage)
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            HStack(spacing: Space.s) {
                WooliLogo(size: 20)
                Text("Wooli").font(.headline).foregroundStyle(Theme.text)
                Spacer()
                SyncButton()
                    .buttonStyle(.borderless)
                    .labelStyle(.iconOnly)
                Button("Settings", systemImage: "gearshape") { openSettings() }
                    .buttonStyle(.borderless)
                    .labelStyle(.iconOnly)
                    .help("Settings (⌘,)")
            }
            .padding(.horizontal, Space.l)
            .padding(.vertical, Space.m)
        }
    }

    /// Plain sidebar icons: Mac sidebars draw them in the accent colour and turn them white when selected.
    private func row(_ section: MacSection, _ title: String, _ systemImage: String, badge: Int = 0) -> some View {
        Label(title, systemImage: systemImage)
        .badge(badge) // Before the tag, so the row stays selectable.
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
        case .reminders: NavigationStack { RemindersView() }
        }
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
