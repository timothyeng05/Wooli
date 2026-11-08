import Foundation
import HealthKit
import OSLog
import SwiftData

/// One period as Apple Health knows it: a run of flow days.
struct Period: Identifiable, Equatable {
    var start: Date
    var end: Date
    /// "", "light", "medium", "heavy" — the heaviest day.
    var flow: String = ""
    var symptoms: [String] = []
    /// False when another app logged part of it; HealthKit only lets an app
    /// change its own samples.
    var isEditable = true

    var id: Date { start }
    var cycleEntry: CycleMath.Entry { .init(start: start, end: end) }

    /// Health has no "ongoing": a period that reaches today or yesterday may still be going.
    func isCurrent(today: Date = .now) -> Bool { CycleMath.days(from: end, to: today) <= 1 }
}

/// Periods live in Apple Health, not SwiftData: Apple's guideline 5.1.3(ii)
/// keeps personal health information out of iCloud, and Health syncs itself.
/// Wooli keeps only predictions, worked out each time from what it reads.
/// Sample mode uses an in-memory list, so demo data never reaches Health.
@MainActor
@Observable
final class PeriodStore {
    static let shared = PeriodStore()

    enum Access { case checking, unavailable, needsConnect, connected }

    private(set) var periods: [Period] = []
    private(set) var access = Access.checking
    var errorMessage: String?

    private let health = HKHealthStore()
    private var isSample = false
    /// Wooli's own samples per period, the only ones it may delete.
    private var owned: [Date: [HKObject]] = [:]
    private static let log = Logger(subsystem: "com.timothyeng.wooli", category: "Period")

    private static let flowType = HKCategoryType(.menstrualFlow)
    /// `CycleMath.symptoms` names and their Health types.
    private static let symptomTypes: [(name: String, type: HKCategoryType)] = [
        ("cramps", HKCategoryType(.abdominalCramps)), ("headache", HKCategoryType(.headache)),
        ("fatigue", HKCategoryType(.fatigue)), ("bloating", HKCategoryType(.bloating)),
        ("mood swings", HKCategoryType(.moodChanges)), ("nausea", HKCategoryType(.nausea)),
        ("breast tenderness", HKCategoryType(.breastPain)), ("acne", HKCategoryType(.acne)),
    ]
    private static var allTypes: Set<HKCategoryType> { Set(symptomTypes.map(\.type)).union([flowType]) }

    // MARK: Reading

