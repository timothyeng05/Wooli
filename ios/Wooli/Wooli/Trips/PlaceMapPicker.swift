import MapKit
import SwiftUI

/// Pick a place by looking at a map, for when search doesn't turn it up:
/// tap one of the stations (or places) pinned in view, or move the map until
/// the centre pin sits on the spot. Opens on the trip leg being searched.
struct PlaceMapPicker: View {
    let near: String
    let onPick: (TripPlace) -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var region: MKCoordinateRegion?
    @State private var places: [MKMapItem] = []
    @State private var selection: Int?
    @State private var showStations: Bool
    @State private var loading = false
    @State private var resolving = false
    @State private var loadTask: Task<Void, Never>?
    /// The area last looked up, so redrawing the pins doesn't look it up again.
    @State private var loaded: MKCoordinateRegion?

    /// `start` is the area search already found for `near`, when it has.
    init(near: String, start: MKCoordinateRegion? = nil, stationsOnly: Bool = true,
         onPick: @escaping (TripPlace) -> Void) {
        self.near = near
        self.onPick = onPick
        _showStations = State(initialValue: stationsOnly)
        // A whole country or province is too far out to show stations; then
        // look up the first city instead.
        if let start, start.span.latitudeDelta < 0.6 { _position = State(initialValue: .region(start)) }
    }

    private var selected: MKMapItem? { selection.flatMap { places.indices.contains($0) ? places[$0] : nil } }

