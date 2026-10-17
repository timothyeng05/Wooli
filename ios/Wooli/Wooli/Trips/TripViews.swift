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
        .sheet(item: $newTrip) { NewTripFlow(trip: $0) }
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

// MARK: - New trip flow

/// A short step-by-step flow for creating a trip. Dates come before stops
/// because each stop's date range is clamped to the trip's — picking a stop
/// date first left nothing to choose from (it defaulted to a single day).
struct NewTripFlow: View {
    @Environment(\.dismiss) private var dismiss
    @State private var trip: Trip
    @State private var start: Date
    @State private var end: Date
    @State private var step = Step.basics

    private enum Step: Int { case basics, dates, stops, notes }

    init(trip: Trip) {
        _trip = State(initialValue: trip)
        _start = State(initialValue: DayKey.date(trip.startDay))
        _end = State(initialValue: DayKey.date(trip.endDay))
    }

    var body: some View {
        NavigationStack {
            Form {
                switch step {
                case .basics:
                    Section {
                        TextField("Trip name", text: $trip.name, prompt: Text("e.g. Japan in spring"))
                        TextField("Destination", text: $trip.destination, prompt: Text("e.g. Tokyo & Kyoto"))
                    } footer: {
                        Text("The destination helps Apple Maps find places nearby.")
                    }
                case .dates:
                    Section {
                        DatePicker("Starts", selection: $start, displayedComponents: .date)
                        DatePicker("Ends", selection: $end, in: start..., displayedComponents: .date)
                    }
                case .stops:
                    Section {
                        ForEach($trip.legs) { $leg in
                            NavigationLink {
                                TripLegEditor(leg: $leg, tripStart: start, tripEnd: max(end, start))
                            } label: {
                                HStack {
                                    Text(leg.emoji.isEmpty ? "📍" : leg.emoji)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(leg.name.isEmpty ? "Untitled stop" : leg.name)
                                        Text("\(DayKey.date(leg.startDay).formatted(.dateTime.month(.abbreviated).day())) – \(DayKey.date(leg.endDay).formatted(.dateTime.month(.abbreviated).day()))")
                                            .font(.caption).foregroundStyle(Theme.textSecondary)
                                    }
                                }
                            }
                        }
                        .onDelete { trip.legs.remove(atOffsets: $0) }
                        Button("Add a stop", systemImage: "plus") {
                            let startDay = trip.legs.last.map { DayKey.key(Calendar.current.date(byAdding: .day, value: 1, to: DayKey.date($0.endDay))!) }
                                ?? DayKey.key(start)
                            let clamped = min(startDay, DayKey.key(max(end, start)))
                            trip.legs.append(TripLeg(startDay: clamped, endDay: DayKey.key(max(end, start))))
                        }
                    } header: {
                        Text("Stops")
                    } footer: {
                        Text("Split a multi-city trip into stops (\"Tokyo\", \"Kyoto\"). Each stop gets its own section, and travel between them shows as a card. Optional — skip if it's a single place.")
                    }
                case .notes:
                    Section("Notes") {
                        TextField("Flights, budget, anything", text: $trip.notes, axis: .vertical).lineLimit(2...6)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(step == .basics ? "Cancel" : "Back") { back() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(step == .notes ? "Create" : "Next") { advance() }
                        .disabled(!canAdvance)
                }
            }
        }
    }

    private var title: String {
        switch step {
        case .basics: "New trip"
        case .dates: "When?"
        case .stops: "Stops"
        case .notes: "Notes"
        }
    }

    private var canAdvance: Bool {
        switch step {
        case .basics: !trip.name.trimmingCharacters(in: .whitespaces).isEmpty
        default: true
        }
    }

    private func back() {
        if let previous = Step(rawValue: step.rawValue - 1) {
            step = previous
        } else {
            dismiss()
        }
    }

    private func advance() {
        guard let next = Step(rawValue: step.rawValue + 1) else {
            trip.name = trip.name.trimmingCharacters(in: .whitespaces)
            trip.startDay = DayKey.key(start)
            trip.endDay = DayKey.key(max(end, start))
            trip.legs.sort { $0.startDay < $1.startDay }
            TripStore.shared.save(trip)
            dismiss()
            return
        }
        step = next
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
                Section {
                    ForEach($trip.legs) { $leg in
                        NavigationLink {
                            TripLegEditor(leg: $leg, tripStart: start, tripEnd: max(end, start))
                        } label: {
                            HStack {
                                Text(leg.emoji.isEmpty ? "📍" : leg.emoji)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(leg.name.isEmpty ? "Untitled stop" : leg.name)
                                    Text("\(DayKey.date(leg.startDay).formatted(.dateTime.month(.abbreviated).day())) – \(DayKey.date(leg.endDay).formatted(.dateTime.month(.abbreviated).day()))")
                                        .font(.caption).foregroundStyle(Theme.textSecondary)
                                }
                            }
                        }
                    }
                    .onDelete { trip.legs.remove(atOffsets: $0) }
                    Button("Add a stop", systemImage: "plus") {
                        let startDay = trip.legs.last.map { DayKey.key(Calendar.current.date(byAdding: .day, value: 1, to: DayKey.date($0.endDay))!) }
                            ?? DayKey.key(start)
                        let clamped = min(startDay, DayKey.key(max(end, start)))
                        trip.legs.append(TripLeg(startDay: clamped, endDay: DayKey.key(max(end, start))))
                    }
                } header: {
                    Text("Stops")
                } footer: {
                    Text("Split a multi-city trip into stops (\"Tokyo\", \"Kyoto\"). Each stop gets its own section, and travel between them shows as a card.")
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
                        trip.legs.sort { $0.startDay < $1.startDay }
                        TripStore.shared.save(trip)
                        dismiss()
                    }
                    .disabled(trip.name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

struct TripLegEditor: View {
    @Binding var leg: TripLeg
    let tripStart: Date
    let tripEnd: Date

    var body: some View {
        Form {
            Section {
                TextField("City or region", text: $leg.name, prompt: Text("e.g. Kyoto"))
                TextField("Emoji (optional)", text: Binding(get: { leg.emoji }, set: { leg.emoji = String($0.prefix(1)) }))
            }
            Section {
                DatePicker("Arrive", selection: Binding(get: { DayKey.date(leg.startDay) }, set: {
                    leg.startDay = DayKey.key($0)
                    if leg.endDay < leg.startDay { leg.endDay = leg.startDay }
                }), in: tripStart...tripEnd, displayedComponents: .date)
                DatePicker("Leave", selection: Binding(get: { DayKey.date(leg.endDay) }, set: { leg.endDay = DayKey.key($0) }),
                           in: DayKey.date(leg.startDay)...max(tripEnd, DayKey.date(leg.startDay)), displayedComponents: .date)
            } footer: {
                Text("The day you arrive is shown as a travel day from the previous stop.")
            }
        }
        .navigationTitle(leg.name.isEmpty ? "Stop" : leg.name)
        .navigationBarTitleDisplayMode(.inline)
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
    /// Collapsed legs; nil until the user changes something (then remembered).
    @State private var collapsedLegs: Set<String>?
    @Environment(\.dismiss) private var dismiss

    private var collapsedKey: String { "trip.collapsedLegs.\(tripID)" }

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
        let allItems = store.items(in: trip.id)
        let placed = allItems.filter { $0.place != nil }
        let (blocks, travelIDs) = TripLayout.blocks(trip: trip, items: allItems)
        let planCounts = Self.planCounts(blocks: blocks, items: allItems)
        let collapsed = collapsedLegs ?? defaultCollapsed(trip)

        return ScrollView {
            // Lazy: long trips have dozens of day cards.
            LazyVStack(spacing: 16, pinnedViews: .sectionHeaders) {
                header(trip, dayCount: days.count)

                if !placed.isEmpty {
                    TripMap(stops: placed.map { TripMap.Stop(item: $0, label: nil) })
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }

                ideasCard(trip, ideas: ideas)

                Section {
                    ForEach(TripRow.rows(blocks: blocks, items: allItems, collapsed: collapsed)) { row in
                        switch row {
                        case .day(let block, let half, let leg):
                            dayCard(trip, block, half: half, leg: leg, travelIDs: travelIDs)
                        case .travel(let from, let to, let start, let end, let items):
                            travelCard(trip, from: from, to: to, start: start, end: end, items: items, all: allItems)
                        case .legHeader(let leg):
                            Button {
                                withAnimation(.snappy) { toggle(leg, trip: trip) }
                            } label: {
                                TripLegHeader(leg: leg, number: (trip.legs.firstIndex { $0.id == leg.id } ?? 0) + 1,
                                              colorHex: trip.colorHex(of: leg),
                                              planCount: planCounts[leg.id] ?? 0,
                                              isCollapsed: collapsed.contains(leg.id), isNow: leg.contains(DayKey.key(.now)))
                            }
                            .buttonStyle(.plain)
                            .sensoryFeedback(.selection, trigger: collapsed.contains(leg.id))
                        }
                    }
                } header: {
                    if !trip.legs.isEmpty { legsBar(trip, collapsed: collapsed) }
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
        .onAppear {
            if collapsedLegs == nil, let saved = UserDefaults.standard.stringArray(forKey: collapsedKey) {
                collapsedLegs = Set(saved)
            }
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

    /// Past trips start collapsed; during a trip, legs already finished do.
    /// Pinned above the itinerary: one tap folds every leg so the trip reads
    /// as just its stops and the travel between them.
    private func legsBar(_ trip: Trip, collapsed: Set<String>) -> some View {
        let allCollapsed = trip.legs.allSatisfy { collapsed.contains($0.id) }
        return HStack {
            Label("\(trip.legs.count) stop\(trip.legs.count == 1 ? "" : "s")", systemImage: "point.topleft.down.to.point.bottomright.curvepath")
                .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
            Spacer()
            Button {
                setCollapsed(allCollapsed ? [] : Set(trip.legs.map(\.id)))
            } label: {
                Label(allCollapsed ? "Expand all" : "Collapse all",
                      systemImage: allCollapsed ? "rectangle.expand.vertical" : "rectangle.compress.vertical")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .controlSize(.small)
            .sensoryFeedback(.selection, trigger: allCollapsed)
        }
        .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 8)
        .background(.regularMaterial, in: Capsule())
        .shadow(color: .black.opacity(0.08), radius: 8, y: 3)
    }

    private func defaultCollapsed(_ trip: Trip) -> Set<String> {
        let today = DayKey.key(.now)
        if trip.endDay < today { return Set(trip.legs.map(\.id)) }
        if trip.startDay <= today { return Set(trip.legs.filter { $0.endDay < today }.map(\.id)) }
        return []
    }

    private func toggle(_ leg: TripLeg, trip: Trip) {
        var set = collapsedLegs ?? defaultCollapsed(trip)
        if set.contains(leg.id) { set.remove(leg.id) } else { set.insert(leg.id) }
        setCollapsed(set)
    }

    private func setCollapsed(_ set: Set<String>) {
        withAnimation(.snappy) { collapsedLegs = set }
        UserDefaults.standard.set(Array(set), forKey: collapsedKey)
    }

    /// A day's plans. On a travel day, "1 of 2" holds plans before the
    /// departure (still in the city you're leaving) and "2 of 2" the rest.
    private func dayCard(_ trip: Trip, _ block: TripDayBlock, half: TripRow.Half, leg: TripLeg?,
                         travelIDs: Set<String>) -> some View {
        let departure = block.departure ?? Int.max
        let plans = store.items(in: trip.id, day: block.day).filter { item in
            guard !travelIDs.contains(item.id) else { return false }
            switch half {
            case .whole: return true
            case .first: return (item.time ?? Int.max) < departure
            case .second: return (item.time ?? Int.max) >= departure
            }
        }
        let date = DayKey.date(block.day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        let base = "Day \(block.number)"
        let title: String = switch half {
        case .whole: trip.dayTitles[block.day].map { "\(base) · \($0)" } ?? base
        case .first: "\(base) · 1 of 2"
        case .second: "\(base) · 2 of 2"
        }
        let subtitle = half == .whole ? date : [date, leg?.name].compactMap { $0 }.joined(separator: " · ")

        return VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: title, subtitle: subtitle) {
                HStack(spacing: 14) {
                    if plans.contains(where: { $0.place != nil }) {
                        Button("Map", systemImage: "map") { dayMap = block.day }.labelStyle(.iconOnly)
                    }
                    Button("Add", systemImage: "plus") {
                        // "1 of 2" needs a time before departure to stay there.
                        let time = half == .first ? max(min(9 * 60, departure - 60), 0) : nil
                        editingItem = TripItem(tripID: trip.id, day: block.day, time: time)
                    }
                    .labelStyle(.iconOnly)
                }
                .font(.body.weight(.medium))
            }
            if plans.isEmpty {
                Text("Nothing planned yet").font(.footnote).foregroundStyle(Theme.textTertiary)
            }
            ForEach(plans) { itemRow($0, trip: trip) }
        }
        .card()
        // The day's leg color down the left edge.
        .overlay(alignment: .leading) {
            if let leg {
                Capsule().fill(Color(hex: trip.colorHex(of: leg)).gradient).frame(width: 4).padding(.vertical, 22)
            }
        }
    }

    /// Plans per leg, not counting travel. On a travel day, plans before the
    /// departure count for the city you're leaving.
    private static func planCounts(blocks: [TripDayBlock], items: [TripItem]) -> [String: Int] {
        var counts: [String: Int] = [:]
        for block in blocks {
            for item in items where item.day == block.day && item.kind != .transit {
                let early = block.departure.map { (item.time ?? Int.max) < $0 } ?? false
                if let leg = early ? block.travelFrom : block.leg { counts[leg.id, default: 0] += 1 }
            }
        }
        return counts
    }

    private func travelCard(_ trip: Trip, from: TripLeg?, to: TripLeg?, start: String, end: String,
                            items: [TripItem], all: [TripItem]) -> some View {
        TripTravelCard(fromName: from?.name, toName: to?.name,
                       day: start, endDay: end, items: items,
                       distanceKm: TripTravelCard.distanceKm(from: from, to: to, items: all),
                       onSelect: { editingItem = $0 },
                       onAdd: { editingItem = TripItem(tripID: trip.id, day: end, kind: .transit,
                                                       title: to.map { "To \($0.name)" } ?? "Home") })
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
                .foregroundStyle(.white)
                .frame(width: 32, height: 32)
                .background(Color(hex: item.kind.colorHex).gradient, in: Circle())
                .shadow(color: Color(hex: item.kind.colorHex).opacity(0.35), radius: 4, y: 2)
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
    /// Flight / train details; kept while switching to "Other" and back.
    @State private var transport: TripTransport
    /// nil = "Other" (bus, ferry, car…), which uses the plain form.
    @State private var transportMode: TripTransport.Mode?
    /// Arrival clock time on the ticket; nil = not set.
    @State private var arrival: Date?
    @Environment(\.dismiss) private var dismiss

    init(item: TripItem, trip: Trip) {
        self.trip = trip
        let isNew = !TripStore.shared.items.contains { $0.id == item.id }
        self.isNew = isNew
        _item = State(initialValue: item)
        _hasTime = State(initialValue: item.time != nil)
        _time = State(initialValue: TripTransport.clock(item.time ?? 12 * 60))
        // Existing bookings without details keep their look unless they read
        // like a flight or train; new ones start as a flight.
        let mode = item.transport?.mode ?? Self.guessMode(item) ?? (isNew ? .flight : nil)
        _transport = State(initialValue: item.transport ?? TripTransport(mode: mode ?? .flight))
        _transportMode = State(initialValue: mode)
        _arrival = State(initialValue: item.transport?.arriveTime.map(TripTransport.clock))
    }

    private static func guessMode(_ item: TripItem) -> TripTransport.Mode? {
        guard item.kind == .transit else { return nil }
        switch TripTravelCard.mode(for: [item]).label {
        case "Flight": return .flight
        case "Train": return .train
        default: return nil
        }
    }

    /// The flight / train ticket being shown, if any.
    private var transportForm: TripTransport.Mode? { item.kind == .transit ? transportMode : nil }

    /// What would be saved, with the arrival day worked out.
    private var draft: TripTransport {
        var t = transport
        t.arriveTime = arrival.map(TripTransport.minutes)
        return t.inferringArrivalDay(departDay: item.day, departTime: hasTime ? TripTransport.minutes(time) : nil)
    }

    var body: some View {
        NavigationStack {
            Group {
                if transportForm != nil { ticket } else { form }
            }
            .navigationTitle(isNew ? "Add to trip" : "Edit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                if transportForm != nil {
                    ToolbarItem(placement: .principal) { modePicker.frame(width: 230) }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(item.title.trimmingCharacters(in: .whitespaces).isEmpty && item.place == nil
                                  && (transportForm == nil || draft.suggestedTitle.isEmpty))
                }
            }
        }
        // The ticket lives on a night sky, whatever the phone's appearance.
        .preferredColorScheme(transportForm == nil ? nil : .dark)
        .onChange(of: transportMode) { _, mode in
            if let mode { transport.mode = mode }
        }
    }

    private var modePicker: some View {
        Picker("Travel by", selection: $transportMode.animation()) {
            ForEach(TripTransport.Mode.allCases) { Text($0.label).tag(TripTransport.Mode?.some($0)) }
            Text("Other").tag(TripTransport.Mode?.none)
        }
        .pickerStyle(.segmented)
    }

    // MARK: Plain form (activities, food, stays, notes, other travel)

    private var form: some View {
        Form {
            Section {
                Picker("Type", selection: $item.kind) {
                    ForEach(TripItem.Kind.allCases) { kind in
                        Image(systemName: kind.symbol).tag(kind).accessibilityLabel(kind.label)
                    }
                }
                .pickerStyle(.segmented)
                if item.kind == .transit { modePicker }
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
                    PlaceSearchView(near: arrivingLeg ?? trip.destination) { place in
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
                    Button("Delete", role: .destructive, action: delete)
                }
            }
        }
    }

    // MARK: Flight & train ticket

    private var ticket: some View {
        ScrollView {
            VStack(spacing: 0) {
                RouteBackdrop(transport: draft, focus: tripFocus)
                    .frame(height: 380)
                    .overlay(alignment: .bottom) {
                        LinearGradient(colors: [.clear, TransportTicket.night], startPoint: .top, endPoint: .bottom)
                            .frame(height: 100)
                    }
                TransportTicket(transport: $transport, day: $item.day, departure: departure, arrival: $arrival,
                                days: trip.days, stationHints: (leavingLeg ?? trip.destination, arrivingLeg ?? trip.destination))
                    .padding(.horizontal, 16)
                    .padding(.top, -96)
                TextField("Notes", text: $item.notes, axis: .vertical)
                    .lineLimit(1...6)
                    .padding(14)
                    .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(.white.opacity(0.1)))
                    .padding(.horizontal, 16)
                    .padding(.top, 20)
                if !isNew {
                    Button("Delete", role: .destructive, action: delete)
                        .padding(.top, 18)
                }
            }
            .padding(.bottom, 30)
        }
        .scrollDismissesKeyboard(.interactively)
        .ignoresSafeArea(edges: .top)
        .background(TransportTicket.night.ignoresSafeArea())
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    /// Departure time on the ticket, backed by the same state as the plain form.
    private var departure: Binding<Date?> {
        Binding(get: { hasTime ? time : nil },
                set: { date in
                    if let date { time = date }
                    hasTime = date != nil
                })
    }

    /// The leg you're leaving on this day, to search for the departure station there.
    private var leavingLeg: String? {
        guard let day = item.day else { return nil }
        return trip.legs.first { $0.endDay == day && $0.startDay != day }?.name
    }

    private var arrivingLeg: String? { item.day.flatMap { trip.leg(for: $0)?.name } }

    /// Middle of the trip's places, for the globe to face before airports are picked.
    private var tripFocus: CLLocationCoordinate2D? {
        let places = TripStore.shared.items(in: trip.id).compactMap(\.place)
        guard !places.isEmpty else { return nil }
        return CLLocationCoordinate2D(latitude: places.map(\.latitude).reduce(0, +) / Double(places.count),
                                      longitude: places.map(\.longitude).reduce(0, +) / Double(places.count))
    }

    private func delete() {
        TripStore.shared.delete(item)
        dismiss()
    }

    private func save() {
        item.title = item.title.trimmingCharacters(in: .whitespaces)
        if transportForm != nil {
            var details = draft
            details.flightNumber = details.flightNumber.uppercased().trimmingCharacters(in: .whitespaces)
            item.transport = details
            // The ticket has no title field: name it after the route once both ends are picked.
            if item.title.isEmpty || details.hasRoute { item.title = details.suggestedTitle }
        } else {
            item.transport = nil
        }
        if item.title.isEmpty, let place = item.place { item.title = place.name }
        if hasTime && item.day != nil {
            item.time = TripTransport.minutes(time)
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
