import SwiftUI
import SwiftData

struct TransactionsView: View {
    /// Restrict to one account or category (when pushed from elsewhere).
    var accountId: String?
    var embedded = false

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query private var accounts: [LocalAccount]
    @State private var filter = TransactionFilter()
    @State private var search = ""
    @State private var debouncedSearch = ""
    @State private var showFilters = false

    var body: some View {
        if embedded {
            content
        } else {
            NavigationStack { content }
        }
    }

    private var content: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let query = debouncedSearch.trimmingCharacters(in: .whitespaces).lowercased()
        let reviewCount = ledger.reviewQueue(transactions).count

        let visible = filter.sorted(transactions.filter { tx in
            // A split original is represented by its parts.
            if tx.isSplit { return false }
            if let accountId { if tx.accountId != accountId { return false } }
            else if !ledger.isVisible(tx) && !filter.accountIds.contains(tx.accountId) { return false }
            guard filter.matches(tx) else { return false }
            guard !query.isEmpty else { return true }
            let categoryName = ledger.category(for: tx)?.name.lowercased() ?? "uncategorized"
            return tx.title.lowercased().contains(query)
                || tx.transactionDescription.lowercased().contains(query)
                || categoryName.contains(query)
                || tx.note.lowercased().contains(query)
        })
        let groupByDay = filter.sort == .newest || filter.sort == .oldest
        let days: [(Date, [LocalTransaction])] = groupByDay
            ? Dictionary(grouping: visible) { Calendar.current.startOfDay(for: $0.transactedAt) }
                .sorted { filter.sort == .newest ? $0.key > $1.key : $0.key < $1.key }
                .map { ($0.key, $0.value) }
            : []
        let counted = visible.filter { !$0.isHidden && !$0.isTransfer }
        let spent = counted.filter { $0.amount < 0 }.reduce(0) { $0 - $1.amount }
        let income = counted.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }

        return List {
            Section {
                HStack(spacing: 4) {
                    Text("\(visible.count) transactions").fontWeight(.semibold).foregroundStyle(Theme.text)
                    Text("· \(spent.currency()) spent").foregroundStyle(Theme.textSecondary)
                    Text("· \(income.currency()) income").foregroundStyle(Theme.income)
                }
                .font(.caption)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
            }

            if groupByDay {
                ForEach(days, id: \.0) { day, items in
                    Section {
                        ForEach(items) { tx in row(tx, ledger: ledger) }
                    } header: {
                        DayHeader(day: day, total: items.filter { !$0.isHidden && !$0.isTransfer }.reduce(0) { $0 + $1.amount })
                    }
                }
            } else {
                Section {
                    ForEach(visible) { tx in row(tx, ledger: ledger) }
                }
            }
        }
        .listStyle(.plain)
        .listSectionSpacing(0)
        .pageBackground()
        .overlay {
            if visible.isEmpty {
                if !query.isEmpty {
                    ContentUnavailableView.search(text: debouncedSearch)
                } else if filter.activeCount > 0 {
                    ContentUnavailableView("No Matches", systemImage: "line.3.horizontal.decrease.circle",
                                           description: Text("Try clearing some filters."))
                } else {
                    ContentUnavailableView("No Transactions", systemImage: "creditcard",
                                           description: Text(app.mode == .live ? "Transactions from your banks appear here after a sync."
                                                             : "Tap + to add a transaction."))
                }
            }
        }
        .searchable(text: $search, prompt: "Search transactions")
        .task(id: search) {
            // Wait for a pause in typing; a new keystroke cancels this task.
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            debouncedSearch = search
        }
        
            .navigationTitle(accountId == nil ? "Transactions" : "Activity")
        .refreshable { await app.sync(context: context) }
        .toolbar {
            if accountId == nil {
                ToolbarItem(placement: .topBarLeading) { HamburgerButton() }
                ToolbarItem(placement: .topBarTrailing) { ReviewButton(count: reviewCount) }
                ToolbarItem(placement: .topBarTrailing) { ManualAddMenu() }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showFilters = true
                } label: {
                    Image(systemName: filter.activeCount > 0 ? "line.3.horizontal.decrease.circle.fill"
                                                             : "line.3.horizontal.decrease.circle")
                }
                .accessibilityLabel(filter.activeCount > 0 ? "Filters, \(filter.activeCount) active" : "Filters")
            }
        }
        .sheet(isPresented: $showFilters) {
            FiltersSheet(filter: $filter, transactions: transactions, accounts: accounts, categories: categories)
        }
    }

    private func row(_ tx: LocalTransaction, ledger: Ledger) -> some View {
        TransactionListRow(tx: tx, ledger: ledger, categories: categories, accountId: accountId)
    }
}