    var body: some View {
        Map(position: $position, selection: $selection) {
            ForEach(Array(places.enumerated()), id: \.offset) { i, item in
                Marker(item.name ?? "Place", systemImage: showStations ? "tram.fill" : "mappin",
                       coordinate: item.location.coordinate)
                    .tint(showStations ? Theme.accentBlue : Theme.accentRose)
                    .tag(i)
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapCompass()
            MapScaleView()
            #if os(macOS)
            MapZoomStepper()
            #endif
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            region = context.region
            reload()
        }
        .overlay {
            // The pin for "this spot", hidden while a listed place is picked.
            if selected == nil {
                Image(systemName: "mappin")
                    .font(.title.weight(.bold))
                    .foregroundStyle(Theme.text)
                    .shadow(radius: 2)
                    .offset(y: -14)
                    .allowsHitTesting(false)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            Picker("Show", selection: $showStations) {
                Text("Stations").tag(true)
                Text("All places").tag(false)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(maxWidth: 280)
            .padding(Space.s)
            .frame(maxWidth: .infinity)
            .background(.bar)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { card }
        .onChange(of: showStations) { _, _ in
            loaded = nil
            reload()
        }
        .task { await focus() }
        .navigationTitle("Pick on the map")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            if let selected {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selected.name ?? "Place").font(.headline).foregroundStyle(Theme.text)
                    if let address = selected.address?.shortAddress {
                        Text(address).font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                }
                Button { pick(selected) } label: {
                    Label("Use this place", systemImage: "checkmark").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            } else {
                // Fixed height: if the card resized, the map would move and look up again.
                HStack(spacing: Space.s) {
                    ProgressView().controlSize(.small).opacity(loading ? 1 : 0)
                    Text(hint).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .lineLimit(2, reservesSpace: true)
                }
                Button { Task { await pickCenter() } } label: {
                    Label("Use pinned spot", systemImage: "mappin.and.ellipse").frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(region == nil || resolving)
            }
        }
        .padding(Space.l)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial)
    }

    private var hint: String {
        let kind = showStations ? "station" : "place"
        if let region, region.span.latitudeDelta >= Self.maxSpan { return "Zoom in to see \(kind)s, or put the pin on the spot." }
        if !loading && places.isEmpty { return "No \(kind)s here. Zoom in or move the map, or put the pin on the spot." }
        return "Tap a \(kind), or move the map so the pin is on the spot."
    }

    /// Opens on the leg's city, or wherever the map lands by itself.
    private func focus() async {
        if let start = position.region {
            region = start
            reload()
            return
        }
        // A trip's name can list several cities ("Hong Kong, Chongqing, …"),
        // which Apple can't place as one; then open on the first.
        let first = near.split(separator: ",").first.map { $0.trimmingCharacters(in: .whitespaces) } ?? ""
        for query in [near, first] where !query.isEmpty {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            request.resultTypes = .address
            if let item = try? await MKLocalSearch(request: request).start().mapItems.first {
                let found = MKCoordinateRegion(center: item.location.coordinate,
                                               latitudinalMeters: 12_000, longitudinalMeters: 12_000)
                position = .region(found)
                // Moving the camera from code doesn't report a camera change.
                region = found
                reload()
                return
            }
        }
    }

    /// Stations (or all places) Apple Maps lists in the part of the map on screen.
    private func reload() {
        guard let region else { return }
        if let loaded, Self.same(loaded, region) { return }
        loadTask?.cancel()
        loaded = region
        // Further out than a city, there'd be too many to show (and Apple won't list them).
        guard region.span.latitudeDelta < Self.maxSpan else {
            loaded = nil
            places = []
            selection = nil
            return
        }
        loadTask = Task {
            // Wait for the map to settle; Apple limits how many lookups an app makes.
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            loading = true
            defer { loading = false }
            let items = await Self.places(in: region, stationsOnly: showStations)
            guard !Task.isCancelled else { return }
            let keep = selected
            places = items
            selection = keep.flatMap { k in items.firstIndex { $0.identifier == k.identifier && k.identifier != nil } }
        }
    }

    private static let maxSpan = 0.6

    /// Two map areas that differ by less than a few percent.
    private static func same(_ a: MKCoordinateRegion, _ b: MKCoordinateRegion) -> Bool {
        let tolerance = max(a.span.latitudeDelta, b.span.latitudeDelta) * 0.05
        return abs(a.center.latitude - b.center.latitude) < tolerance
            && abs(a.center.longitude - b.center.longitude) < tolerance
            && abs(a.span.latitudeDelta - b.span.latitudeDelta) < tolerance
    }

    /// Apple's points-of-interest list is thin in some countries (China
    /// especially), so stations also come from plain searches in the area.
    private static func places(in region: MKCoordinateRegion, stationsOnly: Bool) async -> [MKMapItem] {
        let poi = MKLocalPointsOfInterestRequest(coordinateRegion: region)
        if stationsOnly { poi.pointOfInterestFilter = MKPointOfInterestFilter(including: [.publicTransport]) }
        var searches = [MKLocalSearch(request: poi)]
        let queries = stationsOnly ? ["station"] : []
        for query in queries {
            let request = MKLocalSearch.Request()
            request.naturalLanguageQuery = query
            request.region = region
            request.resultTypes = .pointOfInterest
            if stationsOnly { request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.publicTransport]) }
            searches.append(MKLocalSearch(request: request))
        }
        let found = await withTaskGroup(of: [MKMapItem].self) { group in
            for search in searches { group.addTask { (try? await search.start().mapItems) ?? [] } }
            var all: [MKMapItem] = []
            for await items in group { all += items }
            return all
        }
        // Keep what's on screen, once each.
        let span = region.span, c = region.center
        var seen = Set<String>()
        return found.filter { item in
            let p = item.location.coordinate
            guard abs(p.latitude - c.latitude) <= span.latitudeDelta / 2,
                  abs(p.longitude - c.longitude) <= span.longitudeDelta / 2 else { return false }
            let key = item.identifier?.rawValue ?? "\(item.name ?? "")|\(Int(p.latitude * 1e4))|\(Int(p.longitude * 1e4))"
            return seen.insert(key).inserted
        }
    }

    private func pick(_ item: MKMapItem) {
        let c = item.location.coordinate
        onPick(TripPlace(name: item.name ?? "Place",
                         address: item.address?.shortAddress ?? item.address?.fullAddress ?? "",
                         latitude: c.latitude, longitude: c.longitude,
                         mapItemID: item.identifier?.rawValue ?? ""))
    }

    /// The pin's spot, named after its street address when Apple knows it.
    private func pickCenter() async {
        guard let center = region?.center else { return }
        resolving = true
        defer { resolving = false }
        let location = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let item = try? await MKReverseGeocodingRequest(location: location)?.mapItems.first
        let address = item?.address?.shortAddress ?? item?.address?.fullAddress ?? ""
        onPick(TripPlace(name: address.isEmpty ? "Pinned spot" : address, address: address,
                         latitude: center.latitude, longitude: center.longitude))
    }
}
