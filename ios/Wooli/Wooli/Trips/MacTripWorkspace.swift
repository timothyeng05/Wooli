#if os(macOS)
import MapKit
import SwiftUI

/// Which page of a trip the shell's sidebar has picked.
enum TripPage: Hashable {
    case overview
    case city(String)
    case ideas
    case bookings

    var legID: String? {
        if case .city(let id) = self { id } else { nil }
    }
}

/// What the Mac trip page shows: the days with the map beside them, the
/// days as calendar columns, or the map across the whole window.
enum TripWorkspaceMode: String, CaseIterable, Identifiable {
    case itinerary, calendar, map
    var id: String { rawValue }
    var label: String {
        switch self {
        case .itinerary: "Itinerary"
        case .calendar: "Calendar"
        case .map: "Map"
        }
    }
    var symbol: String {
        switch self {
        case .itinerary: "suitcase.rolling"
        case .calendar: "calendar"
        case .map: "map"
        }
    }
}

/// What the menu bar can do to the open trip. The workspace publishes it as a
/// focused value, so the Plan menu is only enabled while a trip is in front.
struct TripActions {
    var newPlan: () -> Void
    var moveUp: () -> Void
    var moveDown: () -> Void
    var duplicate: () -> Void
    var markBooked: () -> Void
    var moveDay: (Int) -> Void
    var moveToIdeas: () -> Void
    var openInMaps: () -> Void
    var setKind: (TripItem.Kind) -> Void
    var editTicket: () -> Void
    var stepCity: (Int) -> Void
    var copy: () -> Void
    var paste: () -> Void
    var hasSelection: Bool
    var hasPlace: Bool
    var hasTicket: Bool
}

private struct TripActionsKey: FocusedValueKey { typealias Value = TripActions }

extension FocusedValues {
    var tripActions: TripActions? {
        get { self[TripActionsKey.self] }
        set { self[TripActionsKey.self] = newValue }
    }
}

/// The trip page on the Mac, laid out like Mail or Calendar: cities and
/// ideas on the left, the days in the middle (an outline or day columns),
/// and the map with the selected plan on the right, edited in place.
struct MacTripWorkspace: View {
    let tripID: String
    /// True in a trip's own window (no Back button, no Open in New Window).
    var inOwnWindow = false
    /// The page picked in the shell's sidebar. nil in a trip's own window,
    /// which keeps its own cities and ideas list on the left.
    var page: TripPage? = nil
    /// Called after the trip is deleted or left, to leave its page.
    var onClose: (() -> Void)? = nil

