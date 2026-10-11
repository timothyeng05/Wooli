import SwiftUI
import MapKit
import CloudKit

/// Wraps a trip id so trip screens can be pushed or presented without
/// clashing with other `String` navigation values.
struct TripRoute: Identifiable, Hashable {
    let id: String
}

// MARK: - Trip list

struct TripsListView: View {
    @State private var store = TripStore.shared
    @State private var newTrip: Trip?

    var body: some View {
        let today = DayKey.key(.now)
        let upcoming = store.trips.filter { $0.endDay >= today }.sorted { $0.startDay < $1.startDay }
        let past = store.trips.filter { $0.endDay < today }.sorted { $0.startDay > $1.startDay }

        List {
            if !store.iCloudAvailable {
                Section {
                    Label("Sign in to iCloud in Settings to sync trips and invite people. Your trips are saved on this iPhone for now.",
                          systemImage: "icloud.slash")
                        .font(.footnote).foregroundStyle(Theme.textSecondary)
                }
            }
            if store.trips.isEmpty {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "suitcase.rolling.fill").font(.system(size: 40)).foregroundStyle(Theme.brand)
                        Text("Plan a trip together").font(.headline)
                        Text("Collect ideas, plan each day on Apple Maps, and invite someone to plan it with you — they join with their own Apple Account.")
                            .font(.subheadline).foregroundStyle(Theme.textSecondary).multilineTextAlignment(.center)
                        Button("New trip") { newTrip = Trip() }
                            .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
            }
            if !upcoming.isEmpty {
                Section("Upcoming") { ForEach(upcoming) { row($0) } }
            }
            if !past.isEmpty {
                Section("Past") { ForEach(past) { row($0) } }
            }
        }
        .navigationTitle("Trips")
        .toolbar {
            Button("New trip", systemImage: "plus") { newTrip = Trip() }
        }
        .sheet(item: $newTrip) { TripEditor(trip: $0) }
        .refreshable { await store.fetchChanges() }
    }

    private func row(_ trip: Trip) -> some View {
        NavigationLink {
            TripDetailView(tripID: trip.id)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "suitcase.fill")
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Theme.brand.gradient, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(trip.name.isEmpty ? "Untitled trip" : trip.name).font(.body.weight(.medium))
                    Text([trip.destination, trip.dateRangeText].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if !trip.isMine || trip.isShared {
                    Image(systemName: "person.2.fill").font(.caption).foregroundStyle(Theme.textTertiary)
                        .accessibilityLabel("Shared")
                }
            }
        }
    }
}

// MARK: - Trip editor

