import SwiftUI
import SwiftData

/// The hub: one glanceable card per app, then the app grid. Tapping a card
/// switches into that app. Cards follow the user's ranking (`AppLineup`).
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

                    // In the order the user ranked them.
                    ForEach(lineup.todayCards) { space in
                        Group {
                            switch space {
                            case .budget: BudgetTodayCard()
                            case .trips: TripsTodayCard()
                            case .eats: EatsTodayCard()
                            case .movies: MoviesTodayCard()
                            case .recipes: RecipesTodayCard()
                            case .period: PeriodTodayCard()
                            case .today: EmptyView()
                            }
                        }
                        .contextMenu {
                            Button("Hide from Today", systemImage: "eye.slash") {
                                withAnimation { lineup.setShowsCard(space, false) }
                            }
                            Button("Edit Today", systemImage: "slider.horizontal.3") { showEdit = true }
                        }
                    }
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
                    AppGrid(apps: lineup.installed)
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
                Section {
                    ForEach(lineup.installed) { space in
                        Toggle(isOn: Binding(get: { lineup.showsCard(space) },
                                             set: { on in withAnimation { lineup.setShowsCard(space, on) } })) {
                            HStack(spacing: 12) {
                                AppIconTile(space, size: 32)
                                Text(space.title).font(.body.weight(.semibold))
                            }
                        }
                    }
                    .onMove { from, to in
                        withAnimation { lineup.moveInstalled(fromOffsets: from, toOffset: to) }
                        movedPulse.toggle()
                    }
                } header: {
                    Text("Cards")
                } footer: {
                    Text("Drag to reorder — this also orders the app grid and the ☰ switcher. Hidden cards' apps stay in Your apps.")
                }
                Section {
                    Button("Add or remove apps", systemImage: "square.grid.2x2") {
                        dismiss()
                        app.sidebarDestination = .settings
                    }
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

/// Shared look for every Today card: app icon + name, a headline, a detail
/// line, optional extra content. The whole card opens the app.
struct TodayCard<Extra: View>: View {
    let space: AppSpace
    let headline: String
    var detail: String = ""
    @ViewBuilder var extra: Extra
    @Environment(AppModel.self) private var app

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { app.open(space) }
        } label: {
            TodayCardBody(systemImage: space.systemImage, tint: space.tint, title: space.title,
                          headline: headline, detail: detail) { extra }
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens \(space.title)")
    }
}

extension TodayCard where Extra == EmptyView {
    init(space: AppSpace, headline: String, detail: String = "") {
        self.init(space: space, headline: headline, detail: detail) { EmptyView() }
    }
}

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

// MARK: - Budget

private struct BudgetTodayCard: View {
    @Environment(AppModel.self) private var app
    @Query private var accounts: [LocalAccount]
    @Query private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]

    init() {
        // This month and the review window (from last month on), not years of history.
        let start = ReviewWindow.start
        _transactions = Query(filter: #Predicate<LocalTransaction> { $0.transactedAt >= start })
    }

    var body: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let month = DateInterval.month(containing: .now)
        let summary = MonthSummary(transactions: transactions, in: month,
                                   categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let planned = BudgetPlan(categories: categories, transactions: transactions, month: month, ledger: ledger).plannedExpenses
        let toReview = ledger.reviewQueue(transactions).count
        let left = planned - summary.spending

        let headline = planned > 0
            ? (left >= 0 ? "\(left.currency(cents: false)) left" : "\((-left).currency(cents: false)) over")
            : "\(summary.spending.currency(cents: false)) spent"
        let detail = planned > 0
            ? "\(summary.spending.currency(cents: false)) of \(planned.currency(cents: false)) this month"
            : "This month"

        TodayCard(space: .budget, headline: headline, detail: detail) {
            if planned > 0 {
                BarGauge(value: summary.spending, total: planned, tint: left >= 0 ? Theme.brand : Theme.expense)
            }
            if toReview > 0 {
                Label("\(toReview) transactions to review", systemImage: "tray.full")
                    .font(.footnote.weight(.medium))
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Theme.pendingSoft, in: Capsule())
                    .foregroundStyle(Theme.pending)
            }
        }
    }
}

// MARK: - Trips

private struct TripsTodayCard: View {
    @State private var store = TripStore.shared

