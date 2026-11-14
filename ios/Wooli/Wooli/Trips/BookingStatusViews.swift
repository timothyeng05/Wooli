import SwiftUI

// M2-1: booking status on a plan (see `BookingStatus` and `ItemExtras.status`).

extension TripItem {
    /// Travel and stays are the plans that have to be booked, so they always
    /// show a status. Everything else shows one only when someone set it.
    var needsBooking: Bool { kind == .transit || kind == .stay }

    var showsStatus: Bool { !isMealPlaceholder && (needsBooking || extras?.status != nil) }

    /// Dashed outline: travel or a stay that still has to be booked.
    var drawsAsUnbooked: Bool { needsBooking && isUnbooked }
}

extension BookingStatus {
    var symbol: String {
        switch self {
        case .idea: "lightbulb"
        case .planned: "circle.dashed"
        case .booked: "checkmark.circle.fill"
        case .cancelled: "xmark.circle"
        }
    }

    var tint: Color {
        switch self {
        case .idea: Theme.textSecondary
        case .planned: Theme.brand
        case .booked: Theme.income
        case .cancelled: Theme.textTertiary
        }
    }
}

/// A small capsule saying where a plan stands. Draws nothing for a plan with no status.
struct BookingStatusBadge: View {
    let item: TripItem

    var body: some View {
        if item.showsStatus, let status = shown {
            Label(status.label, systemImage: status.symbol)
                .labelStyle(.titleAndIcon)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(status.tint)
                .padding(.horizontal, 7).padding(.vertical, 2)
                .background(Capsule().fill(status.tint.opacity(0.12)))
                .overlay {
                    if status == .planned {
                        Capsule().strokeBorder(status.tint.opacity(0.7), style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
                    }
                }
                .accessibilityLabel("Status: \(status.label)")
        }
    }

    /// Travel and stays nobody has marked read as booked (that's how older trips behave).
    private var shown: BookingStatus? { item.bookingStatus ?? (item.needsBooking ? .booked : nil) }
}

/// Not booked · Booked · Cancelled. Travel and stays always have a value to
/// pick; other plans can also go back to no status at all.
struct BookingStatusPicker: View {
    @Binding var item: TripItem

    var body: some View {
        Picker("Status", selection: selection) {
            if !item.needsBooking { Text("None").tag(BookingStatus?.none) }
            Text(BookingStatus.planned.label).tag(BookingStatus?.some(.planned))
            Text(BookingStatus.booked.label).tag(BookingStatus?.some(.booked))
            Text(BookingStatus.cancelled.label).tag(BookingStatus?.some(.cancelled))
        }
        .pickerStyle(.menu)
    }

    private var selection: Binding<BookingStatus?> {
        Binding(
            get: {
                let s = item.bookingStatus
                // An old plan with no status counts as booked for travel and stays.
                return s ?? (item.needsBooking ? .booked : nil)
            },
            set: { item.setStatus($0) })
    }
}
