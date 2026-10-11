import Foundation
import SwiftData

// Module data. Same CloudKit rules as the budget models: every property has a
// default, no unique constraints, no required relationships.

@Model
final class PeriodEntry {
    var id: String = UUID().uuidString
    /// Start of day, local calendar.
    var startDay: Date = Date.now
    /// nil = ongoing.
    var endDay: Date?
    /// "", "light", "medium", "heavy"
    var flowRaw: String = ""
    var symptoms: [String] = []
    var note: String = ""
    var updatedAt: Date = Date.now

    init(startDay: Date, endDay: Date? = nil) {
        self.startDay = Calendar.current.startOfDay(for: startDay)
        self.endDay = endDay.map { Calendar.current.startOfDay(for: $0) }
    }

    var cycleEntry: CycleMath.Entry { .init(start: startDay, end: endDay) }
}
