import SwiftUI
import SwiftData
import MapKit

/// What Today shows: one hero, what needs doing, then Personal as rings and
/// Explore as a row of real content. Apps with nothing to say stay in the grid.
struct TodayBoard: View {
    @Binding var showEdit: Bool
    @Environment(AppModel.self) private var app
    @State private var lineup = AppLineup.shared
    @State private var trips = TripStore.shared
    @State private var book = EatsBook.shared
    @State private var period = PeriodStore.shared
    @State private var reminderStore = ReminderStore.shared
    @State private var lock = ModuleLock.shared
    @Query private var accounts: [LocalAccount]
    @Query private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query(sort: \RecurringItem.nextDate) private var recurring: [RecurringItem]
    @Query(sort: \SightEntry.createdAt, order: .reverse) private var sights: [SightEntry]
    @Query private var movies: [MovieEntry]
    @Query(sort: \RecipeEntry.createdAt, order: .reverse) private var recipes: [RecipeEntry]

    init(showEdit: Binding<Bool>) {
        _showEdit = showEdit
        // This month and the review window (from last month on), not years of history.
        let start = ReviewWindow.start
        _transactions = Query(filter: #Predicate<LocalTransaction> { $0.transactedAt >= start })
    }

    var body: some View {
        let cards = lineup.todayCards
        let budget = cards.contains(.budget) ? budgetSummary : nil
        let trip = cards.contains(.trips) ? TodayTrip(trips: trips.trips) : nil
        // A trip takes over once it's close; a far-off one only leads with no Budget to show.
        let heroTrip = trip.flatMap { $0.isClose || budget == nil ? $0 : nil }

        VStack(alignment: .leading, spacing: Space.l) {
            if let heroTrip {
                tripHero(heroTrip)
            } else if let budget {
                budgetHero(budget)
            }

            let items = todos(budget: budget, showsEats: cards.contains(.eats), showsReminders: cards.contains(.reminders))
            if !items.isEmpty { todoCard(items) }

            let rings = personalTiles(cards: cards, budget: heroTrip == nil ? nil : budget)
            if !rings.isEmpty {
                SectionLabel(AppTheme.personal.title).padding(.horizontal, Space.xs)
                HStack(alignment: .top, spacing: Space.m) {
                    ForEach(rings) { $0 }
                }
                .fixedSize(horizontal: false, vertical: true)
            }

            let tiles = exploreTiles(cards: cards, heroTrip: heroTrip)
            if !tiles.isEmpty {
                SectionLabel(AppTheme.explore.title).padding(.horizontal, Space.xs)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: Space.m) {
                        ForEach(tiles) { $0 }
                    }
                }
                .scrollClipDisabled()
            }
        }
        .task(id: cards.contains(.period)) {
            if cards.contains(.period) { await period.refresh(sample: app.mode == .sample) }
        }
        .task(id: cards.contains(.reminders)) {
            if cards.contains(.reminders) { await reminderStore.refresh(sample: app.mode == .sample) }
        }
    }

    // MARK: Hero

    private func tripHero(_ trip: TodayTrip) -> some View {
        Button { open(.trips) } label: {
            TicketCard(eyebrow: trip.isUnderway ? "On your trip" : "Next trip", meta: trip.trip.dateRangeText,
                       rows: trip.route.map { [TicketRowData(symbol: "mappin.and.ellipse", title: $0)] } ?? []) {
                Text(trip.status).wooliFont(.amount)
                Text(trip.trip.name).font(.headline)
            }
        }
        .buttonStyle(.plain)
        .contextMenu { hideMenu(.trips) }
    }

    private func budgetHero(_ budget: TodayBudget) -> some View {
        Button { open(.budget) } label: {
            HeroCard(eyebrow: "This month") {
                Text(budget.headline).wooliFont(.amount)
                Text(budget.detail).font(.footnote)
                if budget.planned > 0 {
                    RouteProgress(progress: budget.fraction, startLabel: "$0",
                                  middleLabel: "\(budget.spent.currency(cents: false)) spent",
                                  endLabel: budget.planned.currency(cents: false))
                }
            }
        }
        .buttonStyle(.plain)
        .contextMenu { hideMenu(.budget) }
    }

    // MARK: To do

    private struct Todo: Identifiable {
        let id: String
        let space: AppSpace
        let title: String
        var subtitle: String?
        var amount: Double?
        let action: () -> Void
    }

    /// Only what's waiting on you; the card goes away when there's nothing.
    private func todos(budget: TodayBudget?, showsEats: Bool, showsReminders: Bool) -> [Todo] {
        var items: [Todo] = []
        if let budget, budget.toReview > 0 {
            items.append(Todo(id: "review", space: .budget,
                              title: "Review \(budget.toReview) transaction\(budget.toReview == 1 ? "" : "s")") {
                app.open(.budget)
                app.showReview = true
            })
        }
        if budget != nil {
            let today = Calendar.current.startOfDay(for: .now)
            let soon = Calendar.current.date(byAdding: .day, value: Self.billDays, to: today)!
            for bill in recurring.filter({ $0.isActive && $0.amount < 0 && $0.nextDate >= today && $0.nextDate < soon }).prefix(2) {
                items.append(Todo(id: bill.id, space: .budget, title: bill.title, subtitle: dueText(bill.nextDate),
                                  amount: -bill.amount) { open(.budget) })
            }
        }
        if showsEats {
            let waiting = EatsRanking.toRank(entries: book.mine).count
            if waiting > 0 {
                items.append(Todo(id: "rank", space: .eats, title: "Rank \(waiting) meal\(waiting == 1 ? "" : "s")",
                                  subtitle: "From your trips") { open(.eats) })
            }
        }
        if showsReminders, reminderStore.access == .connected {
            let due = ReminderBuckets.dueNow(reminderStore.reminders)
            if !due.isEmpty {
                let overdue = due.filter { ReminderBuckets.bucket($0) == .overdue }.count
                items.append(Todo(id: "reminders", space: .reminders,
                                  title: "\(due.count) reminder\(due.count == 1 ? "" : "s") due",
                                  subtitle: overdue > 0 ? "\(overdue) overdue" : due.first?.title) { open(.reminders) })
            }
        }
        return items
    }

    /// How far ahead a bill counts as something to deal with.
    private static let billDays = 4

    private func dueText(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return "Due today" }
        if cal.isDateInTomorrow(date) { return "Due tomorrow" }
        return "Due \(date.formatted(.dateTime.weekday(.wide)))"
    }

    private func todoCard(_ items: [Todo]) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                if index > 0 { ItemRowDivider() }
                Button(action: item.action) {
                    ItemRow(title: item.title, subtitle: item.subtitle.map { Text($0) }) {
                        AppIconTile(item.space, size: 40)
                    } trailing: {
                        if let amount = item.amount {
                            ItemRowAmount(text: amount.currency(cents: false))
                        } else {
                            Image(systemName: "chevron.right")
                                .font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, Space.xs)
        .card(padding: Space.m)
    }

    // MARK: Personal

    private func personalTiles(cards: [AppSpace], budget: TodayBudget?) -> [AnyTile] {
        cards.filter { $0.theme == .personal }.compactMap { space in
            switch space {
            case .budget:
                guard let budget else { return nil }
                return tile(space) {
                    RingTile(space: space, value: budget.fraction, title: budget.headline, detail: budget.detail) {
                        Text(budget.planned > 0 ? "\(Int((budget.fraction * 100).rounded()))%" : "—")
                    }
                }
            case .period: return tile(space) { healthTile }
            default: return nil
            }
        }
    }

    @ViewBuilder private var healthTile: some View {
        if lock.isLocked(.period) {
            // Locked: no cycle details on Today either.
            RingTile(space: .period, value: 0, title: "Locked", detail: "Open to unlock with \(ThisDevice.biometry).") {
                Image(systemName: "lock.fill")
            }
        } else if period.access != .connected {
            RingTile(space: .period, value: 0, title: "Connect Apple Health", detail: "See your cycle and predictions here.") {
                Image(systemName: "heart.fill")
            }
        } else {
            let status = PeriodStatus.text(period.periods)
            let cycle = cycleRing
            RingTile(space: .period, value: cycle.value, title: status.headline, detail: status.detail) {
                if let day = cycle.day { Text("\(day)") } else { Image(systemName: "heart.fill") }
            }
        }
    }

    /// How far through the period, or the cycle, today is.
    private var cycleRing: (value: Double, day: Int?) {
        let list = period.periods.map(\.cycleEntry)
        if let current = period.periods.first, current.isCurrent() {
            let day = CycleMath.days(from: current.start, to: .now) + 1
            return (Double(day) / Double(max(CycleMath.averagePeriodLength(list), day)), day)
        }
        guard let day = CycleMath.cycleDay(list, today: .now) else { return (0, nil) }
        return (Double(day) / Double(max(CycleMath.averageCycleLength(list), 1)), day)
    }

    // MARK: Explore

    private func exploreTiles(cards: [AppSpace], heroTrip: TodayTrip?) -> [AnyTile] {
        lineup.recentFirst(cards.filter { $0.theme == .explore }).compactMap { space in
            switch space {
            case .trips:
                guard heroTrip == nil, let trip = TodayTrip(trips: trips.trips) else { return nil }
                return tile(space) { ExploreTile(space: space, title: trip.trip.name, detail: trip.status) { TintTileArt(space: space) } }
            case .eats:
                let ranked = EatsRanking.ordered(book.mine.map(\.candidate))
                guard let best = ranked.first, let place = book.mine.first(where: { $0.id == best.id }) else { return nil }
                let coordinate = place.latitude.flatMap { lat in place.longitude.map { CLLocationCoordinate2D(latitude: lat, longitude: $0) } }
                return tile(space) { ExploreTile(space: space, title: place.name, detail: "Your #1 place") { MapTileArt(space: space, coordinate: coordinate) } }
            case .sights:
                guard let next = sights.first(where: { !$0.isVisited }) else { return nil }
                let coordinate = next.latitude.flatMap { lat in next.longitude.map { CLLocationCoordinate2D(latitude: lat, longitude: $0) } }
                return tile(space) { ExploreTile(space: space, title: next.name, detail: "Next to see") { MapTileArt(space: space, coordinate: coordinate) } }
            case .movies:
                let seen = movies.filter { !$0.isWishlist }
                guard let best = EatsRanking.ordered(seen.map(\.candidate)).first,
                      let movie = seen.first(where: { $0.id == best.id }) else { return nil }
                return tile(space) { ExploreTile(space: space, title: movie.title, detail: "Your #1 movie") { PosterTileArt(space: space, url: movie.posterURL) } }
            case .recipes:
                guard let latest = recipes.first else { return nil }
                return tile(space) {
                    ExploreTile(space: space, title: latest.displayTitle,
                                detail: latest.tagLine.isEmpty ? "Latest recipe" : latest.tagLine) { TintTileArt(space: space) }
                }
            default: return nil
            }
        }
    }

    // MARK: Helpers

    private var budgetSummary: TodayBudget {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let month = DateInterval.month(containing: .now)
        let summary = MonthSummary(transactions: transactions, in: month,
                                   categories: ledger.categoriesById, hiddenAccounts: ledger.hiddenAccounts)
        let planned = BudgetPlan(categories: categories, transactions: transactions, month: month, ledger: ledger).plannedExpenses
        return TodayBudget(spent: summary.spending, planned: planned, toReview: ledger.reviewQueue(transactions).count)
    }

    private func open(_ space: AppSpace) {
        withAnimation(.easeInOut(duration: 0.2)) { app.open(space) }
    }

    private func tile<Content: View>(_ space: AppSpace, @ViewBuilder _ content: () -> Content) -> AnyTile {
        AnyTile(space: space, content: AnyView(
            Button { open(space) } label: { content() }
                .buttonStyle(.plain)
                .contextMenu { hideMenu(space) }
        ))
    }

    @ViewBuilder private func hideMenu(_ space: AppSpace) -> some View {
        Button("Hide from Today", systemImage: "eye.slash") {
            withAnimation { lineup.setShowsCard(space, false) }
        }
        Button("Edit Today", systemImage: "slider.horizontal.3") { showEdit = true }
    }
}

