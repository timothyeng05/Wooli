import Foundation

/// Cycle predictions — a port of the web app's `lib/period-utils.ts`.
///
/// Pure functions over plain values (no SwiftData), so they're easy to test
/// and can move into a package later. Unlike the web version, which compared
/// dates as UTC strings (`toISOString()`, off by one day in US evenings),
/// everything here works in whole local calendar days.
enum CycleMath {
    struct Entry: Equatable {
        var start: Date
        /// nil = ongoing.
        var end: Date?
    }

    static let defaultCycleLength = 28
    static let defaultPeriodLength = 5

    static let symptoms = ["cramps", "headache", "fatigue", "bloating", "mood swings", "nausea", "breast tenderness", "acne"]
    static let flowColors = ["light": "#fda4af", "medium": "#ef4444", "heavy": "#991b1b"]

    /// Whole local days from `a` to `b` (both reduced to the start of their day).
    static func days(from a: Date, to b: Date, calendar: Calendar = .current) -> Int {
        calendar.dateComponents([.day], from: calendar.startOfDay(for: a), to: calendar.startOfDay(for: b)).day ?? 0
    }

    private static func sortedByStart(_ entries: [Entry]) -> [Entry] {
        entries.sorted { $0.start < $1.start }
    }

    /// Gaps longer than this are treated as a missed log (or a pause, like a
    /// pregnancy), not a cycle, and left out of the average.
    static let maxCycleGap = 45

    /// Mean gap between the last 7 starts, rounded, skipping gaps over
    /// `maxCycleGap` days (all gaps count if every one is that long); 28 with fewer than 2.
    static func averageCycleLength(_ entries: [Entry], calendar: Calendar = .current) -> Int {
        let recent = Array(sortedByStart(entries).suffix(7))
        guard recent.count >= 2 else { return defaultCycleLength }
        let allGaps = zip(recent, recent.dropFirst()).map { days(from: $0.start, to: $1.start, calendar: calendar) }
        let cycles = allGaps.filter { $0 <= maxCycleGap }
        let gaps = cycles.isEmpty ? allGaps : cycles
        return Int((Double(gaps.reduce(0, +)) / Double(gaps.count)).rounded())
    }

    /// Mean length of completed periods (inclusive days), rounded; 5 if none.
    static func averagePeriodLength(_ entries: [Entry], calendar: Calendar = .current) -> Int {
        let lengths = entries.compactMap { e in e.end.map { days(from: e.start, to: $0, calendar: calendar) + 1 } }
        guard !lengths.isEmpty else { return defaultPeriodLength }
        return max(1, Int((Double(lengths.reduce(0, +)) / Double(lengths.count)).rounded()))
    }

    static func latest(_ entries: [Entry]) -> Entry? { sortedByStart(entries).last }

    /// Latest start + average cycle; nil with no entries.
    static func predictedNextStart(_ entries: [Entry], calendar: Calendar = .current) -> Date? {
        guard let latest = latest(entries) else { return nil }
        return calendar.date(byAdding: .day, value: averageCycleLength(entries, calendar: calendar),
                             to: calendar.startOfDay(for: latest.start))
    }

    /// Days since the latest start, counting that day as 1; nil if none or in the future.
    static func cycleDay(_ entries: [Entry], today: Date, calendar: Calendar = .current) -> Int? {
        guard let latest = latest(entries) else { return nil }
        let day = days(from: latest.start, to: today, calendar: calendar) + 1
        return day > 0 ? day : nil
    }

    /// The logged period covering `date`, if any. An ongoing period covers its
    /// start through `today`.
    static func periodEntry(on date: Date, in entries: [Entry], today: Date = .now, calendar: Calendar = .current) -> Entry? {
        let day = calendar.startOfDay(for: date)
        return entries.first { e in
            let start = calendar.startOfDay(for: e.start)
            let end = calendar.startOfDay(for: e.end ?? max(e.start, today))
            return day >= start && day <= end
        }
    }

    static func isPeriodDay(_ date: Date, in entries: [Entry], today: Date = .now, calendar: Calendar = .current) -> Bool {
        periodEntry(on: date, in: entries, today: today, calendar: calendar) != nil
    }

    /// Inside the next predicted period (now works with 1 entry).
    static func isPredictedDay(_ date: Date, in entries: [Entry], today: Date = .now, calendar: Calendar = .current) -> Bool {
        guard !isPeriodDay(date, in: entries, today: today, calendar: calendar),
              let next = predictedNextStart(entries, calendar: calendar) else { return false }
        let offset = days(from: next, to: date, calendar: calendar)
        return offset >= 0 && offset < averagePeriodLength(entries, calendar: calendar)
    }