    @State private var store = TripStore.shared
    @State private var eatsBook = EatsBook.shared
    @State private var selection = Set<String>()
    @AppStorage("trip.mac.view") private var mode: TripWorkspaceMode = .itinerary
    @State private var search = ""
    /// The map beside the itinerary (⇧⌘M).
    @AppStorage("trip.mac.showMap") private var showMap = true
    /// The selected plan, or the trip summary, in the right pane (⌥⌘I).
    @AppStorage("trip.mac.showInspector") private var showInspector = false
    /// The city picked on the left, for the map when no plan is selected.
    @State private var ownFocusLeg: String?
    private var focusLeg: String? { page != nil ? page?.legID : ownFocusLeg }
    /// Day (or plan) the outline should scroll to.
    @State private var scrollTarget: String?
    @State private var editingTicket: TripItem?
    @State private var editingTrip: Trip?
    /// What was just deleted, shown for a few seconds with an Undo button.
    @State private var deletedNote: String?
    @Environment(\.undoManager) private var undoManager
    @State private var confirmDeleteTrip = false
    @State private var confirmRemoveSlots = false
    @AppStorage("trip.showOpenSlots") private var showOpenSlots = true
    @State private var preparingShare = false
    @FocusState private var titleFocused: Bool
    @FocusState private var quickAddFocused: Bool
    /// Set by a day's + or Add Idea: where quick add puts the next plan. nil = follow the selection.
    @State private var quickTarget: String??
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let trip = store.trip(tripID) {
            if page == .bookings {
                bookingsPage(trip)
            } else {
                workspace(trip)
            }
        } else {
            ContentUnavailableView("Trip not available", systemImage: "suitcase",
                                   description: Text("It may have been deleted, or you're no longer part of it."))
        }
    }

    // MARK: Layout

    /// The Bookings page: a table instead of the plan, map and inspector.
    private func bookingsPage(_ trip: Trip) -> some View {
        MacBookingsTable(tripID: trip.id, search: search, onOpen: { editingTicket = $0 })
            .contentMargins(.horizontal, 0, for: .scrollContent)
            .navigationTitle(trip.name.isEmpty ? "Trip" : trip.name)
            .navigationSubtitle("Bookings")
            .searchable(text: $search, placement: .toolbar, prompt: "Search bookings")
            .sheet(item: $editingTicket) { TripItemEditor(item: $0, trip: trip) }
    }

    private func workspace(_ trip: Trip) -> some View {
        GeometryReader { geo in
            // Narrow windows give the map's place to the inspector while it's open.
            let narrow = geo.size.width < 1180
            let mapShown = mode == .itinerary && showMap && !(narrow && showInspector)
            let all = store.items(in: trip.id)
            let selected = all.filter { selection.contains($0.id) }
            HSplitView {
                if page == nil {
                    sideColumn(trip)
                        .frame(minWidth: 190, idealWidth: 220, maxWidth: 300, maxHeight: .infinity)
                }
                if mode == .map {
                    fullMap(trip)
                        .frame(minWidth: 600, maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    planColumn(trip)
                        .frame(minWidth: 400, idealWidth: 520, maxWidth: mapShown ? 560 : .infinity, maxHeight: .infinity)
                    if mapShown {
                        MacTripMap(stops: mapStops(trip, selected: selected, all: all), numbered: mapIsOneDay(selected),
                                   selection: $selection)
                            .frame(minWidth: 360, maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                if showInspector {
                    details(trip, selected: selected, all: all)
                        .frame(minWidth: 300, idealWidth: 340, maxWidth: 420, maxHeight: .infinity)
                        .background(Theme.card)
                }
            }
        }
        // The window centres other pages at a readable width; this one uses it all.
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .tripWorkspaceGuide()
        .navigationTitle(trip.name.isEmpty ? "Trip" : trip.name)
        .navigationSubtitle(trip.dateRangeText)
        .toolbar { toolbar(trip) }
        .searchable(text: $search, placement: .toolbar, prompt: "Search plans")
        .focusedSceneValue(\.tripActions, TripActions(
            newPlan: { focusQuickAdd(day: nil) },
            moveUp: { nudge(-1, trip: trip) },
            moveDown: { nudge(1, trip: trip) },
            duplicate: { duplicate(selection, trip: trip) },
            markBooked: { markBooked(trip) },
            moveDay: { moveSelectedDays($0, trip: trip) },
            moveToIdeas: { place(Array(selection), on: nil, before: nil, trip: trip) },
            openInMaps: { openSelectedInMaps() },
            setKind: { setKind($0, trip: trip) },
            editTicket: { editSelectedTicket() },
            stepCity: { stepCity($0, trip: trip) },
            copy: { copyPlans(trip: trip) },
            paste: { pastePlans(trip: trip) },
            hasSelection: !selection.isEmpty,
            hasPlace: selectedItems(trip).contains { $0.place?.mapsURL != nil },
            hasTicket: selectedItems(trip).count == 1 && selectedItems(trip).first?.kind == .transit))
        .sheet(item: $editingTicket) { TripItemEditor(item: $0, trip: trip) }
        .sheet(item: $editingTrip) { editing in
            // Trips with cities get the same sheet as New Trip; older city-less ones keep the form.
            if editing.legs.contains(where: { !$0.isHome }) { NewTripSheet(editing: editing) } else { TripEditor(trip: editing) }
        }
        .confirmationDialog("Remove empty meal slots?", isPresented: $confirmRemoveSlots, titleVisibility: .visible) {
            Button("Remove", role: .destructive) { store.removeEmptyMealSlots(tripID: trip.id) }
        } message: {
            Text("Deletes the old empty Breakfast, Lunch and Dinner entries for everyone on this trip. Open meals still show as dashed rows.")
        }
        .confirmationDialog(trip.isMine ? "Delete \(trip.name)?" : "Leave \(trip.name)?", isPresented: $confirmDeleteTrip,
                            titleVisibility: .visible) {
            Button(trip.isMine ? "Delete trip" : "Leave trip", role: .destructive) {
                store.delete(trip)
                if let onClose { onClose() } else { dismiss() }
            }
        } message: {
            Text(trip.isMine ? "This deletes the trip for everyone you've shared it with." : "You'll need a new invite to join again.")
        }
        .task(id: undoManager) { store.undoManager = undoManager }
        .overlay(alignment: .bottom) {
            if let deletedNote {
                HStack(spacing: Space.m) {
                    Text(deletedNote).foregroundStyle(Theme.text)
                    Button("Undo") {
                        undoManager?.undo()
                        self.deletedNote = nil
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(Space.m)
                .background(.regularMaterial, in: Capsule())
                .shadow(color: .black.opacity(0.15), radius: 8, y: 3)
                .padding(.bottom, Space.xl)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .overlay {
            if preparingShare {
                ProgressView().controlSize(.large).padding(Space.xxl)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Radius.card))
            }
        }
    }

    @ToolbarContentBuilder
    private func toolbar(_ trip: Trip) -> some ToolbarContent {
        ToolbarItem(placement: .principal) {
            Picker("View", selection: $mode) {
                ForEach(TripWorkspaceMode.allCases) { Label($0.label, systemImage: $0.symbol).tag($0) }
            }
            .pickerStyle(.segmented)
            .help("Itinerary (⌘1), Calendar (⌘2) or Map (⌘3)")
        }
        ToolbarItem(placement: .primaryAction) {
            Toggle("Map", systemImage: "map", isOn: $showMap)
                .help("Show or hide the map beside the itinerary (⇧⌘M)")
                .disabled(mode != .itinerary)
        }
        ToolbarItem(placement: .primaryAction) {
            Toggle("Inspector", systemImage: "sidebar.right", isOn: $showInspector)
                .help("Show or hide the selected plan, or the trip summary (⌥⌘I)")
        }
        ToolbarItem(placement: .primaryAction) {
            Toggle("Open Slots", systemImage: "square.dashed", isOn: $showOpenSlots)
                .help("Show or hide the empty meals and nights (⇧⌘O)")
        }
        ToolbarItem(placement: .primaryAction) {
            Button("Add Plan", systemImage: "plus") { focusQuickAdd(day: nil) }
                .help("Type a place to add it to the selected day (⌘N)")
        }
        ToolbarItem(placement: .primaryAction) {
            Button(trip.isMine && !trip.isShared ? "Invite" : "People", systemImage: "person.crop.circle.badge.plus") {
                invite(trip)
            }
            .disabled(preparingShare)
        }
        ToolbarItem(placement: .primaryAction) {
            Menu("More", systemImage: "ellipsis.circle") {
                Button("Edit Trip…", systemImage: "pencil") { editingTrip = trip }
                if !store.hiddenPlaceholders(in: trip.id).isEmpty {
                    Button("Remove Empty Meal Slots…", systemImage: "square.dashed") { confirmRemoveSlots = true }
                }
                if !inOwnWindow {
                    Button("Open in New Window", systemImage: "macwindow.badge.plus") { openWindow(id: "trip", value: trip.id) }
                }
                Divider()
                Button(trip.isMine ? "Delete Trip…" : "Leave Trip…", systemImage: trip.isMine ? "trash" : "rectangle.portrait.and.arrow.right",
                       role: .destructive) { confirmDeleteTrip = true }
            }
        }
    }

    // MARK: Left: cities and ideas

    private func sideColumn(_ trip: Trip) -> some View {
        let ideas = ideaItems(trip)
        return List(selection: $selection) {
            Section("Cities") {
                Button {
                    ownFocusLeg = nil
                    selection = []
                    scrollTarget = trip.days.first
                } label: {
                    HStack(spacing: Space.s) {
                        Image(systemName: "globe.asia.australia.fill")
                            .font(.caption.weight(.semibold)).foregroundStyle(.white)
                            .frame(width: 28, height: 28)
                            .background(Theme.brand.gradient, in: Circle())
                        Text("Whole trip")
                            .font(.body.weight(focusLeg == nil ? .semibold : .regular))
                            .foregroundStyle(focusLeg == nil ? Theme.brand : Theme.text)
                    }
                }
                .buttonStyle(.plain)
                ForEach(trip.legs.filter { !$0.isHome }.sorted { $0.startDay < $1.startDay }) { leg in
                    Button {
                        ownFocusLeg = leg.id
                        selection = []
                        scrollTarget = trip.days.first { $0 >= leg.startDay }
                    } label: {
                        cityLine(leg, trip: trip)
                    }
                    .buttonStyle(.plain)
                }
            }
            Section {
                ForEach(ideas) { item in
                    MacPlanLine(item: item, day: nil, score: score(item))
                        .tag(item.id)
                        .itemProvider { NSItemProvider(object: TripItem.dragPrefix + item.id as NSString) }
                }
                .onInsert(of: [.text]) { _, providers in
                    Self.ids(from: providers) { place($0, on: nil, before: nil, trip: trip) }
                }
                if ideas.isEmpty {
                    Text("Drag plans here to keep them for later, or add places to fit in somewhere.")
                        .font(.caption).foregroundStyle(Theme.textTertiary)
                }
            } header: {
                HStack {
                    Text("Ideas")
                    Spacer()
                    Button("Add Idea", systemImage: "plus") { focusQuickAdd(day: .some(.none)) }
                        .labelStyle(.iconOnly).buttonStyle(.borderless)
                }
                .dropDestination(for: String.self) { texts, _ in
                    place(Self.ids(in: texts), on: nil, before: nil, trip: trip)
                    return true
                }
            }
        }
        .listStyle(.sidebar)
        .contextMenu(forSelectionType: String.self) { ids in
            planMenu(ids, trip: trip)
        } primaryAction: { ids in
            openPrimary(ids, trip: trip)
        }
        .onKeyPress(.return) { renameSelected() }
        .onDeleteCommand { deletePlans(selection, trip: trip) }
    }

    private func cityLine(_ leg: TripLeg, trip: Trip) -> some View {
        let picked = focusLeg == leg.id
        return HStack(spacing: Space.s) {
            Group {
                if leg.emoji.isEmpty || leg.emoji == "📍" {
                    Text("\(trip.number(of: leg))").font(.caption.weight(.bold)).foregroundStyle(.white)
                } else {
                    Text(leg.emoji).font(.callout)
                }
            }
            .frame(width: 28, height: 28)
            .background(Theme.Group.travel.color.gradient.opacity(picked ? 1 : 0.85), in: Circle())
            .shadow(color: Theme.Group.travel.color.opacity(0.35), radius: 3, y: 1)
            VStack(alignment: .leading, spacing: 0) {
                Text(leg.name.isEmpty ? "City \(trip.number(of: leg))" : leg.name)
                    .font(.body.weight(focusLeg == leg.id ? .semibold : .regular))
                    .foregroundStyle(focusLeg == leg.id ? Theme.brand : Theme.text)
                Text(legDates(leg)).font(.caption).foregroundStyle(Theme.textSecondary)
            }
            Spacer(minLength: 0)
            if leg.contains(DayKey.key(.now)) {
                Text("NOW").font(.caption2.weight(.heavy)).foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Theme.brand.gradient, in: Capsule())
            }
        }
        .contentShape(Rectangle())
    }

    private func legDates(_ leg: TripLeg) -> String {
        let format = Date.FormatStyle.dateTime.month(.abbreviated).day()
        let start = DayKey.date(leg.startDay).formatted(format)
        let nights = leg.nights
        if leg.startDay == leg.endDay { return start }
        return "\(start) – \(DayKey.date(leg.endDay).formatted(format)) · \(nights) night\(nights == 1 ? "" : "s")"
    }

    // MARK: Middle: the days as calendar columns

    private func calendar(_ trip: Trip) -> some View {
        let all = store.items(in: trip.id)
        let openSlots = showOpenSlots ? TripCoverage.openSlots(trip: trip, items: all) : [:]
        return ScrollViewReader { proxy in
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: Space.m) {
                    ForEach(visibleDays(trip), id: \.self) { day in
                        MacDayColumn(trip: trip, day: day, plans: shownPlans(trip, day: day),
                                     staying: all.filter { $0.staysOver(day) && $0.day != day },
                                     slots: search.isEmpty ? openSlots[day] ?? [] : [],
                                     selection: $selection, score: score,
                                     onOpenSlot: { selection = [store.materialize($0, tripID: trip.id).id] },
                                     onAdd: { focusQuickAdd(day: .some(day)) },
                                     onOpen: { openPrimary([$0], trip: trip) },
                                     onDrop: { ids, before in place(ids, on: day, before: before, trip: trip) },
                                     menu: { planMenu($0, trip: trip) })
                            .id(day)
                    }
                }
                .padding(Space.l)
            }
            .background(Theme.background)
            .onChange(of: scrollTarget) { _, target in
                guard let target else { return }
                withAnimation(.snappy) { proxy.scrollTo(target, anchor: .leading) }
                scrollTarget = nil
            }
        }
    }

    // MARK: Middle: quick add and the days

    private func planColumn(_ trip: Trip) -> some View {
        VStack(spacing: 0) {
            if store.isSample(trip.id) { sampleBanner(trip) }
            QuickAddBar(trip: trip, day: quickAddDay(trip), focus: $quickAddFocused,
                        onFlight: { editingTicket = $0 },
                        onAdded: { id, openInspector in
                            selection = [id]
                            scrollTarget = id
                            if openInspector {
                                showInspector = true
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { titleFocused = true }
                            }
                        })
            Group {
                switch mode {
                case _ where page == .ideas:
                    ideasPage(trip)
                case .calendar:
                    calendar(trip)
                default:
                    // The iPhone's itinerary: city banners, day cards, tickets.
                    TripDetailView(tripID: trip.id, selection: $selection, filter: matches,
                                   onAdd: { focusQuickAdd(day: .some($0)) }, scrollTarget: $scrollTarget)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onChange(of: selection) { _, _ in quickTarget = nil }
        // The sidebar picked another city: bring its first day into view.
        .onChange(of: page, initial: true) { _, page in
            quickTarget = nil
            switch page {
            case .city(let id)?:
                if let leg = trip.legs.first(where: { $0.id == id }) { scrollTarget = trip.days.first { $0 >= leg.startDay } }
            case .overview?: scrollTarget = trip.days.first
            default: break
            }
        }
    }

    /// Shown on the sample trip: it's only on this Mac and can be deleted in one click.
    private func sampleBanner(_ trip: Trip) -> some View {
        HStack(spacing: Space.s) {
            Image(systemName: "sparkles").foregroundStyle(Theme.brand)
            Text("Sample trip · only on this \(ThisDevice.name)").font(.callout).foregroundStyle(Theme.textSecondary)
            Spacer()
            Button("Delete Sample") {
                store.delete(trip)
                if let onClose { onClose() } else { dismiss() }
            }
            .buttonStyle(.borderless).foregroundStyle(Theme.brand)
        }
        .padding(.horizontal, Space.m).padding(.vertical, Space.s)
        .background(Theme.brandSoft)
    }

    /// Quick add's day: the one a + picked, else Ideas on the Ideas page, else the selection's.
    private func quickAddDay(_ trip: Trip) -> String? {
        if let picked = quickTarget { return picked }
        return page == .ideas ? nil : currentDay(trip)
    }

    /// The trip's Ideas as a page: a drop target for plans to set aside.
    private func ideasPage(_ trip: Trip) -> some View {
        let ideas = ideaItems(trip)
        return List(selection: $selection) {
            ForEach(ideas) { item in
                MacPlanLine(item: item, day: nil, score: score(item))
                    .tag(item.id)
                    .itemProvider { NSItemProvider(object: TripItem.dragPrefix + item.id as NSString) }
            }
            .onInsert(of: [.text]) { _, providers in
                Self.ids(from: providers) { place($0, on: nil, before: nil, trip: trip) }
            }
            if ideas.isEmpty {
                ContentUnavailableView("No ideas yet", systemImage: "lightbulb",
                                       description: Text("Type a place above to keep it for later, or drag plans here to set them aside."))
            }
        }
        .listStyle(.inset)
        .dropDestination(for: String.self) { texts, _ in
            place(Self.ids(in: texts), on: nil, before: nil, trip: trip)
            return true
        }
        .contextMenu(forSelectionType: String.self) { ids in
            planMenu(ids, trip: trip)
        } primaryAction: { ids in
            openPrimary(ids, trip: trip)
        }
        .onKeyPress(.return) { renameSelected() }
        .onDeleteCommand { deletePlans(selection, trip: trip) }
    }

    // MARK: Right: the selected plan

    @ViewBuilder
    private func details(_ trip: Trip, selected: [TripItem], all: [TripItem]) -> some View {
            if selected.count == 1, let item = selected.first {
                MacPlanInspector(trip: trip, item: item, titleFocused: $titleFocused,
                                 score: score(item), onEditTicket: { editingTicket = $0 },
                                 onDelete: { deletePlans([item.id], trip: trip) })
                    .id(item.id)
            } else if selected.count > 1 {
                multiSelection(selected, trip: trip)
            } else {
                tripSummary(trip, all: all)
            }
    }

    /// The map across the window, with the selected plan in a card.
    private func fullMap(_ trip: Trip) -> some View {
        let all = store.items(in: trip.id)
        let selected = all.filter { selection.contains($0.id) }
        return MacTripMap(stops: mapStops(trip, selected: selected, all: all), numbered: mapIsOneDay(selected),
                          selection: $selection)
            .overlay(alignment: .bottomLeading) {
                mapCard(trip, selected: selected)
                    .padding(Space.l)
            }
    }

    /// The selected plan (or the city or trip) floating over the full map.
    @ViewBuilder
    private func mapCard(_ trip: Trip, selected: [TripItem]) -> some View {
        if selected.count == 1, let item = selected.first {
            let tint = Color(hex: item.kind.colorHex)
            HStack(alignment: .center, spacing: Space.m) {
                Image(systemName: item.kind == .transit ? MacPlanLine.transitSymbol(item) : item.kind.symbol)
                    .font(.callout.weight(.semibold)).foregroundStyle(item.kind.onColor)
                    .frame(width: 36, height: 36)
                    .background(tint.gradient, in: Circle())
                    .shadow(color: tint.opacity(0.35), radius: 4, y: 2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title)
                        .font(.headline).foregroundStyle(Theme.text).lineLimit(1)
                    Text([item.day.flatMap { d in trip.days.firstIndex(of: d).map { "Day \($0 + 1)" } },
                          item.place?.address, item.timeText].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                }
                if let score = score(item) { MealScoreBadge(score: score, size: 32) }
                Button("Details") { withAnimation(.snappy) { showInspector = true } }
                    .buttonStyle(.borderedProminent)
            }
            .padding(Space.m)
            .frame(maxWidth: 460, alignment: .leading)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        } else {
            let leg = trip.legs.first { $0.id == focusLeg }
            Text(selected.count > 1 ? "\(selected.count) plans" : leg.map { "\($0.emoji) \($0.name)" } ?? trip.name)
                .font(.headline).foregroundStyle(Theme.text)
                .padding(.horizontal, Space.m).padding(.vertical, Space.s)
                .background(.regularMaterial, in: Capsule())
        }
    }

    private func multiSelection(_ selected: [TripItem], trip: Trip) -> some View {
        VStack(spacing: Space.l) {
            Spacer()
            Image(systemName: "square.stack.3d.up").font(.largeTitle).foregroundStyle(Theme.textTertiary)
            Text("\(selected.count) plans selected").font(.headline).foregroundStyle(Theme.text)
            Menu("Move to") { moveMenu(Set(selected.map(\.id)), trip: trip) }
                .fixedSize()
            Button("Delete", role: .destructive) { deletePlans(Set(selected.map(\.id)), trip: trip) }
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(Space.l)
    }

    private func tripSummary(_ trip: Trip, all: [TripItem]) -> some View {
        let cities = trip.legs.filter { !$0.isHome }.count
        let plans = all.filter { $0.day != nil && !$0.isMealPlaceholder }.count
        return ScrollView {
            VStack(alignment: .leading, spacing: Space.m) {
                if let leg = trip.legs.first(where: { $0.id == focusLeg }) {
                    Text("\(leg.emoji) \(leg.name)").font(.title2.weight(.semibold)).foregroundStyle(Theme.text)
                    Text(legDates(leg)).font(.subheadline).foregroundStyle(Theme.textSecondary)
                } else {
                    if !trip.destination.isEmpty {
                        Label(trip.destination, systemImage: "mappin.and.ellipse")
                            .font(.subheadline.weight(.medium)).foregroundStyle(Theme.brand)
                    }
                    Text(trip.dateRangeText).font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                    Text("\(trip.days.count) days · \(cities) cit\(cities == 1 ? "y" : "ies") · \(plans) plans")
                        .font(.subheadline).foregroundStyle(Theme.textSecondary)
                    if !trip.notes.isEmpty {
                        Text(trip.notes).font(.callout).foregroundStyle(Theme.textSecondary)
                    }
                }
                TripCoverageCard(trip: trip, items: all,
                                 days: trip.legs.first { $0.id == focusLeg }.map { leg in trip.days.filter { leg.contains($0) } }) {
                    scrollTarget = $0
                }
                let leg = trip.legs.first { $0.id == focusLeg }
                TripCostsCard(costs: TripCosts(items: all.filter { item in leg.map { l in item.day.map(l.contains) == true } ?? true }),
                              scope: leg.map { $0.name } ?? "this trip")
                Divider().padding(.vertical, Space.xs)
                Text("Select a plan to see and edit it here. Drag plans to reorder a day or move them to another; ⌘↑ and ⌘↓ move the selected plan, ⌘N adds one.")
                    .font(.callout).foregroundStyle(Theme.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Space.xl)
        }
    }

    /// What the map shows: the selected plan's day in order, the selected
    /// plans, the ideas, the picked city, or the whole trip.
    private func mapStops(_ trip: Trip, selected: [TripItem], all: [TripItem]) -> [TripItem] {
        mapStopsIncludingCancelled(trip, selected: selected, all: all).filter { !$0.isCancelled }
    }

    private func mapStopsIncludingCancelled(_ trip: Trip, selected: [TripItem], all: [TripItem]) -> [TripItem] {
        if selected.count == 1, let item = selected.first {
            if let day = item.day, trip.days.contains(day) {
                return store.items(in: trip.id, day: day).filter { $0.place != nil }
            }
            return ideaItems(trip).filter { $0.place != nil }
        }
        if selected.count > 1 { return selected.filter { $0.place != nil } }
        if let leg = trip.legs.first(where: { $0.id == focusLeg }) {
            return all.filter { item in item.place != nil && item.day.map(leg.contains) == true }
        }
        return all.filter { $0.place != nil }
    }

    private func mapIsOneDay(_ selected: [TripItem]) -> Bool {
        selected.count == 1 && selected.first?.day != nil
    }

    // MARK: Menus

    @ViewBuilder
    private func planMenu(_ ids: Set<String>, trip: Trip) -> some View {
        if ids.count == 1, let item = store.items.first(where: { $0.id == ids.first }) {
            if item.kind == .transit {
                Button("Edit Ticket…", systemImage: "ticket") { editingTicket = item }
            }
            if let url = item.place?.mapsURL {
                Link(destination: url) { Label("Open in Apple Maps", systemImage: "map") }
            }
            if let url = item.place?.googleMapsURL {
                Link(destination: url) { Label("Open in Google Maps", systemImage: "globe") }
            }
            if let address = item.place?.address, !address.isEmpty {
                Button("Copy Address", systemImage: "doc.on.doc") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(address, forType: .string)
                }
            }
            Divider()
        }
        if !ids.isEmpty {
            Menu("Move to", systemImage: "calendar") { moveMenu(ids, trip: trip) }
            Button("Duplicate", systemImage: "plus.square.on.square") { duplicate(ids, trip: trip) }
            Divider()
            Button("Delete", systemImage: "trash", role: .destructive) { deletePlans(ids, trip: trip) }
        }
    }

    @ViewBuilder
    private func moveMenu(_ ids: Set<String>, trip: Trip) -> some View {
        Button("Ideas") { place(Array(ids), on: nil, before: nil, trip: trip) }
        Divider()
        ForEach(Array(trip.days.enumerated()), id: \.element) { i, day in
            let city = trip.leg(for: day).map { " · \($0.name)" } ?? ""
            Button("Day \(i + 1) · \(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))\(city)") {
                place(Array(ids), on: day, before: nil, trip: trip)
            }
        }
    }

    /// Return: type a new title for the selected plan.
    private func renameSelected() -> KeyPress.Result {
        guard selection.count == 1 else { return .ignored }
        showInspector = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { titleFocused = true }
        return .handled
    }

    /// Double-click: a flight or train opens its ticket; anything else, its title.
    private func openPrimary(_ ids: Set<String>, trip: Trip) {
        guard ids.count == 1, let item = store.items.first(where: { $0.id == ids.first }) else { return }
        selection = [item.id]
        if item.kind == .transit {
            editingTicket = item
        } else {
            showInspector = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { titleFocused = true }
        }
    }

    // MARK: Data

    private func ideaItems(_ trip: Trip) -> [TripItem] {
        let days = trip.days
        return store.items(in: trip.id)
            .filter { $0.day.map { !days.contains($0) } ?? true }
            .filter(matches)
            .sorted { $0.createdAt < $1.createdAt }
    }

    private func shownPlans(_ trip: Trip, day: String) -> [TripItem] {
        store.items(in: trip.id, day: day).filter(matches)
    }

    /// While searching, only days with a match.
    private func visibleDays(_ trip: Trip) -> [String] {
        guard !search.isEmpty else { return trip.days }
        return trip.days.filter { !shownPlans(trip, day: $0).isEmpty }
    }

    private func matches(_ item: TripItem) -> Bool {
        let query = search.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return true }
        return [item.title, item.place?.name ?? "", item.place?.address ?? "", item.notes, item.kind.label]
            .contains { $0.localizedCaseInsensitiveContains(query) }
    }

    /// Your Eats score for a trip meal, once you've ranked it.
    private func score(_ item: TripItem) -> Double? {
        guard item.kind == .meal else { return nil }
        let entry = eatsBook.place(forTripItem: item.id) ?? item.place.flatMap { spot in
            let probe = EatsPlace(name: spot.name, place: spot)
            return eatsBook.mine.first { $0.isSamePlace(as: probe) }
        }
        return entry.flatMap { eatsBook.scores[$0.id] }
    }

    /// The day the next plan goes on: the selected plan's, else the picked
    /// city's first, else the first day.
    private func currentDay(_ trip: Trip) -> String? {
        if let id = selection.first, let day = store.items.first(where: { $0.id == id })?.day, trip.days.contains(day) {
            return day
        }
        if let leg = trip.legs.first(where: { $0.id == focusLeg }) { return trip.days.first { $0 >= leg.startDay } }
        return trip.days.first
    }

    // MARK: Changes

    /// Puts the cursor in quick add. `day` nil = wherever the selection is; `.some(nil)` = Ideas.
    private func focusQuickAdd(day: String??) {
        if let day { quickTarget = day }
        quickAddFocused = true
    }

    private func addPlan(_ trip: Trip, day: String?? = .none) {
        let target: String? = day ?? currentDay(trip)
        var item = TripItem(tripID: trip.id, day: target)
        if let target, let last = store.items(in: trip.id, day: target).last(where: { $0.sortKey < TripItem.untimedKey }) {
            item.order = last.sortKey + 15
        }
        withAnimation(.snappy) { store.save(item) }
        selection = [item.id]
        if target != nil { scrollTarget = item.id }
        // Wait a beat so the inspector for the new plan exists before focusing it.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { titleFocused = true }
    }

    /// Deletes plans straight away (no confirmation); the bar offers Undo for a few seconds.
    private func deletePlans(_ ids: Set<String>, trip: Trip) {
        let doomed = store.items(in: trip.id).filter { ids.contains($0.id) }
        guard !doomed.isEmpty else { return }
        withAnimation(.snappy) { doomed.forEach(store.delete) }
        selection.subtract(ids)
        let note = doomed.count == 1 ? "Deleted 1 plan" : "Deleted \(doomed.count) plans"
        undoManager?.setActionName(doomed.count == 1 ? "Delete Plan" : "Delete Plans")
        withAnimation(.snappy) { deletedNote = note }
        Task {
            try? await Task.sleep(for: .seconds(6))
            if deletedNote == note { withAnimation(.snappy) { deletedNote = nil } }
        }
    }

    /// ⌘B: the selected plans are booked; if they all already are, they go back to not booked.
    private func markBooked(_ trip: Trip) {
        let chosen = store.items(in: trip.id).filter { selection.contains($0.id) }
        let allBooked = !chosen.isEmpty && chosen.allSatisfy { $0.bookingStatus == .booked }
        for var item in chosen {
            item.setStatus(allBooked ? (item.needsBooking ? .planned : nil) : .booked)
            store.save(item)
        }
    }

    // MARK: Menu actions (Plan, Go and Edit menus)

    private func selectedItems(_ trip: Trip) -> [TripItem] {
        store.items(in: trip.id).filter { selection.contains($0.id) }
    }

    /// ⌥⌘↑ / ⌥⌘↓: the selected plans go to the end of the day before or after.
    private func moveSelectedDays(_ direction: Int, trip: Trip) {
        let days = trip.days
        for item in selectedItems(trip) {
            guard let day = item.day, let i = days.firstIndex(of: day) else { continue }
            let target = i + direction
            guard days.indices.contains(target) else { continue }
            place([item.id], on: days[target], before: nil, trip: trip)
        }
    }

    /// ⌘⏎: opens the first selected plan that has a place in Apple Maps.
    private func openSelectedInMaps() {
        guard let url = store.items.first(where: { selection.contains($0.id) && $0.place?.mapsURL != nil })?.place?.mapsURL else { return }
        NSWorkspace.shared.open(url)
    }

    private func setKind(_ kind: TripItem.Kind, trip: Trip) {
        for var item in selectedItems(trip) where item.kind != kind {
            item.kind = kind
            store.save(item)
        }
    }

    private func editSelectedTicket() {
        guard selection.count == 1, let item = store.items.first(where: { $0.id == selection.first }), item.kind == .transit else { return }
        editingTicket = item
    }

    /// ⌘] / ⌘[: scroll to the next or previous city's first day.
    private func stepCity(_ direction: Int, trip: Trip) {
        let legs = trip.legs
        guard !legs.isEmpty else { return }
        let here: Int
        if let id = focusLeg, let i = legs.firstIndex(where: { $0.id == id }) {
            here = i
        } else if let day = currentDay(trip), let leg = trip.leg(for: day), let i = legs.firstIndex(where: { $0.id == leg.id }) {
            here = i
        } else {
            here = direction > 0 ? -1 : legs.count
        }
        let next = here + direction
        guard legs.indices.contains(next) else { return }
        if page == nil { ownFocusLeg = legs[next].id }
        if let day = trip.days.first(where: { legs[next].contains($0) }) { scrollTarget = day }
    }

    /// ⌘C: the plans as Wooli plans (to paste into a trip) and as readable text (for Notes or Messages).
    private func copyPlans(trip: Trip) {
        let chosen = selectedItems(trip).sorted { ($0.day ?? "", $0.sortKey) < ($1.day ?? "", $1.sortKey) }
        guard !chosen.isEmpty else { return }
        let text = chosen.map { item -> String in
            let name = item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title
            return [name, item.place?.name == name ? nil : item.place?.name, item.place?.address]
                .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        }.joined(separator: "\n")
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
        if let data = try? JSONEncoder().encode(chosen) { pb.setData(data, forType: Self.plansType) }
    }

    static let plansType = NSPasteboard.PasteboardType("com.timothyeng.wooli.trip-plans")

    /// ⌘V: copies of the plans go on the selected day; plain text becomes one plan per line.
    private func pastePlans(trip: Trip) {
        let day = currentDay(trip)
        let pb = NSPasteboard.general
        var added: [String] = []
        if let data = pb.data(forType: Self.plansType), let plans = try? JSONDecoder().decode([TripItem].self, from: data) {
            for var copy in plans {
                copy.id = UUID().uuidString
                copy.tripID = trip.id
                copy.systemFields = nil
                copy.createdAt = .now
                copy.day = day
                if copy.time == nil, let day, let last = store.items(in: trip.id, day: day).last(where: { $0.sortKey < TripItem.untimedKey }) {
                    copy.order = last.sortKey + 15
                }
                store.save(copy)
                added.append(copy.id)
            }
        } else if let text = pb.string(forType: .string) {
            for line in text.split(whereSeparator: \.isNewline).map({ $0.trimmingCharacters(in: .whitespaces) }) where !line.isEmpty {
                let request = QuickAddParser.parse(line)
                let title = request.query.isEmpty ? line : request.query
                var item = TripItem(tripID: trip.id, day: day, kind: request.kind ?? .activity, title: title)
                item.time = request.time
                var extras = ItemExtras(); extras.source = "paste"
                item.extras = extras
                if item.time == nil, let day, let last = store.items(in: trip.id, day: day).last(where: { $0.sortKey < TripItem.untimedKey }) {
                    item.order = last.sortKey + 15
                }
                store.save(item)
                added.append(item.id)
            }
        }
        if !added.isEmpty { selection = Set(added) }
    }

    private func duplicate(_ ids: Set<String>, trip: Trip) {
        var copies: [String] = []
        for item in store.items(in: trip.id) where ids.contains(item.id) {
            var copy = item
            copy.id = UUID().uuidString
            copy.systemFields = nil
            copy.createdAt = .now
            if let order = item.order ?? item.time.map(Double.init) { copy.order = order + 0.5 }
            store.save(copy)
            copies.append(copy.id)
        }
        selection = Set(copies)
    }

    /// ⌘↑ / ⌘↓: one place up or down in its day, and past the top or bottom
    /// onto the day before or after.
    private func nudge(_ direction: Int, trip: Trip) {
        guard selection.count == 1, let id = selection.first,
              let item = store.items.first(where: { $0.id == id }), let day = item.day,
              let dayIndex = trip.days.firstIndex(of: day) else { return }
        let list = store.items(in: trip.id, day: day)
        guard let i = list.firstIndex(where: { $0.id == id }) else { return }
        if direction < 0 {
            if i > 0 {
                place([id], on: day, before: list[i - 1].id, trip: trip)
            } else if dayIndex > 0 {
                place([id], on: trip.days[dayIndex - 1], before: nil, trip: trip)
            }
        } else {
            if i < list.count - 1 {
                place([id], on: day, before: i + 2 < list.count ? list[i + 2].id : nil, trip: trip)
            } else if dayIndex < trip.days.count - 1 {
                let next = trip.days[dayIndex + 1]
                place([id], on: next, before: store.items(in: trip.id, day: next).first?.id, trip: trip)
            }
        }
        scrollTarget = id
    }

    /// Puts plans on `day` (nil = Ideas), just before `before` (nil = at the
    /// end), between their new neighbours' times or dragged places. Shown
    /// times never change; only if the day was out of order do later plans
    /// shift to keep it.
    private func place(_ ids: [String], on day: String?, before: String?, trip: Trip) {
        let moving = store.items(in: trip.id).filter { ids.contains($0.id) }
            .sorted { ($0.day ?? "", $0.sortKey, $0.createdAt) < ($1.day ?? "", $1.sortKey, $1.createdAt) }
        guard !moving.isEmpty else { return }

        guard let day else {
            withAnimation(.snappy) {
                for var item in moving where item.day != nil {
                    item.day = nil
                    item.order = nil
                    store.save(item)
                }
            }
            return
        }

        let rest = store.items(in: trip.id, day: day).filter { !ids.contains($0.id) }
        let index = before.flatMap { id in rest.firstIndex { $0.id == id } } ?? rest.count
        let prev = index > 0 ? rest[index - 1].sortKey : nil
        let next = index < rest.count ? rest[index].sortKey : nil
        let n = Double(moving.count)

        var placed: [TripItem] = []
        for (k, original) in moving.enumerated() {
            var item = original
            if item.day != day {
                // A multi-night stay keeps its number of nights.
                if let from = item.day, item.stayEnd != nil, let end = item.checkOutDay {
                    let shift = Calendar.current.dateComponents([.day], from: DayKey.date(from), to: DayKey.date(day)).day ?? 0
                    item.checkOutDay = Calendar.current.date(byAdding: .day, value: shift, to: DayKey.date(end)).map(DayKey.key)
                }
                item.day = day
            }
            let step = Double(k + 1)
            switch (prev, next) {
            case (nil, nil):
                item.order = 9 * 60 + 15 * (step - 1)
            case (nil, let next?):
                item.order = next - 15 * (n - step + 1)
            case (let prev?, nil):
                item.order = prev + 15 * step
            case (let prev?, let next?):
                if next >= TripItem.untimedKey && prev < TripItem.untimedKey {
                    item.order = prev + 15 * step
                } else {
                    item.order = prev + (next - prev) * step / (n + 1)
                }
            }
            placed.append(item)
        }

        var list = rest
        list.insert(contentsOf: placed, at: index)
        var changed = placed
        var last = -Double.infinity
        for item in list {
            var item = changed.first(where: { $0.id == item.id }) ?? item
            if item.sortKey <= last {
                item.order = last + 1
                changed.removeAll { $0.id == item.id }
                changed.append(item)
            }
            last = item.sortKey
        }
        withAnimation(.snappy) { changed.forEach(store.save) }
    }

    /// The first plan from `index` on that isn't being moved: the dragged
    /// plans land just before it.
    private static func following(_ index: Int, in plans: [TripItem], skipping ids: [String]) -> String? {
        plans.dropFirst(index).first { !ids.contains($0.id) }?.id
    }

    /// Trip plan IDs from dragged text, ignoring anything else dropped.
    private static func ids(in texts: [String]) -> [String] {
        texts.filter { $0.hasPrefix(TripItem.dragPrefix) }.map { String($0.dropFirst(TripItem.dragPrefix.count)) }
    }

    private static func ids(from providers: [NSItemProvider], then perform: @escaping ([String]) -> Void) {
        var texts: [String] = []
        let group = DispatchGroup()
        for provider in providers {
            group.enter()
            _ = provider.loadObject(ofClass: NSString.self) { object, _ in
                DispatchQueue.main.async {
                    if let text = object as? String { texts.append(text) }
                    group.leave()
                }
            }
        }
        group.notify(queue: .main) {
            let ids = ids(in: texts)
            if !ids.isEmpty { perform(ids) }
        }
    }

    private func invite(_ trip: Trip) {
        guard !store.isSample(trip.id) else {
            store.lastError = "A sample trip only lives on this \(ThisDevice.name). Make your own trip to invite people."
            return
        }
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

// MARK: - Rows

/// One plan on one line: icon, title, where, and a time only for travel and stays.
struct MacPlanLine: View {
    let item: TripItem
    let day: String?
    var score: Double?

    private var name: String { item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title }
    private var tint: Color { Color(hex: item.kind.colorHex) }

    var body: some View {
        HStack(spacing: Space.s) {
            Image(systemName: item.kind == .transit ? MacPlanLine.transitSymbol(item) : item.kind.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(item.isMealPlaceholder ? tint : item.kind.onColor)
                .frame(width: 22, height: 22)
                .background(item.isMealPlaceholder ? AnyShapeStyle(tint.opacity(0.12)) : AnyShapeStyle(tint.gradient), in: Circle())
            Text(name)
                .font(item.kind == .transit || item.kind == .stay ? .body.weight(.semibold) : .body)
                .foregroundStyle(item.isMealPlaceholder ? Theme.textSecondary : Theme.text)
                .lineLimit(1)
            if let detail {
                Text(detail).font(.callout).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            Spacer(minLength: Space.s)
            if !item.notes.isEmpty {
                Image(systemName: "text.alignleft").font(.caption).foregroundStyle(Theme.textTertiary)
                    .help(item.notes)
            }
            if let score {
                MealScoreBadge(score: score, size: 22)
            }
            if item.kind == .stay, item.stayEnd != nil {
                Text("\(item.nights) night\(item.nights == 1 ? "" : "s")")
                    .font(.caption.weight(.semibold)).foregroundStyle(item.kind.onColor)
                    .padding(.horizontal, Space.s).padding(.vertical, 2)
                    .background(tint.gradient, in: Capsule())
            }
            if let price = item.priceText {
                Text(price).font(.callout.weight(.semibold)).monospacedDigit().foregroundStyle(Theme.text)
            }
            if let time = timeText {
                Text(time).font(.callout).monospacedDigit().foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(.vertical, 2)
        .contentShape(Rectangle())
    }

    /// The place, when the title is something else.
    private var detail: String? {
        guard let place = item.place, place.name != name else { return nil }
        return place.name
    }

    private var timeText: String? {
        guard let start = item.timeText else { return nil }
        if item.kind == .transit, let depart = item.time, let arrive = item.transport?.arriveTime {
            return "\(TripTransport.timeText(depart))–\(TripTransport.timeText(arrive))"
        }
        return start
    }

    static func transitSymbol(_ item: TripItem) -> String {
        switch item.transport?.mode {
        case .flight: "airplane"
        case .train: "tram.fill"
        default: TripItem.Kind.transit.symbol
        }
    }
}

/// One day as a column: travel and stays stand out, other plans in order.
struct MacDayColumn<MenuContent: View>: View {
    let trip: Trip
    let day: String
    let plans: [TripItem]
    let staying: [TripItem]
    var slots: [OpenSlot] = []
    @Binding var selection: Set<String>
    let score: (TripItem) -> Double?
    var onOpenSlot: (OpenSlot) -> Void = { _ in }
    let onAdd: () -> Void
    let onOpen: (String) -> Void
    let onDrop: (_ ids: [String], _ before: String?) -> Void
    @ViewBuilder let menu: (Set<String>) -> MenuContent
    @State private var targeted: String?

    var body: some View {
        let number = (trip.days.firstIndex(of: day) ?? 0) + 1
        let isToday = day == DayKey.key(.now)
        VStack(alignment: .leading, spacing: Space.s) {
            HStack(alignment: .center, spacing: Space.s) {
                Text("\(number)")
                    .font(.headline.weight(.bold)).monospacedDigit().foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background((isToday ? Theme.brand : Theme.Group.travel.color).gradient, in: Circle())
                    .shadow(color: Theme.Group.travel.color.opacity(0.35), radius: 3, y: 1)
                VStack(alignment: .leading, spacing: 0) {
                    Text(DayKey.date(day).formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                        .font(.headline).foregroundStyle(isToday ? Theme.brand : Theme.text)
                    Text([trip.leg(for: day).map { "\($0.emoji) \($0.name)" }, trip.dayTitles[day]]
                        .compactMap { $0?.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                }
                Spacer()
                Button("Add to Day \(number)", systemImage: "plus", action: onAdd)
                    .labelStyle(.iconOnly).buttonStyle(.borderless)
            }
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xs) {
                    ForEach(plans) { item in
                        card(item)
                            .overlay(alignment: .top) {
                                if targeted == item.id {
                                    Capsule().fill(Theme.brand).frame(height: 3).offset(y: -4)
                                }
                            }
                            .dropDestination(for: String.self) { texts, _ in
                                drop(texts, before: item.id)
                            } isTargeted: { on in
                                targeted = on ? item.id : (targeted == item.id ? nil : targeted)
                            }
                    }
                    ForEach(slots) { slot in
                        Button { onOpenSlot(slot) } label: { OpenSlotRow(slot: slot) }
                            .buttonStyle(.plain)
                            .padding(.horizontal, Space.s).padding(.vertical, Space.xs)
                    }
                    ForEach(staying) { stay in
                        Label(stay.stayEnd == day ? "Check out · \(stay.title)" : "At \(stay.title)",
                              systemImage: stay.stayEnd == day ? "door.left.hand.open" : "bed.double")
                            .font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(1)
                            .padding(.horizontal, Space.s).padding(.top, Space.xs)
                    }
                    // The empty space below takes drops at the end of the day.
                    Color.clear.frame(minHeight: 80)
                        .contentShape(Rectangle())
                        .overlay(alignment: .top) {
                            if targeted == "end" { Capsule().fill(Theme.brand).frame(height: 3) }
                        }
                        .dropDestination(for: String.self) { texts, _ in
                            drop(texts, before: nil)
                        } isTargeted: { on in
                            targeted = on ? "end" : (targeted == "end" ? nil : targeted)
                        }
                }
            }
            .scrollIndicators(.never)
        }
        .padding(Space.m)
        .frame(width: 230)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
            .strokeBorder(isToday ? Theme.brand : Theme.border))
    }

    private func drop(_ texts: [String], before: String?) -> Bool {
        targeted = nil
        let ids = texts.filter { $0.hasPrefix(TripItem.dragPrefix) }.map { String($0.dropFirst(TripItem.dragPrefix.count)) }
        guard !ids.isEmpty else { return false }
        onDrop(ids, before)
        return true
    }

    private func card(_ item: TripItem) -> some View {
        let selected = selection.contains(item.id)
        let tint = Color(hex: item.kind.colorHex)
        let timed = item.kind == .transit || item.kind == .stay
        return Group {
            if item.kind == .transit { ticket(item) } else { plainCard(item, tint: tint, timed: timed) }
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.small, style: .continuous)
            .strokeBorder(selected ? Theme.brand : .clear, lineWidth: 2))
        .contentShape(RoundedRectangle(cornerRadius: Radius.small))
        .onTapGesture(count: 2) { onOpen(item.id) }
        .onTapGesture {
            let flags = NSEvent.modifierFlags
            if flags.contains(.command) {
                if selected { selection.remove(item.id) } else { selection.insert(item.id) }
            } else if flags.contains(.shift), !selection.isEmpty {
                selection.insert(item.id)
            } else {
                selection = [item.id]
            }
        }
        .draggable(TripItem.dragPrefix + item.id)
        .contextMenu { menu(selected ? selection : [item.id]) }
    }

    /// Travel as a little boarding pass: time, the route with a dashed line, and the mode's icon.
    private func ticket(_ item: TripItem) -> some View {
        let t = item.transport
        let from = [t?.fromAirport, t?.fromStation?.name].compactMap { $0 }.first { !$0.isEmpty }
        let to = [t?.toAirport, t?.toStation?.name].compactMap { $0 }.first { !$0.isEmpty }
        return VStack(alignment: .leading, spacing: Space.xs) {
            HStack {
                if let time = item.timeText {
                    Text(time).font(.caption.weight(.bold)).monospacedDigit()
                }
                Spacer()
                if let arrive = t?.arriveTime {
                    Text(TripTransport.timeText(arrive)).font(.caption.weight(.bold)).monospacedDigit()
                }
            }
            .foregroundStyle(.white.opacity(0.85))
            HStack(spacing: Space.xs) {
                Text(from ?? "").font(.callout.weight(.heavy)).lineLimit(1)
                Line().stroke(style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1).opacity(0.6)
                Image(systemName: MacPlanLine.transitSymbol(item))
                    .font(.caption2.weight(.bold)).foregroundStyle(Theme.Group.travel.color)
                    .frame(width: 22, height: 22)
                    .background(.white, in: Circle())
                Line().stroke(style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1).opacity(0.6)
                Text(to ?? "").font(.callout.weight(.heavy)).lineLimit(1)
            }
            .foregroundStyle(.white)
            if from == nil || to == nil {
                Text(item.title.isEmpty ? "Travel" : item.title)
                    .font(.caption.weight(.semibold)).foregroundStyle(.white).lineLimit(2)
            }
            if let price = item.priceText {
                Text(price).font(.caption.weight(.bold)).monospacedDigit().foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .padding(Space.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient(colors: [Theme.Group.travel.color, Theme.brand],
                                   startPoint: .topLeading, endPoint: .bottomTrailing),
                    in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
        .shadow(color: Theme.Group.travel.color.opacity(0.3), radius: 4, y: 2)
    }

    private func plainCard(_ item: TripItem, tint: Color, timed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: Space.xs) {
                Image(systemName: item.kind == .transit ? MacPlanLine.transitSymbol(item) : item.kind.symbol)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(timed ? item.kind.onColor : tint)
                if let time = item.timeText {
                    Text(time).font(.caption.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(timed ? item.kind.onColor : Theme.textSecondary)
                }
                Spacer(minLength: 0)
                if let price = item.priceText {
                    Text(price).font(.caption.weight(.bold)).monospacedDigit()
                        .foregroundStyle(timed ? item.kind.onColor : Theme.text)
                }
                if let score = score(item) { MealScoreBadge(score: score, size: 18) }
            }
            Text(item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title)
                .font(.callout.weight(timed ? .semibold : .regular))
                .foregroundStyle(timed ? item.kind.onColor : Theme.text)
                .lineLimit(2)
            if let place = item.place, place.name != item.title, !timed {
                Text(place.name).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
        }
        .padding(Space.s)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(timed ? AnyShapeStyle(tint.gradient) : AnyShapeStyle(tint.opacity(0.1)),
                    in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
        .shadow(color: tint.opacity(timed ? 0.3 : 0), radius: 4, y: 2)
    }
}

// MARK: - Map

/// The trip's places on the map. One day shows its stops numbered in order
/// with the route between them; clicking a pin selects its plan.
struct MacTripMap: View {
    let stops: [TripItem]
    let numbered: Bool
    @Binding var selection: Set<String>
    @State private var position: MapCameraPosition = .automatic
    @State private var routes: [MKRoute] = []

    private var key: String { stops.map(\.id).joined(separator: ",") + (numbered ? "#" : "") }

    /// Frames every stop with a margin; one stop gets a neighbourhood around it.
    static func fit(_ stops: [TripItem]) -> MapCameraPosition {
        let points = stops.compactMap(\.place).map(\.coordinate)
        guard let first = points.first else { return .automatic }
        var minLat = first.latitude, maxLat = first.latitude, minLon = first.longitude, maxLon = first.longitude
        for p in points {
            minLat = min(minLat, p.latitude); maxLat = max(maxLat, p.latitude)
            minLon = min(minLon, p.longitude); maxLon = max(maxLon, p.longitude)
        }
        let center = CLLocationCoordinate2D(latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max((maxLat - minLat) * 1.5, 0.02),
                                    longitudeDelta: max((maxLon - minLon) * 1.5, 0.02))
        return .region(MKCoordinateRegion(center: center, span: span))
    }

    var body: some View {
        Map(position: $position, selection: Binding<String?>(
            get: { selection.count == 1 ? selection.first : nil },
            set: { if let id = $0 { selection = [id] } }
        )) {
            ForEach(routes, id: \.self) { route in
                MapPolyline(route.polyline).stroke(Theme.brand.opacity(0.7), lineWidth: 4)
            }
            ForEach(Array(stops.enumerated()), id: \.element.id) { index, item in
                if let place = item.place {
                    Group {
                        if numbered {
                            Marker(item.title.isEmpty ? place.name : item.title, monogram: Text("\(index + 1)"),
                                   coordinate: place.coordinate)
                        } else {
                            Marker(item.title.isEmpty ? place.name : item.title, systemImage: item.kind.symbol,
                                   coordinate: place.coordinate)
                        }
                    }
                    .tint(Color(hex: item.kind.colorHex))
                    .tag(item.id)
                }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .mapControls {
            MapZoomStepper()
            MapCompass()
        }
        .overlay {
            if stops.isEmpty {
                Text("No places to show")
                    .font(.footnote.weight(.medium)).foregroundStyle(Theme.textSecondary)
                    .padding(.horizontal, Space.m).padding(.vertical, Space.s)
                    .background(.regularMaterial, in: Capsule())
            }
        }
        .overlay(alignment: .topLeading) { RecenterButton(position: $position) }
        .task(id: key) {
            withAnimation(.easeInOut(duration: 0.4)) { position = Self.fit(stops) }
            routes = []
            guard numbered, stops.count > 1 else { return }
            let found = await DayMapView.routes(between: stops).map(\.route)
            if !Task.isCancelled { routes = found }
        }
    }
}

// MARK: - Inspector

/// The selected plan, edited in place; changes save a moment after you stop typing.
struct MacPlanInspector: View {
    let trip: Trip
    var titleFocused: FocusState<Bool>.Binding
    let score: Double?
    let onEditTicket: (TripItem) -> Void
    let onDelete: () -> Void

    private let itemID: String
    @State private var store = TripStore.shared
    /// Never optional: when the plan is deleted this view goes away, and an
    /// unwrapped binding to a vanished copy would crash first.
    @State private var draft: TripItem
    @State private var saveTask: Task<Void, Never>?
    @State private var searchingPlace = false

    init(trip: Trip, item: TripItem, titleFocused: FocusState<Bool>.Binding, score: Double?,
         onEditTicket: @escaping (TripItem) -> Void, onDelete: @escaping () -> Void) {
        self.trip = trip
        self.itemID = item.id
        self.titleFocused = titleFocused
        self.score = score
        self.onEditTicket = onEditTicket
        self.onDelete = onDelete
        _draft = State(initialValue: item)
    }

    private var stored: TripItem? { store.items.first { $0.id == itemID } }

    var body: some View {
        form($draft)
        .onChange(of: stored) { _, new in
            // Someone else's change (or a drag) shows unless you're mid-edit.
            if saveTask == nil, let new { draft = new }
        }
        .onChange(of: draft) { _, new in
            guard let stored, !Self.sameEdits(new, stored) else { return }
            saveTask?.cancel()
            saveTask = Task {
                try? await Task.sleep(for: .milliseconds(700))
                guard !Task.isCancelled else { return }
                commit()
            }
        }
        .onDisappear { commit() }
        .sheet(isPresented: $searchingPlace) {
            NavigationStack {
                PlaceSearchView(near: arrivingLeg ?? trip.destination) { place in
                    draft.place = place
                    if draft.title.isEmpty { draft.title = place.name }
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { searchingPlace = false } }
                }
            }
            .frame(minWidth: 480, idealWidth: 540, minHeight: 560, idealHeight: 640)
        }
    }

    private func form(_ item: Binding<TripItem>) -> some View {
        Form {
            Section {
                hero(item)
            }
            .listRowBackground(Color.clear)
            Section {
                Picker("Type", selection: item.kind) {
                    ForEach(TripItem.Kind.picker(for: item.wrappedValue.kind)) { kind in
                        Label(kind.label, systemImage: kind.symbol).tag(kind)
                    }
                }
                BookingStatusPicker(item: item)
                if item.wrappedValue.kind == .transit {
                    LabeledContent("Ticket") {
                        Button(item.wrappedValue.transport == nil ? "Add Flight or Train…" : "Edit Ticket…") {
                            commit()
                            if let current = stored { onEditTicket(current) }
                        }
                    }
                }
            }

            Section("Place") {
                if let place = item.wrappedValue.place {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(place.name).font(.body.weight(.medium))
                        if !place.address.isEmpty {
                            Text(place.address).font(.caption).foregroundStyle(Theme.textSecondary).textSelection(.enabled)
                        }
                    }
                    HStack {
                        if let url = place.mapsURL { Link("Apple Maps", destination: url) }
                        if let url = place.googleMapsURL { Link("Google Maps", destination: url) }
                        Spacer()
                        Button("Remove", role: .destructive) { item.wrappedValue.place = nil }
                            .buttonStyle(.borderless)
                    }
                    .font(.callout)
                }
                Button(item.wrappedValue.place == nil ? "Find on Apple Maps…" : "Change Place…", systemImage: "magnifyingglass") {
                    searchingPlace = true
                }
            }

            Section("When") {
                Picker("Day", selection: item.day) {
                    Text("Ideas · no day yet").tag(String?.none)
                    ForEach(Array(trip.days.enumerated()), id: \.element) { i, day in
                        Text("Day \(i + 1) · \(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))")
                            .tag(String?.some(day))
                    }
                }
                if item.wrappedValue.kind == .stay, let checkIn = item.wrappedValue.day {
                    Picker("Check-out", selection: item.checkOutDay) {
                        Text("Not set").tag(String?.none)
                        ForEach(trip.days.filter { $0 > checkIn }, id: \.self) { day in
                            let nights = Calendar.current.dateComponents([.day], from: DayKey.date(checkIn), to: DayKey.date(day)).day ?? 0
                            Text("\(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())) · \(nights) night\(nights == 1 ? "" : "s")")
                                .tag(String?.some(day))
                        }
                    }
                }
                if item.wrappedValue.day != nil {
                    Toggle(item.wrappedValue.kind == .stay ? "Check-in time" : item.wrappedValue.kind == .transit ? "Departure time" : "Time", isOn: Binding(
                        get: { item.wrappedValue.time != nil },
                        set: { item.wrappedValue.time = $0 ? (item.wrappedValue.time ?? 12 * 60) : nil }
                    ))
                    if item.wrappedValue.time != nil {
                        DatePicker("Time", selection: Binding(
                            get: { TripTransport.clock(item.wrappedValue.time ?? 12 * 60) },
                            set: { item.wrappedValue.time = TripTransport.minutes($0) }
                        ), displayedComponents: .hourAndMinute)
                    }
                }
            }

            if item.wrappedValue.kind == .meal {
                Section("How was it?") {
                    if let score {
                        HStack(spacing: Space.m) {
                            MealScoreBadge(score: score, size: 32)
                            Text(EatsVerdict.label(for: score)).font(.body.weight(.medium))
                            Spacer()
                            Button("Re-rank…") { openRanking() }
                        }
                    } else {
                        Button("Rank in Eats…", systemImage: "fork.knife") { openRanking() }
                    }
                }
            }

            if item.wrappedValue.kind != .note {
                Section {
                    TripCostField(cost: item.cost, currency: item.currency,
                                  prompt: item.wrappedValue.kind == .stay ? "Total for the stay" : "Price")
                    TripPointsField(points: item.points, program: item.pointsProgram)
                } header: {
                    Text("Cost")
                } footer: {
                    if let perNight = item.wrappedValue.perNightText { Text(perNight) }
                }
            }

            Section("Notes") {
                TextField("Notes", text: item.notes, prompt: Text("Booking number, what to order…"), axis: .vertical)
                    .labelsHidden()
                    .multilineTextAlignment(.leading)
                    .lineLimit(3...12)
            }

            Section {
                Button("Delete Plan…", role: .destructive, action: onDelete)
            }
        }
        .formStyle(.grouped)
        .scrollContentBackground(.hidden)
    }

    /// The plan's kind as a coloured tag, when it is, its Eats stamp, and a
    /// big editable title, like the iPhone's place page.
    private func hero(_ item: Binding<TripItem>) -> some View {
        let value = item.wrappedValue
        let tint = Color(hex: value.kind.colorHex)
        return VStack(alignment: .leading, spacing: Space.m) {
            HStack(alignment: .center, spacing: Space.s) {
                Label(value.kind.label, systemImage: value.kind == .transit ? MacPlanLine.transitSymbol(value) : value.kind.symbol)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(value.kind.onColor)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(tint.gradient, in: Capsule())
                    .shadow(color: tint.opacity(0.35), radius: 4, y: 2)
                Text(when(value)).font(.subheadline.weight(.medium)).foregroundStyle(Theme.textSecondary)
                    .lineLimit(2)
                Spacer(minLength: 0)
                if let score { MealScoreBadge(score: score, size: 44) }
            }
            TextField("Title", text: item.title, prompt: Text(value.place?.name ?? "What's the plan?"), axis: .vertical)
                .textFieldStyle(.plain)
                .labelsHidden()
                .wooliFont(.display)
                .foregroundStyle(Theme.text)
                .lineLimit(1...3)
                .focused(titleFocused)
        }
        .padding(.vertical, Space.xs)
    }

    /// "Day 3 · Tue, Jun 2 · 3 nights · 3:00 PM", or "Ideas".
    private func when(_ item: TripItem) -> String {
        guard let day = item.day, let index = trip.days.firstIndex(of: day) else { return "Ideas · no day yet" }
        let format = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day()
        let nights = item.stayEnd.map { _ in "\(item.nights) night\(item.nights == 1 ? "" : "s")" }
        return ["Day \(index + 1)", DayKey.date(day).formatted(format), nights, item.timeText].compactMap { $0 }.joined(separator: " · ")
    }

    /// Ranking lives in the full editor, which knows how to write to Eats.
    private func openRanking() {
        commit()
        if let current = stored { onEditTicket(current) }
    }

    private var arrivingLeg: String? { draft.day.flatMap { trip.leg(for: $0)?.name } }

    /// The fields this inspector edits.
    private static func sameEdits(_ a: TripItem, _ b: TripItem) -> Bool {
        a.title == b.title && a.kind == b.kind && a.place == b.place && a.notes == b.notes
            && a.day == b.day && a.checkOutDay == b.checkOutDay && a.time == b.time
            && a.cost == b.cost && a.currency == b.currency && a.points == b.points && a.pointsProgram == b.pointsProgram
    }

    /// Writes your edits onto the latest saved copy, so a drag or sync
    /// that happened meanwhile isn't undone.
    private func commit() {
        saveTask?.cancel()
        saveTask = nil
        guard var current = stored, !Self.sameEdits(draft, current) else { return }
        let oldTime = current.time
        let oldDay = current.day
        current.title = draft.title
        current.kind = draft.kind
        current.place = draft.place
        current.notes = draft.notes
        current.day = draft.day
        current.checkOutDay = draft.checkOutDay
        current.time = draft.time
        current.cost = draft.cost
        current.currency = draft.currency
        current.points = draft.points
        current.pointsProgram = draft.pointsProgram
        if current.day != oldDay {
            // A new day: it goes in by its time, or at the end.
            current.order = nil
            if current.kind == .stay, let day = current.day, (current.checkOutDay ?? "") <= day {
                let legEnd = trip.leg(for: day)?.endDay
                current.checkOutDay = legEnd.flatMap { $0 > day ? $0 : nil } ?? trip.days.first { $0 > day }
            }
        } else if current.order != nil, current.time != oldTime, let time = current.time {
            // Setting a time puts it back in time order.
            current.order = Double(time)
        }
        if current.stayEnd == nil { current.checkOutDay = nil }
        store.save(current)
    }
}
#endif

#if os(macOS)
/// What the trip's bookings cost so far: flights and trains, stays, and
/// anything else priced, with the total and what's still missing a price.
struct TripCostsCard: View {
    let costs: TripCosts
    let scope: String
    /// Cents per point you've set, by program (`PointValues`).
    @AppStorage(PointValues.key + ".changed") private var valuesChanged = 0
    @State private var valuingPoints = false

    var body: some View {
        // Re-read when a value changes (the popover bumps `valuesChanged`).
        let estimate = valuesChanged >= 0 ? PointValues.estimate(costs.points) : nil
        VStack(alignment: .leading, spacing: Space.s) {
            HStack(alignment: .firstTextBaseline) {
                Text("Costs").font(.headline).foregroundStyle(Theme.text)
                Spacer()
                if !costs.totals.isEmpty || !costs.points.isEmpty {
                    Text(TripCosts.text(costs.totals, points: costs.points))
                        .font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(Theme.text)
                        .multilineTextAlignment(.trailing)
                }
            }
            if costs.lines.isEmpty {
                Text("Add prices to flights, trains and stays to see what \(scope) costs.")
                    .font(.callout).foregroundStyle(Theme.textTertiary)
            }
            ForEach(costs.lines) { line in
                HStack(spacing: Space.s) {
                    Image(systemName: line.symbol)
                        .font(.caption.weight(.semibold)).foregroundStyle(.white)
                        .frame(width: 24, height: 24)
                        .background(Theme.Group.travel.color.gradient, in: Circle())
                    Text(line.title).font(.callout).foregroundStyle(Theme.text)
                    Text("\(line.count)").font(.caption).foregroundStyle(Theme.textTertiary)
                    Spacer()
                    Text(TripCosts.text(line.totals, points: line.points)).font(.callout.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(Theme.text)
                        .multilineTextAlignment(.trailing)
                }
            }
            if !costs.points.isEmpty {
                HStack(spacing: Space.s) {
                    if let estimate {
                        Text("Points worth ≈ \(TripItem.money(estimate.rounded(), TripItem.homeCurrency)) at your values")
                            .font(.caption).foregroundStyle(Theme.textSecondary)
                    }
                    Spacer()
                    Button(estimate == nil ? "Value points…" : "Edit values…") { valuingPoints = true }
                        .buttonStyle(.link).font(.caption)
                        .popover(isPresented: $valuingPoints) {
                            PointValuesEditor(programs: costs.points.keys.sorted()) { valuesChanged += 1 }
                        }
                }
            }
            if costs.unpriced > 0 {
                Label("\(costs.unpriced) booking\(costs.unpriced == 1 ? "" : "s") without a price",
                      systemImage: "exclamationmark.circle")
                    .font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(Space.l)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
    }
}

/// Cents per point for the programs a trip uses, so its Costs card can
/// say what the points are worth. Saved on this Mac only.
struct PointValuesEditor: View {
    let programs: [String]
    var onChange: () -> Void
    @State private var values = PointValues.all

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text("What's a point worth?").font(.headline)
            Text("In cents of \(TripItem.homeCurrency). Leave blank to keep a program out of the estimate.")
                .font(.caption).foregroundStyle(Theme.textSecondary)
            Grid(alignment: .leading, horizontalSpacing: Space.m, verticalSpacing: Space.s) {
                ForEach(programs, id: \.self) { program in
                    GridRow {
                        Text(program.isEmpty ? "No program" : program)
                        TextField("Cents", value: Binding(get: { values[program] }, set: { values[program] = $0 }),
                                  format: .number.precision(.fractionLength(0...2)), prompt: Text("e.g. 1.5"))
                            .frame(width: 80)
                        Text("¢").foregroundStyle(Theme.textSecondary)
                    }
                }
            }
        }
        .padding(Space.l)
        .frame(width: 320)
        .onChange(of: values) { _, new in
            PointValues.all = new
            onChange()
        }
    }
}

/// A horizontal line, for the dashed route on a ticket.
private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        Path { p in
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        }
    }
}
#endif
