import SwiftUI
import EventKit
import CoreLocation

/// "This weekend": free lunch/dinner windows from Apple Calendar, paired with
/// places near you from your Want to try list and friends' 8+ spots. Adding
/// one creates a calendar event with the address. (Apple Maps doesn't give
/// apps opening hours, so the event links to Maps to check.)
@MainActor
@Observable
final class WeekendPlanner {
    static let shared = WeekendPlanner()

    struct Slot: Identifiable, Hashable {
        let start: Date
        let meal: String
        var id: Date { start }

        var label: String { "\(start.formatted(.dateTime.weekday(.abbreviated))) · \(meal) \(start.formatted(date: .omitted, time: .shortened))" }
    }

    struct Rec: Identifiable {
        let place: EatsPlace
        /// The friend who ranked it, for friends' spots; nil for your Want to try.
        let friend: EatsFriend?
        let score: Double?
        var id: String { (friend?.id ?? "me") + place.id }
    }

    private(set) var slots: [Slot] = []
    private(set) var here: CLLocation?
    private(set) var calendarAccess = EKEventStore.authorizationStatus(for: .event)
    var lastError: String?

    @ObservationIgnored private let store = EKEventStore()
    /// How far counts as "near you".
    private static let radius: CLLocationDistance = 40_000

    var calendarConnected: Bool { calendarAccess == .fullAccess }

    func connectCalendar() async {
        do {
            _ = try await store.requestFullAccessToEvents()
        } catch {
            lastError = "Couldn't connect to Calendar: \(error.localizedDescription)"
        }
        calendarAccess = EKEventStore.authorizationStatus(for: .event)
        slots = freeSlots()
    }

    func refresh() async {
        calendarAccess = EKEventStore.authorizationStatus(for: .event)
        slots = freeSlots()
        if here == nil { here = await currentLocation() }
    }

    // MARK: Free time

    /// Lunch and dinner windows left this weekend (Saturday and Sunday; just
    /// what's left if it's already the weekend). With Calendar connected,
    /// only windows with nothing booked; otherwise all of them.
    private func freeSlots() -> [Slot] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let weekday = cal.component(.weekday, from: today) // 1 = Sunday, 7 = Saturday
        let saturday: Date
        switch weekday {
        case 7: saturday = today
        case 1: saturday = cal.date(byAdding: .day, value: -1, to: today)!
        default: saturday = cal.date(byAdding: .day, value: 7 - weekday, to: today)!
        }
        let windows: [(meal: String, start: (Int, Int), end: (Int, Int))] = [("Lunch", (12, 30), (14, 0)), ("Dinner", (19, 0), (21, 0))]
        var slots: [Slot] = []
        for day in [saturday, cal.date(byAdding: .day, value: 1, to: saturday)!] {
            for window in windows {
                guard let start = cal.date(bySettingHour: window.start.0, minute: window.start.1, second: 0, of: day),
                      let end = cal.date(bySettingHour: window.end.0, minute: window.end.1, second: 0, of: day),
                      start > .now else { continue }
                if calendarConnected {
                    let busy = store.events(matching: store.predicateForEvents(withStart: start, end: end, calendars: nil))
                        .contains { !$0.isAllDay && $0.availability != .free }
                    if busy { continue }
                }
                slots.append(Slot(start: start, meal: window.meal))
            }
        }
        return slots
    }

    // MARK: Picks

    /// Your Want to try places (closest first) and friends' 8+ spots you
    /// haven't been to (best first), taking turns, all near you. Without
    /// your location, "near" means near the places already on your list.
    func recs(book: EatsBook) -> [Rec] {
        let center = here ?? Self.middle(of: book.ranked)
        func near(_ place: EatsPlace) -> CLLocationDistance? {
            guard let c = place.coordinate else { return nil }
            guard let center else { return 0 }
            let d = center.distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude))
            return d <= Self.radius ? d : nil
        }

        let wishes = book.wishlist.compactMap { place in near(place).map { (place, $0) } }
            .sorted { $0.1 < $1.1 }
            .map { Rec(place: $0.0, friend: nil, score: nil) }

        var friendPicks: [Rec] = []
        for friend in book.friends {
            let scores = friend.scores
            for place in friend.places {
                guard let score = scores[place.id], score >= 8, near(place) != nil,
                      !book.mine.contains(where: { $0.isSamePlace(as: place) }) else { continue }
                if let i = friendPicks.firstIndex(where: { $0.place.isSamePlace(as: place) }) {
                    if score > (friendPicks[i].score ?? 0) { friendPicks[i] = Rec(place: place, friend: friend, score: score) }
                } else {
                    friendPicks.append(Rec(place: place, friend: friend, score: score))
                }
            }
        }
        friendPicks.sort { ($0.score ?? 0) > ($1.score ?? 0) }

        var mixed: [Rec] = []
        for i in 0..<max(wishes.count, friendPicks.count) {
            if i < wishes.count { mixed.append(wishes[i]) }
            if i < friendPicks.count { mixed.append(friendPicks[i]) }
        }
        return mixed
    }

    private static func middle(of places: [EatsPlace]) -> CLLocation? {
        let coords = places.compactMap(\.coordinate)
        guard !coords.isEmpty else { return nil }
        return CLLocation(latitude: coords.map(\.latitude).reduce(0, +) / Double(coords.count),
                          longitude: coords.map(\.longitude).reduce(0, +) / Double(coords.count))
    }

    private func currentLocation() async -> CLLocation? {
        do {
            for try await update in CLLocationUpdate.liveUpdates() {
                if let location = update.location { return location }
                if update.authorizationDenied || update.authorizationRestricted { return nil }
            }
        } catch {}
        return nil
    }

    // MARK: Calendar

    func addToCalendar(_ rec: Rec, at slot: Slot) -> Bool {
        guard calendarConnected, let calendar = store.defaultCalendarForNewEvents else { return false }
        let event = EKEvent(eventStore: store)
        event.title = "\(slot.meal) at \(rec.place.name)"
        event.startDate = slot.start
        event.endDate = slot.start.addingTimeInterval(90 * 60)
        event.calendar = calendar
        event.location = rec.place.address.isEmpty ? rec.place.name : "\(rec.place.name), \(rec.place.address)"
        if let c = rec.place.coordinate {
            let location = EKStructuredLocation(title: rec.place.name)
            location.geoLocation = CLLocation(latitude: c.latitude, longitude: c.longitude)
            event.structuredLocation = location
        }
        event.url = rec.place.tripPlace?.mapsURL
        if let friend = rec.friend, let score = rec.score {
            event.notes = "\(friend.name) rated it \(score.formatted(.number.precision(.fractionLength(1)))) on Eats."
        }
        do {
            try store.save(event, span: .thisEvent)
            return true
        } catch {
            lastError = "Couldn't add it to Calendar: \(error.localizedDescription)"
            return false
        }
    }
}

