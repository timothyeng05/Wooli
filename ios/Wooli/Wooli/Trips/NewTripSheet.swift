#if os(macOS)
import MapKit
import SwiftUI

/// The Mac's new-trip sheet: name, start, where you leave from, then cities
/// from Apple Maps with a nights stepper each. One page, all keyboard.
struct NewTripSheet: View {
    var onCreated: (String) -> Void = { _ in }
    /// Set for Edit Trip…: the same sheet, filled in from this trip.
    let editing: Trip?
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var start: Date
    @State private var home: SetupCity?
    @State private var cities: [SetupCity]
    @State private var creating = false
    @State private var confirmMove: Int?
    @FocusState private var nameFocused: Bool

    init(editing: Trip? = nil, onCreated: @escaping (String) -> Void = { _ in }) {
        self.editing = editing
        self.onCreated = onCreated
        if let trip = editing {
            _name = State(initialValue: trip.name)
            _start = State(initialValue: DayKey.date(trip.startDay))
            _home = State(initialValue: trip.legs.first(where: \.isHome).map(SetupCity.init(leg:)))
            _cities = State(initialValue: trip.legs.filter { !$0.isHome }.map(SetupCity.init(leg:)))
        } else {
            _name = State(initialValue: "")
            _start = State(initialValue: Calendar.current.startOfDay(for: .now))
            _home = State(initialValue: TripSetup.savedHome)
            _cities = State(initialValue: [])
        }
    }

    private var suggestion: String { TripSetup.name(for: cities) }
    private var finalName: String { name.trimmingCharacters(in: .whitespaces).isEmpty ? suggestion : name }
    private var plan: (legs: [TripLeg], endDay: String) { TripSetup.legs(start: start, home: home, cities: cities) }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.l) {
            Text(editing == nil ? "New trip" : "Edit trip").font(.title2.weight(.semibold)).foregroundStyle(Theme.text)

            VStack(alignment: .leading, spacing: Space.s) {
                TextField("Trip name", text: $name, prompt: Text(suggestion.isEmpty ? "e.g. Japan in spring" : suggestion))
                    .textFieldStyle(.roundedBorder)
                    .focused($nameFocused)
                HStack {
                    DatePicker("Starts", selection: $start, displayedComponents: .date)
                    Spacer()
                }
                HStack(alignment: .top, spacing: Space.s) {
                    Text("Leaving from").foregroundStyle(Theme.textSecondary).frame(width: 96, alignment: .leading)
                    if let home {
                        HStack {
                            Label(home.display, systemImage: "house.fill").foregroundStyle(Theme.text)
                            Spacer()
                            Button("Remove Home City", systemImage: "xmark.circle.fill") { self.home = nil }
                                .labelStyle(.iconOnly).buttonStyle(.borderless).foregroundStyle(Theme.textTertiary)
                        }
                    } else {
                        CityField(prompt: "Home city (optional)") { home = $0 }
                    }
                }
            }

            VStack(alignment: .leading, spacing: Space.s) {
                Text("Cities").font(.headline).foregroundStyle(Theme.text)
                if !cities.isEmpty {
                    List {
                        ForEach($cities) { $city in cityRow($city) }
                            .onMove { cities.move(fromOffsets: $0, toOffset: $1) }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .frame(height: min(CGFloat(cities.count) * 44 + 8, 240))
                }
                CityField(prompt: cities.isEmpty ? "Add the first city…" : "Add another city…") { added in
                    cities.append(added)
                }
            }

            HStack {
                Text(summary).font(.callout).foregroundStyle(Theme.textSecondary)
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
                Button(editing == nil ? "Create" : "Save") { create() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(finalName.trimmingCharacters(in: .whitespaces).isEmpty || creating)
            }
        }
        .padding(Space.xl)
        .frame(width: 540)
        .background(Theme.card)
        .onAppear { nameFocused = true }
        .confirmationDialog("\(confirmMove ?? 0) plan\(confirmMove == 1 ? "" : "s") will move to Ideas", isPresented: Binding(
            get: { confirmMove != nil }, set: { if !$0 { confirmMove = nil } }), titleVisibility: .visible) {
            Button("Save and Move to Ideas") { confirmMove = nil; save(editing!) }
            Button("Cancel", role: .cancel) { confirmMove = nil }
        } message: {
            Text("Their days no longer exist. Nothing is deleted.")
        }
    }

    private func cityRow(_ city: Binding<SetupCity>) -> some View {
        let number = (cities.firstIndex { $0.id == city.wrappedValue.id } ?? 0) + 1
        return HStack(spacing: Space.s) {
            Text("\(number)").font(.caption.weight(.bold)).foregroundStyle(.white)
                .frame(width: 26, height: 26)
                .background(Theme.Group.travel.color.gradient, in: Circle())
            VStack(alignment: .leading, spacing: 0) {
                Text(city.wrappedValue.display).foregroundStyle(Theme.text).lineLimit(1)
                if city.wrappedValue.latitude == nil {
                    Text("Not on the map yet").font(.caption).foregroundStyle(Theme.textTertiary)
                }
            }
            Spacer()
            Stepper(value: city.nights, in: 1...60) {
                Text("\(city.wrappedValue.nights) night\(city.wrappedValue.nights == 1 ? "" : "s")")
                    .monospacedDigit().foregroundStyle(Theme.textSecondary)
            }
            Button("Remove City", systemImage: "minus.circle") { cities.removeAll { $0.id == city.wrappedValue.id } }
                .labelStyle(.iconOnly).buttonStyle(.borderless).foregroundStyle(Theme.textTertiary)
        }
    }

    private var summary: String {
        guard !cities.isEmpty else { return "Add a city to set the dates." }
        let format = Date.FormatStyle.dateTime.weekday(.abbreviated).day().month(.abbreviated)
        let nights = cities.reduce(0) { $0 + max($1.nights, 1) }
        return "\(start.formatted(format)) – \(DayKey.date(plan.endDay).formatted(format)) · \(nights) nights"
            + (home.map { " · back in \($0.name)" } ?? "")
    }

    private func create() {
        if let editing {
            let changes = changes(for: editing)
            let toIdeas = changes.values.filter { $0 == nil }.count
            if toIdeas > 0 { confirmMove = toIdeas } else { save(editing) }
            return
        }
        creating = true
        let trip = TripSetup.trip(name: finalName, start: start, home: home, cities: cities)
        TripStore.shared.save(trip)
        TripSetup.savedHome = home
        onCreated(trip.id)
        dismiss()
    }
}

