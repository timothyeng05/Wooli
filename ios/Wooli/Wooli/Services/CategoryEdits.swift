#if os(macOS)
import Foundation
import SwiftData

/// Category changes Claude asks for through the Mac MCP server (which opens the
/// store read-only). The running app applies them like a hand-picked category.
enum CategoryEdits {
    struct Change: Codable {
        /// `LocalTransaction.providerTransactionId`.
        var transactionId: String
        var categoryId: String
        /// Mark it reviewed.
        var confirm: Bool
        /// Remember for this merchant, and pass on to its other unreviewed transactions.
        var remember: Bool
    }

    static var inboxURL: URL { URL.documentsDirectory.appending(path: "category-edits.json") }

    static func queue(_ changes: [Change]) throws {
        var all = (try? JSONDecoder().decode([Change].self, from: Data(contentsOf: inboxURL))) ?? []
        all += changes
        try FileManager.default.createDirectory(at: inboxURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(all).write(to: inboxURL, options: .atomic)
    }

    @MainActor @discardableResult
    static func apply(in context: ModelContext) -> Int {
        guard FileManager.default.fileExists(atPath: inboxURL.path),
              let data = try? Data(contentsOf: inboxURL) else { return 0 }
        try? FileManager.default.removeItem(at: inboxURL)
        guard let changes = try? JSONDecoder().decode([Change].self, from: data), !changes.isEmpty else { return 0 }
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        var applied = 0
        for change in changes {
            let id = change.transactionId
            guard let tx = try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.providerTransactionId == id })).first,
                  let category = categories.first(where: { $0.id == change.categoryId }) else { continue }
            Categorizer.assign(category, to: tx)
            if change.remember { Categorizer.learn(from: tx, categories: categories, context: context) }
            if change.confirm { tx.needsReview = false }
            applied += 1
        }
        try? context.save()
        return applied
    }
}
#endif
