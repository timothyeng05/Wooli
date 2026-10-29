import Foundation

extension Theme.Group {
    /// Which design-system colour a budget group is shown in. Worked out from the
    /// group's name (and the default aliases), so nothing is stored or synced; a
    /// renamed default group or a user-made one falls back to `.money` (slate).
    static func forBudgetGroup(named name: String) -> Theme.Group {
        byName[name.lowercased()] ?? .money
    }

    private static let byName: [String: Theme.Group] = [
        "food & dining": .food,
        "home": .home, "housing": .home,
        "bills & other": .home, "other": .home, "bills": .home,
        "family & pets": .home, "family": .home,
        "transportation": .travel, "transport": .travel, "travel": .travel,
        "health & personal": .health, "personal": .health, "health": .health,
        "entertainment": .fun, "fun": .fun, "lifestyle": .fun,
        "shopping": .shopping,
        "income": .money, "transfer": .money,
    ]
}

extension BudgetCategory {
    /// The group colour for this category (a leaf uses its parent group's name).
    func designGroup(in categoriesById: [String: BudgetCategory]) -> Theme.Group {
        let top = parentId.flatMap { categoriesById[$0] } ?? self
        return .forBudgetGroup(named: top.name)
    }
}
