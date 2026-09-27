import Foundation
import SwiftData

/// Matching and applying `TransactionRule`s.
enum RuleEngine {
    /// The meaningful start of a bank statement, for a "contains" rule:
    /// everything before the first id, card mask, date or store number.
    /// "TST* JOE'S PIZZA 0123 NEW YORK" → "TST* JOE'S PIZZA".
    static func statementPrefix(_ statement: String) -> String {
        // Split into runs of words separated by ids/dates/store numbers, then
        // take the first run that names something (not just "POS DEBIT").
        // Runs are contiguous in the original, so "contains" still matches.
        var runs: [[Substring]] = [[]]
        for token in statement.split(separator: " ") {
            let digits = token.filter(\.isNumber).count
            let looksLikeId = digits >= 4 || token.contains("#") || token.uppercased().contains("XXX")
                || (token.contains("/") && digits >= 2)
            if looksLikeId {
                if !(runs.last?.isEmpty ?? true) { runs.append([]) }
            } else {
                runs[runs.count - 1].append(token)
            }
        }
        let run = runs.first { run in run.contains { !fillerWords.contains($0.lowercased()) } } ?? runs.first ?? []
        let prefix = run.prefix(6).joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return prefix.isEmpty ? statement : prefix
    }

    private static let fillerWords: Set<String> = [
        "pos", "debit", "credit", "purchase", "card", "checkcard", "ach", "visa", "mastercard", "recurring",
        "online", "web", "withdrawal", "deposit", "payment", "pmt", "dbt", "crd", "sq", "tst*", "sq*",
    ]

    /// A new rule pre-filled from a transaction: original statement contains
    /// its meaningful start, set to `category`. No account is pre-selected.
    static func seed(_ rule: TransactionRule, from tx: LocalTransaction, category: BudgetCategory?) {
        rule.statementMatch = "contains"
        rule.statementText = statementPrefix(tx.transactionDescription)
        rule.setCategoryId = category?.id ?? tx.categoryId
    }

    static func hasConditions(_ r: TransactionRule) -> Bool {
        (!r.statementMatch.isEmpty && !r.statementText.isEmpty) || (!r.merchantMatch.isEmpty && !r.merchantText.isEmpty)
            || !r.amountDirection.isEmpty || !r.amountMatch.isEmpty || !r.categoryIds.isEmpty || !r.accountIds.isEmpty
    }

    static func hasActions(_ r: TransactionRule) -> Bool {
        !r.renameTo.isEmpty || r.setCategoryId != nil || !r.reviewAction.isEmpty || r.hide
    }

    static func matches(_ r: TransactionRule, _ tx: LocalTransaction) -> Bool {
        guard hasConditions(r) else { return false }
        if !r.statementMatch.isEmpty && !r.statementText.isEmpty,
           !text(tx.transactionDescription, r.statementMatch, r.statementText) { return false }
        if !r.merchantMatch.isEmpty && !r.merchantText.isEmpty,
           !text(tx.baseTitle, r.merchantMatch, r.merchantText) { return false }
        if r.amountDirection == "debit" && tx.amount >= 0 { return false }
        if r.amountDirection == "credit" && tx.amount <= 0 { return false }
        let size = abs(tx.amount)
        switch r.amountMatch {
        case "equals": if abs(size - r.amountValue) > 0.005 { return false }
        case "greater": if size <= r.amountValue { return false }
        case "less": if size >= r.amountValue { return false }
        case "between": if size < min(r.amountValue, r.amountValue2) || size > max(r.amountValue, r.amountValue2) { return false }
        default: break
        }
        if !r.categoryIds.isEmpty && !r.categoryIds.contains(tx.categoryId ?? "") { return false }
        if !r.accountIds.isEmpty && !r.accountIds.contains(tx.accountId) { return false }
        return true
    }

    private static func text(_ value: String, _ mode: String, _ needle: String) -> Bool {
        let v = value.lowercased().trimmingCharacters(in: .whitespaces)
        let n = needle.lowercased().trimmingCharacters(in: .whitespaces)
        return mode == "exact" ? v == n : v.contains(n)
    }