    /// Self-checks, run from the DEBUG self-test. Returns failures (empty = all pass).
    static func selfTest() -> [String] {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        func d(_ y: Int, _ m: Int, _ day: Int, _ h: Int = 12, _ min: Int = 0) -> Date {
            cal.date(from: DateComponents(year: y, month: m, day: day, hour: h, minute: min))!
        }
        var failures: [String] = []
        func check(_ ok: Bool, _ label: String) { if !ok { failures.append(label) } }

        // 0 entries
        check(averageCycleLength([], calendar: cal) == 28, "avg cycle default")
        check(averagePeriodLength([], calendar: cal) == 5, "avg period default")
        check(predictedNextStart([], calendar: cal) == nil, "no prediction with 0 entries")
        check(cycleDay([], today: d(2026, 9, 1), calendar: cal) == nil, "no cycle day with 0 entries")

        // 1 entry: prediction uses the default cycle, but no predicted days shown
        let one = [Entry(start: d(2026, 9, 1), end: d(2026, 9, 5))]
        check(predictedNextStart(one, calendar: cal) == cal.startOfDay(for: d(2026, 9, 29)), "1 entry predicts +28")
        check(isPredictedDay(d(2026, 9, 29), in: one, today: d(2026, 9, 10), calendar: cal), "works with 1 entry")
        check(averagePeriodLength(one, calendar: cal) == 5, "inclusive length")

        // 3 entries, 30-day cycles, 4-day periods
        let three = [Entry(start: d(2026, 7, 3), end: d(2026, 7, 6)), Entry(start: d(2026, 8, 2), end: d(2026, 8, 5)),
                     Entry(start: d(2026, 9, 1), end: d(2026, 9, 4))]
        check(averageCycleLength(three, calendar: cal) == 30, "avg cycle 30")
        check(averagePeriodLength(three, calendar: cal) == 4, "avg period 4")
        check(predictedNextStart(three, calendar: cal) == cal.startOfDay(for: d(2026, 10, 1)), "next start Oct 1")
        check(isPredictedDay(d(2026, 10, 4), in: three, today: d(2026, 9, 20), calendar: cal), "Oct 4 predicted")
        check(!isPredictedDay(d(2026, 10, 5), in: three, today: d(2026, 9, 20), calendar: cal), "Oct 5 not predicted")
        check(cycleDay(three, today: d(2026, 9, 12), calendar: cal) == 12, "cycle day 12")

        // A missed month (62-day gap) is left out: 30, 26, 25, 29 → 28, not 34
        let missed = [d(2026, 4, 20), d(2026, 5, 20), d(2026, 6, 15), d(2026, 7, 10), d(2026, 9, 10), d(2026, 10, 9)]
            .map { Entry(start: $0, end: nil) }
        check(averageCycleLength(missed, calendar: cal) == 28, "gap over 45 days skipped")
        check(predictedNextStart(missed, calendar: cal) == cal.startOfDay(for: d(2026, 11, 6)), "next start Nov 6")
        // Every gap over 45 (long cycles): use them all rather than the default
        let long = [Entry(start: d(2026, 1, 1), end: nil), Entry(start: d(2026, 2, 20), end: nil), Entry(start: d(2026, 4, 11), end: nil)]
        check(averageCycleLength(long, calendar: cal) == 50, "all-long gaps still averaged")

        // Ongoing period covers start through today, not beyond
        let ongoing = [Entry(start: d(2026, 9, 25), end: nil)]
        check(isPeriodDay(d(2026, 9, 27), in: ongoing, today: d(2026, 9, 27), calendar: cal), "ongoing covers today")
        check(!isPeriodDay(d(2026, 9, 28), in: ongoing, today: d(2026, 9, 27), calendar: cal), "ongoing not tomorrow")

        // Late evening (the web's UTC bug): 11:30pm Sept 4 is still Sept 4, the last day
        check(isPeriodDay(d(2026, 9, 4, 23, 30), in: three, today: d(2026, 9, 20), calendar: cal), "late evening is same day")
        check(!isPeriodDay(d(2026, 9, 5, 0, 30), in: three, today: d(2026, 9, 20), calendar: cal), "just after midnight is next day")
        check(cycleDay(three, today: d(2026, 9, 1, 23, 45), calendar: cal) == 1, "late evening cycle day 1")
        return failures
    }
}
