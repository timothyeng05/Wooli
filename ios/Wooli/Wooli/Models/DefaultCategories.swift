import Foundation
import SwiftData

/// Same starter tree as the web app's `app/api/setup-budget/route.ts`.
enum DefaultCategories {
    private struct Group {
        let name: String, color: String, icon: String
        var isIncome = false, isTransfer = false
        let children: [(String, String)]
    }

    private static let groups: [Group] = [
        Group(name: "Food & Dining", color: "#f59e0b", icon: "🍽️",
              children: [("Restaurants", "🍽️"), ("Groceries", "🛒"), ("Coffee", "☕"), ("Takeout", "🥡")]),
        Group(name: "Home", color: "#8b5cf6", icon: "🏠",
              children: [("Rent", "🏠"), ("Utilities", "💡"), ("Internet", "📶"), ("Home Improvement", "🔨")]),
        Group(name: "Travel", color: "#06b6d4", icon: "✈️",
              children: [("Transit", "🚇"), ("Rideshare", "🚗"), ("Flights", "✈️"), ("Hotels", "🏨"), ("Car", "🚘")]),
        Group(name: "Personal", color: "#ec4899", icon: "🧴",
              children: [("Medical", "🏥"), ("Shopping", "🛍️"), ("Entertainment", "🎬"), ("Personal Care", "💅")]),
        Group(name: "Other", color: "#64748b", icon: "📁",
              children: [("Taxes", "📋"), ("Subscriptions", "📱"), ("Miscellaneous", "📌")]),
        Group(name: "Income", color: "#22c55e", icon: "💵", isIncome: true,
              children: [("Salary", "💵"), ("Freelance", "💻"), ("Rent Income", "💰"), ("Other Income", "💰")]),
        Group(name: "Transfer", color: "#8b5cf6", icon: "↔️", isTransfer: true,
              children: [("Balance Adjustments", "⚖️"), ("Transfer", "↔️"), ("Credit Card Payment", "💳")]),
    ]

    static func seedIfNeeded(_ context: ModelContext) {
        let existing = (try? context.fetchCount(FetchDescriptor<BudgetCategory>())) ?? 0
        guard existing == 0 else { return }
        for (gi, group) in groups.enumerated() {
            let parent = BudgetCategory(name: group.name, icon: group.icon, colorHex: group.color,
                                        isIncome: group.isIncome, isTransfer: group.isTransfer, sortOrder: gi * 100)
            context.insert(parent)
            for (ci, child) in group.children.enumerated() {
                context.insert(BudgetCategory(name: child.0, icon: child.1, colorHex: group.color, parentId: parent.id,
                                              isIncome: group.isIncome, isTransfer: group.isTransfer,
                                              sortOrder: gi * 100 + ci + 1))
            }
        }
        try? context.save()
    }
}
