#if os(macOS)
import SwiftData
import SwiftUI

/// Field Notes surface & ink palette for the macOS shell chrome.
private enum ShellPalette {
    static let paper = Color(light: 0xFBF9F5, dark: 0x161D1A)
    static let paperWarm = Color(light: 0xF4F0EA, dark: 0x1E2622)
    static let ink = Color(light: 0x182C23, dark: 0xF0ECE3)
    static let forest = Color(light: 0x2B4C3F, dark: 0x5E9B82)
    static let forestSoft = Color(light: 0xE7EFEA, dark: 0x23382F)
    static let hairline = Color(light: 0xE4DDD0, dark: 0x2D3832)
    static let muted = Color(light: 0x5A6B62, dark: 0x9BA9A1)
}

private extension Notification.Name {
    static let toggleMacSidebar = Notification.Name("wooli.mac.toggleSidebar")
    static let toggleMacCommandPalette = Notification.Name("wooli.mac.toggleCommandPalette")
}

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
        }
    }

    static func decode(_ text: String) -> MacSection {
        let parts = text.split(separator: "|", maxSplits: 1).map(String.init)
        guard parts.count == 2 else { return .allTrips }
        let page: TripPage = parts[1] == "ideas" ? .ideas : parts[1].hasPrefix("city:") ? .city(String(parts[1].dropFirst(5))) : .overview
        return .trip(parts[0], page)
    }
}

/// The Mac window: a collapsible 210pt/68pt Field Notes sidebar with integrated
/// traffic lights, a clean top horizontal app switcher bar, and Cmd+F Spotlight.
struct MacShellView: View {
    let reviewCount: Int
    @Environment(AppModel.self) private var app
    @Environment(\.openSettings) private var openSettings
    @Query(sort: \LocalAccount.name) private var accounts: [LocalAccount]
    @State private var lineup = AppLineup.shared
    @State private var tool: SidebarDestination?
    @State private var trips = TripStore.shared
    /// The Trips sidebar's pick, kept while another app is open.
    @State private var tripSelection: MacSection = .allTrips
    /// The trip whose cities are unfolded in the sidebar.
    @State private var expandedTrip: String?
    @State private var showNewTrip = false
    @State private var showCommandPalette = false
    @AppStorage("mac.trips.last") private var lastTrip = ""
    @AppStorage("mac.sidebar.collapsed") private var isSidebarCollapsed = false
    @AppStorage("mac.sidebar.accountsExpanded") private var accountsExpanded = true

