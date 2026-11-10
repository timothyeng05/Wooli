import SwiftUI
import SwiftData

/// A transaction line in the web app's style: emoji tile, name + pending
/// badge, "Category · Account", and a colored amount.
struct TransactionRow: View {
    let transaction: LocalTransaction
    let category: BudgetCategory?
    var accountName: String?
    /// Tapping the icon opens the quick category sheet.
    var quickEdit = true
    @State private var showQuick = false

    var body: some View {
        ItemRow(title: transaction.title, subtitle: subtitle, leading: { tile }, trailing: {
            HStack(spacing: Space.s) {
                Text(transaction.amount.signedCurrency())
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle(amountColor)
                    .strikethrough(transaction.isHidden)
                    .lineLimit(1)
                    .fixedSize()
                if transaction.needsReview {
                    Circle().fill(Theme.brand).frame(width: 8, height: 8)
                        .accessibilityLabel("Needs review")
                }
            }
        }, below: {
            if let tag = transaction.tags.first { LuggageTag("#\(tag)", group: .money) }
        }, badge: {
            if transaction.isPending { PendingBadge() }
            if !transaction.splitParentId.isEmpty {
                Label("Split", systemImage: "arrow.triangle.branch")
                    .labelStyle(.iconOnly)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Theme.brand)
                    .accessibilityLabel("Part of a split transaction")
            }
        })
        .opacity(transaction.isHidden ? 0.5 : 1)
        .sheet(isPresented: $showQuick) {
            QuickCategorySheet(transaction: transaction)
        }
    }

    /// "Category · Account", with Apple Intelligence's sparkle and an amber "Uncategorized".
    private var subtitle: Text {
        let name: Text
        if let category {
            if transaction.aiSuggested && transaction.needsReview {
                name = Text("\(Text(Image(systemName: "sparkles")).foregroundStyle(Theme.brand)) \(category.name)")
            } else {
                name = Text(category.name)
            }
        } else {
            name = Text("Uncategorized").foregroundStyle(Theme.pending)
        }
        guard let accountName else { return name }
        return Text("\(name) · \(Text(accountName))")
    }

    @ViewBuilder private var tile: some View {
        if quickEdit {
            Button { showQuick = true } label: {
                CategoryTile(category: category, size: 40)
                    .overlay(alignment: .bottomTrailing) {
                        if transaction.ruleApplied && !transaction.needsReview {
                            Image(systemName: "forward.fill")
                                .font(.system(size: 10))
                                .symbolRenderingMode(.palette)
                                .foregroundStyle(.white, Theme.brand)
                                .padding(3)
                                .background(Circle().fill(Theme.card))
                                .offset(x: 2, y: 2)
                                .accessibilityLabel("Categorized by a rule")
                        }
                    }
            }
            .buttonStyle(.borderless)
            .accessibilityLabel("Change category, currently \(category?.name ?? "uncategorized")")
        } else {
            CategoryTile(category: category, size: 40)
        }
    }

    private var amountColor: Color {
        if transaction.amount > 0 { return Theme.income }
        if transaction.isPending { return Theme.pending }
        return Theme.text
    }
}

/// Toolbar sync button that shows a spinner while syncing.
/// Toolbar button that opens the hamburger sidebar (Categories/Rules/Recurring/Settings).
struct HamburgerButton: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        #if os(iOS)
        Button("Menu", systemImage: "line.3.horizontal") {
            withAnimation(.snappy) { app.isSidebarOpen = true }
        }
        .labelStyle(.iconOnly)
        #else
        // The Mac window always shows its sidebar.
        EmptyView()
        #endif
    }
}

struct SyncButton: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context

    var body: some View {
        if app.mode == .live {
            Button {
                Task { await app.sync(context: context) }
            } label: {
                if app.isSyncing {
                    ProgressView()
                } else {
                    Label("Sync", systemImage: "arrow.clockwise")
                }
            }
            .disabled(app.isSyncing)
        }
    }
}

/// Toolbar button that opens the review flow, with a count badge.
struct ReviewButton: View {
    @Environment(AppModel.self) private var app
    let count: Int

    var body: some View {
        Button {
            app.showReview = true
        } label: {
            Image(systemName: "checkmark.square")
                .overlay(alignment: .topTrailing) {
                    if count > 0 {
                        Text(count > 99 ? "99+" : "\(count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 4).padding(.vertical, 1)
                            .background(Theme.expense, in: Capsule())
                            .offset(x: 10, y: -8)
                    }
                }
        }
        .accessibilityLabel("Review transactions, \(count) remaining")
    }
}

/// Notice card shown at the top of pages when something needs attention.
struct StatusBanner: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Group {
            if app.mode == .sample {
                Label("You're looking at sample data. Connect your bank in Settings.", systemImage: "sparkles")
                    .foregroundStyle(Theme.textSecondary)
            } else if let error = app.syncError {
                Label(error, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(Theme.pending)
            } else {
                ForEach(app.bankMessages, id: \.self) { message in
                    Label(message, systemImage: "building.columns").foregroundStyle(Theme.pending)
                }
            }
        }
        .font(.footnote)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    static func isVisible(_ app: AppModel) -> Bool {
        app.mode == .sample || app.syncError != nil || !app.bankMessages.isEmpty
    }
}

/// Lookups most screens need, built once per render from the queried models.
struct Ledger {
    let categoriesById: [String: BudgetCategory]
    let hiddenAccounts: Set<String>
    let accountNames: [String: String]

    init(categories: [BudgetCategory], accounts: [LocalAccount]) {
        categoriesById = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        hiddenAccounts = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        accountNames = Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
    }

    func category(for tx: LocalTransaction) -> BudgetCategory? { tx.categoryId.flatMap { categoriesById[$0] } }

    func isVisible(_ tx: LocalTransaction) -> Bool { !hiddenAccounts.contains(tx.accountId) }

    func reviewQueue(_ transactions: [LocalTransaction]) -> [LocalTransaction] {
        let start = ReviewWindow.start
        return transactions.filter { $0.needsReview && !$0.isHidden && isVisible($0) && $0.transactedAt >= start }
    }
}

extension Date {
    var dayHeader: String {
        let cal = Calendar.current
        if cal.isDateInToday(self) { return "Today" }
        if cal.isDateInYesterday(self) { return "Yesterday" }
        let sameYear = cal.isDate(self, equalTo: .now, toGranularity: .year)
        return formatted(sameYear ? .dateTime.weekday(.wide).month(.wide).day()
                                  : .dateTime.month(.wide).day().year())
    }
}
