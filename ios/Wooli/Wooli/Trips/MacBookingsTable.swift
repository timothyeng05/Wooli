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
    @State private var grouping = TripBookings.Grouping.none

    private enum Filter: String, CaseIterable, Identifiable {
        case all = "All", notBooked = "Not booked", booked = "Booked", cancelled = "Cancelled", withoutPrice = "No price"
        var id: String { rawValue }
        func matches(_ row: BookingRow) -> Bool {
            switch self {
            case .all: true
            case .notBooked: row.status == .planned
            case .booked: row.status == .booked
            case .cancelled: row.status == .cancelled
            case .withoutPrice: row.isTravelOrStay && row.status != .cancelled && row.cost == 0 && row.costText.isEmpty
            }
        }
    }

    var body: some View {
        if let trip = store.trip(tripID) {
            let all = TripBookings.rows(trip: trip, items: store.items(in: tripID))
            let sorted = all.filter(filter.matches).filter(matchesSearch).sorted(using: sortOrder)
            // Group by sorts the groups together (a Table has no section headers).
            let shown = TripBookings.grouped(sorted, by: grouping).flatMap(\.rows)
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

    /// "9 of 14 booked · 3 not booked · 2 without a price": each part filters the table.
    private func header(_ rows: [BookingRow]) -> some View {
        let c = TripBookings.headerCounts(rows)
        return HStack(spacing: Space.s) {
            part("\(c.booked) of \(c.needBooking) booked", show: .booked, always: true)
            part("\(c.notBooked) not booked", show: .notBooked, count: c.notBooked)
            part("\(c.withoutPrice) without a price", show: .withoutPrice, count: c.withoutPrice)
            part("\(c.cancelled) cancelled", show: .cancelled, count: c.cancelled)
            Spacer()
            Menu("Group: \(grouping.rawValue)", systemImage: "rectangle.3.group") {
                Picker("Group by", selection: $grouping) {
                    ForEach(TripBookings.Grouping.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.inline)
            }
            .menuStyle(.borderlessButton).fixedSize()
            Picker("Show", selection: $filter) {
                ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
            }
            .labelsHidden().fixedSize()
        }
        .padding(Space.m)
    }

    /// One part of the header line; clicking it filters to it (again to clear).
    @ViewBuilder
    private func part(_ text: String, show: Filter, count: Int = 1, always: Bool = false) -> some View {
        if always || count > 0 {
            Button { filter = filter == show ? .all : show } label: {
                Text(text)
                    .font(always ? .headline : .callout)
                    .foregroundStyle(filter == show ? Theme.brand : (always ? Theme.text : Theme.textSecondary))
            }
            .buttonStyle(.plain)
            .help(filter == show ? "Show everything" : "Show only these")
        }
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