    private var selection: Binding<MacSection?> {
        Binding {
            if let tool { return .tool(tool) }
            let space = lineup.isEnabled(app.space) ? app.space : .today
            if space == .trips {
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
        ZStack {
            HStack(spacing: 0) {
                sidebarRail
                Rectangle()
                    .fill(ShellPalette.hairline)
                    .frame(width: 1)
                VStack(spacing: 0) {
                    topModuleBar
                    Rectangle()
                        .fill(ShellPalette.hairline)
                        .frame(height: 1)
                    detail
                        .id(detailID)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(ShellPalette.paper)
                        .readableContentWidth(wideSelection ? ReadableWidth.dashboard : ReadableWidth.max)
                }
            }
            .background(ShellPalette.paper)

            if showCommandPalette {
                MacCommandPalette(
                    reviewCount: reviewCount,
                    accounts: visibleAccounts,
                    trips: trips.trips,
                    isPresented: $showCommandPalette,
                    onSelectSection: { selection.wrappedValue = $0 },
                    onToggleSidebar: toggleSidebar,
                    onOpenSettings: { openSettings() }
                )
                .transition(.opacity.combined(with: .scale(scale: 0.98)))
                .zIndex(50)
            }
        }
        .sheet(isPresented: $showNewTrip) {
            NewTripSheet { selection.wrappedValue = .trip($0, .overview) }
        }
        .task(id: trips.newTripRequested) {
            if trips.newTripRequested { trips.newTripRequested = false; showNewTrip = true }
        }
        .onAppear { tripSelection = TripSelectionStore.decode(lastTrip) }
        .onChange(of: tripSelection) { _, new in
            lastTrip = TripSelectionStore.encode(new)
            if case .trip(let id, _) = new { expandedTrip = id }
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleMacSidebar)) { _ in
            toggleSidebar()
        }
        .onReceive(NotificationCenter.default.publisher(for: .toggleMacCommandPalette)) { _ in
            withAnimation(.easeOut(duration: 0.14)) {
                showCommandPalette.toggle()
            }
        }
        .frame(minWidth: 860, minHeight: 560)
        .onChange(of: app.sidebarDestination) { _, destination in
            guard let destination else { return }
            app.sidebarDestination = nil
            if destination == .settings { openSettings() } else { selection.wrappedValue = .tool(destination) }
        }
    }

    private func toggleSidebar() {
        withAnimation(.snappy(duration: 0.22)) {
            isSidebarCollapsed.toggle()
        }
    }

    private var visibleAccounts: [LocalAccount] {
        accounts.filter { !$0.isHidden }
    }

    // MARK: Top Horizontal App Switcher Bar

    private var topModuleBar: some View {
        HStack(spacing: Space.xs) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Space.xs) {
                    ForEach([AppSpace.today] + lineup.installed.filter { $0 != .today }) { space in
                        let isSelected = app.space == space
                        Button {
                            selection.wrappedValue = space == .budget ? .budget(app.selectedTab) : .space(space)
                        } label: {
                            HStack(spacing: Space.xs) {
                                AppIconTile(space, size: 18)
                                Text(space.title)
                                    .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                                if space == .budget, reviewCount > 0 {
                                    Text("\(reviewCount)")
                                        .font(.caption2.weight(.bold))
                                        .monospacedDigit()
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Theme.expense, in: Capsule())
                                }
                            }
                            .padding(.horizontal, Space.m)
                            .padding(.vertical, 6)
                            .foregroundStyle(isSelected ? ShellPalette.forest : ShellPalette.muted)
                            .background(
                                isSelected ? ShellPalette.forestSoft : Color.clear,
                                in: Capsule()
                            )
                            .overlay(
                                Capsule()
                                    .strokeBorder(isSelected ? ShellPalette.forest.opacity(0.18) : Color.clear, lineWidth: 1)
                            )
                            .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .help(space.title)
                    }
                }
            }

            Spacer(minLength: Space.s)

