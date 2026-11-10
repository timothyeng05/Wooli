import EventKit
import OSLog
import SwiftUI

/// One reminder as Wooli shows it, copied out of EventKit.
struct Reminder: Identifiable, Equatable {
    enum Priority: Int, CaseIterable, Identifiable {
        case none, low, medium, high
        var id: Int { rawValue }
        var title: String { ["None", "Low", "Medium", "High"][rawValue] }

        /// EventKit uses 1–4 for high, 5 for medium, 6–9 for low.
        init(eventKit value: Int) {
            switch value {
            case 1...4: self = .high
            case 5: self = .medium
            case 6...9: self = .low
            default: self = .none
            }
        }

        var eventKitValue: Int { [0, 9, 5, 1][rawValue] }
    }

    enum Repeat: String, CaseIterable, Identifiable {
        case never, daily, weekly, monthly, yearly
        /// A rule Wooli's editor can't show (every 2 weeks, weekdays…). Kept as it is unless changed.
        case custom
        var id: String { rawValue }
        var title: String { rawValue == "never" ? "Never" : rawValue.capitalized }
    }

    var id: String = UUID().uuidString
    var title = ""
    var notes = ""
    var listID = ""
    var due: Date?
    /// False for a reminder due on a day, with no time.
    var hasTime = false
    var priority = Priority.none
    var repeats = Repeat.never
    var isCompleted = false
}

/// A Reminders list, with its own colour from the Reminders app.
struct ReminderList: Identifiable, Equatable {
    let id: String
    let title: String
    let color: Color
    let allowsEdits: Bool
}

/// Reminders live in Apple Reminders, not SwiftData: Wooli reads them each
/// time and writes changes straight back, so they stay in step with the
/// Reminders app, Siri and the user's other devices (through their iCloud).
/// Sample mode uses an in-memory list, so demo data never reaches Reminders.
@MainActor
@Observable
final class ReminderStore {
    static let shared = ReminderStore()

    enum Access { case checking, needsConnect, denied, connected }

    private(set) var lists: [ReminderList] = []
    /// Not yet done, plus any ticked off since the app opened, so a mis-tap can be undone.
    private(set) var reminders: [Reminder] = []
    private(set) var access = Access.checking
    var errorMessage: String?

    private let store = EKEventStore()
    private var isSample = false
    private var recentlyCompleted: Set<String> = []
    private var observer: NSObjectProtocol?
    private static let log = Logger(subsystem: "com.timothyeng.wooli", category: "Reminders")

