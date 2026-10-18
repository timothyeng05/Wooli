import SwiftUI
import SwiftData
import MapKit

// MARK: - Saving

enum EatsStore {
    /// Adds a ranked trip meal to Eats, linked back to its trip.
    @MainActor
    static func add(_ item: TripItem, sentiment: MealSentiment, rank: Double, context: ModelContext) {
        let entry = EatsEntry(name: item.rankCandidate.title, place: item.place, visitedDay: item.day ?? DayKey.key(.now))
        entry.tripID = item.tripID
        entry.tripItemID = item.id
        entry.sentiment = sentiment
        entry.rank = rank
        context.insert(entry)
        try? context.save()
    }
}

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
/// trip meals waiting to be ranked, then your ranked places (list or map).
struct EatsListView: View {
    /// Show only this trip's places.
    var tripID: String? = nil

    @Environment(\.modelContext) private var context
    @Query(sort: \EatsEntry.createdAt) private var entries: [EatsEntry]
    @State private var skipped = EatsRanking.skippedIDs
    @State private var showMap = false
    @State private var adding = false
    @State private var pickedPlace: TripPlace?
    @State private var ranking: RankRequest?
    @State private var detail: EatsEntry?

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
        let mine = entries.filter { tripID == nil || $0.tripID == tripID }
        let scores = EatsRanking.scores(entries.map(\.candidate))
        let ordered = EatsRanking.ordered(mine.map(\.candidate)).compactMap { c in mine.first { $0.id == c.id } }
        let waiting = EatsRanking.toRank(entries: entries).filter { !skipped.contains($0.id) && (tripID == nil || $0.tripID == tripID) }

        Group {
            if showMap {
                map(ordered, scores: scores)
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
            RankFlow(candidate: candidate(for: request), others: entries.map(\.candidate)) { sentiment, rank in
                record(request, sentiment: sentiment, rank: rank)
            }
        }
        .sheet(item: $detail) { entry in
            EatsEntryDetail(entry: entry)
        }
    }

    private func list(_ ordered: [EatsEntry], waiting: [TripItem], scores: [String: Double]) -> some View {
        List {
            if !waiting.isEmpty {
                Section {
                    ForEach(waiting) { item in
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
                                EatsRanking.skip(item.id)
                                skipped.insert(item.id)
                            }
                        }
                    }
                } header: {
                    Text("To rank")
                } footer: {
                    Text("Food from your trips. Swipe to skip one.")
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
                    ForEach(Array(ordered.enumerated()), id: \.element.id) { index, entry in
                        Button { detail = entry } label: {
                            HStack(spacing: 12) {
                                Text("\(index + 1)").font(.subheadline.weight(.bold)).monospacedDigit()
                                    .foregroundStyle(Theme.textTertiary).frame(width: 26)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(1)
                                    Text(subtitle(entry)).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                                }
                                Spacer(minLength: 8)
                                if let score = scores[entry.id] { MealScoreBadge(score: score, size: 38) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func subtitle(_ entry: EatsEntry) -> String {
        let trip = tripID == nil && !entry.tripID.isEmpty ? TripStore.shared.trip(entry.tripID)?.name : nil
        let date = entry.visitedDay.isEmpty ? nil : DayKey.date(entry.visitedDay).formatted(.dateTime.month(.abbreviated).day().year())
        return [trip, date].compactMap { $0 }.joined(separator: " · ")
    }

    private func map(_ ordered: [EatsEntry], scores: [String: Double]) -> some View {
        Map(initialPosition: .automatic) {
            ForEach(ordered.filter { $0.coordinate != nil }) { entry in
                Annotation(entry.name, coordinate: entry.coordinate!) {
                    Button { detail = entry } label: {
                        MealScoreBadge(score: scores[entry.id] ?? 0, size: 34)
                            .background(Circle().fill(Theme.card))
                            .shadow(color: .black.opacity(0.2), radius: 3, y: 1)
                    }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .overlay {
            if !ordered.contains(where: { $0.coordinate != nil }) {
                ContentUnavailableView("No places on the map yet", systemImage: "map",
                                       description: Text("Places picked from Apple Maps show up here with their score."))
            }
        }
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
            EatsStore.add(item, sentiment: sentiment, rank: rank, context: context)
        case .place(let place):
            let entry = EatsEntry(name: place.name, place: place)
            entry.tripID = tripID ?? ""
            entry.sentiment = sentiment
            entry.rank = rank
            context.insert(entry)
            try? context.save()
        }
    }
}

// MARK: - A place

struct EatsEntryDetail: View {
    @Bindable var entry: EatsEntry
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var entries: [EatsEntry]
    @State private var reranking = false
    @State private var confirmDelete = false

    var body: some View {
        let all = entries.map(\.candidate)
        let ordered = EatsRanking.ordered(all)
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        MealScoreBadge(score: EatsRanking.scores(all)[entry.id] ?? 0, size: 56)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(entry.sentiment.label).font(.headline)
                            Text("#\((ordered.firstIndex { $0.id == entry.id } ?? 0) + 1) of \(ordered.count) on your list")
                                .font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Button("Re-rank") { reranking = true }.buttonStyle(.bordered).buttonBorderShape(.capsule)
                    }
                }

                Section {
                    TextField("Name", text: $entry.name)
                    DatePicker("Went", selection: Binding(get: { DayKey.date(entry.visitedDay) },
                                                          set: { entry.visitedDay = DayKey.key($0) }),
                               displayedComponents: .date)
                    if let trip = TripStore.shared.trip(entry.tripID) {
                        LabeledContent("Trip", value: trip.name)
                    }
                    if let coordinate = entry.coordinate,
                       let url = TripPlace(name: entry.name, address: entry.address, latitude: coordinate.latitude,
                                           longitude: coordinate.longitude, mapItemID: entry.mapItemID).mapsURL {
                        Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
                    }
                }

                Section("Notes") {
                    TextField("What to order, who you went with…", text: $entry.notes, axis: .vertical).lineLimit(2...8)
                }

                Section {
                    Button("Remove from Eats", role: .destructive) { confirmDelete = true }
                }
            }
            .navigationTitle(entry.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { try? context.save(); dismiss() } } }
            .sheet(isPresented: $reranking) {
                RankFlow(candidate: entry.candidate, others: all.filter { $0.id != entry.id }) { sentiment, rank in
                    entry.sentiment = sentiment
                    entry.rank = rank
                    try? context.save()
                }
            }
            .confirmationDialog("Remove \(entry.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    dismiss()
                    context.delete(entry)
                    try? context.save()
                }
            }
        }
    }
}
