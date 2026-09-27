import Foundation
import SwiftData

/// On-device replacement for the web app's categorization pipeline. There's no
/// AI layer here (that runs on a server in the web app), so suggestions come
/// from the user's own confirmed merchant rules first, then a small built-in
/// keyword list. Either way the transaction stays in the review queue until the
/// user confirms it.
enum Categorizer {
    /// Built-in hints: keyword in the merchant/description → default category name.
    /// Order matters: the first match wins, so more specific keywords come first.
    private static let keywordHints: [(String, String)] = [
        ("payment thank you", "Credit Card Payment"), ("autopay", "Credit Card Payment"),
        ("card payment", "Credit Card Payment"), ("epay", "Credit Card Payment"),
        ("online transfer", "Transfer"), ("transfer to", "Transfer"), ("transfer from", "Transfer"),
        ("apartments", "Rent"), ("property mgmt", "Rent"), ("landlord", "Rent"),
        ("payroll", "Salary"), ("direct dep", "Salary"), ("interest paid", "Other Income"),
        ("uber eats", "Takeout"), ("doordash", "Takeout"), ("grubhub", "Takeout"), ("seamless", "Takeout"),
        ("uber", "Rideshare"), ("lyft", "Rideshare"),
        ("starbucks", "Coffee"), ("blue bottle", "Coffee"), ("peet", "Coffee"), ("dunkin", "Coffee"),
        ("whole foods", "Groceries"), ("wholefds", "Groceries"), ("trader joe", "Groceries"),
        ("safeway", "Groceries"), ("kroger", "Groceries"), ("costco", "Groceries"), ("instacart", "Groceries"),
        ("mta", "Transit"), ("bart", "Transit"), ("clipper", "Transit"), ("metro", "Transit"),
        ("shell", "Car"), ("chevron", "Car"), ("exxon", "Car"),
        ("netflix", "Subscriptions"), ("spotify", "Subscriptions"), ("hulu", "Subscriptions"),
        ("apple.com", "Subscriptions"), ("icloud", "Subscriptions"), ("youtube", "Subscriptions"),
        ("comcast", "Internet"), ("xfinity", "Internet"), ("verizon", "Utilities"), ("pg&e", "Utilities"),
        ("con ed", "Utilities"), ("airbnb", "Hotels"), ("marriott", "Hotels"), ("hilton", "Hotels"),
        ("united", "Flights"), ("delta", "Flights"), ("jetblue", "Flights"), ("southwest", "Flights"),
        ("cvs", "Medical"), ("walgreens", "Medical"), ("amazon", "Shopping"), ("amzn", "Shopping"),
        ("target", "Shopping"), ("amc theatres", "Entertainment"), ("regal", "Entertainment"),
    ]

    /// Suggest a category id for a fresh transaction, or nil.
    static func suggest(merchant: String, description: String,
                        rules: [String: MerchantRule], categoriesByName: [String: BudgetCategory]) -> String? {
        if !merchant.isEmpty, let rule = rules[merchant] { return rule.categoryId }
        let haystack = (merchant + " " + description).lowercased()
        for (keyword, categoryName) in keywordHints where haystack.contains(keyword) {
            if let category = categoriesByName[categoryName.lowercased()] { return category.id }
        }
        return nil
    }

    /// Apply a category to a transaction. The transfer flag always follows the
    /// category, as it does on the web.
    static func assign(_ category: BudgetCategory?, to transaction: LocalTransaction, byAI: Bool = false) {
        transaction.categoryId = category?.id
        transaction.isTransfer = category?.isTransfer ?? false
        transaction.aiSuggested = byAI && category != nil
    }

    /// The user confirmed this transaction. Requires a category (same rule as
    /// the web review queue). Remembers the merchant, and pre-fills other
    /// unreviewed, uncategorized transactions from the same merchant, which
    /// still need their own confirmation.
    @discardableResult
    static func confirm(_ transaction: LocalTransaction, categories: [BudgetCategory], context: ModelContext) -> Bool {
        guard let categoryId = transaction.categoryId else { return false }
        transaction.needsReview = false

        let merchant = transaction.normalizedMerchant
        guard !merchant.isEmpty else { return true }

        let ruleFetch = FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.merchant == merchant })
        if let rule = try? context.fetch(ruleFetch).first {
            if rule.categoryId == categoryId { rule.timesConfirmed += 1 } else { rule.categoryId = categoryId; rule.timesConfirmed = 1 }
            rule.updatedAt = .now
        } else {
            context.insert(MerchantRule(merchant: merchant, categoryId: categoryId))
        }

        let category = categories.first { $0.id == categoryId }
        let siblings = FetchDescriptor<LocalTransaction>(
            predicate: #Predicate { $0.normalizedMerchant == merchant && $0.needsReview && $0.categoryId == nil })
        for other in (try? context.fetch(siblings)) ?? [] {
            assign(category, to: other)
        }
        return true
    }
}
