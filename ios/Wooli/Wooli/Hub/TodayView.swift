import SwiftUI
import SwiftData

/// The hub: `TodayBoard`, then the app grid. Tiles follow the user's ranking
/// (`AppLineup`), and hiding one in Edit Today keeps its app in the grid.
struct TodayView: View {
    @Environment(AppModel.self) private var app
    @AppStorage("displayName") private var displayName = ""
    @State private var lineup = AppLineup.shared
    @State private var showEdit = false

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: .now)
        let part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
        return displayName.isEmpty ? part : "\(part), \(displayName)"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.textSecondary)
                        .padding(.horizontal, 4)

                    TodayBoard(showEdit: $showEdit)
                    if lineup.todayCards.isEmpty && !lineup.installed.isEmpty {
                        Button { showEdit = true } label: {
                            Label("All cards are hidden. Edit Today", systemImage: "slider.horizontal.3")
                                .font(.subheadline.weight(.medium))
                                .frame(maxWidth: .infinity)
                                .card(padding: 16)
                        }
                        .buttonStyle(.plain)
                    }
                    #if DEBUG
                    if FutureAppsPreview.isOn { FutureAppsPreview.cards }
                    #endif

                    SectionLabel("Your apps").padding(.top, 8).padding(.horizontal, 4)
                    AppGrid(apps: lineup.recentFirst(lineup.installed))
                }
                .padding(16)
            }
            .pageBackground()
            .navigationTitle(greeting)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { HamburgerButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit Today", systemImage: "slider.horizontal.3") { showEdit = true }
                }
            }
            .sheet(isPresented: $showEdit) { EditTodayView() }
        }
    }
}

/// Edit Today: drag to rank the apps, switch a card off to keep the app in
/// the grid without a card. The rank is the same one Settings → Apps sets.
struct EditTodayView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var app
    @State private var lineup = AppLineup.shared
    @State private var movedPulse = false

    var body: some View {
        NavigationStack {
            List {
                ForEach(AppTheme.allCases) { theme in
                    let apps = lineup.installed.filter { $0.theme == theme }
                    if !apps.isEmpty {
                        Section(theme.title) {
                            ForEach(apps) { space in
                                Toggle(isOn: Binding(get: { lineup.showsCard(space) },
                                                     set: { on in withAnimation { lineup.setShowsCard(space, on) } })) {
                                    HStack(spacing: 12) {
                                        AppIconTile(space, size: 44)
                                        Text(space.title).font(.body.weight(.semibold))
                                    }
                                }
                            }
                            .onMove { from, to in
                                withAnimation { lineup.move(within: apps, fromOffsets: from, toOffset: to) }
                                movedPulse.toggle()
                            }
                        }
                    }
                }
                Section {
                    Button("Add or remove apps", systemImage: "square.grid.2x2") {
                        dismiss()
                        app.sidebarDestination = .settings
                    }
                } footer: {
                    Text("Drag to order Personal and the ☰ switcher. Explore and Your apps show what you opened most recently first.")
                }
            }
            .environment(\.editMode, .constant(.active))
            .sensoryFeedback(.selection, trigger: movedPulse)
            .navigationTitle("Edit Today")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

// MARK: - Card chrome

struct TodayCardBody<Extra: View>: View {
    let systemImage: String
    let tint: Color
    let title: String
    let headline: String
    var detail: String = ""
    @ViewBuilder var extra: Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                AppIconTile(systemImage: systemImage, tint: tint, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    SectionLabel(title)
                    Text(headline)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Theme.text)
                        .contentTransition(.numericText())
                    if !detail.isEmpty {
                        Text(detail)
                            .font(.footnote)
                            .foregroundStyle(Theme.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.textTertiary)
            }
            extra
        }
        .card(padding: 16)
        .contentShape(Rectangle())
    }
}

// MARK: - App grid

private struct AppGrid: View {
    let apps: [AppSpace]
    @Environment(AppModel.self) private var app
    /// Big enough to read each sheep's prop (sun, coins, map…) at a glance.
    private let iconSize: CGFloat = 88

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 20) {
            ForEach(apps) { space in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { app.open(space) }
                } label: {
                    tile(AppIconTile(space, size: iconSize), title: space.title)
                }
                .buttonStyle(.plain)
            }
            #if DEBUG
            if FutureAppsPreview.isOn {
                ForEach(FutureAppsPreview.apps, id: \.title) { future in
                    tile(AppIconTile(systemImage: future.systemImage, tint: future.tint, size: iconSize), title: future.title)
                }
            }
            #endif
            Button {
                app.sidebarDestination = .settings
            } label: {
                tile(Image(systemName: "plus")
                        .font(.title.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: iconSize, height: iconSize)
                        .background(Theme.track, in: RoundedRectangle(cornerRadius: iconSize * 0.26, style: .continuous)),
                     title: "Add")
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add apps in Settings")
        }
        .padding(.horizontal, 4)
    }

    private func tile(_ icon: some View, title: String) -> some View {
        VStack(spacing: 6) {
            icon
            Text(title).font(.subheadline.weight(.medium)).foregroundStyle(Theme.text).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }
}

#if DEBUG
/// `-futureApps` launch arg: mock Dates and Outfits apps, to see how Today
/// and the grid look as more apps are added. Not real features.
enum FutureAppsPreview {
    static var isOn: Bool { ProcessInfo.processInfo.arguments.contains("-futureApps") }

    static let apps: [(title: String, systemImage: String, tint: Color)] = [
        ("Dates", "heart.fill", Color(hex: "#ec4899")),
        ("Outfits", "tshirt.fill", Color(hex: "#8b5cf6")),
    ]

    @ViewBuilder static var cards: some View {
        TodayCardBody(systemImage: "heart.fill", tint: Color(hex: "#ec4899"), title: "Dates",
                      headline: "Friday, 7:30 PM", detail: "Dinner at Bavel · 3 ideas saved") { EmptyView() }
        TodayCardBody(systemImage: "tshirt.fill", tint: Color(hex: "#8b5cf6"), title: "Outfits",
                      headline: "64° and cloudy", detail: "Navy overshirt, last worn 12 days ago") { EmptyView() }
    }
}
#endif
