import SwiftUI
import MapKit

/// On a trip page: places your friends have ranked near where you're going,
/// best first, with a button to drop one into the trip's Ideas.
struct FriendsNearTripCard: View {
    let trip: Trip
    @State private var book = EatsBook.shared
    @State private var store = TripStore.shared
    /// Where the trip goes: its destination and stops, found on Apple Maps.
    @State private var areas: [CLLocation] = []
    @State private var showAll = false

    /// Close enough to count as "near" the trip.
    private static let radius: CLLocationDistance = 40_000

    struct Pick: Identifiable {
        let friend: EatsFriend
        let place: EatsPlace
        let score: Double
        var id: String { friend.id + place.id }
    }

    var body: some View {
        let picks = nearbyPicks()
        // A VStack (not Group) so the lookup below runs even while it's empty.
        VStack(spacing: 0) {
            if !picks.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    CardHeader(title: "Friends ate here", subtitle: "Ranked by friends, near this trip") { EmptyView() }
                    ForEach(showAll ? picks : Array(picks.prefix(4))) { pick in row(pick) }
                    if picks.count > 4 {
                        Button(showAll ? "Show fewer" : "Show all \(picks.count)") { withAnimation(.snappy) { showAll.toggle() } }
                            .font(.subheadline.weight(.medium))
                    }
                }
                .card()
            }
        }
        .task(id: areaQueries) { areas = await Self.locate(areaQueries) }
    }

    private func row(_ pick: Pick) -> some View {
        let added = store.items(in: trip.id).contains { $0.title.caseInsensitiveCompare(pick.place.name) == .orderedSame }
        return HStack(spacing: 12) {
            FriendAvatar(friend: pick.friend, size: 30)
            VStack(alignment: .leading, spacing: 2) {
                Text(pick.place.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text(pick.friend.name).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            MealScoreBadge(score: pick.score, size: 32)
            Button(added ? "Added" : "Ideas", systemImage: added ? "checkmark" : "plus") { addToIdeas(pick) }
                .font(.caption.weight(.semibold))
                .buttonStyle(.bordered).buttonBorderShape(.capsule).controlSize(.small)
                .disabled(added)
        }
    }

    /// Friends' places within reach of the trip, best score first; a place
    /// several friends ranked shows once, with the highest score.
    private func nearbyPicks() -> [Pick] {
        let centers = areas + store.items(in: trip.id).compactMap(\.place).map { CLLocation(latitude: $0.latitude, longitude: $0.longitude) }
        guard !centers.isEmpty else { return [] }
        var picks: [Pick] = []
        for friend in book.friends {
            let scores = friend.scores
            for place in friend.places {
                guard let c = place.coordinate, let score = scores[place.id] else { continue }
                let location = CLLocation(latitude: c.latitude, longitude: c.longitude)
                guard centers.contains(where: { $0.distance(from: location) < Self.radius }) else { continue }
                if let i = picks.firstIndex(where: { $0.place.isSamePlace(as: place) }) {
                    if score > picks[i].score { picks[i] = Pick(friend: friend, place: place, score: score) }
                } else {
                    picks.append(Pick(friend: friend, place: place, score: score))
                }
            }
        }
        return picks.sorted { $0.score > $1.score }
    }

    private var areaQueries: [String] {
        Array(Set(([trip.destination] + trip.legs.map(\.name)).filter { !$0.isEmpty })).sorted()
    }

    private static func locate(_ queries: [String]) async -> [CLLocation] {
        var found: [CLLocation] = []
        for query in queries.prefix(8) {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            if let center = try? await MKLocalSearch(request: request).start().boundingRegion.center {
                found.append(CLLocation(latitude: center.latitude, longitude: center.longitude))
            }
        }
        return found
    }

    private func addToIdeas(_ pick: Pick) {
        store.save(TripItem(tripID: trip.id, day: nil, kind: .meal, title: pick.place.name, place: pick.place.tripPlace,
                            notes: "\(pick.friend.name) rated it \(pick.score.formatted(.number.precision(.fractionLength(1))))"))
    }
}
