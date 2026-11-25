#if os(macOS)
import Foundation
import SwiftData

/// Forecast changes made outside the app window (Claude via the Mac MCP server).
/// The MCP process opens the store read-only, so it queues whole plans here and
/// the running app saves them through its own context, which syncs to iCloud.
enum ForecastEdits {
    struct Queued: Codable {
        /// nil = add as a new scenario.
        var scenarioId: String?
        var plan: ForecastPlan
        var summary: String
    }

    static let didApply = Notification.Name("ForecastEditsDidApply")
    static var inboxURL: URL { URL.documentsDirectory.appending(path: "forecast-edits.json") }

    static func queue(_ edit: Queued) throws {
        var all = (try? JSONDecoder().decode([Queued].self, from: Data(contentsOf: inboxURL))) ?? []
        all.append(edit)
        try FileManager.default.createDirectory(at: inboxURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(all).write(to: inboxURL, options: .atomic)
    }

    /// Saves anything waiting. Cheap when there's nothing (one file check).
    @MainActor @discardableResult
    static func apply(in context: ModelContext) -> Int {
        guard FileManager.default.fileExists(atPath: inboxURL.path),
              let data = try? Data(contentsOf: inboxURL) else { return 0 }
        try? FileManager.default.removeItem(at: inboxURL)
        guard let edits = try? JSONDecoder().decode([Queued].self, from: data), !edits.isEmpty else { return 0 }
        let scenarios = (try? context.fetch(FetchDescriptor<ForecastScenario>())) ?? []
        for edit in edits {
            if let id = edit.scenarioId, let s = scenarios.first(where: { $0.id == id }) {
                s.plan = edit.plan
            } else {
                context.insert(ForecastScenario(plan: edit.plan))
            }
        }
        try? context.save()
        NotificationCenter.default.post(name: didApply, object: nil)
        return edits.count
    }

    struct PatchError: Error { let message: String }

    /// Applies a JSON merge patch to a plan. Objects merge key by key; `null`
    /// clears a value. The arrays `people`, `incomes`, `accounts` and `events`
    /// merge item by item on `id` (unknown ids are added, `"_delete": true`
    /// removes one); other arrays are replaced whole.
    static func merge(_ plan: ForecastPlan, patch: [String: Any]) throws -> ForecastPlan {
        let encoded = try JSONEncoder().encode(plan)
        guard var object = try JSONSerialization.jsonObject(with: encoded) as? [String: Any] else {
            throw PatchError(message: "Couldn't read the plan.")
        }
        let templates: [String: () throws -> [String: Any]] = [
            "people": { try template(ForecastPerson()) },
            "incomes": { try template(ForecastIncome()) },
            "accounts": { try template(ForecastAccount()) },
            "events": { try template(ForecastEvent()) },
        ]
        for (key, value) in patch {
            if let make = templates[key], let items = value as? [[String: Any]] {
                var list = object[key] as? [[String: Any]] ?? []
                for item in items {
                    let id = item["id"] as? String
                    if let id, let i = list.firstIndex(where: { $0["id"] as? String == id }) {
                        if item["_delete"] as? Bool == true { list.remove(at: i) } else { list[i] = mergeObject(list[i], item) }
                    } else if item["_delete"] as? Bool != true {
                        var base = try make()
                        base = mergeObject(base, item)
                        list.append(base)
                    }
                }
                object[key] = list
            } else {
                object[key] = merge(object[key], value)
            }
        }
        let data = try JSONSerialization.data(withJSONObject: object)
        do {
            return try JSONDecoder().decode(ForecastPlan.self, from: data)
        } catch {
            throw PatchError(message: "The change doesn't fit the plan: \(error)")
        }
    }

    private static func template<T: Encodable>(_ value: T) throws -> [String: Any] {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as? [String: Any] ?? [:]
    }

    private static func mergeObject(_ base: [String: Any], _ patch: [String: Any]) -> [String: Any] {
        var out = base
        for (k, v) in patch where k != "_delete" { out[k] = merge(out[k], v) }
        return out
    }

    private static func merge(_ base: Any?, _ patch: Any) -> Any? {
        if patch is NSNull { return nil }
        if let p = patch as? [String: Any] { return mergeObject(base as? [String: Any] ?? [:], p) }
        return patch
    }
}
#endif
