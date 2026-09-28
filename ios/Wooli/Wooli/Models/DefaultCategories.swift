import Foundation
import SwiftData

/// The starter category tree, and a way to bring an existing tree up to it
/// without losing anything.
enum DefaultCategories {
    struct Leaf {
        let name: String
        let icon: String
        /// Older/alternative names this category replaces (renamed in place).
        var aliases: [String] = []
    }

    struct Group {
        let name: String
        let color: String
        let icon: String
        var isIncome = false
        var isTransfer = false
        var aliases: [String] = []
        let children: [Leaf]
    }

    static let groups: [Group] = [
        Group(name: "Food & Dining", color: "#f59e0b", icon: "🍽️", children: [
            Leaf(name: "Groceries", icon: "🛒"),
            Leaf(name: "Restaurants", icon: "🍽️", aliases: ["Dining", "Restaurants & Bars"]),
            Leaf(name: "Coffee", icon: "☕", aliases: ["Coffee Shops"]),
            Leaf(name: "Takeout & Delivery", icon: "🥡", aliases: ["Takeout", "Delivery"]),
            Leaf(name: "Alcohol & Bars", icon: "🍷", aliases: ["Alcohol", "Bars"]),
        ]),
        Group(name: "Home", color: "#8b5cf6", icon: "🏠", aliases: ["Housing"], children: [
            Leaf(name: "Rent & Mortgage", icon: "🏠", aliases: ["Rent", "Mortgage", "Housing"]),
            Leaf(name: "Utilities & Internet", icon: "💡", aliases: ["Utilities", "Internet"]),
            Leaf(name: "Phone", icon: "📱", aliases: ["Mobile Phone"]),
            Leaf(name: "Home Supplies", icon: "🧻", aliases: ["Home Supply", "Household"]),
            Leaf(name: "Home Improvement", icon: "🔨"),
        ]),
        Group(name: "Transportation", color: "#0ea5e9", icon: "🚗", aliases: ["Transport"], children: [
            Leaf(name: "Transit", icon: "🚇", aliases: ["Public Transit"]),
            Leaf(name: "Rideshare & Taxi", icon: "🚕", aliases: ["Rideshare", "Taxi", "Transit & Rideshare"]),
            Leaf(name: "Gas", icon: "⛽", aliases: ["Gas & Fuel", "Fuel"]),
            Leaf(name: "Car", icon: "🚘", aliases: ["Auto", "Car & Auto"]),
            Leaf(name: "Parking & Tolls", icon: "🅿️", aliases: ["Parking", "Tolls"]),
        ]),
        Group(name: "Travel", color: "#06b6d4", icon: "✈️", children: [
            Leaf(name: "Flights", icon: "✈️", aliases: ["Airfare"]),
            Leaf(name: "Hotels", icon: "🏨", aliases: ["Lodging"]),
            Leaf(name: "Vacation", icon: "🏖️", aliases: ["Trip", "Trips"]),
        ]),
        Group(name: "Shopping", color: "#ec4899", icon: "🛍️", children: [
            Leaf(name: "Shopping", icon: "🛍️", aliases: ["General Shopping"]),
            Leaf(name: "Clothing", icon: "👗"),
            Leaf(name: "Electronics", icon: "💻"),
            Leaf(name: "Gifts", icon: "🎁"),
        ]),
        Group(name: "Health & Personal", color: "#10b981", icon: "🩺", aliases: ["Personal", "Health"], children: [
            Leaf(name: "Medical", icon: "🏥", aliases: ["Health & Medical", "Doctor"]),
            Leaf(name: "Pharmacy", icon: "💊"),
            Leaf(name: "Fitness", icon: "💪", aliases: ["Gym"]),
            Leaf(name: "Personal Care", icon: "💅"),
        ]),
        Group(name: "Entertainment", color: "#f97316", icon: "🎬", aliases: ["Fun", "Lifestyle"], children: [
            Leaf(name: "Entertainment", icon: "🎬", aliases: ["Entertainment & Events"]),
            Leaf(name: "Subscriptions", icon: "📺", aliases: ["Streaming"]),
            Leaf(name: "Hobbies", icon: "🎨"),
        ]),
        Group(name: "Family & Pets", color: "#eab308", icon: "👪", aliases: ["Family"], children: [
            Leaf(name: "Kids & Childcare", icon: "👶", aliases: ["Childcare", "Kids"]),
            Leaf(name: "Pets", icon: "🐾"),
            Leaf(name: "Education", icon: "🎓"),
        ]),
        Group(name: "Bills & Other", color: "#64748b", icon: "📋", aliases: ["Other", "Bills"], children: [
            Leaf(name: "Insurance", icon: "🛡️", aliases: ["Home Insurance"]),
            Leaf(name: "Taxes", icon: "📋"),
            Leaf(name: "Loan Payments", icon: "🤝", aliases: ["Loans"]),
            Leaf(name: "Fees & Interest", icon: "💸", aliases: ["Fees", "Bank Fees"]),
            Leaf(name: "Donations", icon: "❤️", aliases: ["Charity"]),
            Leaf(name: "Miscellaneous", icon: "📌"),
        ]),
        Group(name: "Income", color: "#22c55e", icon: "💵", isIncome: true, children: [
            Leaf(name: "Salary", icon: "💵", aliases: ["Paycheck"]),
            Leaf(name: "Side Income", icon: "💻", aliases: ["Freelance"]),
            Leaf(name: "Interest & Dividends", icon: "📈", aliases: ["Interest", "Dividends"]),
            Leaf(name: "Other Income", icon: "💰"),
        ]),
        Group(name: "Transfer", color: "#6366f1", icon: "↔️", isTransfer: true, aliases: ["Transfers"], children: [
            Leaf(name: "Transfer", icon: "↔️"),
            Leaf(name: "Credit Card Payment", icon: "💳"),
            Leaf(name: "Savings & Investments", icon: "🏦", aliases: ["Investments", "Savings"]),
            Leaf(name: "Balance Adjustments", icon: "⚖️"),
        ]),
    ]

