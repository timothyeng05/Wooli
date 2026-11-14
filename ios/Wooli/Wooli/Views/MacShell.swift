#if os(macOS)
import AppKit
import SwiftData
import SwiftUI
import UniformTypeIdentifiers

/// What the Mac sidebar can show: an app, one of Budget's pages, or a Budget tool.
enum MacSection: Hashable {
    case space(AppSpace)
    case budget(AppTab)
    case tool(SidebarDestination)
    /// Trips' gallery, and one page (overview, a city, ideas) of one trip.
    case allTrips
    case trip(String, TripPage)
}

/// Where the Trips sidebar was last left, so quitting and reopening returns there.
private enum TripSelectionStore {
    static func encode(_ section: MacSection) -> String {
        guard case .trip(let id, let page) = section else { return "" }
        switch page {
        case .overview: return "\(id)|overview"
        case .city(let leg): return "\(id)|city:\(leg)"
        case .ideas: return "\(id)|ideas"
        case .bookings: return "\(id)|bookings"
        }
    }

    static func decode(_ text: String) -> MacSection {
        let parts = text.split(separator: "|", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return .allTrips }
        let page: TripPage = parts[1] == "ideas" ? .ideas : parts[1] == "bookings" ? .bookings : parts[1].hasPrefix("city:") ? .city(String(parts[1].dropFirst(5))) : .overview
        return .trip(parts[0], page)
    }
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
    @State private var trips = TripStore.shared
    /// The Trips sidebar's pick, kept while another app is open.
    @State private var tripSelection: MacSection = .allTrips
    /// The trip whose cities are unfolded in the sidebar.
    @State private var expandedTrip: String?
    @State private var showNewTrip = false
    @AppStorage("mac.trips.last") private var lastTrip = ""

    private var selection: Binding<MacSection?> {
        Binding {
            if let tool { return .tool(tool) }
            let space = lineup.isEnabled(app.space) ? app.space : .today
            if space == .trips {
                // A trip that was deleted or left falls back to the gallery.
                if case .trip(let id, _) = tripSelection, trips.trip(id) == nil { return .allTrips }
                return tripSelection
            }
            return space == .budget ? .budget(app.selectedTab) : .space(space)
        } set: { section in
            switch section {
            case .allTrips, .trip: tool = nil; app.space = .trips; tripSelection = section ?? .allTrips
            case .space(let space): tool = nil; app.space = space
            case .budget(let tab): tool = nil; app.space = .budget; app.selectedTab = tab
            case .tool(let destination): tool = destination; app.space = .budget
            case nil: break
            }
        }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columns) {
            Group {
                if showsTripsSidebar { tripsSidebar } else { sidebar }
            }
            .navigationSplitViewColumnWidth(min: showsTripsSidebar ? 200 : 68, ideal: showsTripsSidebar ? 230 : 68,
                                            max: showsTripsSidebar ? 300 : 68)
            .toolbar(removing: .sidebarToggle)
        } detail: {
            // Scroll views stay window-wide (scroll bar at the edge, background
            // to the edges); only their content is centred at a readable width.
            detail
                .id(detailID)
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
        .sheet(isPresented: $showNewTrip) {
            NewTripSheet { selection.wrappedValue = .trip($0, .overview) }
        }
        // File → New Trip… and the toolbar's + both come through here.
        .task(id: trips.newTripRequested) {
            if trips.newTripRequested { trips.newTripRequested = false; showNewTrip = true }
        }
        .onAppear { tripSelection = TripSelectionStore.decode(lastTrip) }
        .onChange(of: tripSelection) { _, new in
            lastTrip = TripSelectionStore.encode(new)
            if case .trip(let id, _) = new { expandedTrip = id }
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
        case .budget, .tool, .allTrips, .trip: true
        default: false
        }
    }

    /// Trips lists its trips and their cities by name, so its sidebar is wider than Budget's icon rail.
    private var showsTripsSidebar: Bool {
        switch selection.wrappedValue {
        case .allTrips, .trip: true
        default: false
        }
    }