/// The card at the top of Eats.
struct WeekendCard: View {
    @State private var planner = WeekendPlanner.shared
    @State private var book = EatsBook.shared
    @State private var shuffle = 0
    @State private var added: [String] = []

    var body: some View {
        let recs = planner.recs(book: book)
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("This weekend", systemImage: "calendar").font(.headline).foregroundStyle(Theme.text)
                Spacer()
                if recs.count > planner.slots.count || (planner.slots.isEmpty && recs.count > 1) {
                    Button("Shuffle", systemImage: "shuffle") { withAnimation(.snappy) { shuffle += 1 } }
                        .labelStyle(.iconOnly).font(.subheadline.weight(.semibold))
                }
            }

            if !planner.calendarConnected && planner.calendarAccess != .denied {
                Button {
                    Task { await planner.connectCalendar() }
                } label: {
                    Label("Connect Apple Calendar to find your free time", systemImage: "calendar.badge.clock")
                        .font(.subheadline.weight(.medium))
                }
            }

            if recs.isEmpty {
                Text("Save places to Want to try, or follow friends, and picks near you show up here.")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
            } else if planner.slots.isEmpty {
                Text(planner.calendarConnected ? "Your weekend looks full. Some ideas for next time:" : "Ideas for the weekend:")
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                ForEach(Array(rotated(recs).prefix(3))) { rec in row(rec, slot: nil) }
            } else {
                let picks = rotated(recs)
                ForEach(Array(planner.slots.prefix(4).enumerated()), id: \.element.id) { index, slot in
                    if index < picks.count { row(picks[index], slot: slot) }
                }
            }
        }
        .card()
        .task { await planner.refresh() }
        .alert("Calendar", isPresented: Binding(get: { planner.lastError != nil }, set: { if !$0 { planner.lastError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(planner.lastError ?? "")
        }
    }

    private func rotated(_ recs: [WeekendPlanner.Rec]) -> [WeekendPlanner.Rec] {
        guard !recs.isEmpty else { return [] }
        let offset = (shuffle * max(planner.slots.count, 1)) % recs.count
        return Array(recs[offset...] + recs[..<offset])
    }

    private func row(_ rec: WeekendPlanner.Rec, slot: WeekendPlanner.Slot?) -> some View {
        HStack(spacing: 12) {
            if let friend = rec.friend {
                FriendAvatar(friend: friend, size: 34)
            } else {
                Image(systemName: "bookmark.fill").font(.subheadline).foregroundStyle(.white)
                    .frame(width: 34, height: 34).background(Color(hex: "#f97316").gradient, in: Circle())
            }
            VStack(alignment: .leading, spacing: 2) {
                if let slot {
                    Text(slot.label.uppercased()).font(.caption2.weight(.bold)).tracking(0.6).foregroundStyle(Theme.brand)
                }
                Text(rec.place.name).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text).lineLimit(1)
                Text(reason(rec)).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Spacer(minLength: 8)
            if let slot {
                let key = rec.id + "\(slot.start.timeIntervalSince1970)"
                Button {
                    if !planner.calendarConnected {
                        Task { await planner.connectCalendar() }
                    } else if planner.addToCalendar(rec, at: slot) {
                        added.append(key)
                    }
                } label: {
                    Image(systemName: added.contains(key) ? "checkmark" : "calendar.badge.plus")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.bordered).buttonBorderShape(.circle)
                .accessibilityLabel("Add to Calendar")
            } else if let url = rec.place.tripPlace?.mapsURL {
                Link(destination: url) { Image(systemName: "map").font(.subheadline.weight(.semibold)) }
                    .buttonStyle(.bordered).buttonBorderShape(.circle)
                    .accessibilityLabel("Open in Apple Maps")
            }
        }
    }

    private func reason(_ rec: WeekendPlanner.Rec) -> String {
        if let friend = rec.friend, let score = rec.score {
            return "\(friend.name) · \(score.formatted(.number.precision(.fractionLength(1))))"
        }
        return rec.place.address.isEmpty ? "On your Want to try" : "Want to try · \(rec.place.address)"
    }
}
