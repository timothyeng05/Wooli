import SwiftUI
import MapKit

/// An activity or stay with a place, laid out like an Eats place page: a map
/// across the top, the name and when you're there, Apple's place actions,
/// then "What we did" — notes the whole trip can read later.
struct TripPlaceDetail: View {
    @State private var item: TripItem
    let trip: Trip

    @Environment(\.dismiss) private var dismiss
    @State private var mapItem: MKMapItem?
    @State private var showingListing = false
    @State private var editingPlan: TripItem?
    @State private var confirmRemove = false

    init(item: TripItem, trip: Trip) {
        _item = State(initialValue: item)
        self.trip = trip
    }

    private var tint: Color { Color(hex: item.kind.colorHex) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PlaceHeroMap(coordinate: item.place?.coordinate, name: item.place?.name ?? item.title, tint: tint) {
                        if mapItem != nil { showingListing = true }
                    }
                    VStack(alignment: .leading, spacing: 22) {
                        titleBlock
                        PlaceActionBar(place: item.place, mapItem: mapItem) { showingListing = true }
                        notes
                        rows
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.card)
            .ignoresSafeArea(edges: .top)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        TripStore.shared.save(item)
                        dismiss()
                    }
                }
            }
            .task(id: item.place) {
                guard let place = item.place else { return }
                mapItem = await PlaceMapCard.listing(for: place)
            }
            .mapItemDetailSheet(isPresented: $showingListing, item: mapItem)
            .sheet(item: $editingPlan, onDismiss: reload) { TripItemEditor(item: $0, trip: trip) }
            .confirmationDialog("Remove \(displayTitle) from the trip?", isPresented: $confirmRemove, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    TripStore.shared.delete(item)
                    dismiss()
                }
            }
        }
    }

    // MARK: Parts

    private var displayTitle: String { item.title.isEmpty ? (item.place?.name ?? item.kind.label) : item.title }

    /// "Day 3 · Tue, Jun 2 · 2:00 PM" — or "Ideas" when it has no day yet.
    private var when: String {
        guard let day = item.day else { return "Ideas · no day yet" }
        let number = (trip.days.firstIndex(of: day) ?? 0) + 1
        let format = Date.FormatStyle.dateTime.weekday(.abbreviated).month(.abbreviated).day()
        // A multi-night stay: "Day 3 · Tue, Jun 2 → Fri, Jun 5 · 3 nights · 3:00 PM"
        if let end = item.stayEnd {
            return ["Day \(number)", "\(DayKey.date(day).formatted(format)) → \(DayKey.date(end).formatted(format))",
                    "\(item.nights) night\(item.nights == 1 ? "" : "s")", item.timeText]
                .compactMap { $0 }.joined(separator: " · ")
        }
        return ["Day \(number)", DayKey.date(day).formatted(format), item.timeText]
            .compactMap { $0 }.joined(separator: " · ")
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(displayTitle)
                .font(.system(size: 34, weight: .heavy, design: .serif))
                .foregroundStyle(Theme.text)
                .lineLimit(3).minimumScaleFactor(0.7)
                .padding(.top, item.place == nil ? 0 : -PlaceHeroMap.titleOverlap)
            HStack(spacing: 10) {
                Label(item.kind.label, systemImage: item.kind.symbol)
                    .font(.subheadline.weight(.semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(tint, in: Capsule())
                Text(when).font(.subheadline.weight(.medium)).foregroundStyle(Theme.textSecondary)
            }
            if let place = item.place {
                if place.name != displayTitle {
                    Text(place.name).font(.headline).foregroundStyle(PlaceActionBar.ink)
                }
                if !place.address.isEmpty {
                    Text(place.address).font(.subheadline).foregroundStyle(Theme.textSecondary).textSelection(.enabled)
                }
            }
        }
    }

    private var notes: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("What we did").font(.title3.weight(.bold)).foregroundStyle(Theme.text)
            TextField("Highlights, what you'd do again, tips for next time…", text: $item.notes, axis: .vertical)
                .lineLimit(4...14)
                .padding(14)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            Text(trip.isShared ? "Everyone on this trip can see these notes." : "Saved with the trip.")
                .font(.caption).foregroundStyle(Theme.textTertiary)
        }
    }

    private var rows: some View {
        VStack(alignment: .leading, spacing: 0) {
            PlaceDetailRow(systemImage: "calendar") {
                PlaceDetailLink(title: "Edit plan", detail: "Day, time, place") {
                    editingPlan = TripStore.shared.items.first { $0.id == item.id } ?? item
                }
            }
            PlaceDetailRow(systemImage: "trash") {
                PlaceDetailLink(title: "Remove from trip", role: .destructive) { confirmRemove = true }
            }
        }
    }

    /// After editing the plan, pick up its new day/time/place but keep any
    /// notes typed here and not saved yet.
    private func reload() {
        guard let latest = TripStore.shared.items.first(where: { $0.id == item.id }) else {
            dismiss() // Deleted from the editor.
            return
        }
        let notes = item.notes
        item = latest
        item.notes = notes
    }
}
