#if os(macOS)
import SwiftUI

/// The trip's checklist as a card (M4-2): packing, documents, things to book. Ticks and edits are
/// saved on the trip, so companions on a shared trip see them. Empty, it offers the last trip's list.
struct TripChecklistCard: View {
    let tripID: String
    @State private var store = TripStore.shared
    @State private var newTitle = ""
    @State private var newGroup = ""

    var body: some View {
        if let trip = store.trip(tripID) {
            let items = TripChecklist.items(trip)
            let progress = TripChecklist.progress(items)
            VStack(alignment: .leading, spacing: Space.s) {
                HStack {
                    Text("Checklist").font(.headline).foregroundStyle(Theme.text)
                    Spacer()
                    if progress.total > 0 {
                        Text("\(progress.done) of \(progress.total)").font(.caption).monospacedDigit()
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                if items.isEmpty, let last = TripChecklist.lastTripsList(for: trip, among: store.trips) {
                    Button("Start from \(last.from.name.isEmpty ? "your last trip" : last.from.name)'s list (\(last.items.count))") {
                        save(trip, TripChecklist.startingFrom(last.items))
                    }
                    .buttonStyle(.link).font(.callout)
                }
                ForEach(TripChecklist.groups(items), id: \.name) { group in
                    if !group.name.isEmpty {
                        Text(group.name).font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary).padding(.top, Space.xs)
                    }
                    ForEach(group.items) { item in
                        Button { save(trip, TripChecklist.toggling(item.id, in: items)) } label: {
                            HStack(spacing: Space.s) {
                                Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(item.done ? Theme.brand : Theme.textTertiary)
                                Text(item.title).font(.callout)
                                    .strikethrough(item.done)
                                    .foregroundStyle(item.done ? Theme.textTertiary : Theme.text)
                                Spacer(minLength: 0)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .contextMenu { Button("Remove", role: .destructive) { save(trip, TripChecklist.removing(item.id, from: items)) } }
                        .accessibilityLabel("\(item.title), \(item.done ? "done" : "not done")")
                    }
                }
                HStack(spacing: Space.s) {
                    TextField("Add an item", text: $newTitle)
                        .textFieldStyle(.plain)
                        .onSubmit { add(trip, items) }
                    Picker("Group", selection: $newGroup) {
                        Text("No group").tag("")
                        ForEach(Array(Set(TripChecklist.suggestedGroups + items.map(\.group).filter { !$0.isEmpty })).sorted(), id: \.self) {
                            Text($0).tag($0)
                        }
                    }
                    .labelsHidden().fixedSize()
                }
                if progress.done > 0 {
                    Button("Clear ticked items") { save(trip, TripChecklist.clearingDone(items)) }
                        .buttonStyle(.link).font(.caption)
                }
            }
            .padding(Space.l)
            .background(Theme.background, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
        }
    }

    private func add(_ trip: Trip, _ items: [ChecklistItem]) {
        let next = TripChecklist.adding(newTitle, group: newGroup, to: items)
        if next.count != items.count { save(trip, next) }
        newTitle = ""
    }

    /// Saves on the latest copy of the trip, so a companion's other changes aren't overwritten.
    private func save(_ trip: Trip, _ items: [ChecklistItem]) {
        var latest = store.trip(trip.id) ?? trip
        latest.extras.checklist = items.isEmpty ? nil : items
        store.save(latest)
    }
}
#endif