private struct AnyTile: View, Identifiable {
    let space: AppSpace
    let content: AnyView
    var id: AppSpace { space }
    var body: some View { content }
}

// MARK: - Summaries

private struct TodayBudget {
    let spent: Double
    let planned: Double
    let toReview: Int

    var left: Double { planned - spent }
    var fraction: Double { planned > 0 ? min(spent / planned, 1) : 0 }

    var headline: String {
        guard planned > 0 else { return "\(spent.currency(cents: false)) spent" }
        return left >= 0 ? "\(left.currency(cents: false)) left" : "\((-left).currency(cents: false)) over"
    }

    var detail: String {
        let cal = Calendar.current
        let lastDay = cal.dateInterval(of: .month, for: .now).map { cal.date(byAdding: .day, value: -1, to: $0.end)! } ?? .now
        let days = CycleMath.days(from: .now, to: lastDay)
        return days == 0 ? "Last day of the month" : "\(days) day\(days == 1 ? "" : "s") left this month"
    }
}

/// The trip under way, or else the next one.
private struct TodayTrip {
    let trip: Trip
    let isUnderway: Bool
    let daysAway: Int

    /// How close a trip gets before it takes over from the budget.
    private static let closeDays = 14

    init?(trips: [Trip]) {
        let today = DayKey.key(.now)
        if let current = trips.first(where: { $0.startDay <= today && $0.endDay >= today }) {
            trip = current
            isUnderway = true
            daysAway = 0
        } else if let next = trips.filter({ $0.startDay > today }).min(by: { $0.startDay < $1.startDay }) {
            trip = next
            isUnderway = false
            daysAway = CycleMath.days(from: .now, to: DayKey.date(next.startDay))
        } else {
            return nil
        }
    }

