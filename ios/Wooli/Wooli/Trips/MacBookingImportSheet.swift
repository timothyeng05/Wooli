#if os(macOS)
import SwiftUI

/// M2-3: paste a confirmation, check what was found, then Add to Trip.
/// Nothing is saved until the button; the text never leaves the Mac.
struct MacBookingImportSheet: View {
    let trip: Trip
    /// Text to read as soon as the sheet opens (from ⌘V or a drop).
    var initialText = ""
    var onAdded: ([String]) -> Void = { _ in }

    @State private var store = TripStore.shared
    @State private var text = ""
    @State private var found: [ImportedBooking] = []
    /// Booking id → true when it should update the plan already in the trip.
    @State private var updating: [String: Bool] = [:]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text("Import a Confirmation").font(.title3.weight(.semibold))
            Text("Paste the text of a flight or hotel confirmation. Wooli finds the bookings; you check them before anything is added.")
                .font(.callout).foregroundStyle(Theme.textSecondary)
            TextEditor(text: $text)
                .font(.callout.monospaced())
                .frame(minHeight: 110, maxHeight: 160)
                .overlay(RoundedRectangle(cornerRadius: Radius.small).stroke(Theme.textTertiary.opacity(0.4)))
                .onChange(of: text) { _, new in read(new) }
            if found.isEmpty {
                Text(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                     ? "Nothing pasted yet."
                     : "No flights or stays found in that text. You can still add the plan by hand.")
                    .font(.callout).foregroundStyle(Theme.textTertiary)
            } else {
                ScrollView {
                    VStack(spacing: Space.s) {
                        ForEach($found) { $booking in row($booking) }
                    }
                }
                .frame(maxHeight: 260)
            }
            HStack {
                Label("Read on this Mac. The text is never sent anywhere.", systemImage: "lock")
                    .font(.caption).foregroundStyle(Theme.textTertiary)
                Spacer()
                Button("Cancel", role: .cancel) { dismiss() }.keyboardShortcut(.cancelAction)
                Button(addLabel) { add() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(found.filter(\.include).isEmpty)
            }
        }
        .padding(Space.l)
        .frame(width: 560)
        .onAppear {
            if text.isEmpty, !initialText.isEmpty { text = initialText }
        }
    }

    private func row(_ booking: Binding<ImportedBooking>) -> some View {
        let b = booking.wrappedValue
        return HStack(alignment: .top, spacing: Space.s) {
            Toggle("", isOn: booking.include).labelsHidden()
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: b.kind == .stay ? "bed.double.fill" : b.mode.symbol).foregroundStyle(Theme.brand)
                    TextField("Title", text: booking.title, prompt: Text(b.flightNumber.isEmpty ? "Title" : suggested(b)))
                        .textFieldStyle(.roundedBorder)
                }
                HStack(spacing: Space.s) {
                    DatePicker("Day", selection: dayBinding(booking), displayedComponents: .date).labelsHidden()
                    if !b.confirmation.isEmpty {
                        Text(b.confirmation).font(.callout.monospaced()).foregroundStyle(Theme.textSecondary)
                    }
                    if let price = b.price {
                        Text(TripItem.money(price, b.currency ?? TripItem.homeCurrency)).foregroundStyle(Theme.textSecondary)
                    }
                }
                if let existing = BookingImport.duplicate(of: b, in: store.items(in: trip.id)) {
                    Picker("Already in this trip", selection: Binding(get: { updating[b.id] ?? true },
                                                                     set: { updating[b.id] = $0 })) {
                        Text("Update “\(existing.title)”").tag(true)
                        Text("Add as a new plan").tag(false)
                    }
                    .pickerStyle(.menu).font(.caption)
                }
                if let warning = b.warning(trip: trip) {
                    Label(warning, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption).foregroundStyle(.orange)
                }
            }
        }
        .padding(Space.s)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.small))
    }

    private func suggested(_ b: ImportedBooking) -> String {
        [b.flightNumber, b.from.isEmpty || b.to.isEmpty ? "" : "\(b.from) → \(b.to)"].filter { !$0.isEmpty }.joined(separator: " ")
    }

    private func dayBinding(_ booking: Binding<ImportedBooking>) -> Binding<Date> {
        Binding(get: { booking.wrappedValue.day.map(DayKey.date) ?? DayKey.date(trip.startDay) },
                set: { booking.wrappedValue.day = DayKey.key($0) })
    }

    private var addLabel: String {
        let chosen = found.filter(\.include)
        let existing = store.items(in: trip.id)
        let updates = chosen.filter { BookingImport.duplicate(of: $0, in: existing) != nil && (updating[$0.id] ?? true) }.count
        return updates > 0 && updates == chosen.count ? "Update Trip" : "Add to Trip"
    }

    private func read(_ text: String) {
        let year = Int(trip.startDay.prefix(4))
        found = BookingImport.read(text, defaultYear: year)
    }

    private func add() {
        var ids: [String] = []
        for booking in found where booking.include {
            if let existing = BookingImport.duplicate(of: booking, in: store.items(in: trip.id)), updating[booking.id] ?? true {
                store.save(booking.updating(existing))
                ids.append(existing.id)
            } else {
                let item = booking.tripItem(tripID: trip.id)
                store.save(item)
                ids.append(item.id)
            }
        }
        onAdded(ids)
        dismiss()
    }
}
#endif
