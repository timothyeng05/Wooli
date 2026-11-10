import SwiftUI
import MapKit
import CloudKit

/// A place's mark on a list: a passport stamp with its rank and tier (Loved / Fine / Skip).
/// The tier comes from the score's band; without a `rank` it is your own list's position for
/// that score, and a friend's place passes `nil` to print the tier word alone.
struct MealScoreBadge: View {
    let score: Double
    var size: CGFloat = 30
    var rank: Int?
    /// Pass `false` for a place that isn't on your list (a friend's pick).
    var usesOwnRank = true
    var place: String?
    var total: Int?
    var scale: RankScale = .eats

    var body: some View {
        RankStamp(rank: rank ?? (usesOwnRank ? Self.ownRank(of: score) : nil), tier: .init(score: score, scale: scale),
                  place: place, total: total, size: .custom(size), score: score)
    }

    /// Position of `score` on your own list (ties share a position).
    @MainActor static func ownRank(of score: Double) -> Int {
        EatsBook.shared.scores.values.filter { $0 > score + 0.0001 }.count + 1
    }

    static func ink(_ score: Double) -> Color { RankStamp.Tier(score: score).ink }
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

/// A stub gets a blue ring while it's being tapped.
private struct StubChoiceStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.overlay(
            RoundedRectangle(cornerRadius: Radius.hero, style: .continuous)
                .strokeBorder(Theme.brand, lineWidth: configuration.isPressed ? 3 : 0)
        )
    }
}

/// A small map with one pin, far enough out to see the neighbourhood: where a
/// place you're comparing against is.
struct PlacePinMap: View {
    let name: String
    let coordinate: CLLocationCoordinate2D

    var body: some View {
        Map(initialPosition: .camera(MapCamera(centerCoordinate: coordinate, distance: 9000)), interactionModes: []) {
            Marker(name, systemImage: "fork.knife", coordinate: coordinate).tint(Theme.brand)
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .frame(height: 170)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .accessibilityLabel("Map showing where \(name) is")
    }
}

private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        Path { $0.move(to: CGPoint(x: 0, y: rect.midY)); $0.addLine(to: CGPoint(x: rect.maxX, y: rect.midY)) }
    }
}

// MARK: - Ranking flow

/// How it felt, then "which was better?" against places in the same third
/// of the scale: a binary search, so a list of 30 takes about five taps.
/// Each place you're asked about shows its score now; hold it to see it on a map.
struct RankFlow: View {
    let candidate: RankCandidate
    /// Everything else on your list.
    let others: [RankCandidate]
    let onFinish: (MealSentiment, Double) -> Void
    /// Movies reuse this flow with their own icon, wording and scale.
    var symbol = "fork.knife"
    var symbolColor: Color?
    var label: (MealSentiment) -> String = { $0.label }
    var scale: RankScale = .eats

    @Environment(\.dismiss) private var dismiss
    @State private var sentiment: MealSentiment?
    @State private var low = 0
    @State private var high = 0
    /// Places you said you don't remember; they're never asked about again.
    @State private var forgotten: Set<String> = []
    /// The peer being compared against now (index into `peers`).
    @State private var pivot: Int?
    @State private var result: Double?
    /// The feeling it's saved under: liked, or must-try when it lands among
    /// older must-trys (they share liked's band).
    @State private var resultSentiment: MealSentiment?

