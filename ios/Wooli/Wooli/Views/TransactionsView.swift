import SwiftUI
import SwiftData

struct TransactionsView: View {
    enum Filter: String, CaseIterable, Identifiable {
        case all = "All", review = "To Review"
        var id: String { rawValue }
    }

    /// Open straight onto the review queue (from the Overview shortcut).
    var startInReview = false
    /// True when pushed inside another NavigationStack.
    var embedded = false
    /// Restrict to one account (from the account screen).
    var accountId: String?

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @State private var filter: Filter = .all
    @State private var search = ""
    @State private var didApplyStart = false

    var body: some View {
        if embedded {
            content
        } else {
            NavigationStack { content }
        }
    }

    private var content: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter(\.isHidden).map(\.providerAccountId))
        let names = Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
        let query = search.trimmingCharacters(in: .whitespaces).lowercased()

        let visible = transactions.filter { tx in
            if let accountId { if tx.accountId != accountId { return false } }
            else if hidden.contains(tx.accountId) { return false }
            if filter == .review && (!tx.needsReview || tx.isHidden) { return false }
            guard !query.isEmpty else { return true }
            let categoryName = tx.categoryId.flatMap { byId[$0]?.name.lowercased() } ?? "uncategorized"
            return tx.title.lowercased().contains(query)
                || tx.transactionDescription.lowercased().contains(query)
                || categoryName.contains(query)
                || tx.note.lowercased().contains(query)
        }
        let days = Dictionary(grouping: visible) { Calendar.current.startOfDay(for: $0.transactedAt) }
            .sorted { $0.key > $1.key }

        return List {
            if accountId == nil {
                Section {
                    Picker("Show", selection: $filter) {
                        ForEach(Filter.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
            }

            ForEach(days, id: \.key) { day, items in
                Section(day.dayHeader) {
                    ForEach(items) { tx in
                        NavigationLink {
                            TransactionDetailView(transaction: tx)
                        } label: {
                            TransactionRow(transaction: tx, category: tx.categoryId.flatMap { byId[$0] },
                                           accountName: accountId == nil ? names[tx.accountId] : nil)
                        }
                        .swipeActions(edge: .leading, allowsFullSwipe: true) {
                            if tx.needsReview && tx.categoryId != nil {
                                Button("Reviewed", systemImage: "checkmark") {
                                    withAnimation { Categorizer.confirm(tx, categories: categories, context: context) }
                                }
                                .tint(.green)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button(tx.isHidden ? "Unhide" : "Hide",
                                   systemImage: tx.isHidden ? "eye" : "eye.slash") {
                                withAnimation { tx.isHidden.toggle() }
                            }
                            .tint(.gray)
                        }
                    }
                }
            }
        }
        .overlay {
            if visible.isEmpty {
                if !query.isEmpty {
                    ContentUnavailableView.search(text: search)
                } else if filter == .review {
                    ContentUnavailableView("All Caught Up", systemImage: "checkmark.circle",
                                           description: Text("You've reviewed every transaction."))
                } else {
                    ContentUnavailableView("No Transactions", systemImage: "list.bullet.rectangle",
                                           description: Text("Transactions from your banks appear here after a sync."))
                }
            }
        }
        .searchable(text: $search, prompt: "Merchant, category, or note")
        .navigationTitle(accountId == nil ? (filter == .review && embedded ? "Review" : "Transactions") : "Activity")
        .refreshable { await app.sync(context: context) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { SyncButton() }
        }
        .onAppear {
            if startInReview && !didApplyStart {
                filter = .review
                didApplyStart = true
            }
        }
    }
}
