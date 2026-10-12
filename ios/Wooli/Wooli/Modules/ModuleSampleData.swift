import Foundation
import SwiftData

/// Demo data for modules in sample mode: ~6 months of periods.
/// Only seeds when the module has no data yet.
enum ModuleSampleData {
    static func seed(_ module: WooliModule, context: ModelContext) {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        var rng = SeededRNG(seed: 11)
        switch module {
        case .period:
            guard ((try? context.fetchCount(FetchDescriptor<PeriodEntry>())) ?? 0) == 0 else { return }
            // Walk back from a recent start: cycles 27–30 days, periods 4–6 days.
            var start = cal.date(byAdding: .day, value: -Int.random(in: 9...14, using: &rng), to: today)!
            let flows = ["light", "medium", "heavy"]
            for _ in 0..<7 {
                let length = Int.random(in: 4...6, using: &rng)
                let e = PeriodEntry(startDay: start, endDay: cal.date(byAdding: .day, value: length - 1, to: start))
                e.flowRaw = flows.randomElement(using: &rng)!
                e.symptoms = Array(CycleMath.symptoms.shuffled(using: &rng).prefix(Int.random(in: 0...3, using: &rng)))
                context.insert(e)
                start = cal.date(byAdding: .day, value: -Int.random(in: 27...30, using: &rng), to: start)!
            }
        }
        try? context.save()
    }
}

/// Deterministic randomness so sample data looks the same each time.
struct SeededRNG: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
