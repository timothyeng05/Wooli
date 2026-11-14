import Foundation
import Testing
@testable import Wooli

// One-currency trip totals (ExchangeRates).

struct ExchangeRatesTests {
    @Test func convertsAndReportsWhatItCouldNot() {
        let r = ExchangeRates.convert(["USD": 1000, "EUR": 200, "JPY": 50_000, "THB": 900],
                                      to: "USD", rates: ["EUR": 1.1, "JPY": 0.0065])
        #expect(abs(r.amount - (1000 + 220 + 325)) < 0.001)
        #expect(r.missing == ["THB"])
        #expect(r.converted)
    }

    @Test func sameCurrencyOnlyIsNotApproximate() {
        let r = ExchangeRates.convert(["USD": 500], to: "USD", rates: [:])
        #expect(r.amount == 500 && r.missing.isEmpty && !r.converted)
    }

    @Test func ecbParsingAndCrossRates() {
        let xml = "<Cube><Cube time='2027-04-01'><Cube currency='USD' rate='1.10'/><Cube currency=\"JPY\" rate=\"165.0\"/></Cube></Cube>"
        let perEuro = ExchangeRates.parseECB(xml)
        #expect(perEuro["EUR"] == 1 && perEuro["USD"] == 1.10 && perEuro["JPY"] == 165.0)
        let rates = ExchangeRates.rates(for: ["EUR", "JPY", "USD", "THB"], into: "USD", perEuro: perEuro)
        #expect(abs((rates["EUR"] ?? 0) - 1.10) < 0.0001)
        #expect(abs((rates["JPY"] ?? 0) - 1.10 / 165.0) < 0.0001)
        #expect(rates["USD"] == nil && rates["THB"] == nil)
    }

    @Test func manualRatesSurviveAFetchThatLacksThem() {
        let merged = ExchangeRates.merging(stored: ["THB": 0.028, "EUR": 1.0], fetched: ["EUR": 1.1])
        #expect(merged["THB"] == 0.028 && merged["EUR"] == 1.1)
    }
}