struct TripEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var trip: Trip
    @State private var start: Date
    @State private var end: Date
    private let isNew: Bool

    init(trip: Trip) {
        _trip = State(initialValue: trip)
        _start = State(initialValue: DayKey.date(trip.startDay))
        _end = State(initialValue: DayKey.date(trip.endDay))
        isNew = TripStore.shared.trip(trip.id) == nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Trip name", text: $trip.name, prompt: Text("e.g. Japan in spring"))
                    TextField("Destination", text: $trip.destination, prompt: Text("e.g. Tokyo & Kyoto"))
                } footer: {
                    Text("The destination helps Apple Maps find places nearby.")
                }
                Section {
                    DatePicker("Starts", selection: $start, displayedComponents: .date)
                    DatePicker("Ends", selection: $end, in: start..., displayedComponents: .date)
                }
                Section("Notes") {
                    TextField("Flights, budget, anything", text: $trip.notes, axis: .vertical).lineLimit(2...6)
                }
            }
            .navigationTitle(isNew ? "New trip" : "Edit trip")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        trip.name = trip.name.trimmingCharacters(in: .whitespaces)
                        trip.startDay = DayKey.key(start)
                        trip.endDay = DayKey.key(max(end, start))
                        TripStore.shared.save(trip)
                        dismiss()
                    }
                    .disabled(trip.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Trip detail

struct TripDetailView: View {
    let tripID: String
    @State private var store = TripStore.shared
    @State private var editingItem: TripItem?
    @State private var editingTrip: Trip?
    @State private var dayMap: String?
    @State private var preparingShare = false
    @State private var confirmDelete = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let trip = store.trip(tripID) {
            content(trip)
        } else {
            ContentUnavailableView("Trip not available", systemImage: "suitcase",
                                   description: Text("It may have been deleted, or you're no longer part of it."))
        }
    }

    private func content(_ trip: Trip) -> some View {
        let days = trip.days
        let ideas = store.items(in: trip.id).filter { $0.day.map { !days.contains($0) } ?? true }
            .sorted { $0.createdAt < $1.createdAt }
        let placed = store.items(in: trip.id).filter { $0.place != nil }

        return ScrollView {
            VStack(spacing: 16) {
                header(trip, dayCount: days.count)

                if !placed.isEmpty {
                    TripMap(stops: placed.map { TripMap.Stop(item: $0, label: nil) })
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }

                ideasCard(trip, ideas: ideas)

                ForEach(Array(days.enumerated()), id: \.element) { index, day in
                    dayCard(trip, day: day, number: index + 1)
                }
            }
            .padding(16)
        }
        .pageBackground()
        .navigationTitle(trip.name.isEmpty ? "Trip" : trip.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.fetchChanges() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(trip.isMine && !trip.isShared ? "Invite" : "People", systemImage: "person.crop.circle.badge.plus") {
                    invite(trip)
                }
                .disabled(preparingShare)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu("More", systemImage: "ellipsis") {
                    Button("Edit trip", systemImage: "pencil") { editingTrip = trip }
                    Button(trip.isMine ? "Delete trip" : "Leave trip", systemImage: trip.isMine ? "trash" : "rectangle.portrait.and.arrow.right",
                           role: .destructive) { confirmDelete = true }
                }
            }
        }
        .sheet(item: $editingItem) { TripItemEditor(item: $0, trip: trip) }
        .sheet(item: $editingTrip) { TripEditor(trip: $0) }
        .sheet(item: Binding(get: { dayMap.map(TripRoute.init) }, set: { dayMap = $0?.id })) { route in
            DayMapView(trip: trip, day: route.id)
        }
        .confirmationDialog(trip.isMine ? "Delete \(trip.name)?" : "Leave \(trip.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button(trip.isMine ? "Delete trip" : "Leave trip", role: .destructive) {
                store.delete(trip)
                dismiss()
            }
        } message: {
            Text(trip.isMine ? "This deletes the trip for everyone you've shared it with." : "You'll need a new invite to join again.")
        }
        .overlay {
            if preparingShare { ProgressView().controlSize(.large).padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)) }
        }
    }

    private func header(_ trip: Trip, dayCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if !trip.destination.isEmpty {
                Label(trip.destination, systemImage: "mappin.and.ellipse").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brand)
            }
            Text(trip.dateRangeText).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
            HStack(spacing: 6) {
                Text("\(dayCount) day\(dayCount == 1 ? "" : "s")")
                if !trip.isMine {
                    Text("·")
                    Label("Shared with you", systemImage: "person.2.fill")
                } else if trip.isShared {
                    Text("·")
                    Label("Shared", systemImage: "person.2.fill")
                }
            }
            .font(.footnote).foregroundStyle(Theme.textSecondary)
            if !trip.notes.isEmpty {
                Text(trip.notes).font(.footnote).foregroundStyle(Theme.textSecondary).padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func ideasCard(_ trip: Trip, ideas: [TripItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Ideas", subtitle: "Places to fit in somewhere") {
                Button("Add", systemImage: "plus") { editingItem = TripItem(tripID: trip.id, day: nil) }
                    .font(.subheadline.weight(.medium)).labelStyle(.titleAndIcon)
            }
            if ideas.isEmpty {
                Text("Save restaurants, sights and shops here, then move them onto a day.")
                    .font(.footnote).foregroundStyle(Theme.textTertiary)
            }
            ForEach(ideas) { item in itemRow(item, trip: trip) }
        }
        .card()
    }

    private func dayCard(_ trip: Trip, day: String, number: Int) -> some View {
        let dayItems = store.items(in: trip.id, day: day)
        let date = DayKey.date(day)
        return VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Day \(number)", subtitle: date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())) {
                HStack(spacing: 14) {
                    if dayItems.contains(where: { $0.place != nil }) {
                        Button("Map", systemImage: "map") { dayMap = day }.labelStyle(.iconOnly)
                    }
                    Button("Add", systemImage: "plus") { editingItem = TripItem(tripID: trip.id, day: day) }.labelStyle(.iconOnly)
                }
                .font(.body.weight(.medium))
            }
            if dayItems.isEmpty {
                Text("Nothing planned yet").font(.footnote).foregroundStyle(Theme.textTertiary)
            }
            ForEach(dayItems) { item in itemRow(item, trip: trip) }
        }
        .card()
    }

    private func itemRow(_ item: TripItem, trip: Trip) -> some View {
        Button { editingItem = item } label: { TripItemRow(item: item) }
            .buttonStyle(.plain)
            .contextMenu {
                if let url = item.place?.mapsURL {
                    Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
                }
                Menu("Move to", systemImage: "calendar") {
                    Button("Ideas") { move(item, to: nil) }
                    ForEach(Array(trip.days.enumerated()), id: \.element) { i, day in
                        Button("Day \(i + 1) · \(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).day()))") { move(item, to: day) }
                    }
                }
                Button("Delete", systemImage: "trash", role: .destructive) { store.delete(item) }
            }
    }

    private func move(_ item: TripItem, to day: String?) {
        var item = item
        item.day = day
        store.save(item)
    }

    private func invite(_ trip: Trip) {
        guard store.iCloudAvailable else {
            store.lastError = "Sign in to iCloud in Settings to invite people to this trip."
            return
        }
        preparingShare = true
        Task {
            defer { preparingShare = false }
            do {
                let share = try await store.share(for: trip)
                TripSharingPresenter.present(share: share, container: store.container, trip: trip)
            } catch {
                store.lastError = "Couldn't set up sharing: \(error.localizedDescription)"
            }
        }
    }
}

