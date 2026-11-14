#if os(macOS)
import AppKit
import SwiftUI

/// A trip's bookings as a table (M2-2): one row per travel plan and stay, and
/// anything else with a status or confirmation code. Any column sorts.
struct MacBookingsTable: View {
    let tripID: String
    var search = ""
    /// Double-click / Return: open the plan's editor.
    var onOpen: (TripItem) -> Void

    @State private var store = TripStore.shared
    @State private var selection = Set<String>()
    @State private var sortOrder = [KeyPathComparator(\BookingRow.whenKey)]
    @State private var filter = Filter.all

    private enum Filter: String, CaseIterable, Identifiable {
        case all = "All", notBooked = "Not booked", booked = "Booked", cancelled = "Cancelled"
        var id: String { rawValue }
        func matches(_ row: BookingRow) -> Bool {
            switch self {
            case .all: true
            case .notBooked: row.status == .planned
            case .booked: row.status == .booked
            case .cancelled: row.status == .cancelled
            }
        }
    }

    var body: some View {
        if let trip = store.trip(tripID) {
            let all = TripBookings.rows(trip: trip, items: store.items(in: tripID))
            let shown = all.filter(filter.matches).filter(matchesSearch).sorted(using: sortOrder)
            VStack(spacing: 0) {
                header(all)
                Divider()
                if shown.isEmpty {
                    ContentUnavailableView(all.isEmpty ? "No bookings yet" : "Nothing matches",
                                           systemImage: "ticket",
                                           description: Text(all.isEmpty ? "Flights, trains and stays you add show up here." : "Try another filter or search."))
                } else {
                    table(shown)
                }
            }
        }
    }

    private func matchesSearch(_ row: BookingRow) -> Bool {
        let q = search.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return true }
        return [row.what, row.kindLabel, row.confirmation, row.city].contains { $0.localizedCaseInsensitiveContains(q) }
    }

    private func header(_ rows: [BookingRow]) -> some View {
        HStack {
            Text(TripBookings.summary(rows)).font(.headline).foregroundStyle(Theme.text)
            Spacer()
            Picker("Show", selection: $filter) {
                ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented).labelsHidden().fixedSize()
        }
        .padding(Space.m)
    }

    private func table(_ rows: [BookingRow]) -> some View {
        Table(rows, selection: $selection, sortOrder: $sortOrder) {
            TableColumn("Status", value: \.statusRank) { row in statusMenu(row) }
                .width(min: 90, ideal: 110)
            TableColumn("Type", value: \.kindLabel) { row in Label(row.kindLabel, systemImage: row.symbol) }
                .width(min: 80, ideal: 100)
            TableColumn("What", value: \.what) { row in
                Text(row.what).strikethrough(row.status == .cancelled).lineLimit(1)
            }
            TableColumn("When", value: \.whenKey) { row in Text(row.whenText).monospacedDigit() }
                .width(min: 110, ideal: 150)
            TableColumn("Until", value: \.untilKey) { row in Text(row.untilText).monospacedDigit() }
                .width(min: 90, ideal: 130)
            TableColumn("Confirmation", value: \.confirmation) { row in confirmation(row) }
                .width(min: 90, ideal: 120)
            TableColumn("Cost", value: \.cost) { row in Text(row.costText).monospacedDigit() }
                .width(min: 70, ideal: 110)
            TableColumn("City", value: \.city) { row in Text(row.city) }
                .width(min: 70, ideal: 100)
        }
        .contextMenu(forSelectionType: String.self) { ids in
            if !ids.isEmpty {
                Button("Mark as Booked", systemImage: "checkmark.circle") { setStatus(.booked, ids) }
                Button("Mark as Not Booked") { setStatus(.planned, ids) }
                Button("Mark as Cancelled") { setStatus(.cancelled, ids) }
                Divider()
                Button("Copy as Text", systemImage: "doc.on.doc") { copy(rows.filter { ids.contains($0.id) }) }
            }
        } primaryAction: { ids in
            if let id = ids.first, let item = store.items(in: tripID).first(where: { $0.id == id }) { onOpen(item) }
        }
    }

    /// Click the status to change it in place.
    private func statusMenu(_ row: BookingRow) -> some View {
        Menu {
            ForEach([BookingStatus.planned, .booked, .cancelled]) { status in
                Button(status.label) { setStatus(status, [row.id]) }
            }
        } label: {
            Text(row.status?.label ?? "Not set")
                .foregroundStyle(row.status == .booked ? Theme.brand : Theme.textSecondary)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }

    /// Monospaced, and one click copies it.
    @ViewBuilder
    private func confirmation(_ row: BookingRow) -> some View {
        if row.confirmation.isEmpty {
            Text("")
        } else {
            Button {
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(row.confirmation, forType: .string)
            } label: {
                Text(row.confirmation).font(.system(.body, design: .monospaced))
            }
            .buttonStyle(.plain)
            .help("Copy confirmation code")
        }
    }

    private func setStatus(_ status: BookingStatus, _ ids: Set<String>) {
        for var item in store.items(in: tripID) where ids.contains(item.id) {
            item.setStatus(status)
            store.save(item)
        }
    }

    private func copy(_ rows: [BookingRow]) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(TripBookings.copyText(rows), forType: .string)
    }
}
#endif