    /// Never prompts; `connect()` does that, from a button.
    func refresh(sample: Bool) async {
        isSample = sample
        if sample {
            if periods.isEmpty { periods = ModuleSampleData.periods() }
            access = .connected
            return
        }
        guard HKHealthStore.isHealthDataAvailable() else { access = .unavailable; return }
        let status = try? await health.statusForAuthorizationRequest(toShare: Self.allTypes, read: Self.allTypes)
        guard status == .unnecessary else { access = .needsConnect; periods = []; return }
        access = .connected
        do {
            try await load()
        } catch {
            // Health is unreadable while the phone is locked; keep what's showing.
            Self.log.error("Reading periods failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func connect() async {
        do {
            try await health.requestAuthorization(toShare: Self.allTypes, read: Self.allTypes)
        } catch {
            errorMessage = "Apple Health didn't connect. \(error.localizedDescription)"
        }
        await refresh(sample: false)
    }

    private func samples(_ type: HKCategoryType) async throws -> [HKCategorySample] {
        try await HKSampleQueryDescriptor(predicates: [.categorySample(type: type)],
                                          sortDescriptors: [SortDescriptor(\.startDate)]).result(for: health)
    }

    private func load() async throws {
        let cal = Calendar.current
        let own = HKSource.default()
        let flowSamples = try await samples(Self.flowType).filter { $0.value != HKCategoryValueVaginalBleeding.none.rawValue }
        let days = flowSamples.map { sample in
            CycleMath.FlowDay(day: cal.startOfDay(for: sample.startDate),
                              isCycleStart: sample.metadata?[HKMetadataKeyMenstrualCycleStart] as? Bool ?? false)
        }

        var result: [Period] = []
        var ownedByPeriod: [Date: [HKObject]] = [:]
        for group in CycleMath.groupFlowDays(days, calendar: cal) {
            guard let start = group.first, let end = group.last else { continue }
            let mine = flowSamples.filter { (start...end).contains(cal.startOfDay(for: $0.startDate)) }
            let heaviest = mine.map(\.value).compactMap(Self.flowName).max { Self.rank($0) < Self.rank($1) } ?? ""
            result.append(Period(start: start, end: end, flow: heaviest,
                                 isEditable: mine.allSatisfy { $0.sourceRevision.source == own }))
            ownedByPeriod[start] = mine.filter { $0.sourceRevision.source == own }
        }

        for (name, type) in Self.symptomTypes {
            let absent = type == HKCategoryType(.moodChanges) ? HKCategoryValuePresence.notPresent.rawValue
                : HKCategoryValueSeverity.notPresent.rawValue
            for sample in try await samples(type) where sample.value != absent {
                let day = cal.startOfDay(for: sample.startDate)
                guard let i = result.firstIndex(where: { (($0.start)...($0.end)).contains(day) }) else { continue }
                if !result[i].symptoms.contains(name) { result[i].symptoms.append(name) }
                if sample.sourceRevision.source == own { ownedByPeriod[result[i].start, default: []].append(sample) }
            }
        }

        periods = result.sorted { $0.start > $1.start }
        owned = ownedByPeriod
    }

    private static func rank(_ flow: String) -> Int { ["light": 1, "medium": 2, "heavy": 3][flow] ?? 0 }

    private static func flowName(_ value: Int) -> String? {
        switch HKCategoryValueVaginalBleeding(rawValue: value) {
        case .light: "light"
        case .medium: "medium"
        case .heavy: "heavy"
        case .unspecified: ""
        default: nil
        }
    }

    // MARK: Writing

    /// A sample per day from `start` through `end`, and each symptom on the first day.
    private func objects(start: Date, end: Date, flow: String, symptoms: [String], includesStart: Bool = true) -> [HKObject] {
        let cal = Calendar.current
        let value: HKCategoryValueVaginalBleeding = switch flow {
        case "light": .light
        case "medium": .medium
        case "heavy": .heavy
        default: .unspecified
        }
        var objects: [HKObject] = []
        var day = cal.startOfDay(for: start)
        var isFirst = includesStart
        while day <= end {
            // Midday, so a later time zone change can't move it to the next day.
            let noon = cal.date(byAdding: .hour, value: 12, to: day)!
            objects.append(HKCategorySample(type: Self.flowType, value: value.rawValue, start: noon, end: noon,
                                            metadata: [HKMetadataKeyMenstrualCycleStart: isFirst]))
            isFirst = false
            day = cal.date(byAdding: .day, value: 1, to: day)!
        }
        let noon = cal.date(byAdding: .hour, value: 12, to: cal.startOfDay(for: start))!
        for (name, type) in Self.symptomTypes where symptoms.contains(name) {
            let value = type == HKCategoryType(.moodChanges) ? HKCategoryValuePresence.present.rawValue
                : HKCategoryValueSeverity.unspecified.rawValue
            objects.append(HKCategorySample(type: type, value: value, start: noon, end: noon))
        }
        return objects
    }

    /// Saves the new version before deleting the old, so a failure leaves a
    /// duplicate rather than a lost period.
    @discardableResult
    func save(start: Date, end: Date, flow: String, symptoms: [String], replacing old: Period? = nil) async -> Bool {
        let cal = Calendar.current
        let start = cal.startOfDay(for: start), end = cal.startOfDay(for: max(end, start))
        if isSample {
            periods.removeAll { $0.id == old?.id }
            periods.append(Period(start: start, end: end, flow: flow, symptoms: symptoms))
            periods.sort { $0.start > $1.start }
            return true
        }
        return await write {
            try await self.health.save(self.objects(start: start, end: end, flow: flow, symptoms: symptoms))
            if let old, let mine = self.owned[old.id], !mine.isEmpty { try await self.health.delete(mine) }
        }
    }

    func delete(_ period: Period) async {
        if isSample { periods.removeAll { $0.id == period.id }; return }
        guard let mine = owned[period.id], !mine.isEmpty else { return }
        await write { try await self.health.delete(mine) }
    }

    /// Extends a current period through today.
    func addToday(to period: Period) async {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        if isSample {
            if let i = periods.firstIndex(of: period) { periods[i].end = today }
            return
        }
        let first = cal.date(byAdding: .day, value: 1, to: period.end)!
        await write {
            try await self.health.save(self.objects(start: first, end: today, flow: period.flow, symptoms: [], includesStart: false))
        }
    }

    /// Removes what Wooli wrote to Health. What other apps logged stays.
    func deleteEverythingWooliWrote() async {
        if isSample { periods = []; return }
        guard access == .connected else { return }
        await write {
            for type in Self.allTypes {
                _ = try await self.health.deleteObjects(of: type, predicate: HKQuery.predicateForObjects(from: HKSource.default()))
            }
        }
    }

    /// Moves periods from before Wooli used Health. Deletes each one, from this
    /// iPhone and iCloud, only once it reads back from Health. Notes aren't moved;
    /// Health has nowhere to keep them.
    @discardableResult
    func moveToHealth(_ entries: [PeriodEntry], context: ModelContext) async -> Bool {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        var objects: [HKObject] = []
        for entry in entries where !periods.contains(where: { ($0.start...$0.end).contains(cal.startOfDay(for: entry.startDay)) }) {
            let start = cal.startOfDay(for: entry.startDay)
            // An old entry left "ongoing" gets a typical length, not a run up to today.
            let end = min(entry.endDay ?? cal.date(byAdding: .day, value: CycleMath.defaultPeriodLength - 1, to: start)!, today)
            objects += self.objects(start: start, end: end, flow: entry.flowRaw, symptoms: entry.symptoms)
        }
        let saved = objects.isEmpty ? true : await write { try await self.health.save(objects) }
        guard saved else { return false }
        for entry in entries {
            let start = cal.startOfDay(for: entry.startDay)
            if periods.contains(where: { ($0.start...$0.end).contains(start) }) { context.delete(entry) }
        }
        try? context.save()
        return true
    }

    @discardableResult
    private func write(_ work: @escaping () async throws -> Void) async -> Bool {
        do {
            try await work()
            try await load()
            return true
        } catch {
            Self.log.error("Writing to Health failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save to Apple Health. Check Wooli's access in Settings → Health → Data Access & Devices."
            return false
        }
    }
}