/// One row in the transactions list, with swipe actions to review/hide it.
private struct TransactionListRow: View {
    let tx: LocalTransaction
    let ledger: Ledger
    let categories: [BudgetCategory]
    let accountId: String?

    @Environment(\.modelContext) private var context
    @State private var showCategorize = false

    var body: some View {
        NavigationLink {
            TransactionDetailView(transaction: tx)
        } label: {
            TransactionRow(transaction: tx, category: ledger.category(for: tx),
                           accountName: accountId == nil ? ledger.accountNames[tx.accountId] : nil)
        }
        .listRowBackground(Theme.card)
        .listRowSeparatorTint(Theme.border)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if tx.needsReview {
                if tx.categoryId != nil {
                    Button("Reviewed", systemImage: "checkmark") {
                        withAnimation { Categorizer.confirm(tx, categories: categories, context: context) }
                    }
                    .tint(Theme.income)
                } else {
                    // No category yet, so a swipe can't confirm it — open the
                    // picker instead of doing nothing.
                    Button("Categorize", systemImage: "tag") { showCategorize = true }
                        .tint(Theme.brand)
                }
            }
        }
        .swipeActions(edge: .trailing) {
            Button(tx.isHidden ? "Unhide" : "Hide", systemImage: tx.isHidden ? "eye" : "eye.slash") {
                withAnimation { tx.isHidden.toggle() }
            }
            .tint(.gray)
        }
        .sheet(isPresented: $showCategorize) {
            QuickCategorySheet(transaction: tx)
        }
    }
}

private struct DayHeader: View {
    let day: Date
    let total: Double

    var body: some View {
        HStack {
            Text(day.formatted(.dateTime.month(.wide).day().year()))
            Spacer()
            Text(total.signedCurrency()).monospacedDigit()
                .foregroundStyle(total > 0 ? Theme.income : Theme.textTertiary)
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(Theme.textSecondary)
        .textCase(nil)
        .padding(.vertical, 6)
    }
}

// MARK: - Filters

struct FiltersSheet: View {
    @Binding var filter: TransactionFilter
    let transactions: [LocalTransaction]
    let accounts: [LocalAccount]
    let categories: [BudgetCategory]

    @Environment(\.dismiss) private var dismiss
    @State private var draft = TransactionFilter()

