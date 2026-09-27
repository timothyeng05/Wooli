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

@Model
final class MoodEntry {
    var id: String = UUID().uuidString
    /// Start of day; one entry per day.
    var day: Date = Date.now
    /// 1 awful … 5 great
    var score: Int = 3
    var tags: [String] = []
    var note: String = ""
    var updatedAt: Date = Date.now

    init(day: Date, score: Int) {
        self.day = Calendar.current.startOfDay(for: day)
        self.score = score
    }
}

enum MoodScale {
    static let emoji = [1: "😞", 2: "🙁", 3: "😐", 4: "🙂", 5: "😄"]
    static let label = [1: "Awful", 2: "Bad", 3: "Okay", 4: "Good", 5: "Great"]
    static let colorHex = [1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#84cc16", 5: "#22c55e"]
    static let defaultTags = ["sleep", "work", "exercise", "social", "family", "health", "money", "weather"]

    /// Log a mood for `day`: logging again the same day updates that entry.
    @discardableResult
    static func log(score: Int, on day: Date = .now, context: ModelContext) -> MoodEntry {
        let start = Calendar.current.startOfDay(for: day)
        let existing = (try? context.fetch(FetchDescriptor<MoodEntry>(predicate: #Predicate { $0.day == start })))?.first
        let entry = existing ?? {
            let e = MoodEntry(day: start, score: score)
            context.insert(e)
            return e
        }()
        entry.score = score
        entry.updatedAt = .now
        try? context.save()
        return entry
    }
}
