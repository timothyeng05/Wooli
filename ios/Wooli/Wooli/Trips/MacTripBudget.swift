#if os(macOS)
import SwiftUI

/// The Costs card's one-currency line (M2-4): planned against the budget, with
/// every foreign amount converted at the trip's rates and marked "≈".
struct TripBudgetLine: View {
    let trip: Trip
    let totals: [String: Double]
    /// Days the scope covers, for "a day".
    var days: Int
    /// Only the whole trip is compared with the budget; a city's costs aren't.
    var wholeTrip = true

    var body: some View {
        let code = trip.extras.budgetCurrency ?? TripItem.homeCurrency
        let result = ExchangeRates.convert(totals, to: code, rates: trip.extras.fxRates ?? [:])
        let budget = wholeTrip ? trip.extras.budget : nil
        VStack(alignment: .leading, spacing: Space.xs) {
            if !totals.isEmpty {
                HStack(alignment: .firstTextBaseline) {
                    Text("Planned").font(.callout).foregroundStyle(Theme.textSecondary)
                    Text((result.converted ? "≈ " : "") + TripItem.money(result.amount, code))
                        .font(.title3.weight(.bold)).monospacedDigit().foregroundStyle(Theme.text)
                    if let budget {
                        Text("of \(TripItem.money(budget, code))").font(.callout).foregroundStyle(Theme.textSecondary)
                    }
                }
                if let budget, budget > 0 {
                    ProgressView(value: min(result.amount / budget, 1))
                        .tint(result.amount > budget ? Theme.pending : Theme.brand)
                    if result.amount > budget {
                        Text("\(TripItem.money(result.amount - budget, code)) over budget")
                            .font(.caption).foregroundStyle(Theme.pending)
                    }
                }
                if !result.missing.isEmpty {
                    Text("Not counted: \(result.missing.joined(separator: ", ")) (no rate yet)")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
                if let people = trip.extras.travelers, people > 0, days > 0 {
                    Text("≈ \(TripItem.money(result.amount / Double(days), code)) a day for \(people)")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
        }
    }
}

/// Budget, its currency, travellers and the rates between the trip's currencies.
struct TripBudgetEditor: View {
    let tripID: String
    /// Currencies used by the trip's bookings.
    let currencies: [String]
    @State private var store = TripStore.shared
    @State private var updating = false
    @State private var message: String?

    var body: some View {
        if let trip = store.trip(tripID) {
            let code = trip.extras.budgetCurrency ?? TripItem.homeCurrency
            VStack(alignment: .leading, spacing: Space.m) {
                Text("Budget & rates").font(.headline)
                Grid(alignment: .leading, horizontalSpacing: Space.m, verticalSpacing: Space.s) {
                    GridRow {
                        Text("Budget")
                        TextField("Amount", value: bind(trip, \.budget), format: .number.precision(.fractionLength(0...2)),
                                  prompt: Text("e.g. 8000"))
                            .frame(width: 110)
                    }
                    GridRow {
                        Text("Currency")
                        Picker("Currency", selection: Binding(get: { code }, set: { value in
                            var t = trip
                            t.extras.budgetCurrency = value == TripItem.homeCurrency ? nil : value
                            store.save(t)
                        })) {
                            ForEach(Array(Set(TripCostField.common + [TripItem.homeCurrency, code])).sorted(), id: \.self) { Text($0).tag($0) }
                        }
                        .labelsHidden().frame(width: 110)
                    }
                    GridRow {
                        Text("Travellers")
                        Stepper(value: Binding(get: { trip.extras.travelers ?? 1 }, set: { value in
                            var t = trip; t.extras.travelers = value; store.save(t)
                        }), in: 1...20) { Text("\(trip.extras.travelers ?? 1)") }
                    }
                }
                let others = currencies.filter { $0 != code }
                if !others.isEmpty {
                    Divider()
                    Text("1 unit of … in \(code)").font(.caption).foregroundStyle(Theme.textSecondary)
                    Grid(alignment: .leading, horizontalSpacing: Space.m, verticalSpacing: Space.s) {
                        ForEach(others, id: \.self) { other in
                            GridRow {
                                Text(other)
                                TextField("Rate", value: Binding(get: { trip.extras.fxRates?[other] }, set: { value in
                                    var t = trip
                                    var rates = t.extras.fxRates ?? [:]
                                    rates[other] = value
                                    t.extras.fxRates = rates.filter { $0.value > 0 }
                                    store.save(t)
                                }), format: .number.precision(.fractionLength(0...6)), prompt: Text("manual"))
                                    .frame(width: 110)
                            }
                        }
                    }
                    HStack {
                        Button(updating ? "Updating…" : "Update rates") { Task { await update(trip, others: others, code: code) } }
                            .disabled(updating)
                        if let at = trip.extras.fxUpdatedAt {
                            Text("Updated \(at.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                    }
                    Text(message ?? "Rates come from the European Central Bank's public daily rates: one anonymous request, nothing about you or the trip is sent. Currencies it lacks stay manual.")
                        .font(.caption).foregroundStyle(Theme.textTertiary).fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(Space.l)
            .frame(width: 340)
        }
    }

    private func bind(_ trip: Trip, _ keyPath: WritableKeyPath<TripExtras, Double?>) -> Binding<Double?> {
        Binding(get: { trip.extras[keyPath: keyPath] }, set: { value in
            var t = trip
            t.extras[keyPath: keyPath] = (value ?? 0) > 0 ? value : nil
            store.save(t)
        })
    }

    private func update(_ trip: Trip, others: [String], code: String) async {
        updating = true
        defer { updating = false }
        guard let url = URL(string: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let xml = String(data: data, encoding: .utf8) else {
            message = "Couldn't reach the rates service. Your stored and manual rates still work."
            return
        }
        let fetched = ExchangeRates.rates(for: others, into: code, perEuro: ExchangeRates.parseECB(xml))
        guard !fetched.isEmpty else { message = "None of these currencies are in the daily rates; enter them by hand."; return }
        var t = store.trip(trip.id) ?? trip
        t.extras.fxRates = ExchangeRates.merging(stored: t.extras.fxRates ?? [:], fetched: fetched)
        t.extras.fxUpdatedAt = .now
        store.save(t)
        let left = others.filter { fetched[$0] == nil }
        message = left.isEmpty ? nil : "Not in the daily rates: \(left.joined(separator: ", ")). Enter them by hand."
    }
}
#endif