    /// Changes when the screen does, but not when only a trip's page does (the workspace keeps its state).
    private var detailID: AnyHashable {
        if case .trip(let id, _) = selection.wrappedValue { return "trip-\(id)" }
        return selection.wrappedValue
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

    // MARK: Trips sidebar

    private var tripsSidebar: some View {
        let today = DayKey.key(.now)
        let upcoming = trips.trips.filter { $0.endDay >= today }.sorted { $0.startDay < $1.startDay }
        let past = trips.trips.filter { $0.endDay < today }.sorted { $0.startDay > $1.startDay }
        return List(selection: selection) {
            Label("All trips", systemImage: "square.grid.2x2").tag(MacSection.allTrips)
            if !upcoming.isEmpty { Section("Upcoming") { ForEach(upcoming) { tripGroup($0) } } }
            if !past.isEmpty { Section("Past") { ForEach(past) { tripGroup($0) } } }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            HStack {
                Button("New Trip", systemImage: "plus") { showNewTrip = true }
                    .buttonStyle(.borderless)
                    .help("New trip (⇧⌘N)")
                Button("Open Trip File", systemImage: "square.and.arrow.down") { openTripFile() }
                    .buttonStyle(.borderless).labelStyle(.iconOnly)
                    .help("Open a .woolitrip file as a new trip")
                Spacer()
                SyncButton().buttonStyle(.borderless).labelStyle(.iconOnly)
                Button("Settings", systemImage: "gearshape") { openSettings() }
                    .buttonStyle(.borderless).labelStyle(.iconOnly).help("Settings (⌘,)")
            }
            .padding(Space.m)
        }
    }

    /// A `.woolitrip` file becomes a new trip with new ids; nothing is overwritten.
    private func openTripFile() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [UTType(filenameExtension: TripFile.fileExtension) ?? .json, .json]
        guard panel.runModal() == .OK, let url = panel.url,
              let data = try? Data(contentsOf: url),
              let copy = try? TripFile.newTrip(from: data) else { return }
        trips.save(copy.trip)
        copy.items.forEach { trips.save($0) }
        selection.wrappedValue = .trip(copy.trip.id, .overview)
    }

