import Foundation
import SwiftData

/// One-time import of rules (and any categories they need) from
/// `Documents/wooli-import.json`, e.g. rules ported from Monarch. The file is
/// deleted after a successful import so it only ever runs once.
///
/// Format:
/// {
///   "categories": [{ "name": "Parking & Tolls", "icon": "🅿️", "group": "Travel" }],
///   "rules": [{ "merchantExact": "e-zpass", "setCategory": "Parking & Tolls" },
///             { "statementContains": "…", "accountNameContains": "1939", "setCategory": "…" },
///             { "merchantExact": "zelle", "debitEquals": 1000, "setCategory": "Rent Income" },
///             { "merchantExact": "citizens bank", "renameTo": "To Checking - 7186" }]
/// }
enum RuleImporter {
    struct Payload: Decodable {
        struct Category: Decodable { let name: String; let icon: String?; let group: String }
        struct Rule: Decodable {
            var merchantExact: String?
            var merchantContains: String?
            var statementContains: String?
            var statementExact: String?
            var debitEquals: Double?
            var creditEquals: Double?
            var accountNameContains: String?
            var setCategory: String?
            var renameTo: String?
            var markReviewed: Bool?
            var hide: Bool?
        }
        var categories: [Category]?
        var rules: [Rule]?
        /// Existing rules to delete, matched on their merchant/statement text.
        var removeRules: [Rule]?
    }

    static var fileURL: URL {
        URL.documentsDirectory.appending(path: "wooli-import.json")
    }

    /// Returns the number of rules added, or nil if there was nothing to import.
    @MainActor
    @discardableResult
    static func importIfPresent(context: ModelContext) -> Int? {
        guard let data = try? Data(contentsOf: fileURL),
              let payload = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }

        var categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        for c in payload.categories ?? [] where !categories.contains(where: { $0.name.caseInsensitiveCompare(c.name) == .orderedSame }) {
            guard let group = categories.first(where: { $0.parentId == nil && $0.name.caseInsensitiveCompare(c.group) == .orderedSame })
            else { continue }
            let siblings = categories.filter { $0.parentId == group.id }
            let new = BudgetCategory(name: c.name, icon: c.icon ?? "•", colorHex: group.colorHex, parentId: group.id,
                                     isIncome: group.isIncome, isTransfer: group.isTransfer,
                                     sortOrder: (siblings.map(\.sortOrder).max() ?? group.sortOrder) + 1)
            context.insert(new)
            categories.append(new)
        }

        func category(named name: String?) -> BudgetCategory? {
            guard let name else { return nil }
            let leaves = categories.filter { $0.parentId != nil }
            return leaves.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }
                ?? categories.first { $0.name.caseInsensitiveCompare(name) == .orderedSame }
        }

        let accounts = (try? context.fetch(FetchDescriptor<LocalAccount>())) ?? []
        let existingRules = (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []
        let transactions = (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var added = 0

        for r in payload.removeRules ?? [] {
            let merchant = (r.merchantExact ?? r.merchantContains ?? "").lowercased()
            let statement = (r.statementContains ?? r.statementExact ?? "").lowercased()
            for rule in existingRules where rule.merchantText.lowercased() == merchant
                && rule.statementText.lowercased() == statement {
                context.delete(rule)
            }
        }
        let remaining = existingRules.filter { !$0.isDeleted }
        let rules = payload.rules ?? []

        for (i, r) in rules.enumerated() {
            let rule = TransactionRule()
            // Keep the file's order: older createdAt runs first.
            rule.createdAt = Date.now.addingTimeInterval(Double(i) - Double(rules.count))
            if let m = r.merchantExact { rule.merchantMatch = "exact"; rule.merchantText = m }
            if let m = r.merchantContains { rule.merchantMatch = "contains"; rule.merchantText = m }
            if let s = r.statementContains { rule.statementMatch = "contains"; rule.statementText = s }
            if let s = r.statementExact { rule.statementMatch = "exact"; rule.statementText = s }
            if let a = r.debitEquals { rule.amountDirection = "debit"; rule.amountMatch = "equals"; rule.amountValue = a }
            if let a = r.creditEquals { rule.amountDirection = "credit"; rule.amountMatch = "equals"; rule.amountValue = a }
            if let name = r.accountNameContains {
                rule.accountIds = accounts.filter { $0.name.localizedCaseInsensitiveContains(name) }.map(\.providerAccountId)
            }
            rule.setCategoryId = category(named: r.setCategory)?.id
            rule.renameTo = r.renameTo ?? ""
            if r.markReviewed == true { rule.reviewAction = "reviewed" }
            rule.hide = r.hide ?? false

            guard RuleEngine.hasConditions(rule), RuleEngine.hasActions(rule) else { continue }
            let duplicate = remaining.contains {
                $0.merchantText == rule.merchantText && $0.statementText == rule.statementText
                    && $0.setCategoryId == rule.setCategoryId && $0.renameTo == rule.renameTo
                    && $0.amountValue == rule.amountValue && $0.accountIds == rule.accountIds
            }
            guard !duplicate else { continue }
            context.insert(rule)
            RuleEngine.applyToExisting(rule, transactions: transactions, categories: byId)
            added += 1
        }

        try? context.save()
        try? FileManager.default.removeItem(at: fileURL)
        return added
    }
}
