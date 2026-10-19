import SwiftUI

/// Places shared to Wooli from Apple Maps (the WooliShare extension),
/// shown one at a time when the app comes to the front.
@MainActor
@Observable
final class SharedPlaceInbox {
    static let shared = SharedPlaceInbox()

    var current: SharedPlace?
    /// An Instagram reel to look for places in; shown after any places.
    var currentReel: SharedReel?
    /// The sheet clears `currentReel` before its onDismiss runs, so remember what was shown.
    @ObservationIgnored private var shownReel: URL?
    /// Bumped when shared places go straight to Eats' Want to try, so the
    /// app can switch to Eats to show them.
    private(set) var wishesAdded = 0
    /// A trip to open once the sheet is gone (two sheets can't overlap).
    @ObservationIgnored var tripToOpenAfter: String?
    @ObservationIgnored private var shownID: String?

    func check() {
        // Want to try needs no questions: save those right away.
        let wishes = SharedPlaceHandoff.pending().filter { $0.destination == .eatsWishlist }
        for wish in wishes {
            EatsBook.shared.addToWishlist(EatsPlace(name: wish.name, place: wish.tripPlace))
            SharedPlaceHandoff.remove(wish.id)
        }
        if !wishes.isEmpty { wishesAdded += 1 }
        guard current == nil, currentReel == nil else { return }
        if let next = SharedPlaceHandoff.pending().first {
            shownID = next.id
            current = next
        } else {
            currentReel = SharedPlaceHandoff.pendingReels().first
            shownReel = currentReel?.url
        }
    }

    /// Added or cancelled, like places: it leaves the inbox either way.
    func reelDismissed() {
        if let shownReel { SharedPlaceHandoff.removeReel(shownReel) }
        shownReel = nil
        currentReel = nil
        check()
    }

    /// Added or cancelled: either way it's done, so it leaves the inbox.
    func dismissed() {
        if let shownID { SharedPlaceHandoff.remove(shownID) }
        shownID = nil
        if let trip = tripToOpenAfter {
            tripToOpenAfter = nil
            TripStore.shared.tripToOpen = trip
        } else {
            check()
        }
    }
}

extension SharedPlace {
    var tripPlace: TripPlace {
        TripPlace(name: name, address: address, latitude: latitude, longitude: longitude, mapItemID: mapItemID)
    }
}

struct SharedPlaceSheet: View {
    let place: SharedPlace

    @Environment(AppModel.self) private var app
    @State private var book = EatsBook.shared

    var body: some View {
        switch place.destination {
        case .eats: rank
        case .tripIdeas: SharedPlaceTripPicker(place: place)
        // Saved by `SharedPlaceInbox.check` before any sheet shows.
        case .eatsWishlist: EmptyView()
        }
    }

    /// Ranks it like any other place; already on your list → re-rank that entry.
    private var rank: some View {
        let new = EatsPlace(name: place.name, place: place.tripPlace)
        let existing = book.mine.first { $0.isSamePlace(as: new) }
        let candidate = RankCandidate(id: existing?.id ?? place.id, title: place.name, subtitle: place.address)
        return RankFlow(candidate: candidate, others: book.mine.filter { $0.id != existing?.id }.map(\.candidate)) { sentiment, rank in
            var saved = existing ?? new
            if saved.mapItemID.isEmpty { saved.mapItemID = place.mapItemID }
            saved.sentiment = sentiment
            saved.rank = rank
            book.save(saved)
            app.space = .eats
        }
    }
}

/// Which trip's Ideas to add a shared place to.
struct SharedPlaceTripPicker: View {
    let place: SharedPlace

    @Environment(\.dismiss) private var dismiss
    @Environment(AppModel.self) private var app
    @State private var store = TripStore.shared
    @State private var kind: TripItem.Kind

    init(place: SharedPlace) {
        self.place = place
        _kind = State(initialValue: place.isFood ? .meal : .activity)
    }

    /// Current and upcoming trips first (soonest first), then past ones.
    private var trips: [Trip] {
        let today = DayKey.key(.now)
        let ahead = store.trips.filter { $0.endDay >= today }.sorted { $0.startDay < $1.startDay }
        let past = store.trips.filter { $0.endDay < today }.sorted { $0.startDay > $1.startDay }
        return ahead + past
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.name).font(.headline).foregroundStyle(Theme.text)
                        if !place.address.isEmpty {
                            Text(place.address).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    Picker("Kind", selection: $kind) {
                        Text(TripItem.Kind.meal.label).tag(TripItem.Kind.meal)
                        Text(TripItem.Kind.activity.label).tag(TripItem.Kind.activity)
                    }
                    .pickerStyle(.segmented)
                }
                Section("Add to Ideas for") {
                    if trips.isEmpty {
                        Text("No trips yet — make one in Trips first.").foregroundStyle(Theme.textSecondary)
                    }
                    ForEach(trips) { trip in
                        Button { add(to: trip) } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(trip.name.isEmpty ? trip.destination : trip.name).font(.body.weight(.semibold)).foregroundStyle(Theme.text)
                                Text([trip.destination, trip.dateRangeText].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.caption).foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Add to a trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func add(to trip: Trip) {
        store.save(TripItem(tripID: trip.id, day: nil, kind: kind, title: place.name, place: place.tripPlace))
        app.space = .trips
        SharedPlaceInbox.shared.tripToOpenAfter = trip.id
        dismiss()
    }
}