struct TripItemRow: View {
    let item: TripItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.kind.symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Color(hex: item.kind.colorHex))
                .frame(width: 32, height: 32)
                .background(Color(hex: item.kind.colorHex).opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title)
                    .font(.subheadline.weight(.medium)).foregroundStyle(Theme.text)
                if let place = item.place, place.name != item.title || !place.address.isEmpty {
                    Text(place.name == item.title ? place.address : place.name)
                        .font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                }
                if !item.notes.isEmpty {
                    Text(item.notes).font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(2)
                }
            }
            Spacer(minLength: 8)
            if let time = item.timeText {
                Text(time).font(.caption.weight(.medium)).monospacedDigit().foregroundStyle(Theme.textSecondary)
            }
        }
        .contentShape(Rectangle())
    }
}

// MARK: - Item editor

struct TripItemEditor: View {
    let trip: Trip
    private let isNew: Bool
    @State private var item: TripItem
    @State private var hasTime: Bool
    @State private var time: Date
    @Environment(\.dismiss) private var dismiss

    init(item: TripItem, trip: Trip) {
        self.trip = trip
        isNew = !TripStore.shared.items.contains { $0.id == item.id }
        _item = State(initialValue: item)
        _hasTime = State(initialValue: item.time != nil)
        let minutes = item.time ?? 12 * 60
        _time = State(initialValue: Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: .now) ?? .now)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Type", selection: $item.kind) {
                        ForEach(TripItem.Kind.allCases) { kind in
                            Image(systemName: kind.symbol).tag(kind).accessibilityLabel(kind.label)
                        }
                    }
                    .pickerStyle(.segmented)
                    TextField("Title", text: $item.title, prompt: Text(item.place?.name ?? "e.g. Dinner, Museum, Train to Kyoto"))
                }

                Section("Place") {
                    if let place = item.place {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(place.name)
                                if !place.address.isEmpty {
                                    Text(place.address).font(.caption).foregroundStyle(Theme.textSecondary)
                                }
                            }
                            Spacer()
                            if let url = place.mapsURL {
                                Link(destination: url) { Image(systemName: "arrow.up.right.square") }
                                    .accessibilityLabel("Open in Apple Maps")
                            }
                        }
                        Button("Remove place", role: .destructive) { item.place = nil }
                    }
                    NavigationLink {
                        PlaceSearchView(near: trip.destination) { place in
                            item.place = place
                        }
                    } label: {
                        Label(item.place == nil ? "Find on Apple Maps" : "Change place", systemImage: "magnifyingglass")
                    }
                }

                Section("When") {
                    Picker("Day", selection: $item.day) {
                        Text("Ideas · no day yet").tag(String?.none)
                        ForEach(Array(trip.days.enumerated()), id: \.element) { i, day in
                            Text("Day \(i + 1) · \(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))")
                                .tag(String?.some(day))
                        }
                    }
                    if item.day != nil {
                        Toggle("Set a time", isOn: $hasTime.animation())
                        if hasTime {
                            DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                        }
                    }
                }

                Section("Notes") {
                    TextField("Booking number, what to order…", text: $item.notes, axis: .vertical).lineLimit(2...6)
                }

                if !isNew {
                    Section {
                        Button("Delete", role: .destructive) {
                            TripStore.shared.delete(item)
                            dismiss()
                        }
                    }
                }
            }
            .navigationTitle(isNew ? "Add to trip" : "Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(item.title.trimmingCharacters(in: .whitespaces).isEmpty && item.place == nil)
                }
            }
        }
    }

    private func save() {
        item.title = item.title.trimmingCharacters(in: .whitespaces)
        if item.title.isEmpty, let place = item.place { item.title = place.name }
        if hasTime && item.day != nil {
            let c = Calendar.current.dateComponents([.hour, .minute], from: time)
            item.time = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        } else {
            item.time = nil
        }
        TripStore.shared.save(item)
        dismiss()
    }
}