    /// Apply the rule's actions. Returns true if anything changed.
    @discardableResult
    static func apply(_ r: TransactionRule, to tx: LocalTransaction, categories: [String: BudgetCategory]) -> Bool {
        var changed = false
        if !r.renameTo.isEmpty && tx.customTitle != r.renameTo { tx.customTitle = r.renameTo; changed = true }
        if let id = r.setCategoryId, let category = categories[id], tx.categoryId != id || tx.aiSuggested {
            Categorizer.assign(category, to: tx)
            changed = true
        }
        switch r.reviewAction {
        case "reviewed" where tx.needsReview && tx.categoryId != nil: tx.needsReview = false; changed = true
        case "needsReview" where !tx.needsReview: tx.needsReview = true; changed = true
        default: break
        }
        if r.hide && !tx.isHidden { tx.isHidden = true; changed = true }
        return changed
    }

    /// Run every enabled rule (oldest first) against one transaction.
    static func applyAll(_ rules: [TransactionRule], to tx: LocalTransaction, categories: [String: BudgetCategory]) {
        for rule in rules where rule.isEnabled && matches(rule, tx) {
            if apply(rule, to: tx, categories: categories) {
                rule.timesApplied += 1
                rule.lastAppliedAt = .now
            }
        }
    }

    /// Apply one rule to existing transactions. Returns how many changed.
    @discardableResult
    static func applyToExisting(_ rule: TransactionRule, transactions: [LocalTransaction],
                                categories: [String: BudgetCategory]) -> Int {
        var count = 0
        for tx in transactions where matches(rule, tx) {
            if apply(rule, to: tx, categories: categories) { count += 1 }
        }
        if count > 0 {
            rule.timesApplied += count
            rule.lastAppliedAt = .now
        }
        return count
    }

    /// One-line description of the conditions, Monarch style.
    static func conditionLines(_ r: TransactionRule, categories: [String: BudgetCategory], accounts: [String: String]) -> [String] {
        var lines: [String] = []
        if !r.statementMatch.isEmpty && !r.statementText.isEmpty {
            lines.append("If original statement \(r.statementMatch == "exact" ? "exactly matches" : "contains") \"\(r.statementText)\"")
        }
        if !r.merchantMatch.isEmpty && !r.merchantText.isEmpty {
            lines.append("If merchant name \(r.merchantMatch == "exact" ? "exactly matches" : "contains") \"\(r.merchantText)\"")
        }
        if !r.amountDirection.isEmpty || !r.amountMatch.isEmpty {
            let kind = r.amountDirection == "debit" ? "debit" : r.amountDirection == "credit" ? "credit" : "amount"
            let a = r.amountValue.currency(), b = r.amountValue2.currency()
            switch r.amountMatch {
            case "equals": lines.append("If \(kind) equals \(a)")
            case "greater": lines.append("If \(kind) is over \(a)")
            case "less": lines.append("If \(kind) is under \(a)")
            case "between": lines.append("If \(kind) is between \(a) and \(b)")
            default: lines.append("If it's a \(kind)")
            }
        }
        if !r.categoryIds.isEmpty {
            let names = r.categoryIds.map { $0.isEmpty ? "Uncategorized" : categories[$0]?.name ?? "?" }
            lines.append("If category is \(names.joined(separator: ", "))")
        }
        if !r.accountIds.isEmpty {
            lines.append("If account is \(r.accountIds.map { accounts[$0] ?? "?" }.joined(separator: ", "))")
        }
        return lines
    }

    static func actionLines(_ r: TransactionRule, categories: [String: BudgetCategory]) -> [String] {
        var lines: [String] = []
        if !r.renameTo.isEmpty { lines.append("Rename to \(r.renameTo)") }
        if let id = r.setCategoryId, let c = categories[id] { lines.append("Recategorize to \(c.icon) \(c.name)") }
        if r.reviewAction == "reviewed" { lines.append("Mark as reviewed") }
        if r.reviewAction == "needsReview" { lines.append("Mark as needs review") }
        if r.hide { lines.append("Hide transaction") }
        return lines
    }
}
