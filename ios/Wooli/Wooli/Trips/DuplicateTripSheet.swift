#if os(macOS)
import SwiftUI

/// Duplicate this trip as a template (M4-4): a new name and start day, and what the copy keeps.
struct DuplicateTripSheet: View {
    let trip: Trip
    /// Called with the new trip's id once it's saved.
    var onCreated: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var store = TripStore.shared
    @State private var name = ""
    @State private var start = Date()

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text("Duplicate trip").font(.title3.weight(.semibold))
            Form {
                TextField("Name", text: $name, prompt: Text(trip.name.isEmpty ? "Trip copy" : trip.name + " copy"))
                DatePicker("Starts", selection: $start, displayedComponents: .date)
            }
            .formStyle(.columns)
            Text("Keeps the cities, ideas and plans with no time, the budget and a fresh checklist. Flights, trains, stays, reservations and prices stay behind.")
                .font(.callout).foregroundStyle(Theme.textSecondary)
            HStack {
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Button("Duplicate") { create() }.keyboardShortcut(.defaultAction)
            }
        }
        .padding(Space.l)
        .frame(width: 420)
        .onAppear {
            // Same weekday next year is a useful default for a trip you'll repeat.
            start = Calendar.current.date(byAdding: .year, value: 1, to: DayKey.date(trip.startDay)) ?? .now
        }
    }

    private func create() {
        let copy = TripTemplate.make(from: trip, items: store.items(in: trip.id), newStart: DayKey.key(start),
                                     name: name.trimmingCharacters(in: .whitespaces).isEmpty ? nil : name)
        store.save(copy.trip)
        copy.items.forEach { store.save($0) }
        dismiss()
        onCreated(copy.trip.id)
    }
}
#endif
