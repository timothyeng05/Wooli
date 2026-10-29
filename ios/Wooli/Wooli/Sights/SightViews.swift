import SwiftUI
import SwiftData
import MapKit

// MARK: - Your list

private enum SightTab: String, CaseIterable, Identifiable {
    case wantToGo = "Want to go", been = "Been"
    var id: String { rawValue }
}

/// Sights' main screen: places to see, split into Want to go and Been, grouped by city.
struct SightsListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \SightEntry.createdAt, order: .reverse) private var sights: [SightEntry]
    @State private var tab: SightTab = .wantToGo
    @State private var adding = false
    @State private var pickedPlace: TripPlace?
    @State private var detail: SightEntry?

    private static let otherCity = "Other places"

    private func hero() -> some View {
        let been = sights.filter(\.isVisited).count
        let cities = Set(sights.compactMap(\.city)).count
        let facts = ["\(been) been", "\(sights.count - been) to go", cities > 0 ? "\(cities) cit\(cities == 1 ? "y" : "ies")" : nil]
        return HeroCard(eyebrow: "Your sights") {
            Text("\(sights.count) place\(sights.count == 1 ? "" : "s")").wooliFont(.amount)
            Text(facts.compactMap { $0 }.joined(separator: " · ")).font(.footnote)
        }
    }

    var body: some View {
        let shown = sights.filter { $0.isVisited == (tab == .been) }
        let groups = Dictionary(grouping: shown) { $0.city ?? Self.otherCity }
        let cities = groups.keys.sorted { a, b in
            a == Self.otherCity ? false : b == Self.otherCity ? true : a.localizedCaseInsensitiveCompare(b) == .orderedAscending
        }

        List {
            Section {
                hero()
                    .listRowInsets(EdgeInsets(top: Space.s, leading: Space.l, bottom: Space.s, trailing: Space.l))
                    .listRowBackground(Color.clear)
            }
            if sights.isEmpty {
                WooliEmptyState(symbol: AppSpace.sights.systemImage, title: "Save a place you want to see",
                                message: "Landmarks, museums, parks, viewpoints. Search Apple Maps, or share a place to Wooli from Maps.",
                                actionTitle: "Add a place") { adding = true }
                    .listRowBackground(Color.clear)
            } else {
                Section {
                    Picker("Show", selection: $tab) {
                        ForEach(SightTab.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                }
                if shown.isEmpty {
                    Text(tab == .been ? "Nothing here yet. Swipe a place in Want to go to mark it as been."
                                      : "Nothing left to see. Add another place with +.")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .listRowBackground(Color.clear)
                }
                ForEach(cities, id: \.self) { city in
                    Section(city) {
                        ForEach(order(groups[city] ?? [])) { sight in
                            Button { detail = sight } label: { SightRow(sight: sight) }
                                .buttonStyle(.plain)
                                .swipeActions(edge: .leading) {
                                    Button(sight.isVisited ? "Not been" : "I've been",
                                           systemImage: sight.isVisited ? "arrow.uturn.backward" : "checkmark") {
                                        withAnimation { toggleVisited(sight) }
                                    }
                                    .tint(AppSpace.sights.tint)
                                }
                                .swipeActions(edge: .trailing) {
                                    Button("Remove", systemImage: "trash", role: .destructive) { context.delete(sight) }
                                }
                        }
                    }
                }
            }
        }
        .navigationTitle("Sights")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add a place", systemImage: "plus") { adding = true }
            }
        }
        .sheet(isPresented: $adding, onDismiss: {
            guard let place = pickedPlace else { return }
            pickedPlace = nil
            save(place)
        }) {
            NavigationStack {
                PlaceSearchView(near: "") { pickedPlace = $0 }
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false } } }
            }
        }
        .sheet(item: $detail) { sight in
            SightDetail(sight: sight)
        }
    }

    /// Newest saved first in Want to go; most recent visit first in Been.
    private func order(_ list: [SightEntry]) -> [SightEntry] {
        tab == .been ? list.sorted { $0.visitedDay > $1.visitedDay } : list
    }

    /// New places land on the tab you're looking at; one you already have opens instead.
    private func save(_ place: TripPlace) {
        if let existing = sights.first(where: { $0.isSamePlace(as: place) }) {
            detail = existing
        } else {
            context.insert(SightEntry(name: place.name, place: place, visitedDay: tab == .been ? DayKey.key(.now) : ""))
        }
    }

    private func toggleVisited(_ sight: SightEntry) {
        sight.visitedDay = sight.isVisited ? "" : DayKey.key(.now)
        sight.updatedAt = .now
    }
}