    private func tripGroup(_ trip: Trip) -> some View {
        DisclosureGroup(isExpanded: Binding(get: { expandedTrip == trip.id },
                                            set: { expandedTrip = $0 ? trip.id : nil })) {
            ForEach(trip.legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }) { leg in
                cityRow(leg, trip: trip).tag(MacSection.trip(trip.id, .city(leg.id)))
            }
            HStack {
                Label("Ideas", systemImage: "lightbulb")
                Spacer()
                let count = ideaCount(trip)
                if count > 0 { Text("\(count)").font(.caption).foregroundStyle(Theme.textTertiary).monospacedDigit() }
            }
            .tag(MacSection.trip(trip.id, .ideas))
            HStack {
                Label("Bookings", systemImage: "ticket")
                Spacer()
                // Travel and stays still to book.
                let count = TripBookings.notBookedCount(trips.items(in: trip.id))
                if count > 0 { Text("\(count)").font(.caption).foregroundStyle(Theme.textTertiary).monospacedDigit() }
            }
            .tag(MacSection.trip(trip.id, .bookings))
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                Text(trip.name.isEmpty ? "Untitled trip" : trip.name).font(.body.weight(.medium)).lineLimit(1)
                Text(tripCaption(trip)).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            .tag(MacSection.trip(trip.id, .overview))
        }
    }

    private func cityRow(_ leg: TripLeg, trip: Trip) -> some View {
        HStack(spacing: Space.s) {
            Group {
                if leg.emoji.isEmpty || leg.emoji == "📍" {
                    Text("\(trip.number(of: leg))").font(.caption2.weight(.bold)).foregroundStyle(.white)
                } else {
                    Text(leg.emoji).font(.caption)
                }
            }
            .frame(width: 22, height: 22)
            .background(Theme.Group.travel.color.gradient, in: Circle())
            Text(leg.name.isEmpty ? "City \(trip.number(of: leg))" : leg.name).lineLimit(1)
            Spacer(minLength: 4)
            if leg.contains(DayKey.key(.now)) {
                Text("NOW").font(.caption2.weight(.heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(Theme.brand.gradient, in: Capsule())
            } else if leg.nights > 0 {
                Text("\(leg.nights) d").font(.caption).foregroundStyle(Theme.textTertiary).monospacedDigit()
            }
        }
    }

    private func ideaCount(_ trip: Trip) -> Int {
        let days = Set(trip.days)
        return trips.items(in: trip.id).filter { $0.day.map { !days.contains($0) } ?? true }.count
    }

    /// "in 42 days", "now", or the dates once it's over.
    private func tripCaption(_ trip: Trip) -> String {
        let today = DayKey.key(.now)
        if trip.startDay > today {
            let days = Calendar.current.dateComponents([.day], from: DayKey.date(today), to: DayKey.date(trip.startDay)).day ?? 0
            return days == 1 ? "tomorrow" : "in \(days) days"
        }
        return trip.endDay >= today ? "now" : trip.dateRangeText
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
        case .allTrips:
            NavigationStack { TripsListView { selection.wrappedValue = .trip($0, .overview) } }
        case .trip(let id, let page):
            NavigationStack {
                MacTripWorkspace(tripID: id, page: page, onClose: { tripSelection = .allTrips })
            }
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
        case .trips: NavigationStack { TripsListView { selection.wrappedValue = .trip($0, .overview) } }
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
                                            .padding(.horizontal, Space.xs)
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
    @FocusedValue(\.tripActions) private var trip
    @AppStorage("trip.mac.view") private var tripView: TripWorkspaceMode = .itinerary
    @AppStorage("trip.mac.showMap") private var showMap = true
    @AppStorage("trip.mac.showInspector") private var showInspector = false
    @AppStorage("trip.showOpenSlots") private var showOpenSlots = true

    var body: some Commands {
        SidebarCommands()
        CommandGroup(replacing: .newItem) {
            Button("New Trip…") {
                app.space = .trips
                TripStore.shared.newTripRequested = true
            }
            .keyboardShortcut("n", modifiers: [.command, .shift])
            Button("New Plan") { trip?.newPlan() }
                .keyboardShortcut("n")
                .disabled(trip == nil)
            Divider()
            Button("Sync Bank") { Task { await app.sync(context: container.mainContext) } }
                .keyboardShortcut("r")
                .disabled(app.mode != .live || app.isSyncing)
        }
        CommandGroup(after: .pasteboard) {
            Button("Duplicate") { trip?.duplicate() }
                .keyboardShortcut("d")
                .disabled(trip?.hasSelection != true)
        }
        CommandMenu("Plan") {
            Button("Move Up") { trip?.moveUp() }
                .keyboardShortcut(.upArrow, modifiers: .command)
                .disabled(trip?.hasSelection != true)
            Button("Move Down") { trip?.moveDown() }
                .keyboardShortcut(.downArrow, modifiers: .command)
                .disabled(trip?.hasSelection != true)
            Divider()
            Button("Mark as Booked") { trip?.markBooked() }
                .keyboardShortcut("b")
                .disabled(trip?.hasSelection != true)
        }
        CommandGroup(before: .sidebar) {
            if app.space == .trips {
                ForEach(Array(TripWorkspaceMode.allCases.enumerated()), id: \.element) { i, mode in
                    Button(mode.label) { tripView = mode }
                        .keyboardShortcut(KeyEquivalent(Character("\(i + 1)")))
                        .disabled(trip == nil)
                }
                Divider()
                Button(showMap ? "Hide Map" : "Show Map") { showMap.toggle() }
                    .keyboardShortcut("m", modifiers: [.command, .shift])
                    .disabled(trip == nil)
                Button(showInspector ? "Hide Inspector" : "Show Inspector") { showInspector.toggle() }
                    .keyboardShortcut("i", modifiers: [.command, .option])
                    .disabled(trip == nil)
                Button(showOpenSlots ? "Hide Open Slots" : "Show Open Slots") { showOpenSlots.toggle() }
                    .keyboardShortcut("o", modifiers: [.command, .shift])
                    .disabled(trip == nil)
                Divider()
            }
        }
        CommandMenu("Go") {
            Button("Today") { app.space = .today }.keyboardShortcut("0")
            if app.space != .trips {
                Button("Dashboard") { app.space = .budget; app.selectedTab = .dashboard }.keyboardShortcut("1")
                Button("Accounts") { app.space = .budget; app.selectedTab = .accounts }.keyboardShortcut("2")
                Button("Transactions") { app.space = .budget; app.selectedTab = .transactions }.keyboardShortcut("3")
                Button("Reports") { app.space = .budget; app.selectedTab = .reports }.keyboardShortcut("4")
                Button("Plan") { app.space = .budget; app.selectedTab = .budget }.keyboardShortcut("5")
            }
            Button("Trips") { app.space = .trips }.keyboardShortcut("t", modifiers: [.command, .shift])
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
