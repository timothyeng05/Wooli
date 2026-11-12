#if os(macOS)
import MapKit
import SwiftUI

/// The field at the top of the plan: type a place, press Return, and it's on
/// the day, ready for the next. ⌘N focuses it; Tab switches between the day
/// and Ideas.
struct QuickAddBar: View {
    let trip: Trip
    /// The day new plans go on; nil = Ideas.
    let day: String?
    var focus: FocusState<Bool>.Binding
    /// Opens the full editor for a flight, with its number filled in.
    let onFlight: (TripItem) -> Void
    /// Called with the new plan's id (⌥Return opens it in the inspector).
    let onAdded: (String, _ openInspector: Bool) -> Void

    @State private var store = TripStore.shared
    @State private var eats = EatsBook.shared
    @State private var searcher = PlaceSearcher()
    @State private var text = ""
    @State private var highlight = 0
    @State private var toIdeas = false
    @State private var resolving = false

    private enum Choice: Identifiable {
        case flight(String)
        case saved(EatsPlace)
        case suggestion(MKLocalSearchCompletion)
        case bare(String)

        var id: String {
            switch self {
            case .flight(let n): "flight-\(n)"
            case .saved(let p): "saved-\(p.id)"
            case .suggestion(let s): "s-\(s.title)|\(s.subtitle)"
            case .bare(let t): "bare-\(t)"
            }
        }
    }

    private var request: QuickAddRequest { QuickAddParser.parse(text) }
    private var target: String? { toIdeas ? nil : day }

