#if os(macOS)
import AppKit
import SwiftUI

/// Paste a confirmation, see what was found, fix it, then add it (M2-3).
/// Nothing is saved until "Add to Trip".
struct ImportBookingsSheet: View {
    let trip: Trip
    @Environment(\.dismiss) private var dismiss
    @State private var store = TripStore.shared
    @State private var text = ""
    @State private var reviewing = false
    @State private var rows: [Row] = []

    struct Row: Identifiable {
        let id = UUID()
        var booking: ParsedBooking
        var include = true
    }

    var body: some View {
        Group {
            if reviewing { review } else { entry }
        }
        .frame(minWidth: 560, minHeight: 440)
    }

    // MARK: Step 1: the text

    private var entry: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            Text("Import a confirmation").font(.title3.weight(.semibold))
            Text("Paste the text of a flight confirmation. It's read on this Mac, and nothing is saved until you add it.")
                .font(.callout).foregroundStyle(Theme.textSecondary)
            TextEditor(text: $text)
                .font(.system(.body, design: .monospaced))
                .overlay(RoundedRectangle(cornerRadius: Radius.small).strokeBorder(Theme.textTertiary.opacity(0.4)))
            HStack {
                Button("Paste") { text = NSPasteboard.general.string(forType: .string) ?? text }
                Spacer()
                Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                Button("Read") { read() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(Space.m)
    }

    private func read() {
        let year = Int(trip.startDay.prefix(4)) ?? Calendar.current.component(.year, from: .now)
        rows = ConfirmationParser.parse(text, referenceYear: year).map { Row(booking: $0) }
        reviewing = true
    }

    // MARK: Step 2: review

    @ViewBuilder
    private var review: some View {
        if rows.isEmpty {
            VStack(spacing: Space.m) {
                ContentUnavailableView("No flights found", systemImage: "airplane",
                                       description: Text("The reader looks for a flight number like CX831. Hotels and other bookings aren't read yet; add them from the plan."))
                Button("Back") { reviewing = false }
            }
            .padding(Space.m)
        } else {
            VStack(spacing: 0) {
                List {
                    ForEach($rows) { $row in rowView($row) }
                }
                Divider()
                HStack {
                    Button("Back") { reviewing = false }
                    Spacer()
                    Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
                    Button("Add to Trip") { add() }
                        .keyboardShortcut(.defaultAction)
                        .disabled(!rows.contains { $0.include })
                }
                .padding(Space.m)
            }
        }
    }

    private func rowView(_ row: Binding<Row>) -> some View {
        let b = row.wrappedValue.booking
        return VStack(alignment: .leading, spacing: Space.xs) {
            Toggle(isOn: row.include) {
                Text(b.flightNumber ?? "Flight").font(.headline)
            }
            HStack {
                field("Flight", row, \.flightNumber)
                field("From", row, \.from)
                field("To", row, \.to)
            }
            Picker("Day", selection: Binding<String?>(
                get: { b.day.flatMap { trip.days.contains($0) ? $0 : nil } },
                set: { row.wrappedValue.booking.day = $0 })) {
                Text("Ideas · no day yet").tag(String?.none)
                ForEach(trip.days, id: \.self) { day in
                    Text(DayKey.date(day).formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())).tag(String?.some(day))
                }
            }
            if let day = b.day, !trip.days.contains(day) {
                Text("\(day) is outside this trip's dates. Pick a day, or it goes to Ideas.")
                    .font(.caption).foregroundStyle(.orange)
            }
            if duplicate(of: b) != nil {
                Text("Already on this trip: adding updates it.").font(.caption).foregroundStyle(.orange)
            }
            HStack(spacing: Space.m) {
                if let code = b.confirmation { Text("Code \(code)").font(.system(.caption, design: .monospaced)) }
                if let amount = b.amount { Text(TripItem.money(amount, b.currency ?? TripItem.homeCurrency)).font(.caption) }
                if let m = b.departMinutes { Text(TripTransport.timeText(m)).font(.caption) }
            }
            .foregroundStyle(Theme.textSecondary)
        }
        .padding(.vertical, Space.xs)
    }

    private func field(_ title: String, _ row: Binding<Row>, _ keyPath: WritableKeyPath<ParsedBooking, String?>) -> some View {
        TextField(title, text: Binding(
            get: { row.wrappedValue.booking[keyPath: keyPath] ?? "" },
            set: { row.wrappedValue.booking[keyPath: keyPath] = $0.isEmpty ? nil : $0.uppercased() }))
            .textFieldStyle(.roundedBorder)
    }

    // MARK: Adding

    /// The same flight on the same day already in the trip.
    private func duplicate(of b: ParsedBooking) -> TripItem? {
        guard let number = b.flightNumber, let day = b.day else { return nil }
        return store.items(in: trip.id).first {
            $0.day == day && $0.transport?.flightNumber.uppercased() == number.uppercased()
        }
    }

    private func add() {
        var pricedOnce = false
        for row in rows where row.include {
            let b = row.booking
            let day = b.day.flatMap { trip.days.contains($0) ? $0 : nil }
            if var existing = duplicate(of: b) {
                var t = existing.transport ?? TripTransport(mode: .flight)
                if t.confirmation.isEmpty { t.confirmation = b.confirmation ?? "" }
                if t.fromAirport.isEmpty { t.fromAirport = b.from ?? "" }
                if t.toAirport.isEmpty { t.toAirport = b.to ?? "" }
                existing.transport = t
                if existing.time == nil { existing.time = b.departMinutes }
                store.save(existing)
                continue
            }
            var item = TripItem(tripID: trip.id, day: day, kind: .transit, title: "", time: b.departMinutes)
            var t = TripTransport(mode: .flight)
            t.flightNumber = b.flightNumber ?? ""
            t.fromAirport = b.from ?? ""
            t.toAirport = b.to ?? ""
            t.confirmation = b.confirmation ?? ""
            item.transport = t
            // One total for the whole confirmation: put it on the first flight only.
            if !pricedOnce, let amount = b.amount {
                item.cost = amount
                item.currency = b.currency == TripItem.homeCurrency ? nil : b.currency
                pricedOnce = true
            }
            var extras = item.extras ?? ItemExtras()
            extras.source = "import"
            item.extras = extras
            if b.confirmation != nil { item.setStatus(.booked) }
            store.save(item)
        }
        dismiss()
    }
}
#endif
