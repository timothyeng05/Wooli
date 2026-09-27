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

    /// The values a statement condition matches against — any one is enough
    /// (OR). Falls back to the old single-value field for rules saved before
    /// multi-value support existed.
    static func statementValues(_ r: TransactionRule) -> [String] {
        r.statementTexts.isEmpty ? (r.statementText.isEmpty ? [] : [r.statementText]) : r.statementTexts
    }

    /// Same as `statementValues`, for the merchant condition.
    static func merchantValues(_ r: TransactionRule) -> [String] {
        r.merchantTexts.isEmpty ? (r.merchantText.isEmpty ? [] : [r.merchantText]) : r.merchantTexts
    }

    private static let fillerWords: Set<String> = [
        "pos", "debit", "credit", "purchase", "card", "checkcard", "ach", "visa", "mastercard", "recurring",
        "online", "web", "withdrawal", "deposit", "payment", "pmt", "dbt", "crd", "sq", "tst*", "sq*",
    ]

    /// "Always use this category for this merchant and skip review": a rule on
    /// the merchant name that sets the category and marks it reviewed, applied
    /// right away to every matching transaction. Reuses an existing rule for
    /// the same merchant. Returns how many other transactions it cleared.
    @MainActor
    @discardableResult
    static func autoApprove(_ tx: LocalTransaction, category: BudgetCategory, context: ModelContext) -> Int {
        let merchant = tx.baseTitle
        let existing = ((try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []).first {
            let merchants = merchantValues($0)
            return $0.merchantMatch == "exact" && merchants.count == 1 && merchants[0].caseInsensitiveCompare(merchant) == .orderedSame
                && statementValues($0).isEmpty && $0.amountMatch.isEmpty && $0.accountIds.isEmpty && $0.categoryIds.isEmpty
        }
        let rule = existing ?? {
            let r = TransactionRule()
            r.merchantMatch = "exact"
            r.merchantTexts = [merchant]
            context.insert(r)
            return r
        }()
        rule.setCategoryId = category.id
        rule.reviewAction = "reviewed"
        rule.isEnabled = true

        Categorizer.assign(category, to: tx)
        tx.needsReview = false
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        Categorizer.learn(from: tx, categories: categories, context: context)
        let all = (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? []
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let cleared = RuleEngine.applyToExisting(rule, transactions: all.filter { $0 !== tx && !$0.isSplit }, categories: byId)
        try? context.save()
        return cleared
    }

    /// Merges rules that are identical except for which statement/merchant
    /// values they match on, so e.g. five separate "this merchant → Coffee"
    /// rules collapse into one "contains A or B or C or D or E" rule/card.
    /// Lossless: the merged rule matches the exact union of what the
    /// originals matched, since everything else about them is identical.
    /// Rules that reach the same category by different means (different
    /// match modes, amount/account/category conditions, or other actions)
    /// are left alone rather than guessed at.
    @MainActor
    @discardableResult
    static func consolidate(context: ModelContext) -> Int {
        // A rule with both a statement AND a merchant condition can't be
        // merged by simply OR-ing each field's values: that would also match
        // combinations neither original rule matched (statement from one
        // rule paired with the merchant from another). Leave those alone.
        // A rule aimed at a group ("Transfer") that has a category of the same
        // name inside it means that category: point it there, so it lines up
        // with the other rules for it (and files transactions properly).
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        var retargeted = false
        for rule in (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? [] {
            guard let id = rule.setCategoryId, let target = categories.first(where: { $0.id == id }), target.parentId == nil,
                  let child = categories.first(where: { $0.parentId == target.id && $0.name.caseInsensitiveCompare(target.name) == .orderedSame })
            else { continue }
            rule.setCategoryId = child.id
            retargeted = true
        }

        let rules = ((try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []).filter {
            statementValues($0).isEmpty || merchantValues($0).isEmpty
        }
        let groups = Dictionary(grouping: rules, by: mergeSignature)
        var merged = 0
        for group in groups.values where group.count > 1 {
            let ordered = group.sorted { $0.createdAt < $1.createdAt }
            let keeper = ordered[0]
            var statements = Set(statementValues(keeper))
            var merchants = Set(merchantValues(keeper))
            for extra in ordered.dropFirst() {
                statements.formUnion(statementValues(extra))
                merchants.formUnion(merchantValues(extra))
                keeper.timesApplied += extra.timesApplied
                if let last = extra.lastAppliedAt, last > (keeper.lastAppliedAt ?? .distantPast) { keeper.lastAppliedAt = last }
                context.delete(extra)
                merged += 1
            }
            keeper.statementTexts = statements.sorted()
            keeper.statementText = ""
            keeper.merchantTexts = merchants.sorted()
            keeper.merchantText = ""
        }
        if merged > 0 || retargeted { try? context.save() }
        return merged
    }

    /// Everything that must match for two rules to merge safely: same mode
    /// and same non-text conditions, same actions. Only the text values
    /// (which the merge unions with OR) are allowed to differ.
    /// "Tidy up": rules that file into the same category and differ only in
    /// "contains" vs "is exactly" or in whether they mark reviewed are lined
    /// up (contains; reviewed if any of them was), then merged. Slightly
    /// broader than the originals, so it's a user action, not automatic.
    @MainActor
    @discardableResult
    static func tidy(context: ModelContext) -> Int {
        let rules = ((try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []).filter {
            $0.setCategoryId != nil && (statementValues($0).isEmpty != merchantValues($0).isEmpty)
        }
        let groups = Dictionary(grouping: rules) { r in
            [r.isEnabled ? "1" : "0", statementValues(r).isEmpty ? "merchant" : "statement", r.amountDirection, r.amountMatch,
             String(r.amountValue), String(r.amountValue2), r.categoryIds.sorted().joined(separator: ","),
             r.accountIds.sorted().joined(separator: ","), r.renameTo, r.setCategoryId ?? "", r.hide ? "1" : "0", r.addTag]
                .joined(separator: "|")
        }
        for group in groups.values where group.count > 1 {
            let reviewed = group.contains { $0.reviewAction == "reviewed" }
            for r in group {
                if !statementValues(r).isEmpty { r.statementMatch = "contains" }
                if !merchantValues(r).isEmpty { r.merchantMatch = "contains" }
                if reviewed && r.reviewAction.isEmpty { r.reviewAction = "reviewed" }
            }
        }
        try? context.save()
        return consolidate(context: context)
    }

    private static func mergeSignature(_ r: TransactionRule) -> String {
        [r.isEnabled ? "1" : "0", r.statementMatch, r.merchantMatch, r.amountDirection, r.amountMatch,
         String(r.amountValue), String(r.amountValue2), r.categoryIds.sorted().joined(separator: ","),
         r.accountIds.sorted().joined(separator: ","), r.renameTo, r.setCategoryId ?? "", r.reviewAction,
         r.hide ? "1" : "0", r.addTag].joined(separator: "|")
    }

    /// A new rule pre-filled from a transaction: original statement contains
    /// its meaningful start, set to `category`. No account is pre-selected.
    static func seed(_ rule: TransactionRule, from tx: LocalTransaction, category: BudgetCategory?) {
        rule.statementMatch = "contains"
        rule.statementTexts = [statementPrefix(tx.transactionDescription)]
        rule.setCategoryId = category?.id ?? tx.categoryId
        // Made while reviewing: matching transactions should leave the queue.
        rule.reviewAction = "reviewed"
    }

    static func hasConditions(_ r: TransactionRule) -> Bool {
        (!r.statementMatch.isEmpty && !statementValues(r).isEmpty) || (!r.merchantMatch.isEmpty && !merchantValues(r).isEmpty)
            || !r.amountDirection.isEmpty || !r.amountMatch.isEmpty || !r.categoryIds.isEmpty || !r.accountIds.isEmpty
    }

    static func hasActions(_ r: TransactionRule) -> Bool {
        !r.renameTo.isEmpty || r.setCategoryId != nil || !r.reviewAction.isEmpty || r.hide || !r.addTag.isEmpty
    }

    static func matches(_ r: TransactionRule, _ tx: LocalTransaction) -> Bool {
        guard hasConditions(r) else { return false }
        let statements = statementValues(r)
        if !r.statementMatch.isEmpty && !statements.isEmpty,
           !statements.contains(where: { text(tx.transactionDescription, r.statementMatch, $0) }) { return false }
        let merchants = merchantValues(r)
        if !r.merchantMatch.isEmpty && !merchants.isEmpty,
           !merchants.contains(where: { text(tx.baseTitle, r.merchantMatch, $0) }) { return false }
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
        if !r.addTag.isEmpty && !tx.tags.contains(where: { $0.caseInsensitiveCompare(r.addTag) == .orderedSame }) {
            tx.tags.append(r.addTag)
            changed = true
        }
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
        let statements = statementValues(r)
        if !r.statementMatch.isEmpty && !statements.isEmpty {
            let verb = r.statementMatch == "exact" ? "exactly matches" : "contains"
            lines.append("If original statement \(verb) \(statements.map { "\"\($0)\"" }.joined(separator: " or "))")
        }
        let merchants = merchantValues(r)
        if !r.merchantMatch.isEmpty && !merchants.isEmpty {
            let verb = r.merchantMatch == "exact" ? "exactly matches" : "contains"
            lines.append("If merchant name \(verb) \(merchants.map { "\"\($0)\"" }.joined(separator: " or "))")
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
        if !r.addTag.isEmpty { lines.append("Add tag #\(r.addTag)") }
        return lines
    }
}