/// One saved place: a pin (a tick once you've been), its name, and where or when.
struct SightRow: View {
    let sight: SightEntry

    var body: some View {
        ItemRow(title: sight.name, subtitle: subtitle, leading: {
            Image(systemName: sight.isVisited ? "checkmark" : "mappin")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 30, height: 30)
                .background(AppSpace.sights.tint, in: Circle())
        }, trailing: {
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Theme.textTertiary)
        })
        .contentShape(Rectangle())
    }

    private var subtitle: Text? {
        if sight.isVisited { return Text("Been · \(sight.visitedText)") }
        return sight.address.isEmpty ? nil : Text(sight.address)
    }
}

// MARK: - A place

/// A saved place, laid out like the Eats place page: map, name, action pills,
/// when you went, an "add to a trip" row and your notes.
struct SightDetail: View {
    @Bindable var sight: SightEntry
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var mapItem: MKMapItem?
    @State private var showingListing = false
    @State private var addingToTrip = false
    @State private var addedTo: String?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PlaceHeroMap(coordinate: sight.coordinate, name: sight.name, tint: AppSpace.sights.tint) {
                        if mapItem != nil { showingListing = true }
                    }
                    VStack(alignment: .leading, spacing: 22) {
                        titleBlock
                        PlaceActionBar(place: sight.tripPlace, mapItem: mapItem) { showingListing = true }
                        visit
                        details
                        Button("Remove from Sights", role: .destructive) { confirmDelete = true }
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, Space.xl)
                    .padding(.bottom, Space.xxl)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.card)
            .ignoresSafeArea(edges: .top)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        sight.updatedAt = .now
                        dismiss()
                    }
                }
            }
            .task(id: sight.tripPlace) {
                guard let spot = sight.tripPlace else { return }
                mapItem = await PlaceMapCard.listing(for: spot)
            }
            .mapItemDetailSheet(isPresented: $showingListing, item: mapItem)
            .sheet(isPresented: $addingToTrip) {
                if let place = sight.tripPlace {
                    SharedPlaceTripPicker(place: SharedPlace(name: place.name, address: place.address,
                                                             latitude: place.latitude, longitude: place.longitude,
                                                             mapItemID: place.mapItemID, destination: .tripIdeas)) { trip in
                        addedTo = trip.name.isEmpty ? trip.destination : trip.name
                    }
                }
            }
            .confirmationDialog("Remove \(sight.name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    dismiss()
                    context.delete(sight)
                }
            }
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            Text(sight.name)
                .wooliFont(.display)
                .foregroundStyle(Theme.text)
                .lineLimit(3).minimumScaleFactor(0.7)
                .padding(.top, sight.coordinate == nil ? CGFloat.zero : -PlaceHeroMap.titleOverlap)
            if !sight.address.isEmpty {
                Text(sight.address).font(.subheadline).foregroundStyle(Theme.textSecondary).textSelection(.enabled)
            }
        }
    }

    /// Want to go → one button; Been → the day, and a way back.
    private var visit: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your visit").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, Space.xs)
            if sight.isVisited {
                PlaceDetailRow(systemImage: "checkmark.circle.fill") {
                    DatePicker("Been", selection: Binding(get: { DayKey.date(sight.visitedDay) },
                                                          set: { sight.visitedDay = DayKey.key($0) }),
                               in: ...Date.now, displayedComponents: .date)
                }
                PlaceDetailRow(systemImage: "arrow.uturn.backward") {
                    PlaceDetailLink(title: "Move back to Want to go") { sight.visitedDay = "" }
                }
            } else {
                Button { sight.visitedDay = DayKey.key(.now) } label: {
                    Label("I've been here", systemImage: "checkmark").frame(maxWidth: .infinity)
                }
                .buttonStyle(.wooliPrimary)
            }
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Your notes").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, Space.xs)
            if sight.tripPlace != nil {
                PlaceDetailRow(systemImage: "suitcase") {
                    PlaceDetailLink(title: addedTo.map { "Added to \($0)" } ?? "Add to a trip's Ideas",
                                    detail: addedTo == nil ? "" : "Tap to add it to another trip") { addingToTrip = true }
                }
            }
            PlaceDetailRow(systemImage: "square.and.pencil") {
                TextField("Add notes — tickets, best time to go, tips", text: $sight.notes, axis: .vertical)
                    .lineLimit(1...8)
            }
        }
    }
}
