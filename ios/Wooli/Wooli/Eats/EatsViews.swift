import SwiftUI
import MapKit
import CloudKit

/// The score in a thin ring, Beli-style: the number carries the color
/// (green 7+, amber 4–6.9, red below), the ring stays quiet.
struct MealScoreBadge: View {
    let score: Double
    var size: CGFloat = 30

    var body: some View {
        Text(score.formatted(.number.precision(.fractionLength(1))))
            .font(.system(size: size * 0.36, weight: .semibold, design: .rounded)).monospacedDigit()
            .foregroundStyle(Self.ink(score))
            .frame(width: size, height: size)
            .background(Circle().fill(Theme.card))
            .overlay(Circle().strokeBorder(Color.primary.opacity(0.12), lineWidth: max(1, size * 0.035)))
            .accessibilityLabel("Score \(score.formatted(.number.precision(.fractionLength(1)))) out of 10")
    }

    /// Slightly deeper than the feeling colors so the number reads on white.
    static func ink(_ score: Double) -> Color {
        score >= 7 ? Color(hex: "#1f9d55") : score >= 4 ? Color(hex: "#e5a50a") : Color(hex: "#dc2626")
    }
}

/// A friend's initials in a colored circle.
struct FriendAvatar: View {
    let friend: EatsFriend
    var size: CGFloat = 36

    private static let colors = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6"]

    var body: some View {
        // A stable pick (String.hashValue changes every launch).
        let hex = Self.colors[friend.id.unicodeScalars.reduce(0) { $0 + Int($1.value) } % Self.colors.count]
        Text(friend.initials.isEmpty ? "?" : friend.initials)
            .font(.system(size: size * 0.4, weight: .bold, design: .rounded)).foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Color(hex: hex).gradient, in: Circle())
            .accessibilityLabel(friend.name)
    }
}

// MARK: - Ranking flow

/// Beli's flow: how it felt, then "which was better?" against places with
/// the same feeling — a binary search, so a list of 30 takes about five taps.
struct RankFlow: View {
    let candidate: RankCandidate
    /// Everything else on your list.
    let others: [RankCandidate]
    let onFinish: (MealSentiment, Double) -> Void
    /// Movies reuse this flow with their own icon and wording.
    var symbol = "fork.knife"
    var symbolColor: Color?
    var label: (MealSentiment) -> String = { $0.label }

    @Environment(\.dismiss) private var dismiss
    @State private var sentiment: MealSentiment?
    @State private var low = 0
    @State private var high = 0
    /// Places you said you don't remember; they're never asked about again.
    @State private var forgotten: Set<String> = []
    /// The peer being compared against now (index into `peers`).
    @State private var pivot: Int?
    @State private var result: Double?