    var body: some View {
        let today = DayKey.key(.now)
        let current = store.trips.first { $0.startDay <= today && $0.endDay >= today }
        let next = store.trips.filter { $0.startDay > today }.min { $0.startDay < $1.startDay }

        if let current {
            let day = (current.days.firstIndex(of: today) ?? 0) + 1
            TodayCard(space: .trips, headline: "Day \(day) of \(current.days.count)",
                      detail: [current.name, current.dateRangeText].filter { !$0.isEmpty }.joined(separator: " · "))
        } else if let next {
            let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now),
                                                       to: DayKey.date(next.startDay)).day ?? 0
            TodayCard(space: .trips, headline: days == 1 ? "\(next.name) tomorrow" : "\(next.name) in \(days) days",
                      detail: next.dateRangeText)
        } else {
            TodayCard(space: .trips, headline: "Plan a trip", detail: "Ideas, day plans on Apple Maps, and someone to plan with.")
        }
    }
}

// MARK: - Eats

private struct EatsTodayCard: View {
    @State private var book = EatsBook.shared

    var body: some View {
        let entries = book.mine
        let waiting = EatsRanking.toRank(entries: entries).count
        let best = EatsRanking.ordered(entries.map(\.candidate)).first
        if waiting > 0 {
            TodayCard(space: .eats, headline: "\(waiting) meal\(waiting == 1 ? "" : "s") to rank",
                      detail: "From your trips — a few taps each.")
        } else if let best {
            TodayCard(space: .eats, headline: "\(entries.count) place\(entries.count == 1 ? "" : "s") ranked", detail: "Top: \(best.title)")
        } else {
            TodayCard(space: .eats, headline: "Start your list", detail: "Rank places you've eaten against each other.")
        }
    }
}

// MARK: - Movies

private struct MoviesTodayCard: View {
    @Query private var movies: [MovieEntry]

    var body: some View {
        if let best = EatsRanking.ordered(movies.map(\.candidate)).first {
            TodayCard(space: .movies, headline: "\(movies.count) movie\(movies.count == 1 ? "" : "s") ranked", detail: "Top: \(best.title)")
        } else {
            TodayCard(space: .movies, headline: "Start your list", detail: "Rank movies you've seen against each other.")
        }
    }
}

// MARK: - Recipes

private struct RecipesTodayCard: View {
    @Query(sort: \RecipeEntry.createdAt, order: .reverse) private var recipes: [RecipeEntry]

    var body: some View {
        if let latest = recipes.first {
            TodayCard(space: .recipes, headline: "\(recipes.count) recipe\(recipes.count == 1 ? "" : "s") saved", detail: "Latest: \(latest.displayTitle)")
        } else {
            TodayCard(space: .recipes, headline: "Save your first recipe", detail: "Share a recipe reel from Instagram to Wooli.")
        }
    }
}

// MARK: - Period

private struct PeriodTodayCard: View {
    @Query(sort: \PeriodEntry.startDay, order: .reverse) private var periods: [PeriodEntry]
    @State private var lock = ModuleLock.shared

    var body: some View {
        if lock.isLocked(.period) {
            // Locked: no cycle details on Today either.
            TodayCard(space: .period, headline: "Locked", detail: "Open to unlock with Face ID.")
        } else {
            let status = PeriodStatus.text(periods)
            TodayCard(space: .period, headline: status.headline, detail: status.detail)
        }
    }
}

// MARK: - App grid

private struct AppGrid: View {
    let apps: [AppSpace]
    @Environment(AppModel.self) private var app

    var body: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 4), spacing: 16) {
            ForEach(apps) { space in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { app.open(space) }
                } label: {
                    tile(AppIconTile(space, size: 56), title: space.title)
                }
                .buttonStyle(.plain)
            }
            #if DEBUG
            if FutureAppsPreview.isOn {
                ForEach(FutureAppsPreview.apps, id: \.title) { future in
                    tile(AppIconTile(systemImage: future.systemImage, tint: future.tint, size: 56), title: future.title)
                }
            }
            #endif
            Button {
                app.sidebarDestination = .settings
            } label: {
                tile(Image(systemName: "plus")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Theme.textSecondary)
                        .frame(width: 56, height: 56)
                        .background(Theme.track, in: RoundedRectangle(cornerRadius: 56 * 0.26, style: .continuous)),
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
            Text(title).font(.caption).foregroundStyle(Theme.text).lineLimit(1)
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