// MARK: - Apple Maps place search

struct PlaceSearchView: View {
    let near: String
    let onPick: (TripPlace) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var searcher = PlaceSearcher()
    @FocusState private var searchFocused: Bool

    var body: some View {
        List {
            ForEach(searcher.results, id: \.self) { mapItem in
                Button { pick(mapItem) } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(mapItem.name ?? "Place").foregroundStyle(Theme.text)
                        if let address = mapItem.address?.shortAddress ?? mapItem.address?.fullAddress {
                            Text(address).font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
            if !query.isEmpty && searcher.nearDestinationOnly {
                Button("Not here? Search everywhere", systemImage: "globe") { searcher.searchEverywhere(query) }
                    .font(.subheadline)
            }
        }
        .overlay {
            if query.isEmpty {
                ContentUnavailableView("Search Apple Maps", systemImage: "map",
                                       description: Text(near.isEmpty ? "Restaurants, sights, hotels, addresses." : "Searching in and around \(near)."))
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search places")
        .searchFocused($searchFocused)
        .onAppear { searchFocused = true }
        .onChange(of: query) { _, text in searcher.search(text) }
        .task { await searcher.focus(on: near) }
        .navigationTitle("Find a place")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func pick(_ mapItem: MKMapItem) {
        let coordinate = mapItem.location.coordinate
        onPick(TripPlace(name: mapItem.name ?? query,
                         address: mapItem.address?.shortAddress ?? mapItem.address?.fullAddress ?? "",
                         latitude: coordinate.latitude, longitude: coordinate.longitude,
                         mapItemID: mapItem.identifier?.rawValue ?? ""))
        dismiss()
    }
}

/// Apple Maps search kept to the trip's destination and sorted by distance
/// from it — the system only *biases* toward a region, so places near the
/// phone would otherwise come first.
@MainActor
@Observable
final class PlaceSearcher {
    private(set) var results: [MKMapItem] = []
    /// Results limited to the destination's area.
    private(set) var nearDestinationOnly = false
    @ObservationIgnored private var region: MKCoordinateRegion?
    @ObservationIgnored private var task: Task<Void, Never>?

    func focus(on destination: String) async {
        guard !destination.isEmpty else { return }
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = destination
        if let response = try? await MKLocalSearch(request: request).start() {
            region = response.boundingRegion
            nearDestinationOnly = true
        }
    }

    func search(_ text: String) {
        task?.cancel()
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else {
            results = []
            return
        }
        task = Task {
            try? await Task.sleep(for: .milliseconds(300)) // wait for typing to pause
            guard !Task.isCancelled else { return }
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = text
            request.resultTypes = [.pointOfInterest, .address]
            var center: CLLocation?
            if nearDestinationOnly, let region {
                request.region = region
                request.regionPriority = .required
                center = CLLocation(latitude: region.center.latitude, longitude: region.center.longitude)
            }
            let items = (try? await MKLocalSearch(request: request).start().mapItems) ?? []
            guard !Task.isCancelled else { return }
            results = center.map { c in items.sorted { $0.location.distance(from: c) < $1.location.distance(from: c) } } ?? items
        }
    }

    /// For places outside the destination, like a day trip.
    func searchEverywhere(_ text: String) {
        nearDestinationOnly = false
        search(text)
    }
}

// MARK: - Maps

struct TripMap: View {
    struct Stop: Identifiable {
        let item: TripItem
        /// Number shown in the pin (day order); nil shows the item's icon.
        let label: Int?
        var id: String { item.id }
    }

    let stops: [Stop]
    var routes: [MKRoute] = []

    var body: some View {
        Map(initialPosition: .automatic) {
            ForEach(routes, id: \.self) { route in
                MapPolyline(route.polyline).stroke(Theme.brand.opacity(0.7), lineWidth: 4)
            }
            ForEach(stops) { stop in
                if let place = stop.item.place {
                    let coordinate = CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)
                    if let label = stop.label {
                        Marker(stop.item.title, monogram: Text("\(label)"), coordinate: coordinate)
                            .tint(Color(hex: stop.item.kind.colorHex))
                    } else {
                        Marker(stop.item.title, systemImage: stop.item.kind.symbol, coordinate: coordinate)
                            .tint(Color(hex: stop.item.kind.colorHex))
                    }
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
    }
}

/// One day on the map: numbered stops in order, the route between them, and
/// how long each hop takes (walking for short hops, driving for longer ones).
struct DayMapView: View {
    let trip: Trip
    let day: String
    @State private var legs: [Leg] = []
    @Environment(\.dismiss) private var dismiss

    struct Leg: Identifiable {
        let from: TripItem
        let to: TripItem
        let route: MKRoute
        var id: String { from.id + to.id }
    }

    var body: some View {
        let stops = TripStore.shared.items(in: trip.id, day: day).filter { $0.place != nil }
        NavigationStack {
            VStack(spacing: 0) {
                TripMap(stops: stops.enumerated().map { TripMap.Stop(item: $1, label: $0 + 1) }, routes: legs.map(\.route))
                    .frame(maxHeight: .infinity)
                List {
                    ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                        HStack {
                            Text("\(index + 1)").font(.caption.weight(.bold)).foregroundStyle(.white)
                                .frame(width: 22, height: 22).background(Color(hex: stop.kind.colorHex), in: Circle())
                            Text(stop.title).lineLimit(1)
                            Spacer()
                            if let url = stop.place?.mapsURL {
                                Link(destination: url) { Image(systemName: "arrow.triangle.turn.up.right.diamond.fill") }
                                    .accessibilityLabel("Directions in Apple Maps")
                            }
                        }
                        if let leg = legs.first(where: { $0.from.id == stop.id }) {
                            Label(legText(leg.route), systemImage: leg.route.transportType == .walking ? "figure.walk" : "car.fill")
                                .font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
                .listStyle(.plain)
                .frame(height: 280)
            }
            .navigationTitle(DayKey.date(day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { legs = await Self.routes(between: stops) }
        }
    }

    private func legText(_ route: MKRoute) -> String {
        let minutes = Int((route.expectedTravelTime / 60).rounded())
        let duration = minutes < 60 ? "\(minutes) min" : "\(minutes / 60) h \(minutes % 60) min"
        return "\(duration) \(route.transportType == .walking ? "walk" : "drive") to next stop"
    }

    private static func routes(between stops: [TripItem]) async -> [Leg] {
        var legs: [Leg] = []
        for (from, to) in zip(stops, stops.dropFirst()).prefix(12) {
            guard let a = from.place, let b = to.place else { continue }
            let start = CLLocation(latitude: a.latitude, longitude: a.longitude)
            let end = CLLocation(latitude: b.latitude, longitude: b.longitude)
            let request = MKDirections.Request()
            request.source = MKMapItem(location: start, address: nil)
            request.destination = MKMapItem(location: end, address: nil)
            request.transportType = start.distance(from: end) < 2000 ? .walking : .automobile
            if let route = try? await MKDirections(request: request).calculate().routes.first {
                legs.append(Leg(from: from, to: to, route: route))
            }
        }
        return legs
    }
}
