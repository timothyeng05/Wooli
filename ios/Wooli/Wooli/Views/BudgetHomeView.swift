import SwiftUI

/// Budget, Categories, Rules and Recurring as one Monarch-style group: a
/// real sidebar on iPad (both columns show at once), a list you tap into on
/// iPhone (matches how Notes/Files present a NavigationSplitView there).
struct BudgetHomeView: View {
    @State private var selection: BudgetSidebarItem? = .budget

    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                ForEach(BudgetSidebarItem.allCases) { item in
                    NavigationLink(value: item) {
                        Label(item.title, systemImage: item.symbol)
                    }
                }
            }
            .navigationTitle("Budget")
        } detail: {
            NavigationStack {
                switch selection ?? .budget {
                case .budget: BudgetView()
                case .categories: CategoriesSettingsView()
                case .rules: RulesView()
                case .recurring: RecurringView()
                }
            }
        }
    }
}

private enum BudgetSidebarItem: String, CaseIterable, Identifiable {
    case budget, categories, rules, recurring
    var id: String { rawValue }

    var title: String {
        switch self {
        case .budget: "Budget"
        case .categories: "Categories"
        case .rules: "Rules"
        case .recurring: "Recurring"
        }
    }

    var symbol: String {
        switch self {
        case .budget: "map"
        case .categories: "square.grid.2x2"
        case .rules: "wand.and.stars"
        case .recurring: "arrow.triangle.2.circlepath"
        }
    }
}