    private init() {
        // Changes from the Reminders app, Siri or iCloud.
        observer = NotificationCenter.default.addObserver(forName: .EKEventStoreChanged, object: store, queue: .main) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.isSample, self.access == .connected else { return }
                await self.load()
            }
        }
    }

    // MARK: Reading

    /// Never prompts; `connect()` does that, from a button.
    func refresh(sample: Bool) async {
        let wasSample = isSample
        isSample = sample
        if sample {
            // Fresh sample lists when switching in, so real reminders never show in the demo.
            if !wasSample || lists.isEmpty { (lists, reminders) = Self.sampleData() }
            access = .connected
            return
        }
        switch EKEventStore.authorizationStatus(for: .reminder) {
        case .fullAccess:
            access = .connected
            await load()
        case .notDetermined:
            access = .needsConnect
        default:
            // Denied, restricted, or write-only (which can't read anything back).
            access = .denied
            lists = []
            reminders = []
        }
    }

    func connect() async {
        do {
            _ = try await store.requestFullAccessToReminders()
        } catch {
            errorMessage = "Apple Reminders didn't connect. \(error.localizedDescription)"
        }
        await refresh(sample: false)
    }

    private func load() async {
        let calendars = store.calendars(for: .reminder)
        lists = calendars
            .map { ReminderList(id: $0.calendarIdentifier, title: $0.title, color: Color(cgColor: $0.cgColor),
                                allowsEdits: $0.allowsContentModifications) }
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        let predicate = store.predicateForIncompleteReminders(withDueDateStarting: nil, ending: nil, calendars: calendars)
        // The completion runs on EventKit's queue; copy values out there.
        let open: [Reminder] = await withCheckedContinuation { done in
            _ = store.fetchReminders(matching: predicate) { found in
                done.resume(returning: (found ?? []).map(Self.value))
            }
        }
        let ticked = recentlyCompleted.compactMap { (store.calendarItem(withIdentifier: $0) as? EKReminder).map(Self.value) }
        reminders = open + ticked.filter { r in !open.contains { $0.id == r.id } }
    }

    private nonisolated static func value(_ r: EKReminder) -> Reminder {
        let comps = r.dueDateComponents
        let due = comps.flatMap { c in (c.calendar ?? Calendar.current).date(from: c) }
        return Reminder(id: r.calendarItemIdentifier, title: r.title ?? "", notes: r.notes ?? "",
                        listID: r.calendar?.calendarIdentifier ?? "", due: due, hasTime: comps?.hour != nil,
                        priority: .init(eventKit: r.priority), repeats: repeatValue(r.recurrenceRules),
                        isCompleted: r.isCompleted)
    }

    private nonisolated static func repeatValue(_ rules: [EKRecurrenceRule]?) -> Reminder.Repeat {
        guard let rules, !rules.isEmpty else { return .never }
        guard rules.count == 1, let rule = rules.first, rule.interval == 1, rule.recurrenceEnd == nil,
              rule.daysOfTheWeek == nil, rule.daysOfTheMonth == nil, rule.monthsOfTheYear == nil,
              rule.setPositions == nil else { return .custom }
        switch rule.frequency {
        case .daily: return .daily
        case .weekly: return .weekly
        case .monthly: return .monthly
        case .yearly: return .yearly
        @unknown default: return .custom
        }
    }

    func list(_ id: String) -> ReminderList? { lists.first { $0.id == id } }

    /// Where a new reminder goes: the Reminders app's default list.
    var defaultListID: String {
        if isSample { return lists.first?.id ?? "" }
        return store.defaultCalendarForNewReminders()?.calendarIdentifier ?? lists.first(where: \.allowsEdits)?.id ?? ""
    }

    // MARK: Writing

    @discardableResult
    func save(_ reminder: Reminder) async -> Bool {
        if isSample {
            reminders.removeAll { $0.id == reminder.id }
            reminders.append(reminder)
            return true
        }
        let item = (store.calendarItem(withIdentifier: reminder.id) as? EKReminder) ?? EKReminder(eventStore: store)
        item.title = reminder.title
        item.notes = reminder.notes.isEmpty ? nil : reminder.notes
        // A new reminder needs a list; fall back to the Reminders app's default.
        if let list = store.calendar(withIdentifier: reminder.listID) ?? (item.calendar == nil ? store.defaultCalendarForNewReminders() : nil) {
            item.calendar = list
        }
        item.priority = reminder.priority.eventKitValue
        apply(due: reminder.due, hasTime: reminder.hasTime, to: item)
        apply(repeats: reminder.due == nil ? .never : reminder.repeats, to: item)
        return write { try self.store.save(item, commit: true) }
    }

    private func apply(due: Date?, hasTime: Bool, to item: EKReminder) {
        let cal = Calendar.current
        item.dueDateComponents = due.map {
            cal.dateComponents(hasTime ? [.year, .month, .day, .hour, .minute] : [.year, .month, .day], from: $0)
        }
        // A time alert, like the Reminders app adds. Location alerts stay.
        for alarm in item.alarms ?? [] where alarm.structuredLocation == nil { item.removeAlarm(alarm) }
        if let due, hasTime { item.addAlarm(EKAlarm(absoluteDate: due)) }
    }

    private func apply(repeats: Reminder.Repeat, to item: EKReminder) {
        let frequency: EKRecurrenceFrequency
        switch repeats {
        case .custom: return
        case .never:
            for rule in item.recurrenceRules ?? [] { item.removeRecurrenceRule(rule) }
            return
        case .daily: frequency = .daily
        case .weekly: frequency = .weekly
        case .monthly: frequency = .monthly
        case .yearly: frequency = .yearly
        }
        guard Self.repeatValue(item.recurrenceRules) != repeats else { return }
        for rule in item.recurrenceRules ?? [] { item.removeRecurrenceRule(rule) }
        item.addRecurrenceRule(EKRecurrenceRule(recurrenceWith: frequency, interval: 1, end: nil))
    }

    func setCompleted(_ reminder: Reminder, _ done: Bool) async {
        if done { recentlyCompleted.insert(reminder.id) } else { recentlyCompleted.remove(reminder.id) }
        if isSample {
            if let i = reminders.firstIndex(where: { $0.id == reminder.id }) { reminders[i].isCompleted = done }
            return
        }
        guard let item = store.calendarItem(withIdentifier: reminder.id) as? EKReminder else { return }
        item.isCompleted = done
        write { try self.store.save(item, commit: true) }
    }

    func delete(_ reminder: Reminder) async {
        recentlyCompleted.remove(reminder.id)
        if isSample { reminders.removeAll { $0.id == reminder.id }; return }
        guard let item = store.calendarItem(withIdentifier: reminder.id) as? EKReminder else { return }
        write { try self.store.remove(item, commit: true) }
    }

    /// Saving fires `EKEventStoreChanged`, which reloads.
    @discardableResult
    private func write(_ work: () throws -> Void) -> Bool {
        do {
            try work()
            return true
        } catch {
            Self.log.error("Writing to Reminders failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save to Apple Reminders. \(error.localizedDescription)"
            return false
        }
    }

    // MARK: Sample

    private static func sampleData() -> ([ReminderList], [Reminder]) {
        let lists = [
            ReminderList(id: "home", title: "Home", color: Theme.accentViolet, allowsEdits: true),
            ReminderList(id: "errands", title: "Errands", color: Theme.accentAmber, allowsEdits: true),
        ]
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        func day(_ n: Int, hour: Int? = nil) -> Date {
            let d = cal.date(byAdding: .day, value: n, to: today)!
            return hour.map { cal.date(byAdding: .hour, value: $0, to: d)! } ?? d
        }
        let reminders = [
            Reminder(title: "Pay the water bill", listID: "home", due: day(-1), priority: .high),
            Reminder(title: "Pick up dry cleaning", listID: "errands", due: day(0, hour: 17), hasTime: true),
            Reminder(title: "Water the plants", listID: "home", due: day(0), repeats: .weekly),
            Reminder(title: "Book dentist", notes: "Ask about the Thursday slots", listID: "errands", due: day(3)),
            Reminder(title: "Renew passport", listID: "home", due: day(20), priority: .medium),
            Reminder(title: "Buy a birthday card", listID: "errands"),
        ]
        return (lists, reminders)
    }
}