    var body: some View {
        NavigationStack {
            Form {
                Section("Date Range") {
                    Picker("Date range", selection: $draft.dateRange) {
                        ForEach(TransactionFilter.DateRange.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.navigationLink)
                    .labelsHidden()
                }

                Section("Sort By") {
                    Picker("Sort by", selection: $draft.sort) {
                        ForEach(TransactionFilter.Sort.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Section("Filter By") {
                    NavigationLink {
                        MultiSelectList(title: "Accounts", selection: $draft.accountIds,
                                        options: accounts.map { ($0.providerAccountId, $0.displayName, $0.institutionName) })
                    } label: {
                        FilterRow(title: "Accounts", count: draft.accountIds.count)
                    }
                    NavigationLink {
                        MultiSelectList(title: "Categories", selection: $draft.categoryIds,
                                        options: [("", "Uncategorized", nil)] + categories.filter { $0.parentId != nil }
                                            .map { ($0.id, "\($0.icon)  \($0.name)", nil) })
                    } label: {
                        FilterRow(title: "Categories", count: draft.categoryIds.count)
                    }
                    NavigationLink {
                        let merchants = Dictionary(grouping: transactions.filter { !$0.normalizedMerchant.isEmpty },
                                                    by: \.normalizedMerchant)
                            .sorted { $0.value.count > $1.value.count }
                            .map { key, items -> (String, String, String?) in
                                // Show whichever raw title is most common for this merchant,
                                // since the normalized key itself isn't meant for display.
                                let label = Dictionary(grouping: items, by: \.title)
                                    .max { $0.value.count < $1.value.count }?.key ?? key
                                return (key, label, "\(items.count) transactions")
                            }
                        MultiSelectList(title: "Merchants", selection: $draft.merchants, options: merchants, searchable: true)
                    } label: {
                        FilterRow(title: "Merchants", count: draft.merchants.count)
                    }
                    NavigationLink {
                        MultiSelectList(title: "Tags", selection: $draft.tags,
                                        options: TagStyle.allTags(in: transactions).map { ($0, "#\($0)", nil) })
                    } label: {
                        FilterRow(title: "Tags", count: draft.tags.count)
                    }
                    NavigationLink {
                        AmountFilter(minAmount: $draft.minAmount, maxAmount: $draft.maxAmount)
                    } label: {
                        FilterRow(title: "Amounts", count: draft.minAmount != nil || draft.maxAmount != nil ? 1 : 0)
                    }
                }
            }
            
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 12) {
                    Button {
                        draft = TransactionFilter()
                    } label: {
                        Text("Clear all").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.bordered)
                    .tint(Theme.text)
                    Button {
                        filter = draft
                        dismiss()
                    } label: {
                        Text("Apply").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .controlSize(.large)
                .padding(.horizontal, 20).padding(.vertical, 12)
                .background(.bar)
            }
        }
        .onAppear { draft = filter }
    }
}

private struct FilterRow: View {
    let title: String
    let count: Int
    var body: some View {
        LabeledContent(title) {
            if count > 0 { Text("\(count) selected").foregroundStyle(Theme.brand) }
        }
    }
}

struct MultiSelectList: View {
    let title: String
    @Binding var selection: Set<String>
    let options: [(String, String, String?)]
    var searchable = false
    @State private var search = ""

    var body: some View {
        let shown = search.isEmpty ? options : options.filter { $0.1.localizedCaseInsensitiveContains(search) }
        List {
            ForEach(shown, id: \.0) { id, label, detail in
                Button {
                    if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(label).foregroundStyle(Theme.text)
                            if let detail { Text(detail).font(.footnote).foregroundStyle(Theme.textTertiary) }
                        }
                        Spacer()
                        Image(systemName: selection.contains(id) ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(selection.contains(id) ? Theme.brand : Theme.textTertiary)
                            .font(.title3)
                    }
                }
            }
        }
        .modifier(OptionalSearch(enabled: searchable, text: $search))
        
            .navigationTitle(title)
        .toolbar {
            if !selection.isEmpty {
                Button("Clear") { selection.removeAll() }
            }
        }
    }
}

private struct OptionalSearch: ViewModifier {
    let enabled: Bool
    @Binding var text: String
    func body(content: Content) -> some View {
        if enabled { content.searchable(text: $text) } else { content }
    }
}

private struct AmountFilter: View {
    @Binding var minAmount: Double?
    @Binding var maxAmount: Double?

    var body: some View {
        Form {
            Section {
                LabeledContent("Minimum") {
                    TextField("Any", value: $minAmount, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                }
                LabeledContent("Maximum") {
                    TextField("Any", value: $maxAmount, format: .currency(code: "USD"))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                }
            } footer: {
                Text("Matches money in and money out by size.")
            }
        }
        
            .navigationTitle("Amounts")
    }
}