    /// Places in the same band, best first.
    private var peers: [RankCandidate] {
        sentiment.map { scale.bucket($0).flatMap { EatsRanking.group(of: $0, in: others) } } ?? []
    }
    private var scores: [String: Double] { EatsRanking.scores(others, scale: scale) }

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
                if let result, let saved = resultSentiment ?? sentiment {
                    finished(saved, rank: result)
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
                ForEach(scale.feelings) { feeling in
                    Button { pick(feeling) } label: {
                        VStack(spacing: 8) {
                            Image(systemName: feeling.symbol)
                                .font(.title2.weight(.bold)).foregroundStyle(Theme.onBrand)
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
            Text(stepText).wooliFont(.eyebrow).foregroundStyle(Theme.textTertiary)
            HStack(spacing: 12) {
                choice(candidate, score: nil) { answer(newIsBetter: true) }
                Text("or").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                choice(other, score: scores[other.id]) { answer(newIsBetter: false) }
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

    /// "Step 2 of about 5": how many comparisons a list this size takes, and where this one falls.
    private var stepText: String {
        let total = max(Int(ceil(log2(Double(peers.count + 1)))), 1)
        let left = max(Int(ceil(log2(Double(high - low + 1)))), 1)
        return "Step \(min(max(total - left + 1, 1), total)) of about \(total)"
    }

    /// One stub to pick. A place already on your list shows its score now,
    /// so you know what you're measuring against.
    private func choice(_ place: RankCandidate, score: Double?, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                if let score {
                    (Text(score, format: .number.precision(.fractionLength(1)))
                        .font(.title3.weight(.heavy)).foregroundStyle(EatsRanking.color(score, scale: scale))
                     + Text(" / 10").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary))
                        .monospacedDigit()
                        .accessibilityLabel("Scored \(score.formatted(.number.precision(.fractionLength(1)))) out of 10")
                } else {
                    Image(systemName: symbol).font(.title3).foregroundStyle(symbolColor ?? Color(hex: TripItem.Kind.meal.colorHex))
                }
                Text(place.title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.text)
                    .multilineTextAlignment(.center).lineLimit(3)
                if !place.subtitle.isEmpty {
                    // The stub's perforation.
                    Rectangle().fill(.clear).frame(height: 1)
                        .overlay(Line().stroke(Theme.border, style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])))
                    Text(place.subtitle).font(.caption).foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center).lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 130)
            .padding(Space.m)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).strokeBorder(Theme.border))
            .shadow(color: Theme.cardShadow, radius: 6, y: 3)
        }
        .buttonStyle(StubChoiceStyle())
        // Hold to see it again before choosing.
        .contextMenu {
            Button("Pick this one", systemImage: "checkmark", action: action)
        } preview: {
            preview(place)
        }
    }

    private func preview(_ place: RankCandidate) -> some View {
        let score = scores[place.id]
        let position = (EatsRanking.ordered(others).firstIndex { $0.id == place.id } ?? 0) + 1
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(place.title).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
                    if !place.subtitle.isEmpty {
                        Text(place.subtitle).font(.subheadline).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer(minLength: 8)
                if let score { MealScoreBadge(score: score, size: 46, rank: position, scale: scale) }
            }
            if scale == .eats, let score {
                Text(EatsVerdict.label(for: score))
                    .font(.subheadline.weight(.semibold)).foregroundStyle(EatsRanking.color(score))
            } else if let sentiment = place.sentiment {
                Label(label(sentiment), systemImage: sentiment.symbol)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(sentiment.color)
            }
            if let latitude = place.latitude, let longitude = place.longitude {
                PlacePinMap(name: place.title, coordinate: .init(latitude: latitude, longitude: longitude))
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
        let score = EatsRanking.scores(all, scale: scale)[ranked.id] ?? scale.band(sentiment).upperBound
        let ordered = EatsRanking.ordered(all)
        let position = (ordered.firstIndex { $0.id == ranked.id } ?? 0) + 1
        return VStack(spacing: 14) {
            MealScoreBadge(score: score, size: 88, rank: position, total: ordered.count, scale: scale)
            if scale == .eats {
                Text(EatsVerdict.label(for: score)).font(.title3.weight(.bold)).foregroundStyle(Theme.text)
            }
            Text("#\(position) of \(ordered.count) on your list").font(.headline).foregroundStyle(scale == .eats ? Theme.textSecondary : Theme.text)
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
        high = peers.count
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

    /// Slot the place in at `index` among its peers (0 = best). Ranks only
    /// order places with the same stored feeling, so it takes the feeling of
    /// the place just below it (or above, at the bottom) and sits between
    /// its neighbours with that feeling.
    private func settle(at index: Int) {
        let peers = self.peers
        let abovePeer = index > 0 ? peers[index - 1] : nil
        let belowPeer = index < peers.count ? peers[index] : nil
        let saved = belowPeer?.sentiment ?? abovePeer?.sentiment ?? sentiment
        resultSentiment = saved
        let above = abovePeer?.sentiment == saved ? abovePeer?.rank : nil
        let below = belowPeer?.sentiment == saved ? belowPeer?.rank : nil
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
    @State private var partnerOptions = false
    @State private var tab = Tab.been
    @State private var sort = Sort.score
    @State private var city: String?
    @State private var cuisine: String?
    @State private var searching = false
    @State private var query = ""
    @State private var near: Near?
    @State private var choosingNear = false
    @State private var locating = false
    @State private var wishDetail: EatsPlace?

    /// Show places within 50 miles of here (you, or a city you're going to).
    struct Near: Equatable {
        var name: String
        var latitude: Double
        var longitude: Double
        var location: CLLocation { CLLocation(latitude: latitude, longitude: longitude) }
    }

    static let nearRadius: CLLocationDistance = 50 * 1609.344

    enum Tab: String, CaseIterable, Identifiable {
        case been = "Been", wantToTry = "Want to Try"
        var id: String { rawValue }
    }

    enum Sort: String, CaseIterable, Identifiable {
        case score = "Score", recent = "Recent", name = "A–Z", distance = "Nearest"
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
        let scores = book.scores
        let byID = Dictionary(mine.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let ordered = EatsRanking.ordered(mine.map(\.candidate)).compactMap { byID[$0.id] }
        let waiting = EatsRanking.toRank(entries: book.mine).filter { !skipped.contains($0.id) && (tripID == nil || $0.tripID == tripID) }
        let pool = tab == .been ? ordered : book.wishlist
        let shown = sorted(filtered(pool))

        let browser = Group {
            if showMap {
                EatsMap(places: sorted(filtered(ordered)), scores: scores) { select($0) }
            } else {
                VStack(spacing: 0) {
                    header(pool)
                    list(shown, total: pool.count, waiting: waiting, scores: scores)
                }
            }
        }

        Group {
        #if os(macOS)
        // Mac: the list beside the open place, like Mail or Notes.
        HSplitView {
            browser.frame(minWidth: 360, idealWidth: 420, maxWidth: 560, maxHeight: .infinity)
            macDetail.frame(minWidth: 420, maxWidth: .infinity, maxHeight: .infinity)
        }
        .searchable(text: $query, placement: .toolbar, prompt: "Search your list")
        .onChange(of: tab) {
            city = nil
            cuisine = nil
            detail = nil
            wishDetail = nil
        }
        .toolbar {
            if tripID == nil {
                ToolbarItem(placement: .principal) {
                    Picker("List", selection: $tab) {
                        ForEach(Tab.allCases) { t in
                            Text(t == .wantToTry && !book.wishlist.isEmpty ? "\(t.rawValue) · \(book.wishlist.count)" : t.rawValue).tag(t)
                        }
                    }
                    .pickerStyle(.segmented)
                }
            }
            ToolbarItem {
                Picker("Show", selection: $showMap) {
                    Label("List", systemImage: "list.bullet").tag(false)
                    Label("Map", systemImage: "map").tag(true)
                }
                .pickerStyle(.segmented)
                .help("Show as a list or on a map")
            }
        }
        #else
        browser
        .overlay(alignment: .bottomTrailing) {
            Button { withAnimation(.snappy) { showMap.toggle() } } label: {
                Label(showMap ? "View List" : "View Map", systemImage: showMap ? "list.bullet" : "map")
                    .font(.headline).foregroundStyle(Theme.onBrand)
                    .padding(.horizontal, 20).padding(.vertical, 14)
                    .background(PlaceActionBar.ink, in: Capsule())
                    .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
            }
            .padding(20)
        }
        #endif
        }
        .navigationTitle(tripID != nil ? "What we ate" : book.partner == nil ? "Eats" : "Our Eats")
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
        .sheet(item: phoneSheet($detail)) { place in
            EatsPlaceDetail(place: place)
        }
        // "I've been" on a wish ranks it once its page has closed.
        .sheet(item: phoneSheet($wishDetail), onDismiss: {
            if let place = pickedPlace {
                pickedPlace = nil
                ranking = .place(place)
            }
        }) { wish in
            EatsWishDetail(place: wish) { pickedPlace = $0 }
        }
        .sheet(isPresented: $choosingNear) {
            NavigationStack {
                PlaceSearchView(near: "") { setNear(Near(name: $0.name, latitude: $0.latitude, longitude: $0.longitude)) }
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { choosingNear = false } } }
            }
        }
        .overlay {
            if preparingShare { ProgressView().controlSize(.large).padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: Radius.card)) }
        }
        .alert("Eats", isPresented: Binding(get: { book.lastError != nil }, set: { if !$0 { book.lastError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(book.lastError ?? "")
        }
    }

    // MARK: Opening a place

    private func select(_ place: EatsPlace) {
        wishDetail = nil
        detail = place
    }

    /// The row whose page is open beside the Mac list.
    private func isOpen(_ place: EatsPlace) -> Bool {
        #if os(macOS)
        detail?.id == place.id || wishDetail?.id == place.id
        #else
        false
        #endif
    }

    /// iPhone opens a place in a sheet; the Mac shows it beside the list instead.
    private func phoneSheet(_ item: Binding<EatsPlace?>) -> Binding<EatsPlace?> {
        #if os(macOS)
        .constant(nil)
        #else
        item
        #endif
    }

    #if os(macOS)
    /// The right side on the Mac: the open place, or your passport and friends.
    @ViewBuilder
    private var macDetail: some View {
        if let place = detail {
            EatsPlaceDetail(place: place, embedded: true) { detail = nil }
                .id(place.id)
        } else if let wish = wishDetail {
            EatsWishDetail(place: wish, embedded: true, onClose: { wishDetail = nil }) { ranking = .place($0) }
                .id(wish.id)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xl) {
                    if tripID == nil, !book.mine.isEmpty { passport(book.mine).padding(-Space.l) }
                    if tripID == nil {
                        VStack(alignment: .leading, spacing: Space.m) {
                            SectionLabel("Friends")
                            friendsStrip
                            if book.friends.isEmpty {
                                Text("Share your list with friends and ask them to share theirs back — you'll see each other's rankings.")
                                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                            }
                        }
                        .card(padding: Space.l)
                    }
                    Label("Choose a place on the left to see it here.", systemImage: "sidebar.left")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
                .padding(Space.xxl)
                .frame(maxWidth: 720, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
            .background(Theme.background)
        }
    }
    #endif

    // MARK: Header

    /// The hero: how many places and cities, and your latest stamps.
    private func passport(_ ordered: [EatsPlace]) -> some View {
        let cities = Set(ordered.compactMap(\.city)).count
        let latest = ordered.sorted { $0.createdAt > $1.createdAt }.prefix(4)
        return HeroCard(eyebrow: "Your passport") {
            Text("\(ordered.count) place\(ordered.count == 1 ? "" : "s")").wooliFont(.amount)
            if cities > 0 { Text("\(cities) cit\(cities == 1 ? "y" : "ies")").font(.footnote) }
            HStack(spacing: Space.m) {
                ForEach(Array(latest)) { place in
                    MealScoreBadge(score: book.scores[place.id] ?? 0, size: 52)
                }
            }
        }
        .padding(Space.l)
    }

    // MARK: Header

    /// Beli's top: Been / Want to Try tabs, filter chips, then sort and search.
    private func header(_ pool: [EatsPlace]) -> some View {
        let cities = Set(pool.compactMap(\.city)).sorted()
        let cuisines = Set(pool.compactMap(\.cuisine)).sorted()
        return VStack(alignment: .leading, spacing: 14) {
            #if os(iOS)
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
            #endif
            if !pool.isEmpty || city != nil || cuisine != nil || near != nil {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        if city != nil || cuisine != nil || near != nil {
                            Button("Clear", systemImage: "xmark") {
                                city = nil
                                cuisine = nil
                                setNear(nil)
                            }
                            .labelStyle(.iconOnly)
                            .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
                            .frame(width: 36, height: 36)
                            .overlay(Circle().strokeBorder(Theme.textTertiary, lineWidth: 1.2))
                        }
                        nearChip
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
                        ForEach(Sort.allCases.filter { $0 != .distance || near != nil }) { Text($0.rawValue).tag($0) }
                    }
                } label: {
                    Label(sort.rawValue, systemImage: "arrow.up.arrow.down")
                        .font(.subheadline.weight(.semibold)).foregroundStyle(PlaceActionBar.ink)
                }
                .chipMenuStyle()
                Spacer()
                #if os(iOS)
                Button(searching ? "Done" : "Search", systemImage: "magnifyingglass") {
                    withAnimation(.snappy) {
                        searching.toggle()
                        if !searching { query = "" }
                    }
                }
                .labelStyle(.iconOnly).font(.title3).foregroundStyle(PlaceActionBar.ink)
                #endif
            }
            #if os(iOS)
            if searching {
                TextField("Search your list", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
            }
            #endif
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
            chipLabel(value.wrappedValue ?? title, isOn: value.wrappedValue != nil)
        }
        .chipMenuStyle()
    }

    private func chipLabel(_ text: String, isOn: Bool) -> some View {
        HStack(spacing: 6) {
            Text(text).lineLimit(1)
            Image(systemName: "chevron.down").font(.caption.weight(.bold))
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(isOn ? Theme.onBrand : Theme.text)
        .padding(.horizontal, 14).frame(height: 36)
        .background(Capsule().fill(isOn ? PlaceActionBar.ink : Color.clear))
        .overlay(Capsule().strokeBorder(isOn ? PlaceActionBar.ink : Theme.textTertiary, lineWidth: 1.2))
    }

    /// Near: you, or a place you pick (a city for a trip), within 50 miles, nearest first.
    private var nearChip: some View {
        Menu {
            Button("Anywhere") { setNear(nil) }
            Button("Near me", systemImage: "location") { locateMe() }
            Button("Choose a place…", systemImage: "magnifyingglass") { choosingNear = true }
        } label: {
            chipLabel(locating ? "Locating…" : near.map { "\($0.name) · 50 mi" } ?? "Near", isOn: near != nil)
        }
        .chipMenuStyle()
        .disabled(locating)
    }

    private func setNear(_ value: Near?) {
        near = value
        if value != nil { sort = .distance } else if sort == .distance { sort = .score }
    }

    private func locateMe() {
        locating = true
        Task {
            defer { locating = false }
            if let here = await CurrentLocation.fetch() {
                setNear(Near(name: "Near me", latitude: here.coordinate.latitude, longitude: here.coordinate.longitude))
            } else {
                book.lastError = "Wooli can't see where you are. Turn on Location for Wooli in Settings, or choose a place instead."
            }
        }
    }

    /// "1.2 mi", or "34 mi" from 10 miles out.
    private static func miles(_ meters: CLLocationDistance) -> String {
        let miles = meters / 1609.344
        return Measurement(value: miles, unit: UnitLength.miles)
            .formatted(.measurement(width: .abbreviated, usage: .asProvided,
                                    numberFormatStyle: .number.precision(.fractionLength(miles < 10 ? 1 : 0))))
    }

    /// The row's quiet line, with how far away it is when Near is on.
    private func withDistance(_ place: EatsPlace, _ text: String) -> String {
        guard let near, let meters = place.distance(from: near.location) else { return text }
        return [Self.miles(meters), text].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private func filtered(_ places: [EatsPlace]) -> [EatsPlace] {
        let text = query.trimmingCharacters(in: .whitespaces)
        let center = near?.location
        return places.filter { place in
            (city == nil || place.city == city) && (cuisine == nil || place.cuisine == cuisine)
                && (center.map { c in place.distance(from: c).map { $0 <= Self.nearRadius } ?? false } ?? true)
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
        case .distance:
            if let center = near?.location {
                places.sorted { ($0.distance(from: center) ?? .infinity) < ($1.distance(from: center) ?? .infinity) }
            } else {
                places
            }
        }
    }

    // MARK: List

    private func list(_ shown: [EatsPlace], total: Int, waiting: [TripItem], scores: [String: Double]) -> some View {
        List {
            #if os(iOS)
            if tab == .been, tripID == nil, !book.mine.isEmpty {
                Section {
                    passport(book.mine)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }
            #endif
            if tab == .been {
                #if os(iOS)
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
                #endif
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
                        setNear(nil)
                        query = ""
                    }
                }
            }

            Section {
                ForEach(Array(shown.enumerated()), id: \.element.id) { index, place in
                    if tab == .been {
                        Button { select(place) } label: {
                            EatsPlaceRow(place: place, index: sort == .score ? index + 1 : nil, score: scores[place.id],
                                         subtitle: withDistance(place, subtitle(place)), friends: book.friendScores(for: place).map(\.friend))
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(isOpen(place) ? Theme.brandSoft : nil)
                        .contextMenu {
                            if let url = place.tripPlace?.mapsURL {
                                Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
                            }
                            if let url = place.tripPlace?.googleMapsURL {
                                Link(destination: url) { Label("Open in Google Maps", systemImage: "globe") }
                            }
                        }
                    } else {
                        wishRow(place)
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
            .listSectionSeparator(.hidden, edges: .top)

            #if os(iOS)
            // Room to scroll the last row out from under View Map.
            Color.clear.frame(height: 72).listRowSeparator(.hidden)
            #endif
        }
        .listStyle(.plain)
        .refreshable {
            await TripStore.shared.fetchChanges()
            await TripStore.shared.downloadPartnersList()
        }
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
                .contextMenu {
                    Button("Skip", systemImage: "forward") {
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
            #if os(macOS)
            Text("Restaurants from your trips. Right-click one to skip it.")
            #else
            Text("Restaurants from your trips. Swipe to skip one.")
            #endif
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

    /// A saved place: same row as the list (tap for its page), with Been to rank it.
    private func wishRow(_ wish: EatsPlace) -> some View {
        HStack(alignment: .center, spacing: 8) {
            Button { detail = nil; wishDetail = wish } label: {
                EatsPlaceRow(place: wish, index: nil, score: nil,
                             subtitle: withDistance(wish, "Saved \(wish.createdAt.formatted(.dateTime.month(.abbreviated).day().year()))"))
            }
            .buttonStyle(.plain)
            if let spot = wish.tripPlace {
                Button("Been") { ranking = .place(spot) }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(PlaceActionBar.ink)
            }
        }
        .listRowBackground(isOpen(wish) ? Theme.brandSoft : nil)
        .contextMenu {
            if let url = wish.tripPlace?.mapsURL {
                Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
            }
            if let reel = wish.reelURL {
                Link(destination: reel) { Label("Watch the reel", systemImage: "play.rectangle") }
            }
            Divider()
            Button("Remove from Want to Try", systemImage: "trash", role: .destructive) { book.removeFromWishlist(wish) }
        }
        .swipeActions {
            Button("Remove", role: .destructive) { book.removeFromWishlist(wish) }
        }
    }

    private var friendsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 16) {
                partnerTile
                // In your partner's list this invites friends to the joint list
                // (you're its administrator).
                Button { shareMyList(asPartner: false) } label: {
                    VStack(spacing: 6) {
                        let sharing = book.isSharing && !book.inPartnersList
                        Image(systemName: sharing ? "person.2.fill" : "person.crop.circle.badge.plus")
                            .font(.title3).foregroundStyle(Theme.brand)
                            .frame(width: 52, height: 52)
                            .background(Theme.brandSoft, in: Circle())
                        Text(sharing ? "Sharing" : "Invite").font(.caption).foregroundStyle(Theme.text)
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

    /// Couple mode: invite your partner, or (once you share a list) manage or leave it.
    private var partnerTile: some View {
        Button {
            if book.partner == nil { shareMyList(asPartner: true) } else { partnerOptions = true }
        } label: {
            VStack(spacing: 6) {
                Image(systemName: book.partner == nil ? "heart.circle" : "heart.fill")
                    .font(.title3).foregroundStyle(Color(hex: "#e11d48"))
                    .frame(width: 52, height: 52)
                    .background(Color(hex: "#e11d48").opacity(0.12), in: Circle())
                Text(book.partner.map { $0.name.split(separator: " ").first.map(String.init) ?? $0.name } ?? "Partner")
                    .font(.caption).foregroundStyle(Theme.text).lineLimit(1)
            }
            .frame(width: 60)
        }
        .buttonStyle(.plain)
        .disabled(preparingShare)
        .confirmationDialog("You and \(book.partner?.name ?? "your partner") share this list", isPresented: $partnerOptions,
                            titleVisibility: .visible) {
            if book.inPartnersList {
                Button("Leave our list", role: .destructive) { book.leavePartnersList() }
            } else {
                Button("Manage sharing") { shareMyList(asPartner: true) }
            }
        } message: {
            Text(book.inPartnersList
                 ? "It stays with \(book.partner?.name ?? "them"). You'll get your own list back."
                 : "You both add, rank and remove places, and see each other's changes.")
        }
    }

    /// Friends get view-only access to your list; your partner can make changes.
    private func shareMyList(asPartner: Bool) {
        guard TripStore.shared.iCloudAvailable else {
            book.lastError = "Sign in to iCloud in Settings to share your list."
            return
        }
        preparingShare = true
        Task {
            defer { preparingShare = false }
            do {
                let share = try await book.share()
                TripSharingPresenter.present(share: share, container: TripStore.shared.container,
                                             title: asPartner || book.partner != nil ? "Our Eats list" : "My Eats list",
                                             permissions: asPartner ? [.allowReadWrite, .allowPrivate] : [.allowReadOnly, .allowPrivate]) {
                    // Only the owner can stop sharing the list.
                    if !EatsBook.shared.inPartnersList { EatsBook.shared.setSharing(false) }
                }
            } catch {
                book.lastError = "Couldn't set up sharing: \(error.localizedDescription)"
            }
        }
    }

    private func subtitle(_ place: EatsPlace) -> String {
        let trip = tripID == nil && !place.tripID.isEmpty ? TripStore.shared.trip(place.tripID)?.name : nil
        let date = place.visitedDay.isEmpty ? nil : DayKey.date(place.visitedDay).formatted(.dateTime.month(.abbreviated).day().year())
        let visits = place.visits.count > 1 ? "\(place.visits.count) visits" : nil
        return [trip, date, visits].compactMap { $0 }.joined(separator: " · ")
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
            if let score { MealScoreBadge(score: score, size: 50, rank: index) }
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
                        MealScoreBadge(score: scores[place.id] ?? 0, size: 40)
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
    @State private var renaming = false
    @State private var newName = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let friend = book.friend(friendID) {
            let scores = book.scores(of: friend)
            let byID = Dictionary(friend.places.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
            let ordered = EatsRanking.ordered(friend.places.map(\.candidate)).compactMap { byID[$0.id] }
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
                        Button("Rename", systemImage: "pencil") {
                            newName = friend.name
                            renaming = true
                        }
                        Button("Stop following", systemImage: "person.badge.minus", role: .destructive) { confirmUnfollow = true }
                    }
                }
            }
            .alert("Rename", isPresented: $renaming) {
                TextField("Name", text: $newName)
                Button("Cancel", role: .cancel) {}
                Button("Save") { book.rename(friend, to: newName) }
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
            .flatMap { book.scores[$0.id] }
            .map { "You: #\(MealScoreBadge.ownRank(of: $0)) · \(EatsVerdict.label(for: $0))" }
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
    @State private var editingVisit: EatsVisit?
    @State private var mapItem: MKMapItem?
    @State private var showingListing = false
    @FocusState private var editingNotes: Bool
    /// Shown beside the Mac list instead of in its own sheet.
    var embedded = false
    /// Clears the Mac list's selection (after removing the place).
    var onClose: (() -> Void)? = nil
    @State private var autosave: Task<Void, Never>?

    init(place: EatsPlace, tripItem: TripItem? = nil, embedded: Bool = false, onClose: (() -> Void)? = nil) {
        _place = State(initialValue: place)
        self.embedded = embedded
        self.onClose = onClose
        self.tripItem = tripItem
    }

    var body: some View {
        if embedded {
            page
                .readableContentWidth()
                // Beside the Mac list there's no Save: keep changes a moment after the last edit.
                .onChange(of: place) { _, edited in
                    autosave?.cancel()
                    autosave = Task {
                        try? await Task.sleep(for: .milliseconds(700))
                        guard !Task.isCancelled, !edited.name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        book.save(edited)
                    }
                }
        } else {
            NavigationStack {
                page.toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            book.save(place)
                            dismiss()
                        }
                        .disabled(place.name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }

    /// Closes the sheet on iPhone; beside the Mac list, clears the selection.
    private func close() {
        if embedded { onClose?() } else { dismiss() }
    }

    @ViewBuilder
    private var page: some View {
        let others = book.mine.filter { $0.id != place.id }.map(\.candidate)
        let all = others + [place.candidate]
        let ordered = EatsRanking.ordered(all)
        let score = EatsRanking.scores(all)[place.id] ?? 0
        let position = (ordered.firstIndex { $0.id == place.id } ?? 0) + 1
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
        .task(id: place.tripPlace) {
            guard let spot = place.tripPlace else { return }
            mapItem = await PlaceMapCard.listing(for: spot)
        }
        .mapItemDetailSheet(isPresented: $showingListing, item: mapItem)
        .sheet(item: $editingPlan) { item in
            if let trip = TripStore.shared.trip(item.tripID) { TripItemEditor(item: item, trip: trip) }
        }
        // A new rank is saved right away and takes you back to the list.
        .sheet(isPresented: $reranking, onDismiss: { if closeAfterRank { close() } }) {
            RankFlow(candidate: place.candidate, others: others) { sentiment, rank in
                place.sentiment = sentiment
                place.rank = rank
                book.save(place)
                closeAfterRank = true
            }
        }
        .sheet(item: $editingVisit) { visit in
            VisitEditor(visit: visit, isNew: !place.visits.contains { $0.id == visit.id },
                        canDelete: place.visits.count > 1) { edited in
                if let edited { place.setVisit(edited) } else { place.removeVisit(visit) }
                book.save(place)
            }
        }
        .alert("Rename", isPresented: $renaming) {
            TextField("Name", text: $place.name)
            Button("Done") {}
        }
        .confirmationDialog("Remove \(place.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                book.delete(place)
                close()
            }
        }
    }

    // MARK: Parts

    private var hero: some View {
        PlaceHeroMap(coordinate: place.coordinate, name: place.name,
                     tint: MealScoreBadge.ink(book.scores[place.id] ?? 7)) {
            if mapItem != nil { showingListing = true }
        }
    }

    private func titleBlock(score: Double) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(place.name)
                .wooliFont(.display)
                .foregroundStyle(Theme.text)
                .lineLimit(3).minimumScaleFactor(0.7)
                .onLongPressGesture { renaming = true }
                .padding(.top, place.coordinate == nil ? 0 : -PlaceHeroMap.titleOverlap)
            HStack(spacing: 10) {
                MealScoreBadge(score: score, size: 92, place: place.city)
                Text(EatsVerdict.label(for: score)).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.textSecondary)
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
                    scoreTile(score: score, badge: "You", rank: position, title: "Your rating", detail: "#\(position) of \(count) on your list")
                    let friends = book.friendScores(for: place)
                    if !friends.isEmpty {
                        let average = friends.map(\.score).reduce(0, +) / Double(friends.count)
                        scoreTile(score: (average * 10).rounded() / 10, badge: "\(friends.count)", rank: nil, title: "Friend score",
                                  detail: friends.prefix(2).map(\.friend.name).joined(separator: ", "))
                    }
                }
            }
            .scrollClipDisabled()
        }
    }

    private func scoreTile(score: Double, badge: String, rank: Int?, title: String, detail: String) -> some View {
        HStack(spacing: 12) {
            MealScoreBadge(score: score, size: 58, rank: rank, usesOwnRank: rank != nil)
                .overlay(alignment: .bottomTrailing) {
                    Text(badge).font(.caption2.weight(.bold)).foregroundStyle(Theme.onBrand)
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
            Text(place.visits.count > 1 ? "Visits · \(place.visits.count)" : "Visits")
                .font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, 6)
            ForEach(place.visits) { visit in
                PlaceDetailRow(systemImage: "calendar") {
                    PlaceDetailLink(title: DayKey.date(visit.day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().year()),
                                    detail: visit.note) { editingVisit = visit }
                }
            }
            PlaceDetailRow(systemImage: "plus.circle") {
                PlaceDetailLink(title: "Add visit") { editingVisit = EatsVisit(day: DayKey.key(.now)) }
            }
            Text("Your notes").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.top, 22).padding(.bottom, 6)
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

/// A place you want to try: where it is, the reel it came from, your notes,
/// and I've been to rank it.
struct EatsWishDetail: View {
    @State private var place: EatsPlace
    /// Gets the place when you tap I've been; the list ranks it once this closes.
    let onBeen: (TripPlace) -> Void
    @State private var book = EatsBook.shared
    @Environment(\.dismiss) private var dismiss
    @State private var mapItem: MKMapItem?
    @State private var showingListing = false
    @State private var confirmRemove = false
    @State private var renaming = false
    /// Shown beside the Mac list instead of in its own sheet.
    var embedded = false
    /// Clears the Mac list's selection (after removing the place).
    var onClose: (() -> Void)? = nil
    @State private var autosave: Task<Void, Never>?

    init(place: EatsPlace, embedded: Bool = false, onClose: (() -> Void)? = nil, onBeen: @escaping (TripPlace) -> Void) {
        _place = State(initialValue: place)
        self.embedded = embedded
        self.onClose = onClose
        self.onBeen = onBeen
    }

    var body: some View {
        if embedded {
            page
                .readableContentWidth()
                // Beside the Mac list there's no Save: keep changes a moment after the last edit.
                .onChange(of: place) { _, edited in
                    autosave?.cancel()
                    autosave = Task {
                        try? await Task.sleep(for: .milliseconds(700))
                        guard !Task.isCancelled, !edited.name.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        book.updateWish(edited)
                    }
                }
        } else {
            NavigationStack {
                page.toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            book.updateWish(place)
                            dismiss()
                        }
                        .disabled(place.name.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
        }
    }

    /// Closes the sheet on iPhone; beside the Mac list, clears the selection.
    private func close() {
        if embedded { onClose?() } else { dismiss() }
    }

    @ViewBuilder
    private var page: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                PlaceHeroMap(coordinate: place.coordinate, name: place.name, tint: Theme.brand) {
                    if mapItem != nil { showingListing = true }
                }
                VStack(alignment: .leading, spacing: 22) {
                    titleBlock
                    PlaceActionBar(place: place.tripPlace, mapItem: mapItem) { showingListing = true }
                    notesList
                    Button("Remove from Want to Try", role: .destructive) { confirmRemove = true }
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
        .task(id: place.tripPlace) {
            guard let spot = place.tripPlace else { return }
            mapItem = await PlaceMapCard.listing(for: spot)
        }
        .mapItemDetailSheet(isPresented: $showingListing, item: mapItem)
        .alert("Rename", isPresented: $renaming) {
            TextField("Name", text: $place.name)
            Button("Done") {}
        }
        .confirmationDialog("Remove \(place.name)?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                book.removeFromWishlist(place)
                close()
            }
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(place.name)
                .wooliFont(.display)
                .foregroundStyle(Theme.text)
                .lineLimit(3).minimumScaleFactor(0.7)
                .onLongPressGesture { renaming = true }
                .padding(.top, place.coordinate == nil ? 0 : -PlaceHeroMap.titleOverlap)
            HStack(spacing: 10) {
                Label("Want to try", systemImage: "bookmark.fill")
                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.textSecondary)
                Spacer()
                if let spot = place.tripPlace {
                    Button("I've been") {
                        onBeen(spot)
                        close()
                    }
                    .font(.subheadline.weight(.semibold))
                    .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(PlaceActionBar.ink)
                }
            }
            if let cuisine = place.cuisine {
                Text(cuisine).font(.headline).foregroundStyle(PlaceActionBar.ink)
            }
            if !place.address.isEmpty {
                Text(place.address).font(.subheadline).foregroundStyle(Theme.textSecondary).textSelection(.enabled)
            }
        }
    }

    private var notesList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your notes").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, 6)
            if let reel = place.reelURL {
                PlaceDetailRow(systemImage: "play.rectangle") {
                    Link(destination: reel) {
                        HStack {
                            Text("Watch the reel").foregroundStyle(Theme.text)
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                        }
                    }
                }
            }
            PlaceDetailRow(systemImage: "bookmark") {
                LabeledContent("Saved", value: place.createdAt.formatted(.dateTime.month(.abbreviated).day().year()))
            }
            PlaceDetailRow(systemImage: "square.and.pencil") {
                TextField("Add notes — what to order, who recommended it", text: $place.notes, axis: .vertical)
                    .lineLimit(1...8)
            }
            PlaceDetailRow(systemImage: "pencil.line") {
                PlaceDetailLink(title: "Rename") { renaming = true }
            }
            Text("Friends you share your list with can see your notes.")
                .font(.caption).foregroundStyle(Theme.textTertiary).padding(.top, 8)
        }
    }
}

/// Add or change one visit: the day and a short note.
struct VisitEditor: View {
    @State var visit: EatsVisit
    let isNew: Bool
    /// The last visit can't be deleted; a place always has one.
    let canDelete: Bool
    /// The edited visit, or nil to delete it.
    let onDone: (EatsVisit?) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Date", selection: Binding(get: { DayKey.date(visit.day) }, set: { visit.day = DayKey.key($0) }),
                           in: ...Date.now, displayedComponents: .date)
                TextField("Note — the occasion, what you ordered", text: $visit.note, axis: .vertical)
                    .lineLimit(1...4)
                if !isNew && canDelete {
                    Button("Delete visit", role: .destructive) {
                        onDone(nil)
                        dismiss()
                    }
                }
            }
            .navigationTitle(isNew ? "Add visit" : "Visit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNew ? "Add" : "Done") {
                        onDone(visit)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

private extension View {
    /// Filter chips draw their own arrow; on the Mac, drop the menu's second one.
    @ViewBuilder
    func chipMenuStyle() -> some View {
        #if os(macOS)
        self.menuIndicator(.hidden).menuStyle(.button).buttonStyle(.plain)
        #else
        self
        #endif
    }
}
