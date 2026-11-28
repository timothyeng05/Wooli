#if os(macOS)
import AppKit
import SwiftUI

/// M2-2: a trip's Bookings page. One row per travel plan and stay (and any
/// plan with a status or confirmation code), sortable by any column.
struct MacBookingsTable: View {
    let trip: Trip
    @Binding var selection: Set<String>
    /// Double-click (or Return) on a row.
    var onOpen: (TripItem) -> Void = { _ in }

    @State private var store = TripStore.shared
    @State private var sortOrder = [KeyPathComparator(\BookingRow.whenKey)]
    @State private var copied: String?
    @State private var filter = BookingsFilter.all
    @State private var search = ""
    @AppStorage("trip.bookings.grouping") private var grouping = BookingsGrouping.none

    var body: some View {
        let rows = BookingsList.rows(trip: trip, items: store.items(in: trip.id))
        let shown = BookingsList.apply(filter, search: search, to: rows)
        VStack(spacing: 0) {
            if rows.isEmpty {
                ContentUnavailableView("No bookings yet", systemImage: "ticket",
                                       description: Text("Flights, trains and stays you add to the plan show up here."))
            } else {
                header(BookingsList.summary(trip: trip, rows: rows))
                Divider()
                if shown.isEmpty {
                    ContentUnavailableView("Nothing matches", systemImage: "line.3.horizontal.decrease.circle",
                                           description: Text("Clear the filter or search to see every booking."))
                } else if grouping == .none {
                    table(shown.sorted(using: sortOrder))
                } else {
                    groupedList(shown.sorted(using: sortOrder))
                }
            }
        }
        .background(Theme.background)
        .searchable(text: $search, placement: .toolbar, prompt: "Search bookings")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Picker("Group By", selection: $grouping) {
                    ForEach(BookingsGrouping.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.menu)
                .help("Group the bookings by type or city")
            }
        }
    }

    /// "9 of 14 booked · 3 nights without a bed · 2 travel days not booked"; each part filters.
    private func header(_ summary: BookingsSummary) -> some View {
        HStack(spacing: Space.s) {
            ForEach(Array(summary.parts.enumerated()), id: \.offset) { index, part in
                if index > 0 { Text("·").foregroundStyle(Theme.textTertiary) }
                if part.filter == .all {
                    Text(part.text).foregroundStyle(Theme.textSecondary)
                } else {
                    Button(part.text) { filter = filter == part.filter ? .all : part.filter }
                        .buttonStyle(.plain)
                        .foregroundStyle(filter == part.filter ? Theme.brand : Theme.text)
                        .fontWeight(filter == part.filter ? .semibold : .regular)
                        .accessibilityHint("Filters the table")
                }
            }
            Spacer()
            Menu {
                Button("All bookings") { filter = .all }
                Button("Not booked") { filter = .notBooked }
                Button("Booked") { filter = .booked }
                Button("Without a price") { filter = .noPrice }
            } label: {
                Label(filterLabel, systemImage: "line.3.horizontal.decrease.circle")
            }
            .menuStyle(.borderlessButton).fixedSize()
        }
        .font(.callout)
        .padding(.horizontal, Space.l).padding(.vertical, Space.s)
    }

    private var filterLabel: String {
        switch filter {
        case .all: "Filter"
        case .booked: "Booked"
        case .notBooked: "Not booked"
        case .noPrice: "Without a price"
        case .travelNotBooked: "Travel not booked"
        }
    }

    /// Grouped by type or city: a section per group, each its own small table.
    private func groupedList(_ rows: [BookingRow]) -> some View {
        let groups = Dictionary(grouping: rows) { grouping == .type ? $0.typeLabel : ($0.city.isEmpty ? "No city" : $0.city) }
        let order = groups.keys.sorted { (groups[$0]?.first?.whenKey ?? "") < (groups[$1]?.first?.whenKey ?? "") }
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.l) {
                ForEach(order, id: \.self) { name in
                    VStack(alignment: .leading, spacing: Space.xs) {
                        Text(name).font(.headline).padding(.horizontal, Space.l)
                        table(groups[name] ?? []).frame(height: CGFloat(groups[name]?.count ?? 0) * 28 + 36)
                    }
                }
            }
            .padding(.vertical, Space.m)
        }
    }

    private func table(_ rows: [BookingRow]) -> some View {
        Table(rows, selection: $selection, sortOrder: $sortOrder) {
            TableColumn("Status", value: \.statusRank) { row in statusCell(row) }
                .width(min: 92, ideal: 104, max: 130)
            TableColumn("Type", value: \.typeLabel) { row in
                Label(row.typeLabel, systemImage: row.typeSymbol).lineLimit(1)
            }
            .width(min: 70, ideal: 84, max: 110)
            TableColumn("What", value: \.what) { row in
                Text(row.what).fontWeight(.medium).lineLimit(1)
                    .strikethrough(row.status == .cancelled)
            }
            .width(min: 140, ideal: 220)
            TableColumn("When", value: \.whenKey) { row in Text(row.whenText).monospacedDigit() }
                .width(min: 90, ideal: 120)
            TableColumn("Until", value: \.untilKey) { row in Text(row.untilText).monospacedDigit() }
                .width(min: 90, ideal: 120)
            TableColumn("Confirmation", value: \.confirmation) { row in confirmationCell(row) }
                .width(min: 90, ideal: 110)
            TableColumn("Cost", value: \.costSort) { row in
                Text(row.priceText).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            .width(min: 70, ideal: 110)
            TableColumn("City", value: \.city) { row in
                Text(row.city).foregroundStyle(Theme.textSecondary).lineLimit(1)
            }
            .width(min: 80, ideal: 110)
        }
        .contextMenu(forSelectionType: String.self) { ids in
            menu(for: ids, rows: rows)
        } primaryAction: { ids in
            if let id = ids.first, let item = store.items(in: trip.id).first(where: { $0.id == id }) { onOpen(item) }
        }
    }

    /// Right-click on one or several rows.
    @ViewBuilder
    private func menu(for ids: Set<String>, rows: [BookingRow]) -> some View {
        let chosen = rows.filter { ids.contains($0.id) }
        if !chosen.isEmpty {
            if chosen.count == 1, let one = chosen.first {
                Button("Edit…", systemImage: "pencil") { onOpen(one.item) }
                if !one.confirmation.isEmpty {
                    Button("Copy Confirmation Code", systemImage: "doc.on.doc") { copy(one.confirmation) }
                }
                Divider()
            }
            Button("Mark as Booked", systemImage: BookingStatus.booked.symbol) { setStatus(.booked, for: chosen.map(\.item)) }
            Button("Mark as Not Booked", systemImage: BookingStatus.planned.symbol) { setStatus(.planned, for: chosen.map(\.item)) }
            Button("Mark as Cancelled", systemImage: BookingStatus.cancelled.symbol) { setStatus(.cancelled, for: chosen.map(\.item)) }
            Divider()
            Button("Copy as Text", systemImage: "text.alignleft") { copy(BookingsList.text(chosen)) }
        }
    }

    private func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
    }

    /// A badge that opens a menu: Not booked · Booked · Cancelled.
    private func statusCell(_ row: BookingRow) -> some View {
        Menu {
            ForEach([BookingStatus.planned, .booked, .cancelled], id: \.self) { status in
                Button(status.label, systemImage: status.symbol) { setStatus(status, for: row.item) }
            }
        } label: {
            Label(row.status.label, systemImage: row.status.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(row.status.tint)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .accessibilityLabel("Status: \(row.status.label)")
    }

    /// Monospaced; one click copies it.
    @ViewBuilder
    private func confirmationCell(_ row: BookingRow) -> some View {
        if row.confirmation.isEmpty {
            Text("")
        } else {
            Button {
                copy(row.confirmation)
                copied = row.id
            } label: {
                Label(copied == row.id ? "Copied" : row.confirmation,
                      systemImage: copied == row.id ? "checkmark" : "doc.on.doc")
                    .labelStyle(.titleAndIcon)
                    .font(.system(.callout, design: .monospaced))
            }
            .buttonStyle(.borderless)
            .help("Copy confirmation code")
            .accessibilityLabel("Copy confirmation code \(row.confirmation)")
        }
    }

    private func setStatus(_ status: BookingStatus, for item: TripItem) { setStatus(status, for: [item]) }

    private func setStatus(_ status: BookingStatus, for items: [TripItem]) {
        for var item in items {
            item.setStatus(status)
            store.save(item)
        }
    }
}
#endif
