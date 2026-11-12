#if os(macOS)
import MapKit
import SwiftUI

/// The Mac's new-trip sheet: name, start, where you leave from, then cities
/// from Apple Maps with a nights stepper each. One page, all keyboard.
struct NewTripSheet: View {
    var onCreated: (String) -> Void = { _ in }
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var start = Calendar.current.startOfDay(for: .now)
    @State private var home: SetupCity? = TripSetup.savedHome
    @State private var cities: [SetupCity] = []
    @State private var creating = false
    @FocusState private var nameFocused: Bool

    private var suggestion: String { TripSetup.name(for: cities) }
    private var finalName: String { name.trimmingCharacters(in: .whitespaces).isEmpty ? suggestion : name }
    private var plan: (legs: [TripLeg], endDay: String) { TripSetup.legs(start: start, home: home, cities: cities) }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.l) {
            Text("New trip").font(.title2.weight(.semibold)).foregroundStyle(Theme.text)

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
                Button("Create") { create() }
                    .keyboardShortcut(.defaultAction)
                    .buttonStyle(.borderedProminent)
                    .disabled(finalName.trimmingCharacters(in: .whitespaces).isEmpty || creating)
            }
        }
        .padding(Space.xl)
        .frame(width: 540)
        .background(Theme.card)
        .onAppear { nameFocused = true }
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
        creating = true
        let trip = TripSetup.trip(name: finalName, start: start, home: home, cities: cities)
        TripStore.shared.save(trip)
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