    var isClose: Bool { isUnderway || daysAway <= Self.closeDays }

    var status: String {
        if isUnderway {
            return "Day \((trip.days.firstIndex(of: DayKey.key(.now)) ?? 0) + 1) of \(trip.days.count)"
        }
        return daysAway == 1 ? "Tomorrow" : "In \(daysAway) days"
    }

    /// "Tokyo → Kyoto → Osaka"
    var route: String? {
        let cities = trip.legs.filter { !$0.isHome }.map(\.name).filter { !$0.isEmpty }
        return cities.isEmpty ? nil : cities.joined(separator: " → ")
    }
}

// MARK: - Tiles

/// Half-width Personal tile: a ring with one figure in it, then the words.
private struct RingTile<Center: View>: View {
    let space: AppSpace
    let value: Double
    let title: String
    let detail: String
    @ViewBuilder var center: Center

    private let ring: CGFloat = 64

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            ZStack {
                Circle().stroke(space.tint.opacity(0.18), lineWidth: Space.s)
                Circle().trim(from: 0, to: min(max(value, 0), 1))
                    .stroke(space.tint, style: StrokeStyle(lineWidth: Space.s, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                center.font(.subheadline.weight(.bold)).monospacedDigit().foregroundStyle(Theme.text)
            }
            .frame(width: ring, height: ring)
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(title).font(.headline).foregroundStyle(Theme.text)
                    .lineLimit(2).minimumScaleFactor(0.8)
                if !detail.isEmpty {
                    Text(detail).font(.footnote).foregroundStyle(Theme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .card(padding: Space.l)
        .contentShape(Rectangle())
    }
}

/// Explore tile: real content on top, what it is below.
private struct ExploreTile<Art: View>: View {
    let space: AppSpace
    let title: String
    let detail: String
    @ViewBuilder var art: Art

    private let width: CGFloat = 156
    private let artHeight: CGFloat = 128

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            art.frame(width: width, height: artHeight).clipped()
            VStack(alignment: .leading, spacing: Space.xs) {
                SectionLabel(space.title)
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text(detail).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            .padding(Space.m)
            .frame(width: width, alignment: .leading)
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .card(padding: 0)
        .contentShape(Rectangle())
    }
}

/// The app's illustration, for content with no picture of its own.
private struct TintTileArt: View {
    let space: AppSpace

    var body: some View {
        ZStack {
            Rectangle().fill(space.tint)
            if let asset = space.iconAsset { Image(asset).resizable().scaledToFill() }
        }
        .accessibilityHidden(true)
    }
}

private struct PosterTileArt: View {
    let space: AppSpace
    let url: String

    var body: some View {
        AsyncImage(url: URL(string: url)) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            TintTileArt(space: space)
        }
        .accessibilityHidden(true)
    }
}

/// A still map of one place; taps go to the tile.
private struct MapTileArt: View {
    let space: AppSpace
    let coordinate: CLLocationCoordinate2D?

    var body: some View {
        if let coordinate {
            Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 1_500, longitudinalMeters: 1_500)),
                interactionModes: []) {
                Marker("", coordinate: coordinate).tint(space.tint)
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        } else {
            TintTileArt(space: space)
        }
    }
}