    private var targetName: String {
        guard let target else { return "Ideas" }
        return DayKey.date(target).formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated))
    }

    /// The leg the new plan lands in, to keep searches in that city.
    private var leg: TripLeg? { target.flatMap { trip.leg(for: $0) } ?? trip.awayLegs.first }

    private var choices: [Choice] {
        let r = request
        guard !r.query.isEmpty || r.flightNumber != nil else { return [] }
        var list: [Choice] = []
        if let flight = r.flightNumber { list.append(.flight(flight)) }
        let q = r.query.lowercased()
        // Places you already saved for this city come first.
        list += eats.wishlist.filter { place in
            q.count >= 2 && place.name.lowercased().contains(q) && isInLeg(place)
        }.prefix(2).map(Choice.saved)
        list += searcher.suggestions.prefix(5).map(Choice.suggestion)
        if !r.query.isEmpty { list.append(.bare(r.query)) }
        return list
    }

    private func isInLeg(_ place: EatsPlace) -> Bool {
        guard let leg else { return true }
        if let lat = leg.latitude, let lon = leg.longitude, let c = place.coordinate {
            return CLLocation(latitude: lat, longitude: lon).distance(from: CLLocation(latitude: c.latitude, longitude: c.longitude)) < 80_000
        }
        return leg.name.isEmpty || place.address.localizedCaseInsensitiveContains(leg.name)
    }

    var body: some View {
        let list = choices
        VStack(spacing: 0) {
            HStack(spacing: Space.s) {
                Image(systemName: "plus.circle.fill").foregroundStyle(Theme.brand)
                TextField("Add to \(targetName)…", text: $text)
                    .textFieldStyle(.plain)
                    .focused(focus)
                    .onSubmit { commit(list) }
                    .onKeyPress(.downArrow) { move(1, count: list.count) }
                    .onKeyPress(.upArrow) { move(-1, count: list.count) }
                    .onKeyPress(.tab) { toIdeas.toggle(); return .handled }
                    .onKeyPress(.escape) { escape() }
                if resolving { ProgressView().controlSize(.small) }
                Text(toIdeas ? "Ideas" : targetName)
                    .font(.caption.weight(.semibold)).foregroundStyle(Theme.brand)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.brand.opacity(0.12), in: Capsule())
                    .help("Where it goes. Press Tab to switch between this day and Ideas.")
            }
            .padding(.horizontal, Space.m).padding(.vertical, Space.s)
            if !list.isEmpty {
                Divider()
                ForEach(Array(list.enumerated()), id: \.element.id) { i, choice in
                    Button { highlight = i; commit(list) } label: { row(choice, selected: i == highlight) }
                        .buttonStyle(.plain)
                }
            }
        }
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
            .strokeBorder(focus.wrappedValue ? Theme.brand : Theme.border, lineWidth: focus.wrappedValue ? 2 : 1))
        .padding(.horizontal, Space.m).padding(.top, Space.s).padding(.bottom, Space.xs)
        .onChange(of: text) { _, new in
            highlight = 0
            searcher.search(QuickAddParser.parse(new).query)
        }
        .task(id: leg?.id) { await focusSearch() }
    }

    // MARK: Rows

    private func row(_ choice: Choice, selected: Bool) -> some View {
        HStack(spacing: Space.s) {
            switch choice {
            case .flight(let number):
                icon("airplane", Theme.Group.travel.color)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Flight \(number)").foregroundStyle(Theme.text)
                    Text("Opens the ticket to fill in").font(.caption).foregroundStyle(Theme.textSecondary)
                }
            case .saved(let place):
                icon("star.fill", Theme.brand)
                VStack(alignment: .leading, spacing: 0) {
                    Text(place.name).foregroundStyle(Theme.text)
                    Text("On your Want to Try list").font(.caption).foregroundStyle(Theme.textSecondary)
                }
            case .suggestion(let s):
                icon("mappin.circle.fill", Theme.textTertiary)
                VStack(alignment: .leading, spacing: 0) {
                    Text(s.title).foregroundStyle(Theme.text).lineLimit(1)
                    if !s.subtitle.isEmpty { Text(s.subtitle).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1) }
                }
            case .bare(let t):
                icon("text.cursor", Theme.textTertiary)
                Text("Add \u{201C}\(t)\u{201D} without a place").foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Spacer()
            if selected { Text("↩").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary) }
        }
        .padding(.horizontal, Space.m).padding(.vertical, 5)
        .background(selected ? Theme.brand.opacity(0.1) : .clear)
        .contentShape(Rectangle())
    }

    private func icon(_ name: String, _ color: Color) -> some View {
        Image(systemName: name).foregroundStyle(color).frame(width: 20)
    }

    // MARK: Keys

    private func move(_ step: Int, count: Int) -> KeyPress.Result {
        guard count > 0 else { return .ignored }
        highlight = min(max(highlight + step, 0), count - 1)
        return .handled
    }

    private func escape() -> KeyPress.Result {
        if text.isEmpty { focus.wrappedValue = false } else { text = ""; searcher.search("") }
        return .handled
    }

    // MARK: Adding

    private func focusSearch() async {
        if let lat = leg?.latitude, let lon = leg?.longitude {
            searcher.focus(near: CLLocationCoordinate2D(latitude: lat, longitude: lon))
        } else if let leg, !leg.name.isEmpty {
            await searcher.focus(on: [leg.name, trip.destination].filter { !$0.isEmpty }.joined(separator: ", "))
        } else {
            await searcher.focus(on: trip.destination)
        }
    }

    private func commit(_ list: [Choice]) {
        guard !resolving, !list.isEmpty else { return }
        let openInspector = NSEvent.modifierFlags.contains(.option)
        let choice = list[min(highlight, list.count - 1)]
        let r = request
        switch choice {
        case .flight(let number):
            var item = TripItem(tripID: trip.id, day: target, kind: .transit, title: "Flight \(number)")
            var transport = TripTransport(mode: .flight)
            transport.flightNumber = number
            item.transport = transport
            item.time = r.time
            clear()
            onFlight(item)
        case .saved(let place):
            let spot = TripPlace(name: place.name, address: place.address, latitude: place.coordinate?.latitude ?? 0,
                                 longitude: place.coordinate?.longitude ?? 0, mapItemID: place.mapItemID)
            add(title: place.name, place: place.coordinate == nil ? nil : spot, kind: r.kind ?? .meal, request: r, openInspector: openInspector)
        case .suggestion(let suggestion):
            resolving = true
            Task {
                defer { resolving = false }
                if let item = await searcher.resolve(suggestion) {
                    let c = item.location.coordinate
                    let spot = TripPlace(name: item.name ?? suggestion.title,
                                         address: item.address?.shortAddress ?? item.address?.fullAddress ?? "",
                                         latitude: c.latitude, longitude: c.longitude,
                                         mapItemID: item.identifier?.rawValue ?? "")
                    add(title: spot.name, place: spot, kind: r.kind ?? QuickAddParser.kind(forCategory: item.pointOfInterestCategory),
                        request: r, openInspector: openInspector)
                } else {
                    add(title: suggestion.title, place: nil, kind: r.kind ?? .activity, request: r, openInspector: openInspector)
                }
            }
        case .bare(let t):
            add(title: t, place: nil, kind: r.kind ?? .activity, request: r, openInspector: openInspector)
        }
    }

    private func add(title: String, place: TripPlace?, kind: TripItem.Kind, request r: QuickAddRequest, openInspector: Bool) {
        var item = TripItem(tripID: trip.id, day: target, kind: kind, title: title)
        item.place = place
        item.time = r.time
        var extras = ItemExtras()
        extras.source = "quickAdd"
        item.extras = extras
        // An untimed plan goes after what's already placed that day.
        if item.time == nil, let target, let last = store.items(in: trip.id, day: target).last(where: { $0.sortKey < TripItem.untimedKey }) {
            item.order = last.sortKey + 15
        }
        withAnimation(.snappy) { store.save(item) }
        clear()
        onAdded(item.id, openInspector)
    }

    private func clear() {
        text = ""
        searcher.search("")
        focus.wrappedValue = true
    }
}
#endif