    static func seedIfNeeded(_ context: ModelContext) {
        let existing = (try? context.fetchCount(FetchDescriptor<BudgetCategory>())) ?? 0
        guard existing == 0 else { return }
        for (gi, group) in groups.enumerated() {
            let parent = BudgetCategory(name: group.name, icon: group.icon, colorHex: group.color,
                                        isIncome: group.isIncome, isTransfer: group.isTransfer, sortOrder: gi * 100)
            context.insert(parent)
            for (ci, child) in group.children.enumerated() {
                context.insert(BudgetCategory(name: child.name, icon: child.icon, colorHex: group.color, parentId: parent.id,
                                              isIncome: group.isIncome, isTransfer: group.isTransfer,
                                              sortOrder: gi * 100 + ci + 1))
            }
        }
        seedStarterRules(context)
        try? context.save()
    }

    /// Bring an existing category tree up to the starter set, in place:
    /// matching categories (by name or an older alias) are renamed and moved,
    /// so transactions, rules, learned merchants and planned amounts stay
    /// attached; two old categories that became one are merged; missing ones
    /// are created; anything the user added that isn't in the starter set is
    /// kept. Returns a short list of what changed.
    @discardableResult
    static func adopt(_ context: ModelContext) -> [String] {
        var all = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        var log: [String] = []
        func same(_ a: String, _ b: String) -> Bool { a.caseInsensitiveCompare(b) == .orderedSame }
        var claimed = Set<String>()

        for (gi, spec) in groups.enumerated() {
            let group = all.first { $0.parentId == nil && same($0.name, spec.name) && !claimed.contains($0.id) }
                ?? all.first { g in g.parentId == nil && !claimed.contains(g.id) && spec.aliases.contains { same(g.name, $0) } }
                ?? {
                    let g = BudgetCategory(name: spec.name, icon: spec.icon, colorHex: spec.color)
                    context.insert(g)
                    all.append(g)
                    log.append("Added group \(spec.name)")
                    return g
                }()
            claimed.insert(group.id)
            if group.name != spec.name { log.append("Renamed group \(group.name) → \(spec.name)") }
            group.name = spec.name
            group.icon = spec.icon
            group.colorHex = spec.color
            group.isIncome = spec.isIncome
            group.isTransfer = spec.isTransfer
            group.sortOrder = gi * 100

            for (ci, leafSpec) in spec.children.enumerated() {
                let names = [leafSpec.name] + leafSpec.aliases
                func rank(_ c: BudgetCategory) -> Int { names.firstIndex { same(c.name, $0) } ?? 99 }
                let matches = all.filter { c in c.parentId != nil && !claimed.contains(c.id) && rank(c) < 99 }
                    .sorted { rank($0) < rank($1) }
                let leaf: BudgetCategory
                if let first = matches.first {
                    leaf = first
                    if first.name != leafSpec.name { log.append("Renamed \(first.name) → \(leafSpec.name)") }
                    // Several old categories now share one: merge the rest in.
                    for extra in matches.dropFirst() {
                        merge(extra, into: first, context: context)
                        log.append("Merged \(extra.name) into \(leafSpec.name)")
                        all.removeAll { $0.id == extra.id }
                    }
                } else {
                    leaf = BudgetCategory(name: leafSpec.name, icon: leafSpec.icon, colorHex: spec.color, parentId: group.id)
                    context.insert(leaf)
                    all.append(leaf)
                    log.append("Added \(leafSpec.name)")
                }
                claimed.insert(leaf.id)
                leaf.name = leafSpec.name
                leaf.parentId = group.id
                leaf.colorHex = spec.color
                leaf.isIncome = spec.isIncome
                leaf.isTransfer = spec.isTransfer
                leaf.sortOrder = gi * 100 + ci + 1
            }
        }

        // The user's own extras keep their group (which may have been
        // renamed); match its color/type and sort them after the starter ones.
        let byId = Dictionary(all.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        for extra in all where extra.parentId != nil && !claimed.contains(extra.id) {
            if let group = extra.parentId.flatMap({ byId[$0] }) {
                extra.colorHex = group.colorHex
                extra.isIncome = group.isIncome
                extra.isTransfer = group.isTransfer
                extra.sortOrder = group.sortOrder + 50
            }
        }
        // Old groups left with nothing in them go away.
        for group in all where group.parentId == nil && !claimed.contains(group.id)
            && !all.contains(where: { $0.parentId == group.id }) {
            context.delete(group)
            log.append("Removed empty group \(group.name)")
        }

        // Transfer flags on transactions follow their category.
        let types = Dictionary(all.map { ($0.id, $0.isTransfer) }, uniquingKeysWith: { a, _ in a })
        for tx in (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? [] {
            if let id = tx.categoryId, let isTransfer = types[id] { tx.isTransfer = isTransfer }
        }
        try? context.save()
        return log
    }

    /// Move everything pointing at `old` to `new`, then delete `old`.
    private static func merge(_ old: BudgetCategory, into new: BudgetCategory, context: ModelContext) {
        let oldId = old.id
        let optionalOld: String? = oldId
        for tx in (try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.categoryId == optionalOld }))) ?? [] {
            tx.categoryId = new.id
        }
        for rule in (try? context.fetch(FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.categoryId == oldId }))) ?? [] {
            rule.categoryId = new.id
        }
        for rule in (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? [] {
            if rule.setCategoryId == oldId { rule.setCategoryId = new.id }
            rule.categoryIds = rule.categoryIds.map { $0 == oldId ? new.id : $0 }
        }
        new.monthlyTarget += old.monthlyTarget
        context.delete(old)
    }

    /// Generic rules that fit almost anyone. Visible and editable in Rules.
    private static let starterRules: [(merchant: String, category: String)] = [
        ("uber eats", "Takeout & Delivery"),
        ("doordash", "Takeout & Delivery"),
        ("starbucks", "Coffee"),
        ("mcdonald's", "Restaurants"),
        ("whole foods", "Groceries"),
        ("safeway", "Groceries"),
        ("target", "Shopping"),
        ("amazon", "Shopping"),
        ("netflix", "Subscriptions"),
        ("spotify", "Subscriptions"),
        ("pg&e", "Utilities & Internet"),
        ("comcast", "Utilities & Internet"),
        ("uber ", "Rideshare & Taxi"),
        ("lyft ", "Rideshare & Taxi"),
        ("delta air", "Flights"),
        ("united airlines", "Flights"),
        ("e-zpass", "Parking & Tolls"),
        ("ezpass", "Parking & Tolls"),
        ("atm withdrawal", "Transfer"),
        ("autopay", "Credit Card Payment"),
    ]

    static func injectStarterRulesIfMissing(context: ModelContext) {
        guard !UserDefaults.standard.bool(forKey: "didV1StarterRulesInject_v2") else { return }

        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        // Nothing to attach rules to yet (e.g. still onboarding) — try again next launch,
        // rather than burning the one-time flag before any category exists.
        guard !categories.isEmpty else { return }
        UserDefaults.standard.set(true, forKey: "didV1StarterRulesInject_v2")

        let existingRules = (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? []
        // Only inject a rule if they don't already have one with that exact merchant string
        let existingMerchants = Set(existingRules.flatMap { $0.merchantTexts })

        for (i, starter) in starterRules.enumerated() {
            guard !existingMerchants.contains(starter.merchant) else { continue }
            guard let category = categories.first(where: { $0.parentId != nil && $0.name == starter.category }) else { continue }
            let rule = TransactionRule()
            rule.createdAt = Date.now.addingTimeInterval(Double(i - starterRules.count))
            rule.merchantMatch = "contains"
            rule.merchantTexts = [starter.merchant]
            rule.setCategoryId = category.id
            context.insert(rule)
        }
        try? context.save()
    }

    private static func seedStarterRules(_ context: ModelContext) {
        let categories = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        for (i, starter) in starterRules.enumerated() {
            guard let category = categories.first(where: { $0.parentId != nil && $0.name == starter.category }) else { continue }
            let rule = TransactionRule()
            rule.createdAt = Date.now.addingTimeInterval(Double(i - starterRules.count))
            rule.merchantMatch = "contains"
            rule.merchantTexts = [starter.merchant]
            rule.setCategoryId = category.id
            context.insert(rule)
        }
    }
}
