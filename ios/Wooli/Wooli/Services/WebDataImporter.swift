import Foundation
import SwiftData
import os

/// One-time hand-over from the Wooli web app, via `Documents/web-import.json`
/// (copied onto the phone, applied on launch, then deleted):
/// - `reviewed`: transactions you already reviewed on the web. Each one that's
///   still waiting for review here gets that category and is marked reviewed;
///   anything you've reviewed on the phone is left alone.
/// - `periods`: period entries, skipped if one already starts that day.
enum WebDataImporter {
    struct Payload: Decodable {
        struct Reviewed: Decodable {
            let providerTransactionId: String
            /// A `BudgetCategory.id` on this phone; nil with `isTransfer`.
            let categoryId: String?
            let isTransfer: Bool?
        }
        struct Period: Decodable {
            /// "yyyy-MM-dd"
            let start: String
            let end: String?
            let flow: String?
        }
        var reviewed: [Reviewed]?
        var periods: [Period]?
    }

    private static let log = Logger(subsystem: "com.timothyeng.wooli", category: "WebImport")
    private static var url: URL { URL.documentsDirectory.appending(path: "web-import.json") }

    static func importIfPresent(context: ModelContext) {
        guard let data = try? Data(contentsOf: url) else { return }
        defer { try? FileManager.default.removeItem(at: url) }
        guard let payload = try? JSONDecoder().decode(Payload.self, from: data) else {
            log.error("Web import file couldn't be read")
            return
        }
        var categorized = 0
        if let reviewed = payload.reviewed, !reviewed.isEmpty {
            let categories = Dictionary(((try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []).map { ($0.id, $0) },
                                        uniquingKeysWith: { a, _ in a })
            let waiting = (try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.needsReview }))) ?? []
            let byID = Dictionary(waiting.map { ($0.providerTransactionId, $0) }, uniquingKeysWith: { a, _ in a })
            for item in reviewed {
                guard let tx = byID[item.providerTransactionId] else { continue }
                let category = item.categoryId.flatMap { categories[$0] }
                guard category != nil || item.isTransfer == true else { continue }
                Categorizer.assign(category, to: tx)
                if item.isTransfer == true { tx.isTransfer = true }
                tx.needsReview = false
                categorized += 1
            }
        }
        var added = 0
        if let periods = payload.periods {
            let existing = Set(((try? context.fetch(FetchDescriptor<PeriodEntry>())) ?? []).map { DayKey.key($0.startDay) })
            for period in periods where !existing.contains(period.start) {
                let entry = PeriodEntry(startDay: DayKey.date(period.start), endDay: period.end.map(DayKey.date))
                entry.flowRaw = period.flow ?? ""
                context.insert(entry)
                added += 1
            }
        }
        try? context.save()
        log.info("Web import: \(categorized) transactions reviewed, \(added) periods added")
    }
}
