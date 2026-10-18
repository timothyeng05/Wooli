import SwiftUI
import MapKit
import CloudKit

/// The score in a colored ring: green 7+, amber 4–6.9, red below.
struct MealScoreBadge: View {
    let score: Double
    var size: CGFloat = 30

    var body: some View {
        let color = EatsRanking.color(score)
        Text(score.formatted(.number.precision(.fractionLength(1))))
            .font(.system(size: size * 0.38, weight: .bold, design: .rounded)).monospacedDigit()
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .background(color.opacity(0.12), in: Circle())
            .overlay(Circle().strokeBorder(color, lineWidth: max(1.5, size * 0.07)))
            .accessibilityLabel("Score \(score.formatted(.number.precision(.fractionLength(1)))) out of 10")
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

    @Environment(\.dismiss) private var dismiss
    @State private var sentiment: MealSentiment?
    @State private var low = 0
    @State private var high = 0
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
                } else if sentiment != nil, low < high {
                    compare(against: peers[(low + high) / 2])
                } else {
                    feelings
                }
                Spacer()
            }
            .padding(20)
            .animation(.snappy, value: low)
            .animation(.snappy, value: high)
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
                            Text(feeling.label).font(.caption.weight(.semibold)).foregroundStyle(Theme.text)
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
            Button("Too tough — call it even") { settle(at: (low + high) / 2) }
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
        }
        .id("\(low)-\(high)")
        .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
    }

    private func choice(_ place: RankCandidate, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: "fork.knife").font(.title3).foregroundStyle(Color(hex: TripItem.Kind.meal.colorHex))
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
        if high == 0 { settle(at: 0) }
    }

    private func answer(newIsBetter: Bool) {
        let mid = (low + high) / 2
        if newIsBetter { high = mid } else { low = mid + 1 }
        if low >= high { settle(at: low) }
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

        Group {
            if showMap {
                EatsMap(places: ordered, scores: scores) { detail = $0 }
            } else {
                list(ordered, waiting: waiting, scores: scores)
            }
        }
        .navigationTitle(tripID == nil ? "Eats" : "What we ate")
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

    private func list(_ ordered: [EatsPlace], waiting: [TripItem], scores: [String: Double]) -> some View {
        List {
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

            if !waiting.isEmpty {
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

            if ordered.isEmpty && waiting.isEmpty {
                ContentUnavailableView {
                    Label(tripID == nil ? "Start your list" : "Nothing ranked yet", systemImage: "fork.knife")
                } description: {
                    Text(tripID == nil ? "Add places you've eaten and rank them against each other. Meals from your trips show up here too."
                                       : "Meals from this trip show up here once their day starts.")
                } actions: {
                    Button("Add a place") { adding = true }.buttonStyle(.borderedProminent)
                }
            }

            if !ordered.isEmpty {
                Section(tripID == nil ? "Your list" : "Ranked") {
                    ForEach(Array(ordered.enumerated()), id: \.element.id) { index, place in
                        Button { detail = place } label: {
                            EatsPlaceRow(place: place, index: index + 1, score: scores[place.id],
                                         subtitle: subtitle(place), friends: book.friendScores(for: place).map(\.friend))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
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

/// One ranked place: position, name, who else has been, score.
struct EatsPlaceRow: View {
    let place: EatsPlace
    let index: Int
    let score: Double?
    let subtitle: String
    var friends: [EatsFriend] = []

    var body: some View {
        HStack(spacing: 12) {
            Text("\(index)").font(.subheadline.weight(.bold)).monospacedDigit()
                .foregroundStyle(Theme.textTertiary).frame(width: 26)
            VStack(alignment: .leading, spacing: 2) {
                Text(place.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text(subtitle).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            // Friends who've ranked it too.
            HStack(spacing: -8) {
                ForEach(friends.prefix(3)) { friend in
                    FriendAvatar(friend: friend, size: 22).overlay(Circle().stroke(Theme.card, lineWidth: 2))
                }
            }
            if let score { MealScoreBadge(score: score, size: 38) }
        }
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

struct EatsPlaceDetail: View {
    @State private var place: EatsPlace
    @State private var book = EatsBook.shared
    @Environment(\.dismiss) private var dismiss
    @State private var reranking = false
    @State private var confirmDelete = false

    init(place: EatsPlace) {
        _place = State(initialValue: place)
    }

    var body: some View {
        let others = book.mine.filter { $0.id != place.id }.map(\.candidate)
        let all = others + [place.candidate]
        let ordered = EatsRanking.ordered(all)
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        MealScoreBadge(score: EatsRanking.scores(all)[place.id] ?? 0, size: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(place.sentiment.label).font(.headline)
                            Text("#\((ordered.firstIndex { $0.id == place.id } ?? 0) + 1) of \(ordered.count) on your list")
                                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Button("Re-rank") { reranking = true }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                    }
                }

                let friendScores = book.friendScores(for: place)
                if !friendScores.isEmpty {
                    Section("Friends who've been") {
                        ForEach(friendScores) { entry in
                            HStack(spacing: 12) {
                                FriendAvatar(friend: entry.friend, size: 30)
                                Text(entry.friend.name)
                                Spacer()
                                MealScoreBadge(score: entry.score, size: 32)
                            }
                        }
                    }
                }

                Section {
                    TextField("Name", text: $place.name)
                    DatePicker("Went", selection: Binding(get: { DayKey.date(place.visitedDay) },
                                                          set: { place.visitedDay = DayKey.key($0) }),
                               displayedComponents: .date)
                    if let trip = TripStore.shared.trip(place.tripID) {
                        LabeledContent("Trip", value: trip.name)
                    }
                    if let url = place.tripPlace?.mapsURL {
                        Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
                    }
                }

                Section {
                    TextField("What to order, who you went with…", text: $place.notes, axis: .vertical).lineLimit(2...8)
                } header: {
                    Text("Notes")
                } footer: {
                    Text("Friends you share your list with can see your notes.")
                }

                Section {
                    Button("Remove from Eats", role: .destructive) { confirmDelete = true }
                }
            }
            .navigationTitle(place.name)
            .navigationBarTitleDisplayMode(.inline)
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
            .sheet(isPresented: $reranking) {
                RankFlow(candidate: place.candidate, others: others) { sentiment, rank in
                    place.sentiment = sentiment
                    place.rank = rank
                }
            }
            .confirmationDialog("Remove \(place.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    book.delete(place)
                    dismiss()
                }
            }
        }
    }
}