            Button {
                withAnimation(.easeOut(duration: 0.14)) {
                    showCommandPalette = true
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 12, weight: .medium))
                    Text("Jump to…")
                        .font(.system(size: 12, weight: .medium))
                    Text("⌘F")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(ShellPalette.paper, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 4, style: .continuous)
                                .strokeBorder(ShellPalette.hairline, lineWidth: 1)
                        )
                }
                .foregroundStyle(ShellPalette.muted)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(ShellPalette.paperWarm, in: Capsule())
                .overlay(Capsule().strokeBorder(ShellPalette.hairline, lineWidth: 1))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .help("Spotlight Command Palette (⌘F)")
        }
        .padding(.horizontal, Space.l)
        .padding(.vertical, Space.s)
        .background(ShellPalette.paper)
    }

    // MARK: Collapsible Sidebar Rail (210pt expanded / 68pt collapsed)

    private var sidebarRail: some View {
        VStack(spacing: 0) {
            sidebarTopChrome
            ScrollView {
                VStack(alignment: isSidebarCollapsed ? .center : .leading, spacing: Space.l) {
                    if showsTripsSidebar {
                        tripsSidebarContent
                    } else if app.space == .budget {
                        budgetSidebarContent
                    } else {
                        spaceSidebarContent
                    }
                }
                .padding(.horizontal, isSidebarCollapsed ? Space.s : Space.m)
                .padding(.vertical, Space.s)
            }
            Rectangle()
                .fill(ShellPalette.hairline)
                .frame(height: 1)
            sidebarFooter
        }
        .frame(width: isSidebarCollapsed ? 68 : 210)
        .background(ShellPalette.paperWarm)
    }

    private var sidebarTopChrome: some View {
        Group {
            if isSidebarCollapsed {
                VStack(spacing: Space.s) {
                    Color.clear.frame(height: 28)
                    Button(action: toggleSidebar) {
                        Image(systemName: "sidebar.left")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(ShellPalette.muted)
                            .frame(width: 32, height: 28)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Expand Sidebar (⌃⌘S)")
                }
                .padding(.bottom, Space.xs)
            } else {
                HStack {
                    // Clearance for macOS traffic lights when using .hiddenTitleBar
                    Color.clear.frame(width: 68, height: 28)
                    Spacer()
                    Button(action: toggleSidebar) {
                        Image(systemName: "sidebar.left")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(ShellPalette.muted)
                            .frame(width: 28, height: 28)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .help("Collapse Sidebar (⌃⌘S)")
                }
                .padding(.horizontal, Space.m)
                .padding(.top, 8)
                .padding(.bottom, Space.xs)
            }
        }
    }

    private var sidebarFooter: some View {
        Group {
            if isSidebarCollapsed {
                VStack(spacing: Space.m) {
                    SyncButton()
                        .buttonStyle(.borderless)
                        .labelStyle(.iconOnly)
                    Button("Settings", systemImage: "gearshape") { openSettings() }
                        .buttonStyle(.borderless)
                        .labelStyle(.iconOnly)
                        .foregroundStyle(ShellPalette.muted)
                        .help("Settings (⌘,)")
                }
                .padding(.vertical, Space.m)
            } else {
                HStack(spacing: Space.s) {
                    if showsTripsSidebar {
                        Button {
                            showNewTrip = true
                        } label: {
                            Label("New Trip", systemImage: "plus")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(ShellPalette.forest)
                        }
                        .buttonStyle(.plain)
                        .help("New trip (⇧⌘N)")
                        Spacer()
                        SyncButton().buttonStyle(.borderless).labelStyle(.iconOnly)
                    } else {
                        SyncButton()
                            .buttonStyle(.borderless)
                        Spacer()
                    }
                    Button("Settings", systemImage: "gearshape") { openSettings() }
                        .buttonStyle(.borderless)
                        .labelStyle(.iconOnly)
                        .foregroundStyle(ShellPalette.muted)
                        .help("Settings (⌘,)")
                }
                .padding(.horizontal, Space.m)
                .padding(.vertical, Space.m)
            }
        }
    }

    // MARK: Budget Sidebar + Copilot-Style MY ACCOUNTS Tree

    private var budgetSidebarContent: some View {
        VStack(alignment: isSidebarCollapsed ? .center : .leading, spacing: Space.m) {
            if !isSidebarCollapsed {
                HStack(spacing: Space.s) {
                    AppIconTile(.budget, size: 22)
                    Text(AppSpace.budget.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(ShellPalette.ink)
                }
                .padding(.horizontal, Space.xs)
            }

            VStack(spacing: 2) {
                sidebarRow(.budget(.dashboard), "Dashboard", "house")
                sidebarRow(.budget(.accounts), "Accounts", "square.stack.3d.up")
                sidebarRow(.budget(.transactions), "Transactions", "creditcard", badge: reviewCount)
                sidebarRow(.budget(.reports), "Reports", "chart.pie")
                sidebarRow(.budget(.budget), "Plan", "map")
            }

            sidebarSectionHeader("Tools")
            VStack(spacing: 2) {
                sidebarRow(.tool(.categories), "Categories", "square.grid.2x2")
                sidebarRow(.tool(.rules), "Rules", "wand.and.stars")
                sidebarRow(.tool(.recurring), "Recurring", "arrow.triangle.2.circlepath")
            }

            if !isSidebarCollapsed && !visibleAccounts.isEmpty {
                VStack(alignment: .leading, spacing: Space.xs) {
                    Button {
                        withAnimation(.snappy(duration: 0.18)) {
                            accountsExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text("MY ACCOUNTS")
                                .font(.system(size: 10.5, weight: .bold))
                                .tracking(0.8)
                                .foregroundStyle(ShellPalette.muted)
                            Spacer()
                            Image(systemName: accountsExpanded ? "chevron.down" : "chevron.right")
                                .font(.system(size: 9.5, weight: .semibold))
                                .foregroundStyle(ShellPalette.muted)
                        }
                        .padding(.horizontal, Space.s)
                        .padding(.top, Space.s)
                        .padding(.bottom, 2)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if accountsExpanded {
                        VStack(spacing: 2) {
                            ForEach(visibleAccounts) { account in
                                Button {
                                    selection.wrappedValue = .budget(.accounts)
                                } label: {
                                    HStack(spacing: Space.s) {
                                        Circle()
                                            .fill(accountDotColor(account.kind))
                                            .frame(width: 7, height: 7)
                                        Text(account.displayName)
                                            .font(.system(size: 12.5, weight: .regular))
                                            .foregroundStyle(ShellPalette.ink)
                                            .lineLimit(1)
                                        Spacer(minLength: 4)
                                        Text(account.balance.currency(account.currency))
                                            .font(.system(size: 12, weight: .medium))
                                            .monospacedDigit()
                                            .foregroundStyle(account.balance < 0 ? Theme.expense : ShellPalette.muted)
                                            .lineLimit(1)
                                    }
                                    .padding(.horizontal, Space.s)
                                    .padding(.vertical, 5)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .help("\(account.displayName) · \(account.institutionName)")
                            }
                        }
                    }
                }
            }
        }
    }

    private func accountDotColor(_ kind: AccountKind) -> Color {
        switch kind {
        case .checking: ShellPalette.forest
        case .savings: Theme.accentTeal
        case .credit: Theme.accentAmber
        case .investment: Theme.accentViolet
        case .loan: Theme.accentRose
        case .other: Theme.accentSlate
        }
    }

    // MARK: Space Sidebar (non-Budget, non-Trips)

    private var spaceSidebarContent: some View {
        VStack(alignment: isSidebarCollapsed ? .center : .leading, spacing: Space.xs) {
            sidebarSectionHeader("Workspaces")
            ForEach(Array(([AppSpace.today] + lineup.installed.filter { $0 != .today }).enumerated()), id: \.element) { _, space in
                let target: MacSection = space == .budget ? .budget(app.selectedTab) : .space(space)
                let isSelected = app.space == space
                Button {
                    selection.wrappedValue = target
                } label: {
                    HStack(spacing: Space.s) {
                        AppIconTile(space, size: 20)
                        if !isSidebarCollapsed {
                            Text(space.title)
                                .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                                .foregroundStyle(isSelected ? ShellPalette.forest : ShellPalette.ink)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            if space == .budget, reviewCount > 0 {
                                Text("\(reviewCount)")
                                    .font(.caption2.weight(.bold))
                                    .monospacedDigit()
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 1)
                                    .background(Theme.expense, in: Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, isSidebarCollapsed ? 0 : Space.s)
                    .padding(.vertical, 6)
                    .frame(maxWidth: isSidebarCollapsed ? 44 : .infinity, alignment: isSidebarCollapsed ? .center : .leading)
                    .background(
                        isSelected ? ShellPalette.forestSoft : Color.clear,
                        in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(space.title)
            }
        }
    }

    // MARK: Trips Sidebar

    private var tripsSidebarContent: some View {
        let today = DayKey.key(.now)
        let upcoming = trips.trips.filter { $0.endDay >= today }.sorted { $0.startDay < $1.startDay }
        let past = trips.trips.filter { $0.endDay < today }.sorted { $0.startDay > $1.startDay }

        return VStack(alignment: isSidebarCollapsed ? .center : .leading, spacing: Space.s) {
            sidebarRow(.allTrips, "All Trips", "square.grid.2x2")

            if !isSidebarCollapsed {
                if !upcoming.isEmpty {
                    sidebarSectionHeader("Upcoming")
                    ForEach(upcoming) { tripGroup($0) }
                }
                if !past.isEmpty {
                    sidebarSectionHeader("Past")
                    ForEach(past) { tripGroup($0) }
                }
            }
        }
    }

    private func tripGroup(_ trip: Trip) -> some View {
        DisclosureGroup(isExpanded: Binding(get: { expandedTrip == trip.id },
                                            set: { expandedTrip = $0 ? trip.id : nil })) {
            VStack(alignment: .leading, spacing: 2) {
                ForEach(trip.legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }) { leg in
                    Button {
                        selection.wrappedValue = .trip(trip.id, .city(leg.id))
                    } label: {
                        cityRow(leg, trip: trip)
                            .padding(.horizontal, Space.xs)
                            .padding(.vertical, 4)
                            .background(
                                selection.wrappedValue == .trip(trip.id, .city(leg.id)) ? ShellPalette.forestSoft : Color.clear,
                                in: RoundedRectangle(cornerRadius: 6, style: .continuous)
                            )
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    selection.wrappedValue = .trip(trip.id, .ideas)
                } label: {
                    HStack {
                        Label("Ideas", systemImage: "lightbulb")
                            .font(.system(size: 12.5))
                        Spacer()
                        let count = ideaCount(trip)
                        if count > 0 {
                            Text("\(count)")
                                .font(.caption)
                                .foregroundStyle(ShellPalette.muted)
                                .monospacedDigit()
                        }
                    }
                    .foregroundStyle(selection.wrappedValue == .trip(trip.id, .ideas) ? ShellPalette.forest : ShellPalette.ink)
                    .padding(.horizontal, Space.xs)
                    .padding(.vertical, 4)
                    .background(
                        selection.wrappedValue == .trip(trip.id, .ideas) ? ShellPalette.forestSoft : Color.clear,
                        in: RoundedRectangle(cornerRadius: 6, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
            }
        } label: {
            Button {
                selection.wrappedValue = .trip(trip.id, .overview)
            } label: {
                VStack(alignment: .leading, spacing: 1) {
                    Text(trip.name.isEmpty ? "Untitled trip" : trip.name)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(selection.wrappedValue == .trip(trip.id, .overview) ? ShellPalette.forest : ShellPalette.ink)
                        .lineLimit(1)
                    Text(tripCaption(trip))
                        .font(.caption)
                        .foregroundStyle(ShellPalette.muted)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .tint(ShellPalette.muted)
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
            .frame(width: 20, height: 20)
            .background(Theme.Group.travel.color.gradient, in: Circle())
            Text(leg.name.isEmpty ? "City \(trip.number(of: leg))" : leg.name)
                .font(.system(size: 12.5))
                .foregroundStyle(ShellPalette.ink)
                .lineLimit(1)
            Spacer(minLength: 4)
            if leg.contains(DayKey.key(.now)) {
                Text("NOW").font(.caption2.weight(.heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 5).padding(.vertical, 1)
                    .background(ShellPalette.forest, in: Capsule())
            } else if leg.nights > 0 {
                Text("\(leg.nights) d").font(.caption).foregroundStyle(ShellPalette.muted).monospacedDigit()
            }
        }
    }

    private func ideaCount(_ trip: Trip) -> Int {
        let days = Set(trip.days)
        return trips.items(in: trip.id).filter { $0.day.map { !days.contains($0) } ?? true }.count
    }

    private func tripCaption(_ trip: Trip) -> String {
        let today = DayKey.key(.now)
        if trip.startDay > today {
            let days = Calendar.current.dateComponents([.day], from: DayKey.date(today), to: DayKey.date(trip.startDay)).day ?? 0
            return days == 1 ? "tomorrow" : "in \(days) days"
        }
        return trip.endDay >= today ? "now" : trip.dateRangeText
    }

    // MARK: Sidebar Helpers

    @ViewBuilder
    private func sidebarSectionHeader(_ title: String) -> some View {
        if isSidebarCollapsed {
            Rectangle()
                .fill(ShellPalette.hairline)
                .frame(width: 28, height: 1)
                .padding(.vertical, Space.xs)
        } else {
            Text(title.uppercased())
                .font(.system(size: 10.5, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(ShellPalette.muted)
                .padding(.horizontal, Space.s)
                .padding(.top, Space.xs)
        }
    }

    private func sidebarRow(_ section: MacSection, _ title: String, _ systemImage: String, badge: Int = 0) -> some View {
        let isSelected = selection.wrappedValue == section
        return Button {
            selection.wrappedValue = section
        } label: {
            HStack(spacing: Space.s) {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: isSelected ? .semibold : .regular))
                    .frame(width: 20, height: 20)
                if !isSidebarCollapsed {
                    Text(title)
                        .font(.system(size: 13, weight: isSelected ? .semibold : .medium))
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    if badge > 0 {
                        Text("\(badge)")
                            .font(.caption2.weight(.bold))
                            .monospacedDigit()
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(Theme.expense, in: Capsule())
                    }
                }
            }
            .foregroundStyle(isSelected ? ShellPalette.forest : ShellPalette.ink)
            .padding(.horizontal, isSidebarCollapsed ? 0 : Space.s)
            .padding(.vertical, 6)
            .frame(maxWidth: isSidebarCollapsed ? 44 : .infinity, alignment: isSidebarCollapsed ? .center : .leading)
            .background(
                isSelected ? ShellPalette.forestSoft : Color.clear,
                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
            )
            .overlay(alignment: .topTrailing) {
                if isSidebarCollapsed, badge > 0 {
                    Circle()
                        .fill(Theme.expense)
                        .frame(width: 7, height: 7)
                        .offset(x: -6, y: 4)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
    }

    // MARK: Detail

    private var showsTripsSidebar: Bool {
        switch selection.wrappedValue {
        case .allTrips, .trip: true
        default: false
        }
    }

    private var detailID: AnyHashable {
        if case .trip(let id, _) = selection.wrappedValue { return "trip-\(id)" }
        return selection.wrappedValue
    }

    private var wideSelection: Bool {
        if case .budget = selection.wrappedValue { return true }
        return false
    }

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

// MARK: - Cmd+F Spotlight Command Palette

private struct PaletteEntry: Identifiable {
    let id: String
    let group: String
    let title: String
    let subtitle: String?
    let systemImage: String
    let shortcut: String?
    let action: () -> Void
}

private struct MacCommandPalette: View {
    let reviewCount: Int
    let accounts: [LocalAccount]
    let trips: [Trip]
    @Binding var isPresented: Bool
    let onSelectSection: (MacSection) -> Void
    let onToggleSidebar: () -> Void
    let onOpenSettings: () -> Void

    @Environment(AppModel.self) private var app
    @State private var query = ""
    @State private var highlightedIndex = 0
    @FocusState private var searchFocused: Bool

    private var entries: [PaletteEntry] {
        var items: [PaletteEntry] = []

        // 1. Workspaces (Cmd+1..8)
        for (idx, space) in AppSpace.allCases.enumerated() {
            items.append(PaletteEntry(
                id: "space-\(space.rawValue)",
                group: "Workspaces",
                title: space.title,
                subtitle: space.pitch,
                systemImage: space.systemImage,
                shortcut: "⌘\(idx + 1)",
                action: {
                    onSelectSection(space == .budget ? .budget(app.selectedTab) : .space(space))
                }
            ))
        }

        // 2. Budget pages & tools
        let budgetPages: [(AppTab, String, String)] = [
            (.dashboard, "Dashboard", "house"),
            (.accounts, "Accounts", "square.stack.3d.up"),
            (.transactions, "Transactions", "creditcard"),
            (.reports, "Reports", "chart.pie"),
            (.budget, "Plan", "map"),
        ]
        for (tab, title, icon) in budgetPages {
            items.append(PaletteEntry(
                id: "budget-\(title)",
                group: "Budget",
                title: title,
                subtitle: tab == .transactions && reviewCount > 0 ? "\(reviewCount) to review" : nil,
                systemImage: icon,
                shortcut: nil,
                action: { onSelectSection(.budget(tab)) }
            ))
        }
        let tools: [(SidebarDestination, String, String)] = [
            (.categories, "Categories", "square.grid.2x2"),
            (.rules, "Rules", "wand.and.stars"),
            (.recurring, "Recurring", "arrow.triangle.2.circlepath"),
        ]
        for (dest, title, icon) in tools {
            items.append(PaletteEntry(
                id: "tool-\(dest.rawValue)",
                group: "Budget Tools",
                title: title,
                subtitle: nil,
                systemImage: icon,
                shortcut: nil,
                action: { onSelectSection(.tool(dest)) }
            ))
        }

        // 3. Accounts
        for account in accounts {
            items.append(PaletteEntry(
                id: "acct-\(account.providerAccountId)",
                group: "Accounts",
                title: account.displayName,
                subtitle: "\(account.institutionName) · \(account.balance.currency(account.currency))",
                systemImage: account.kind.symbol,
                shortcut: nil,
                action: { onSelectSection(.budget(.accounts)) }
            ))
        }

        // 4. Trips
        for trip in trips {
            items.append(PaletteEntry(
                id: "trip-\(trip.id)",
                group: "Trips",
                title: trip.name.isEmpty ? "Untitled trip" : trip.name,
                subtitle: trip.dateRangeText,
                systemImage: "suitcase.rolling",
                shortcut: nil,
                action: { onSelectSection(.trip(trip.id, .overview)) }
            ))
        }

        // 5. Actions
        items.append(PaletteEntry(
            id: "action-review",
            group: "Actions",
            title: "Review Transactions",
            subtitle: reviewCount > 0 ? "\(reviewCount) waiting" : "All caught up",
            systemImage: "checkmark.circle",
            shortcut: "⇧⌘R",
            action: { app.showReview = true }
        ))
        items.append(PaletteEntry(
            id: "action-sidebar",
            group: "Actions",
            title: "Toggle Sidebar",
            subtitle: "Expand or collapse navigation rail",
            systemImage: "sidebar.left",
            shortcut: "⌃⌘S",
            action: onToggleSidebar
        ))
        items.append(PaletteEntry(
            id: "action-settings",
            group: "Actions",
            title: "Settings",
            subtitle: "Preferences, apps, and bank connection",
            systemImage: "gearshape",
            shortcut: "⌘,",
            action: onOpenSettings
        ))

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return items }
        return items.filter {
            $0.title.localizedCaseInsensitiveContains(trimmed)
                || ($0.subtitle?.localizedCaseInsensitiveContains(trimmed) ?? false)
                || $0.group.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.opacity(0.22)
                .ignoresSafeArea()
                .onTapGesture { isPresented = false }

            VStack(spacing: 0) {
                HStack(spacing: Space.m) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(ShellPalette.forest)
                    TextField("Jump to workspace, page, account, or action…", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 15))
                        .foregroundStyle(ShellPalette.ink)
                        .focused($searchFocused)
                        .onSubmit { runHighlighted() }
                    Button("Esc") { isPresented = false }
                        .buttonStyle(.plain)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(ShellPalette.muted)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(ShellPalette.paperWarm, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
                .padding(.horizontal, Space.l)
                .padding(.vertical, 14)

                Rectangle().fill(ShellPalette.hairline).frame(height: 1)

                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 2) {
                            if entries.isEmpty {
                                Text("No matches for “\(query)”")
                                    .font(.subheadline)
                                    .foregroundStyle(ShellPalette.muted)
                                    .padding(Space.l)
                            } else {
                                ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                                    let isHighlighted = index == highlightedIndex
                                    Button {
                                        isPresented = false
                                        entry.action()
                                    } label: {
                                        HStack(spacing: Space.m) {
                                            Image(systemName: entry.systemImage)
                                                .font(.system(size: 14, weight: .medium))
                                                .foregroundStyle(isHighlighted ? ShellPalette.forest : ShellPalette.muted)
                                                .frame(width: 22)
                                            VStack(alignment: .leading, spacing: 1) {
                                                Text(entry.title)
                                                    .font(.system(size: 13.5, weight: .medium))
                                                    .foregroundStyle(ShellPalette.ink)
                                                if let subtitle = entry.subtitle, !subtitle.isEmpty {
                                                    Text(subtitle)
                                                        .font(.caption)
                                                        .foregroundStyle(ShellPalette.muted)
                                                        .lineLimit(1)
                                                }
                                            }
                                            Spacer()
                                            Text(entry.group)
                                                .font(.caption2.weight(.medium))
                                                .foregroundStyle(ShellPalette.muted)
                                            if let shortcut = entry.shortcut {
                                                Text(shortcut)
                                                    .font(.system(size: 11, weight: .semibold))
                                                    .foregroundStyle(ShellPalette.muted)
                                                    .padding(.horizontal, 6)
                                                    .padding(.vertical, 2)
                                                    .background(ShellPalette.paperWarm, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
                                            }
                                        }
                                        .padding(.horizontal, Space.m)
                                        .padding(.vertical, 8)
                                        .background(
                                            isHighlighted ? ShellPalette.forestSoft : Color.clear,
                                            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                                        )
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    .id(entry.id)
                                }
                            }
                        }
                        .padding(Space.s)
                    }
                    .frame(maxHeight: 360)
                    .onChange(of: highlightedIndex) { _, idx in
                        if entries.indices.contains(idx) {
                            proxy.scrollTo(entries[idx].id, anchor: .center)
                        }
                    }
                }
            }
            .frame(width: 560)
            .background(ShellPalette.paper, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(ShellPalette.hairline, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.18), radius: 24, y: 12)
            .padding(.top, 76)
        }
        .onAppear {
            searchFocused = true
            highlightedIndex = 0
        }
        .onChange(of: query) { _, _ in
            highlightedIndex = 0
        }
        .onKeyPress(.escape) {
            isPresented = false
            return .handled
        }
        .onKeyPress(.downArrow) {
            if !entries.isEmpty {
                highlightedIndex = min(highlightedIndex + 1, entries.count - 1)
            }
            return .handled
        }
        .onKeyPress(.upArrow) {
            highlightedIndex = max(highlightedIndex - 1, 0)
            return .handled
        }
    }

    private func runHighlighted() {
        guard entries.indices.contains(highlightedIndex) else { return }
        let entry = entries[highlightedIndex]
        isPresented = false
        entry.action()
    }
}

// MARK: - Menu-Bar Commands

/// Menu-bar commands for the Mac app.
struct WooliCommands: Commands {
    let app: AppModel
    let container: ModelContainer
    @FocusedValue(\.tripActions) private var trip
    @AppStorage("trip.mac.view") private var tripView: TripWorkspaceMode = .itinerary
    @AppStorage("trip.mac.showMap") private var showMap = true
    @AppStorage("trip.mac.showInspector") private var showInspector = false
    @AppStorage("trip.showOpenSlots") private var showOpenSlots = true
    @AppStorage("mac.sidebar.collapsed") private var isSidebarCollapsed = false

    var body: some Commands {
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
        CommandGroup(replacing: .textEditing) {
            Button("Spotlight Command Palette…") {
                NotificationCenter.default.post(name: .toggleMacCommandPalette, object: nil)
            }
            .keyboardShortcut("f", modifiers: .command)
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
        CommandGroup(replacing: .sidebar) {
            Button(isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar") {
                NotificationCenter.default.post(name: .toggleMacSidebar, object: nil)
            }
            .keyboardShortcut("s", modifiers: [.control, .command])
            if app.space == .trips {
                Divider()
                ForEach(Array(TripWorkspaceMode.allCases.enumerated()), id: \.element) { i, mode in
                    Button(mode.label) { tripView = mode }
                        .keyboardShortcut(KeyEquivalent(Character("\(i + 1)")), modifiers: [.command, .option])
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
            }
        }
        CommandMenu("Go") {
            ForEach(Array(AppSpace.allCases.enumerated()), id: \.element) { index, space in
                Button(space.title) { app.space = space }
                    .keyboardShortcut(KeyEquivalent(Character("\(index + 1)")), modifiers: .command)
            }
            Divider()
            Button("Dashboard") { app.space = .budget; app.selectedTab = .dashboard }
            Button("Accounts") { app.space = .budget; app.selectedTab = .accounts }
            Button("Transactions") { app.space = .budget; app.selectedTab = .transactions }
            Button("Reports") { app.space = .budget; app.selectedTab = .reports }
            Button("Plan") { app.space = .budget; app.selectedTab = .budget }
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