extension NewTripSheet {
    /// Which plans change day when the cities or nights change.
    fileprivate func changes(for trip: Trip) -> [String: String?] {
        let new = TripSetup.trip(name: trip.name, start: start, home: home, cities: cities)
        return TripSetup.remap(items: TripStore.shared.items(in: trip.id), oldLegs: trip.legs, newLegs: new.legs, newDays: new.days)
    }

    /// Saves the trip with its new cities and dates, and moves each plan with its city.
    fileprivate func save(_ trip: Trip) {
        var updated = TripSetup.trip(name: finalName, start: start, home: home, cities: cities)
        let moves = TripSetup.remap(items: TripStore.shared.items(in: trip.id), oldLegs: trip.legs, newLegs: updated.legs, newDays: updated.days)
        // Keep everything else about the trip (notes, extras, sharing, ids).
        var merged = trip
        merged.name = updated.name
        merged.startDay = updated.startDay
        merged.endDay = updated.endDay
        merged.legs = updated.legs
        if !updated.destination.isEmpty { merged.destination = updated.destination }
        updated = merged
        TripStore.shared.save(updated)
        for var item in TripStore.shared.items(in: trip.id) {
            guard let change = moves[item.id] else { continue }
            item.day = change
            TripStore.shared.save(item)
        }
        TripSetup.savedHome = home
        onCreated(trip.id)
        dismiss()
    }
}

/// A text field with Apple Maps city suggestions listed under it. Return
/// takes the top suggestion, or the typed text as a city with no map pin.
struct CityField: View {
    let prompt: String
    let onPick: (SetupCity) -> Void
    @State private var searcher = CitySearcher()
    @State private var resolving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            TextField(prompt, text: $searcher.text)
                .textFieldStyle(.roundedBorder)
                .onSubmit { submit() }
            ForEach(searcher.results, id: \.self) { result in
                Button {
                    Task { await pick(result) }
                } label: {
                    HStack {
                        Image(systemName: "mappin.circle.fill").foregroundStyle(Theme.Group.travel.color)
                        Text(result.title).foregroundStyle(Theme.text)
                        Text(result.subtitle).font(.caption).foregroundStyle(Theme.textSecondary).lineLimit(1)
                        Spacer()
                    }
                    .padding(.vertical, Space.xs)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func submit() {
        if let first = searcher.results.first {
            Task { await pick(first) }
        } else {
            let typed = searcher.text.trimmingCharacters(in: .whitespaces)
            guard !typed.isEmpty else { return }
            onPick(SetupCity(name: typed))
            searcher.text = ""
        }
    }

    private func pick(_ result: MKLocalSearchCompletion) async {
        guard !resolving else { return }
        resolving = true
        defer { resolving = false }
        let city = await searcher.resolve(result) ?? SetupCity(name: result.title)
        onPick(city)
        searcher.text = ""
    }
}
#endif