    private var peers: [RankCandidate] { sentiment.map { EatsRanking.group(of: $0, in: others) } ?? [] }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                VStack(spacing: 4) {
                    Text(candidate.title).font(.title2.weight(.bold)).foregroundStyle(Theme.text)
                    if !candidate.subtitle.isEmpty {
                        Text(candidate.subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary)
                    }
                }
                .multilineTextAlignment(.center)
                .padding(.top, 8)
                if let sentiment, let result {
                    finished(sentiment, rank: result)
                } else if sentiment != nil, let pivot {
                    compare(against: peers[pivot])
                } else {
                    feelings
                }
                Spacer()
            }
            .padding(20)
            .animation(.snappy, value: low)
            .animation(.snappy, value: high)
            .animation(.snappy, value: forgotten)
            .animation(.snappy, value: result)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }

    private var feelings: some View {
        VStack(spacing: 16) {
            Text("How was it?").font(.headline).foregroundStyle(Theme.textSecondary)
            HStack(spacing: 18) {
                ForEach(MealSentiment.allCases) { feeling in
                    Button { pick(feeling) } label: {
                        VStack(spacing: 8) {
                            Image(systemName: feeling.symbol)
                                .font(.title2.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 64, height: 64)
                                .background(feeling.color.gradient, in: Circle())
                                .shadow(color: feeling.color.opacity(0.4), radius: 8, y: 4)
                            Text(label(feeling)).font(.caption.weight(.semibold)).foregroundStyle(Theme.text)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func compare(against other: RankCandidate) -> some View {
        VStack(spacing: 16) {
            Text("Which was better?").font(.headline).foregroundStyle(Theme.textSecondary)
            HStack(spacing: 12) {
                choice(candidate) { answer(newIsBetter: true) }
                Text("or").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                choice(other) { answer(newIsBetter: false) }
            }
            VStack(spacing: 10) {
                Button("Don't remember \(other.title) — skip") { forget(other) }
                    .font(.subheadline.weight(.medium))
                Button("Too tough — call it even") { settle(at: pivot ?? (low + high) / 2) }
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
            }
            .lineLimit(1)
        }
        .id("\(low)-\(high)-\(pivot ?? -1)")
        .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
    }

    private func choice(_ place: RankCandidate, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(.title3).foregroundStyle(symbolColor ?? Color(hex: TripItem.Kind.meal.colorHex))
                Text(place.title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center).lineLimit(3)
                if !place.subtitle.isEmpty {
                    Text(place.subtitle).font(.caption).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center).lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 130)
            .padding(12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.border))
            .shadow(color: .black.opacity(0.06), radius: 6, y: 3)
        }
        .buttonStyle(.plain)
        // Hold to see it again before choosing.
        .contextMenu {
            Button("Pick this one", systemImage: "checkmark", action: action)
        } preview: {
            preview(place)
        }
    }

    private func preview(_ place: RankCandidate) -> some View {
        let score = EatsRanking.scores(others)[place.id]
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(place.title).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                    if !place.subtitle.isEmpty {
                        Text(place.subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer(minLength: 8)
                if let score { MealScoreBadge(score: score, size: 46) }
            }
            if let sentiment = place.sentiment {
                Label(label(sentiment), systemImage: sentiment.symbol)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(sentiment.color)
            }
            if !place.detail.isEmpty {
                Text(place.detail).font(.subheadline).foregroundStyle(Theme.text).lineLimit(12)
            }
        }
        .padding(20)
        .frame(width: 320, alignment: .leading)
        .background(Theme.card)
    }

    private func finished(_ sentiment: MealSentiment, rank: Double) -> some View {
        var ranked = candidate
        ranked.sentiment = sentiment
        ranked.rank = rank
        let all = others + [ranked]
        let score = EatsRanking.scores(all)[ranked.id] ?? sentiment.band.upperBound
        let ordered = EatsRanking.ordered(all)
        let position = (ordered.firstIndex { $0.id == ranked.id } ?? 0) + 1
        return VStack(spacing: 14) {
            MealScoreBadge(score: score, size: 88)
            Text("#\(position) of \(ordered.count) on your list").font(.headline).foregroundStyle(Theme.text)
            Button {
                onFinish(sentiment, rank)
                dismiss()
            } label: {
                Text("Done").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .transition(.scale.combined(with: .opacity))
        .sensoryFeedback(.success, trigger: result)
    }

    private func pick(_ feeling: MealSentiment) {
        sentiment = feeling
        low = 0
        high = EatsRanking.group(of: feeling, in: others).count
        if high == 0 { settle(at: 0) } else { choosePivot() }
    }

    /// Who to compare against next: a random place from the middle half of
    /// what's left, so each ranking meets different places instead of the
    /// same exact-middle ones every time. Any place in the range keeps the
    /// search correct; staying near the middle keeps it to a few taps.
    /// Places you skipped are never picked.
    private func choosePivot() {
        guard low < high else {
            pivot = nil
            return
        }
        let open = (low..<high).filter { !forgotten.contains(peers[$0].id) }
        let quarter = (high - low) / 4
        let mid = (low + high) / 2
        pivot = open.filter { $0 >= low + quarter && $0 < high - quarter }.randomElement()
            ?? open.min { abs($0 - mid) < abs($1 - mid) }
    }

    private func answer(newIsBetter: Bool) {
        guard let pivot else { return }
        if newIsBetter { high = pivot } else { low = pivot + 1 }
        if low >= high { settle(at: low) } else { choosePivot() }
    }

    /// Skip a place you can't recall; once none are left to ask about, it
    /// lands in the middle of the range still open.
    private func forget(_ place: RankCandidate) {
        forgotten.insert(place.id)
        choosePivot()
        if pivot == nil { settle(at: (low + high) / 2) }
    }

    /// Slot the place in at `index` among its peers (0 = best).
    private func settle(at index: Int) {
        let peers = self.peers
        let above = index > 0 ? peers[index - 1].rank : nil
        let below = index < peers.count ? peers[index].rank : nil
        switch (above, below) {
        case (let a?, let b?): result = (a + b) / 2
        case (let a?, nil): result = a - 1
        case (nil, let b?): result = b + 1
        case (nil, nil): result = 0
        }
    }
}

// MARK: - Your list

/// Eats' main screen, and a trip's "What we ate" when `tripID` is set:
/// friends, trip meals waiting to be ranked, then your ranked places.
struct EatsListView: View {
    /// Show only this trip's places.
    var tripID: String? = nil

    @State private var book = EatsBook.shared
    @State private var skipped = EatsRanking.skippedIDs
    @State private var showMap = false
    @State private var adding = false
    @State private var pickedPlace: TripPlace?
    @State private var ranking: RankRequest?
    @State private var detail: EatsPlace?
    @State private var preparingShare = false
    @State private var showAllWaiting = false
    @State private var confirmSkipAll = false
    @State private var tab = Tab.been
    @State private var sort = Sort.score
    @State private var city: String?
    @State private var cuisine: String?
    @State private var searching = false
    @State private var query = ""

    enum Tab: String, CaseIterable, Identifiable {
        case been = "Been", wantToTry = "Want to Try"
        var id: String { rawValue }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case score = "Score", recent = "Recent", name = "A–Z"
        var id: String { rawValue }
    }

    enum RankRequest: Identifiable {
        case tripItem(TripItem)
        case place(TripPlace)

        var id: String {
            switch self {
            case .tripItem(let item): item.id
            case .place(let place): "\(place.latitude),\(place.longitude)"
            }
        }
    }

    var body: some View {
        let mine = book.mine.filter { tripID == nil || $0.tripID == tripID }
        let scores = EatsRanking.scores(book.mine.map(\.candidate))
        let ordered = EatsRanking.ordered(mine.map(\.candidate)).compactMap { c in mine.first { $0.id == c.id } }
        let waiting = EatsRanking.toRank(entries: book.mine).filter { !skipped.contains($0.id) && (tripID == nil || $0.tripID == tripID) }
        let pool = tab == .been ? ordered : book.wishlist
        let shown = sorted(filtered(pool))

        Group {
            if showMap {
                EatsMap(places: sorted(filtered(ordered)), scores: scores) { detail = $0 }
            } else {
                VStack(spacing: 0) {
                    header(pool)
                    list(shown, total: pool.count, waiting: waiting, scores: scores)
                }
            }
        }
        .overlay(alignment: .bottomTrailing) {
            Button { withAnimation(.snappy) { showMap.toggle() } } label: {
                Label(showMap ? "View List" : "View Map", systemImage: showMap ? "list.bullet" : "map")
                    .font(.headline).foregroundStyle(.white)
                    .padding(.horizontal, 20).padding(.vertical, 14)
                    .background(PlaceActionBar.ink, in: Capsule())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
            }
            .padding(20)
        }
        .navigationTitle(tripID == nil ? "Eats" : "What we ate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add a place", systemImage: "plus") { adding = true }
            }
        }
        .sheet(isPresented: $adding, onDismiss: {
            if let place = pickedPlace {
                pickedPlace = nil
                ranking = .place(place)
            }
        }) {
            NavigationStack {
                PlaceSearchView(near: tripID.flatMap { TripStore.shared.trip($0)?.destination } ?? "") { pickedPlace = $0 }
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false } } }
            }
        }
        .sheet(item: $ranking) { request in
            RankFlow(candidate: candidate(for: request), others: book.mine.map(\.candidate)) { sentiment, rank in
                record(request, sentiment: sentiment, rank: rank)
            }
        }
        .sheet(item: $detail) { place in
            EatsPlaceDetail(place: place)
        }
        .overlay {
            if preparingShare { ProgressView().controlSize(.large).padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)) }
        }
        .alert("Eats", isPresented: Binding(get: { book.lastError != nil }, set: { if !$0 { book.lastError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(book.lastError ?? "")
        }
    }

    // MARK: Header

    /// Beli's top: Been / Want to Try tabs, filter chips, then sort and search.
    private func header(_ pool: [EatsPlace]) -> some View {
        let cities = Set(pool.compactMap(\.city)).sorted()
        let cuisines = Set(pool.compactMap(\.cuisine)).sorted()
        return VStack(alignment: .leading, spacing: 14) {
            if tripID == nil {
                HStack(spacing: 28) {
                    ForEach(Tab.allCases) { t in
                        Button {
                            tab = t
                            city = nil
                            cuisine = nil
                        } label: {
                            VStack(spacing: 8) {
                                Text(t == .wantToTry && !book.wishlist.isEmpty ? "\(t.rawValue) · \(book.wishlist.count)" : t.rawValue)
                                    .font(.headline).foregroundStyle(tab == t ? Theme.text : Theme.textTertiary)
                                Rectangle().fill(tab == t ? Theme.text : .clear).frame(height: 3)
                            }
                            .fixedSize()
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { Divider() }
            }
            if cities.count > 1 || cuisines.count > 1 || city != nil || cuisine != nil {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        if city != nil || cuisine != nil {
                            Button("Clear", systemImage: "xmark") {
                                city = nil
                                cuisine = nil
                            }
                            .labelStyle(.iconOnly)
                            .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            .frame(width: 36, height: 36)
                            .overlay(Circle().strokeBorder(Theme.textTertiary, lineWidth: 1.2))
                        }
                        if cities.count > 1 || city != nil { chip("City", value: $city, options: cities) }
                        if cuisines.count > 1 || cuisine != nil { chip("Cuisine", value: $cuisine, options: cuisines) }
                    }
                    .padding(.vertical, 1)
                }
                .scrollClipDisabled()
            }
            HStack {
                Menu {
                    Picker("Sort", selection: $sort) {
                        ForEach(Sort.allCases) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Label(sort.rawValue, systemImage: "arrow.up.arrow.down")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(PlaceActionBar.ink)
                }
                Spacer()
                Button(searching ? "Done" : "Search", systemImage: "magnifyingglass") {
                    withAnimation(.snappy) {
                        searching.toggle()
                        if !searching { query = "" }
                    }
                }
                .labelStyle(.iconOnly).font(.title3).foregroundStyle(PlaceActionBar.ink)
            }
            if searching {
                TextField("Search your list", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(Theme.card)
    }

    /// An outlined pill that turns solid once a value is picked.
    private func chip(_ title: String, value: Binding<String?>, options: [String]) -> some View {
        Menu {
            Button("Any \(title.lowercased())") { value.wrappedValue = nil }
            ForEach(options, id: \.self) { option in
                Button(option) { value.wrappedValue = option }
            }
        } label: {
            HStack(spacing: 6) {
                Text(value.wrappedValue ?? title).lineLimit(1)
                Image(systemName: "chevron.down").font(.caption.weight(.bold))
            }
            .font(.subheadline.weight(.medium))
            .foregroundStyle(value.wrappedValue == nil ? Theme.text : .white)
            .padding(.horizontal, 14).frame(height: 36)
            .background(Capsule().fill(value.wrappedValue == nil ? Color.clear : PlaceActionBar.ink))
            .overlay(Capsule().strokeBorder(value.wrappedValue == nil ? Theme.textTertiary : PlaceActionBar.ink, lineWidth: 1.2))
        }
    }

    private func filtered(_ places: [EatsPlace]) -> [EatsPlace] {
        let text = query.trimmingCharacters(in: .whitespaces)
        return places.filter { place in
            (city == nil || place.city == city) && (cuisine == nil || place.cuisine == cuisine)
                && (text.isEmpty || place.name.localizedCaseInsensitiveContains(text) || place.address.localizedCaseInsensitiveContains(text)
                    || (place.cuisine?.localizedCaseInsensitiveContains(text) ?? false))
        }
    }

    /// Score keeps the list's own order (best first; wishes in the order saved).
    private func sorted(_ places: [EatsPlace]) -> [EatsPlace] {
        switch sort {
        case .score: places
        case .recent: places.sorted { ($0.visitedDay, $0.createdAt) > ($1.visitedDay, $1.createdAt) }
        case .name: places.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        }
    }

    // MARK: List

    private func list(_ shown: [EatsPlace], total: Int, waiting: [TripItem], scores: [String: Double]) -> some View {
        List {
            if tab == .been {
                if tripID == nil {
                    Section {
                        friendsStrip
                            .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
                    } header: {
                        Text("Friends")
                    } footer: {
                        if book.friends.isEmpty {
                            Text("Share your list with friends and ask them to share theirs back — you'll see each other's rankings.")
                        }
                    }
                }
                if !waiting.isEmpty { toRank(waiting) }
            }

            if total == 0 && (tab == .wantToTry || waiting.isEmpty) {
                emptyState
            } else if shown.isEmpty && total > 0 {
                ContentUnavailableView {
                    Label("No matches", systemImage: "line.3.horizontal.decrease.circle")
                } actions: {
                    Button("Clear filters") {
                        city = nil
                        cuisine = nil
                        query = ""
                    }
                }
            }

            Section {
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, place in
                    if tab == .been {
                        Button { detail = place } label: {
                            EatsPlaceRow(place: place, index: sort == .score ? index + 1 : nil, score: scores[place.id],
                                         subtitle: subtitle(place), friends: book.friendScores(for: place).map(\.friend))
                        }
                        .buttonStyle(.plain)
                    } else {
                        wishRow(place)
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
            .listSectionSeparator(.hidden, edges: .top)

            // Room to scroll the last row out from under View Map.
            Color.clear.frame(height: 72).listRowSeparator(.hidden)
        }
        .listStyle(.plain)
    }

    @ViewBuilder
    private var emptyState: some View {
        if tab == .wantToTry {
            ContentUnavailableView("Nothing saved yet", systemImage: "bookmark",
                                   description: Text("Share a place from Apple Maps or an Instagram reel to Wooli and pick Want to try."))
        } else {
            ContentUnavailableView {
                Label(tripID == nil ? "Start your list" : "Nothing ranked yet", systemImage: "fork.knife")
            } description: {
                Text(tripID == nil ? "Add places you've eaten and rank them against each other. Meals from your trips show up here too."
                                   : "Meals from this trip show up here once their day starts.")
            } actions: {
                Button("Add a place") { adding = true }.buttonStyle(.borderedProminent)
            }
        }
    }

    private func toRank(_ waiting: [TripItem]) -> some View {
        Section {
            ForEach(showAllWaiting ? waiting : Array(waiting.prefix(3))) { item in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.rankCandidate.title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                        Text(item.rankCandidate.subtitle).font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer(minLength: 8)
                    Button("Rank") { ranking = .tripItem(item) }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule).controlSize(.small)
                }
                .swipeActions {
                    Button("Skip") {
                        EatsRanking.skip([item.id])
                        skipped.insert(item.id)
                    }
                }
            }
            if waiting.count > 3 {
                Button(showAllWaiting ? "Show fewer" : "Show all \(waiting.count)") {
                    withAnimation(.snappy) { showAllWaiting.toggle() }
                }
                .font(.subheadline.weight(.medium))
            }
        } header: {
            HStack {
                Text("To rank · \(waiting.count)")
                Spacer()
                Button("Skip all") { confirmSkipAll = true }
                    .font(.footnote.weight(.semibold)).textCase(nil)
            }
        } footer: {
            Text("Restaurants from your trips. Swipe to skip one.")
        }
        .confirmationDialog("Skip all \(waiting.count)?", isPresented: $confirmSkipAll, titleVisibility: .visible) {
            Button("Skip all", role: .destructive) {
                EatsRanking.skip(waiting.map(\.id))
                skipped.formUnion(waiting.map(\.id))
            }
        } message: {
            Text("They won't show up to rank again. You can still add any place with +.")
        }
    }

    /// A saved place: same row as the list, with Been to rank it.
    private func wishRow(_ wish: EatsPlace) -> some View {
        HStack(alignment: .center, spacing: 8) {
            EatsPlaceRow(place: wish, index: nil, score: nil,
                         subtitle: "Saved \(wish.createdAt.formatted(.dateTime.month(.abbreviated).day().year()))")
            if let spot = wish.tripPlace {
                Button("Been") { ranking = .place(spot) }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(PlaceActionBar.ink)
            }
        }
        .contextMenu {
            if let url = wish.tripPlace?.mapsURL {
                Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
            }
            if let reel = URL(string: wish.notes), SharedPlaceHandoff.isInstagramPost(reel) {
                Link(destination: reel) { Label("Watch the reel", systemImage: "play.rectangle") }
            }
        }
        .swipeActions {
            Button("Remove", role: .destructive) { book.removeFromWishlist(wish) }
        }
    }

    private var friendsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                Button(action: shareMyList) {
                    VStack(spacing: 6) {
                        Image(systemName: book.isSharing ? "person.2.fill" : "person.crop.circle.badge.plus")
                            .font(.title3).foregroundStyle(Theme.brand)
                            .frame(width: 52, height: 52)
                            .background(Theme.brandSoft, in: Circle())
                        Text(book.isSharing ? "Sharing" : "Invite").font(.caption).foregroundStyle(Theme.text)
                    }
                }
                .buttonStyle(.plain)
                .disabled(preparingShare)

                ForEach(book.friends) { friend in
                    NavigationLink {
                        FriendListView(friendID: friend.id)
                    } label: {
                        VStack(spacing: 6) {
                            FriendAvatar(friend: friend, size: 52)
                            Text(friend.name.split(separator: " ").first.map(String.init) ?? friend.name)
                                .font(.caption).foregroundStyle(Theme.text).lineLimit(1)
                        }
                        .frame(width: 60)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func shareMyList() {
        guard TripStore.shared.iCloudAvailable else {
            book.lastError = "Sign in to iCloud in Settings to share your list with friends."
            return
        }
        preparingShare = true
        Task {
            defer { preparingShare = false }
            do {
                let share = try await book.share()
                TripSharingPresenter.present(share: share, container: TripStore.shared.container, title: "My Eats list",
                                             permissions: [.allowReadOnly, .allowPrivate]) {
                    EatsBook.shared.setSharing(false)
                }
            } catch {
                book.lastError = "Couldn't set up sharing: \(error.localizedDescription)"
            }
        }
    }

    private func subtitle(_ place: EatsPlace) -> String {
        let trip = tripID == nil && !place.tripID.isEmpty ? TripStore.shared.trip(place.tripID)?.name : nil
        let date = place.visitedDay.isEmpty ? nil : DayKey.date(place.visitedDay).formatted(.dateTime.month(.abbreviated).day().year())
        return [trip, date].compactMap { $0 }.joined(separator: " · ")
    }

    private func candidate(for request: RankRequest) -> RankCandidate {
        switch request {
        case .tripItem(let item): item.rankCandidate
        case .place(let place): RankCandidate(id: request.id, title: place.name, subtitle: place.address)
        }
    }

    private func record(_ request: RankRequest, sentiment: MealSentiment, rank: Double) {
        switch request {
        case .tripItem(let item):
            book.add(item, sentiment: sentiment, rank: rank)
        case .place(let tripPlace):
            var place = EatsPlace(name: tripPlace.name, place: tripPlace)
            place.tripID = tripID ?? ""
            place.sentiment = sentiment
            place.rank = rank
            book.save(place)
        }
    }
}

/// One place, laid out like Beli's lists: "1. Name", cuisine, where it
/// is, then a quiet line (date, trip); who else has been and the score on
/// the right.
struct EatsPlaceRow: View {
    let place: EatsPlace
    /// Position on the list; nil when the order isn't by score.
    let index: Int?
    let score: Double?
    let subtitle: String
    var friends: [EatsFriend] = []

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(index.map { "\($0). \(place.name)" } ?? place.name)
                    .font(.title3.weight(.bold)).foregroundStyle(Theme.text).lineLimit(2)
                if let cuisine = place.cuisine {
                    Text(cuisine).font(.subheadline).foregroundStyle(Theme.text).lineLimit(1)
                }
                if !place.address.isEmpty {
                    Label(place.address, systemImage: "fork.knife")
                        .labelStyle(.titleAndIcon).imageScale(.small)
                        .font(.subheadline).foregroundStyle(Theme.text).lineLimit(1)
                }
                if !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(Theme.textTertiary).lineLimit(1).padding(.top, 14)
                }
            }
            Spacer(minLength: 8)
            // Friends who've ranked it too.
            HStack(spacing: -8) {
                ForEach(friends.prefix(3)) { friend in
                    FriendAvatar(friend: friend, size: 22).overlay(Circle().stroke(Theme.card, lineWidth: 2))
                }
            }
            .padding(.top, 14)
            if let score { MealScoreBadge(score: score, size: 50) }
        }
        .padding(.vertical, 16)
        .contentShape(Rectangle())
    }
}

/// Places with a score pin each.
struct EatsMap: View {
    let places: [EatsPlace]
    let scores: [String: Double]
    var onSelect: ((EatsPlace) -> Void)? = nil
    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position) {
            ForEach(places.filter { $0.coordinate != nil }) { place in
                Annotation(place.name, coordinate: place.coordinate!) {
                    Button { onSelect?(place) } label: {
                        MealScoreBadge(score: scores[place.id] ?? 0, size: 34)
                            .background(Circle().fill(Theme.card))
                            .shadow(color: .black.opacity(0.2), radius: 3, y: 1)
                    }
                    .disabled(onSelect == nil)
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .overlay(alignment: .topTrailing) { RecenterButton(position: $position) }
        .overlay {
            if !places.contains(where: { $0.coordinate != nil }) {
                ContentUnavailableView("No places on the map yet", systemImage: "map",
                                       description: Text("Places picked from Apple Maps show up here with their score."))
            }
        }
    }
}

// MARK: - A friend's list

/// Someone else's ranked list, read-only, with your score where you've both been.
struct FriendListView: View {
    let friendID: String
    @State private var book = EatsBook.shared
    @State private var showMap = false
    @State private var confirmUnfollow = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let friend = book.friend(friendID) {
            let scores = friend.scores
            let ordered = EatsRanking.ordered(friend.places.map(\.candidate)).compactMap { c in friend.places.first { $0.id == c.id } }
            Group {
                if showMap {
                    EatsMap(places: ordered, scores: scores)
                } else {
                    List {
                        if ordered.isEmpty {
                            ContentUnavailableView("Nothing ranked yet", systemImage: "fork.knife",
                                                   description: Text("\(friend.name)'s places show up here as they rank them."))
                        }
                        ForEach(Array(ordered.enumerated()), id: \.element.id) { index, place in
                            HStack(spacing: 12) {
                                EatsPlaceRow(place: place, index: index + 1, score: scores[place.id], subtitle: subtitle(place))
                            }
                            .contextMenu {
                                if let url = place.tripPlace?.mapsURL {
                                    Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle(friend.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("View", selection: $showMap) {
                        Text("List").tag(false)
                        Text("Map").tag(true)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 160)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu("More", systemImage: "ellipsis") {
                        Button("Stop following", systemImage: "person.badge.minus", role: .destructive) { confirmUnfollow = true }
                    }
                }
            }
            .confirmationDialog("Stop following \(friend.name)?", isPresented: $confirmUnfollow, titleVisibility: .visible) {
                Button("Stop following", role: .destructive) {
                    dismiss()
                    book.unfollow(friend)
                }
            } message: {
                Text("You'll need a new invite from them to see their list again.")
            }
        } else {
            ContentUnavailableView("List not available", systemImage: "person.crop.circle.badge.questionmark",
                                   description: Text("They may have stopped sharing it."))
        }
    }

    /// Their date, plus your score if you've been too.
    private func subtitle(_ place: EatsPlace) -> String {
        let date = place.visitedDay.isEmpty ? nil : DayKey.date(place.visitedDay).formatted(.dateTime.month(.abbreviated).year())
        let yours = book.mine.first { $0.isSamePlace(as: place) }
            .flatMap { EatsRanking.scores(book.mine.map(\.candidate))[$0.id] }
            .map { "You: \($0.formatted(.number.precision(.fractionLength(1))))" }
        return [yours, date].compactMap { $0 }.joined(separator: " · ")
    }
}

// MARK: - A place

/// A place on your list, laid out like Beli: a map up top with the name,
/// your score and rank, quick actions from Apple's listing, scores, then
/// your own notes.
struct EatsPlaceDetail: View {
    @State private var place: EatsPlace
    /// The trip meal this was opened from, for its "Edit trip plan" row.
    let tripItem: TripItem?
    @State private var book = EatsBook.shared
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var editingPlan: TripItem?
    @State private var reranking = false
    @State private var closeAfterRank = false
    @State private var confirmDelete = false
    @State private var renaming = false
    @State private var mapItem: MKMapItem?
    @State private var showingListing = false
    @FocusState private var editingNotes: Bool

    init(place: EatsPlace, tripItem: TripItem? = nil) {
        _place = State(initialValue: place)
        self.tripItem = tripItem
    }

    var body: some View {
        let others = book.mine.filter { $0.id != place.id }.map(\.candidate)
        let all = others + [place.candidate]
        let ordered = EatsRanking.ordered(all)
        let score = EatsRanking.scores(all)[place.id] ?? 0
        let position = (ordered.firstIndex { $0.id == place.id } ?? 0) + 1
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    hero
                    VStack(alignment: .leading, spacing: 22) {
                        titleBlock(score: score)
                        actions
                        scores(score: score, position: position, count: ordered.count)
                        notesList
                        Button("Remove from Eats", role: .destructive) { confirmDelete = true }
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.top, 4)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.card)
            .ignoresSafeArea(edges: .top)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        book.save(place)
                        dismiss()
                    }
                    .disabled(place.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .task(id: place.tripPlace) {
                guard let spot = place.tripPlace else { return }
                mapItem = await PlaceMapCard.listing(for: spot)
            }
            .mapItemDetailSheet(isPresented: $showingListing, item: mapItem)
            .sheet(item: $editingPlan) { item in
                if let trip = TripStore.shared.trip(item.tripID) { TripItemEditor(item: item, trip: trip) }
            }
            // A new rank is saved right away and takes you back to the list.
            .sheet(isPresented: $reranking, onDismiss: { if closeAfterRank { dismiss() } }) {
                RankFlow(candidate: place.candidate, others: others) { sentiment, rank in
                    place.sentiment = sentiment
                    place.rank = rank
                    book.save(place)
                    closeAfterRank = true
                }
            }
            .alert("Rename", isPresented: $renaming) {
                TextField("Name", text: $place.name)
                Button("Done") {}
            }
            .confirmationDialog("Remove \(place.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    book.delete(place)
                    dismiss()
                }
            }
        }
    }

    // MARK: Parts

    private var hero: some View {
        PlaceHeroMap(coordinate: place.coordinate, name: place.name,
                     tint: MealScoreBadge.ink(EatsRanking.scores(book.mine.map(\.candidate))[place.id] ?? 7)) {
            if mapItem != nil { showingListing = true }
        }
    }

    private func titleBlock(score: Double) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(place.name)
                .font(.system(size: 34, weight: .heavy, design: .serif))
                .foregroundStyle(Theme.text)
                .lineLimit(3).minimumScaleFactor(0.7)
                .onLongPressGesture { renaming = true }
                .padding(.top, place.coordinate == nil ? 0 : -PlaceHeroMap.titleOverlap)
            HStack(spacing: 10) {
                Text(score.formatted(.number.precision(.fractionLength(1))))
                    .font(.headline.weight(.bold)).monospacedDigit().foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(MealScoreBadge.ink(score), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(place.sentiment.label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.textSecondary)
                Spacer()
                Button("Rank again") { reranking = true }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(.secondary)
            }
            if let tagline {
                Text(tagline).font(.headline).foregroundStyle(PlaceActionBar.ink)
            }
            if !place.address.isEmpty {
                Text(place.address).font(.subheadline).foregroundStyle(Theme.textSecondary).textSelection(.enabled)
            }
        }
    }

    private var actions: some View {
        PlaceActionBar(place: place.tripPlace, mapItem: mapItem) { showingListing = true }
    }

    private func scores(score: Double, position: Int, count: Int) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Scores").font(.title3.weight(.bold)).foregroundStyle(Theme.text)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 20) {
                    scoreTile(score: score, badge: "You", title: "Your rating", detail: "#\(position) of \(count) on your list")
                    let friends = book.friendScores(for: place)
                    if !friends.isEmpty {
                        let average = friends.map(\.score).reduce(0, +) / Double(friends.count)
                        scoreTile(score: (average * 10).rounded() / 10, badge: "\(friends.count)", title: "Friend score",
                                  detail: friends.prefix(2).map(\.friend.name).joined(separator: ", "))
                    }
                }
            }
            .scrollClipDisabled()
        }
    }

    private func scoreTile(score: Double, badge: String, title: String, detail: String) -> some View {
        HStack(spacing: 12) {
            MealScoreBadge(score: score, size: 58)
                .overlay(alignment: .bottomTrailing) {
                    Text(badge).font(.caption2.weight(.bold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(PlaceActionBar.ink, in: Capsule())
                        .offset(x: 6, y: 4)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.headline).foregroundStyle(Theme.text)
                Text(detail).font(.subheadline).foregroundStyle(Theme.textSecondary).lineLimit(2)
            }
        }
    }

    /// Your own details, as a list of rows like Beli's "Your notes and photos".
    private var notesList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your notes").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, 6)
            PlaceDetailRow(systemImage: "calendar") {
                DatePicker("Visit date", selection: Binding(get: { DayKey.date(place.visitedDay) },
                                                             set: { place.visitedDay = DayKey.key($0) }),
                           displayedComponents: .date)
            }
            if let item = tripItem, let trip = TripStore.shared.trip(item.tripID) {
                PlaceDetailRow(systemImage: "suitcase") {
                    Button { editingPlan = TripStore.shared.items.first { $0.id == item.id } ?? item } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Edit trip plan").foregroundStyle(Theme.text)
                                Text([trip.name, item.day.map { DayKey.date($0).formatted(.dateTime.month(.abbreviated).day()) }, item.timeText]
                                    .compactMap { $0 }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    .buttonStyle(.plain)
                }
            } else if let trip = TripStore.shared.trip(place.tripID) {
                PlaceDetailRow(systemImage: "suitcase") { LabeledContent("Trip", value: trip.name) }
            }
            PlaceDetailRow(systemImage: "square.and.pencil") {
                TextField("Add notes — what to order, who you went with", text: $place.notes, axis: .vertical)
                    .lineLimit(1...8).focused($editingNotes)
            }
            PlaceDetailRow(systemImage: "pencil.line") {
                Button { renaming = true } label: {
                    HStack {
                        Text("Rename").foregroundStyle(Theme.text)
                        Spacer()
                        Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                    }
                }
                .buttonStyle(.plain)
            }
            Text("Friends you share your list with can see your notes.")
                .font(.caption).foregroundStyle(Theme.textTertiary).padding(.top, 8)
        }
    }

    private var tagline: String? {
        place.notes.split(separator: "\n").first.map { $0.trimmingCharacters(in: .whitespaces) }.flatMap { $0.isEmpty ? nil : $0 }
    }
}
