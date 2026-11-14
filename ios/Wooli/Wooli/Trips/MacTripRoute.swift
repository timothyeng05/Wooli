#if os(macOS)
import SwiftUI

/// The route as a card (M3-5): cities in order with their nights, and how you get
/// from one to the next. A city with no travel plan says so. A click goes to that city.
struct TripRouteCard: View {
    let trip: Trip
    let items: [TripItem]
    var onGoToDay: (String) -> Void

    var body: some View {
        let stops = TripRoute.stops(trip: trip, items: items)
        if stops.count > 1 {
            VStack(alignment: .leading, spacing: Space.s) {
                Text("Route").font(.headline).foregroundStyle(Theme.text)
                ForEach(Array(stops.enumerated()), id: \.element.id) { index, stop in
                    if index > 0 {
                        HStack(spacing: Space.s) {
                            Image(systemName: stop.noWayThere ? "questionmark.circle" : "arrow.down")
                                .font(.caption).foregroundStyle(stop.noWayThere ? Theme.pending : Theme.textTertiary)
                                .frame(width: 20)
                            Text(stop.noWayThere ? "No travel plan yet" : stop.arrivingBy.joined(separator: " · "))
                                .font(.caption).foregroundStyle(stop.noWayThere ? Theme.pending : Theme.textSecondary)
                        }
                    }
                    Button { onGoToDay(stop.startDay) } label: {
                        HStack(spacing: Space.s) {
                            Image(systemName: "mappin.circle.fill").foregroundStyle(Theme.brand).frame(width: 20)
                            Text(stop.name).font(.callout.weight(.medium)).foregroundStyle(Theme.text)
                            Spacer(minLength: 0)
                            Text("\(stop.nights) night\(stop.nights == 1 ? "" : "s")")
                                .font(.caption).foregroundStyle(Theme.textSecondary).monospacedDigit()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Space.l)
            .background(Theme.background, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
        }
    }
}

/// The trip's free-text notes, edited where they're read (M3-5). Saves when you leave the field.
struct TripNotesField: View {
    let tripID: String
    @State private var store = TripStore.shared
    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("Notes").font(.headline).foregroundStyle(Theme.text)
            TextField("Visa, packing, who's bringing what…", text: $text, axis: .vertical)
                .lineLimit(2...10)
                .textFieldStyle(.plain)
                .focused($focused)
                .onSubmit { commit() }
                .onChange(of: focused) { _, now in if !now { commit() } }
        }
        .padding(Space.l)
        .background(Theme.background, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
        .onAppear { text = store.trip(tripID)?.notes ?? "" }
    }

    private func commit() {
        guard var trip = store.trip(tripID), trip.notes != text else { return }
        trip.notes = text
        store.save(trip)
    }
}
#endif
