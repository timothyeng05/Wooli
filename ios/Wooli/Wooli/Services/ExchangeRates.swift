import Foundation

/// Putting a trip's amounts into one currency (M2-4). Pure: the network fetch of
/// the European Central Bank's daily rates is a separate, thin step.
enum ExchangeRates {
    /// A trip's totals by currency, in `budget`'s currency.
    /// `rates[X]` = units of `budget` per 1 unit of X (`TripExtras.fxRates`).
    /// Currencies with no rate are returned in `missing` and left out of `amount`.
    static func convert(_ totals: [String: Double], to budget: String, rates: [String: Double])
        -> (amount: Double, missing: [String], converted: Bool) {
        var amount = 0.0
        var missing: [String] = []
        var converted = false
        for (code, value) in totals {
            if code == budget {
                amount += value
            } else if let rate = rates[code], rate > 0 {
                amount += value * rate
                converted = true
            } else {
                missing.append(code)
            }
        }
        return (amount, missing.sorted(), converted)
    }

    /// Reads the ECB's daily XML (`<Cube currency='USD' rate='1.0850'/>`, euro-based)
    /// into units of each currency per 1 EUR, with EUR = 1.
    static func parseECB(_ xml: String) -> [String: Double] {
        var perEuro: [String: Double] = ["EUR": 1]
        guard let re = try? NSRegularExpression(pattern: #"currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]"#) else { return perEuro }
        let ns = xml as NSString
        for m in re.matches(in: xml, range: NSRange(location: 0, length: ns.length)) {
            if let rate = Double(ns.substring(with: m.range(at: 2))), rate > 0 {
                perEuro[ns.substring(with: m.range(at: 1))] = rate
            }
        }
        return perEuro
    }

    /// Rates for `codes` into `budget`, from euro-based rates: units of `budget` per 1 unit of each.
    /// A currency the ECB doesn't publish is left out, so it stays manual.
    static func rates(for codes: [String], into budget: String, perEuro: [String: Double]) -> [String: Double] {
        guard let budgetPerEuro = perEuro[budget], budgetPerEuro > 0 else { return [:] }
        var result: [String: Double] = [:]
        for code in codes where code != budget {
            if let perEuroCode = perEuro[code], perEuroCode > 0 { result[code] = budgetPerEuro / perEuroCode }
        }
        return result
    }

    /// Today's rates win; a rate you typed in by hand (not in `fetched`) is kept.
    static func merging(stored: [String: Double], fetched: [String: Double]) -> [String: Double] {
        stored.merging(fetched) { _, new in new }
    }
}
