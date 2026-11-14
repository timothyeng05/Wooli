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

    var body: some View {
        let rows = BookingsList.rows(trip: trip, items: store.items(in: trip.id))
        let sorted = rows.sorted(using: sortOrder)
        VStack(spacing: 0) {
            if rows.isEmpty {
                ContentUnavailableView("No bookings yet", systemImage: "ticket",
                                       description: Text("Flights, trains and stays you add to the plan show up here."))
            } else {
                table(sorted)
            }
        }
        .background(Theme.background)
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
        .contextMenu(forSelectionType: String.self) { _ in } primaryAction: { ids in
            if let id = ids.first, let item = store.items(in: trip.id).first(where: { $0.id == id }) { onOpen(item) }
        }
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
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(row.confirmation, forType: .string)
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

    private func setStatus(_ status: BookingStatus, for item: TripItem) {
        var changed = item
        changed.setStatus(status)
        store.save(changed)
    }
}
#endif
