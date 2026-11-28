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
    @State private var showDatePopover = false
    @State private var showBulkCategoryPicker = false
    @State private var showSingleCategoryPicker = false
    @State private var selectedIds: Set<String> = []
    /// The transaction open beside the list on the Mac.
    @State private var open: LocalTransaction?

    var body: some View {
        if embedded {
            content
        } else {
            #if os(macOS)
            NavigationStack {
                content
                    .environment(\.openTransaction) { open = $0 }
                    .environment(\.openTransactionID, open?.providerTransactionId)
                    .listDetail($open) { tx in
                        NavigationStack {
                            TransactionDetailView(
                                transaction: tx,
                                onStepPrevious: canStep(from: tx, delta: -1) ? { step(from: tx, delta: -1) } : nil,
                                onStepNext: canStep(from: tx, delta: 1) ? { step(from: tx, delta: 1) } : nil
                            )
                        }
                    } empty: {
                        SideDetailPlaceholder(text: "Choose a transaction to see its details.", systemImage: "creditcard")
                    }
            }
            #else
            NavigationStack { content }
            #endif
        }
    }

    private var filteredTransactions: [LocalTransaction] {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let query = debouncedSearch.trimmingCharacters(in: .whitespaces).lowercased()
        let interval = filter.dateRange.interval
        return filter.sorted(transactions.filter { tx in
            if tx.isSplit { return false }
            if let accountId { if tx.accountId != accountId { return false } }
            else if !ledger.isVisible(tx) && !filter.accountIds.contains(tx.accountId) { return false }
            guard filter.matches(tx, in: interval) else { return false }
            guard !query.isEmpty else { return true }
            let categoryName = ledger.category(for: tx)?.name.lowercased() ?? "uncategorized"
            return tx.title.lowercased().contains(query)
                || tx.transactionDescription.lowercased().contains(query)
                || categoryName.contains(query)
                || tx.note.lowercased().contains(query)
        })
    }

    private func canStep(from tx: LocalTransaction, delta: Int) -> Bool {
        let list = filteredTransactions
        guard let idx = list.firstIndex(where: { $0.providerTransactionId == tx.providerTransactionId }) else { return false }
        let target = idx + delta
        return list.indices.contains(target)
    }

    private func step(from tx: LocalTransaction, delta: Int) {
        let list = filteredTransactions
        guard let idx = list.firstIndex(where: { $0.providerTransactionId == tx.providerTransactionId }) else { return }
        let target = idx + delta
        if list.indices.contains(target) {
            open = list[target]
        }
    }

    private var content: some View {
        let ledger = Ledger(categories: categories, accounts: accounts)
        let query = debouncedSearch.trimmingCharacters(in: .whitespaces).lowercased()
        let reviewCount = ledger.reviewQueue(transactions).count
        let visible = filteredTransactions

        let groupByDay = filter.sort == .newest || filter.sort == .oldest
        let days: [(Date, [LocalTransaction])] = groupByDay
            ? Dictionary(grouping: visible) { Calendar.current.startOfDay(for: $0.transactedAt) }
                .sorted { filter.sort == .newest ? $0.key > $1.key : $0.key < $1.key }
                .map { ($0.key, $0.value) }
            : []
        let counted = visible.filter { !$0.isHidden && !$0.isTransfer }
        let spent = counted.filter { $0.amount < 0 }.reduce(0) { $0 - $1.amount }
        let income = counted.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }

        return ZStack(alignment: .bottom) {
            List {
                Section {
                    HStack(spacing: 8) {
                        Text("\(visible.count) transactions")
                            .fontWeight(.semibold)
                            .foregroundStyle(FieldNotes.ink)
                        Text("· \(spent.currency()) spent")
                            .foregroundStyle(FieldNotes.inkSecondary)
                        Text("· \(income.currency()) income")
                            .foregroundStyle(Theme.income)
                        Spacer()
                        #if os(macOS)
                        inlineFilterBar
                        #endif
                    }
                    .font(.caption)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 4, trailing: 20))
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
            .scrollContentBackground(.hidden)
            .background(FieldNotes.paper)

            if !selectedIds.isEmpty {
                BulkSelectionPillBar(
                    count: selectedIds.count,
                    onReview: { bulkMarkReviewed(in: visible) },
                    onCategorize: { showBulkCategoryPicker = true },
                    onToggleHide: { bulkToggleHide(in: visible) },
                    onClear: { withAnimation(.snappy) { selectedIds.removeAll() } }
                )
                .padding(.bottom, 16)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
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
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            debouncedSearch = search
        }
        .navigationTitle(accountId == nil ? "Transactions" : "Activity")
        .refreshable { await app.sync(context: context) }
        #if os(macOS)
        .onKeyPress(characters: CharacterSet(charactersIn: "xXrRcCfF")) { press in
            handleKeyboardShortcut(press.characters.lowercased(), visible: visible)
        }
        .onKeyPress(.upArrow) {
            if let open, canStep(from: open, delta: -1) { step(from: open, delta: -1); return .handled }
            return .ignored
        }
        .onKeyPress(.downArrow) {
            if let open, canStep(from: open, delta: 1) { step(from: open, delta: 1); return .handled }
            return .ignored
        }
        #endif
        .toolbar {
            if accountId == nil {
                ToolbarItem(placement: .topBarLeading) { HamburgerButton() }
                ToolbarItem(placement: .topBarTrailing) { ReviewButton(count: reviewCount) }
                ToolbarItem(placement: .topBarTrailing) { ManualAddMenu() }
            }
            #if os(macOS)
            ToolbarItem(placement: .topBarTrailing) {
                Button("Select All") {
                    withAnimation(.snappy) {
                        if selectedIds.count == visible.count {
                            selectedIds.removeAll()
                        } else {
                            selectedIds = Set(visible.map(\.providerTransactionId))
                        }
                    }
                }
                .keyboardShortcut("a", modifiers: .command)
                .help("Select all visible transactions (⌘A)")
            }
            #else
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showFilters = true
                } label: {
                    Image(systemName: filter.activeCount > 0 ? "line.3.horizontal.decrease.circle.fill"
                                                             : "line.3.horizontal.decrease.circle")
                }
                .accessibilityLabel(filter.activeCount > 0 ? "Filters, \(filter.activeCount) active" : "Filters")
            }
            #endif
        }
        #if os(iOS)
        .sheet(isPresented: $showFilters) {
            FiltersSheet(filter: $filter, transactions: transactions, accounts: accounts, categories: categories)
        }
        #endif
        .sheet(isPresented: $showBulkCategoryPicker) {
            NavigationStack {
                CategoryPickerView(selectedId: nil) { picked in
                    let selected = visible.filter { selectedIds.contains($0.providerTransactionId) }
                    withAnimation(.snappy) {
                        for tx in selected {
                            Categorizer.assign(picked, to: tx)
                        }
                        try? context.save()
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close", systemImage: "xmark") { showBulkCategoryPicker = false }
                    }
                }
            }
        }
        .sheet(isPresented: $showSingleCategoryPicker) {
            if let open {
                NavigationStack {
                    CategoryPickerView(selectedId: open.categoryId) { picked in
                        withAnimation(.snappy) {
                            Categorizer.assign(picked, to: open)
                            if picked != nil {
                                Categorizer.learn(from: open, categories: categories, context: context)
                            }
                            try? context.save()
                        }
                    }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Close", systemImage: "xmark") { showSingleCategoryPicker = false }
                        }
                    }
                }
            }
        }
    }

    #if os(macOS)
    private var inlineFilterBar: some View {
        HStack(spacing: 6) {
            Button {
                showDatePopover.toggle()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                    Text(filter.dateRange == .recent ? "Date" : filter.dateRange.rawValue)
                }
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(filter.dateRange != .recent ? FieldNotes.forestSoft : FieldNotes.pillBg, in: Capsule())
                .foregroundStyle(filter.dateRange != .recent ? FieldNotes.forest : FieldNotes.inkSecondary)
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showDatePopover, arrowEdge: .bottom) {
                DateRangePopover(selection: $filter.dateRange) { showDatePopover = false }
            }

            Button {
                showFilters.toggle()
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "line.3.horizontal.decrease")
                    Text(filter.activeCount > 0 ? "Filters (\(filter.activeCount))" : "Filters")
                }
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(filter.activeCount > 0 ? FieldNotes.forestSoft : FieldNotes.pillBg, in: Capsule())
                .foregroundStyle(filter.activeCount > 0 ? FieldNotes.forest : FieldNotes.inkSecondary)
            }
            .buttonStyle(.plain)
            .popover(isPresented: $showFilters, arrowEdge: .bottom) {
                MultiTabFiltersPopover(filter: $filter, transactions: transactions, accounts: accounts, categories: categories)
            }
        }
    }

    private func handleKeyboardShortcut(_ key: String, visible: [LocalTransaction]) -> KeyPress.Result {
        switch key {
        case "f":
            showFilters.toggle()
            return .handled
        case "x":
            guard let target = open ?? visible.first else { return .ignored }
            withAnimation(.snappy) {
                if selectedIds.contains(target.providerTransactionId) {
                    selectedIds.remove(target.providerTransactionId)
                } else {
                    selectedIds.insert(target.providerTransactionId)
                }
            }
            return .handled
        case "r":
            if !selectedIds.isEmpty {
                bulkMarkReviewed(in: visible)
                return .handled
            } else if let target = open {
                if target.categoryId != nil {
                    _ = withAnimation(.snappy) { Categorizer.confirm(target, categories: categories, context: context) }
                } else {
                    showSingleCategoryPicker = true
                }
                return .handled
            }
            return .ignored
        case "c":
            if !selectedIds.isEmpty {
                showBulkCategoryPicker = true
                return .handled
            } else if open != nil {
                showSingleCategoryPicker = true
                return .handled
            }
            return .ignored
        default:
            return .ignored
        }
    }
    #endif

    private func bulkMarkReviewed(in visible: [LocalTransaction]) {
        let targets = visible.filter { selectedIds.contains($0.providerTransactionId) && $0.categoryId != nil }
        withAnimation(.snappy) {
            for tx in targets {
                _ = Categorizer.confirm(tx, categories: categories, context: context)
            }
            selectedIds.removeAll()
        }
    }

    private func bulkToggleHide(in visible: [LocalTransaction]) {
        let targets = visible.filter { selectedIds.contains($0.providerTransactionId) }
        let shouldHide = targets.contains { !$0.isHidden }
        withAnimation(.snappy) {
            for tx in targets { tx.isHidden = shouldHide }
            try? context.save()
            selectedIds.removeAll()
        }
    }

    private func row(_ tx: LocalTransaction, ledger: Ledger) -> some View {
        TransactionListRow(
            tx: tx,
            ledger: ledger,
            categories: categories,
            accountId: accountId,
            isSelected: selectedIds.contains(tx.providerTransactionId),
            onToggleSelect: {
                withAnimation(.snappy) {
                    if selectedIds.contains(tx.providerTransactionId) {
                        selectedIds.remove(tx.providerTransactionId)
                    } else {
                        selectedIds.insert(tx.providerTransactionId)
                    }
                }
            }
        )
    }
}

private struct BulkSelectionPillBar: View {
    let count: Int
    let onReview: () -> Void
    let onCategorize: () -> Void
    let onToggleHide: () -> Void
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text("\(count) selected")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(FieldNotes.paper)
                .padding(.leading, 4)

            Divider().frame(height: 18).overlay(FieldNotes.paper.opacity(0.25))

            Button("Reviewed", systemImage: "checkmark", action: onReview)
            Button("Category", systemImage: "tag", action: onCategorize)
            Button("Hide", systemImage: "eye.slash", action: onToggleHide)

            Divider().frame(height: 18).overlay(FieldNotes.paper.opacity(0.25))

            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(FieldNotes.paper.opacity(0.75))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Clear selection")
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(FieldNotes.paper)
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(FieldNotes.ink, in: Capsule())
        .shadow(color: Color.black.opacity(0.18), radius: 10, y: 4)
    }
}

/// One row in the transactions list — Copilot-style borderless chronological row.
private struct TransactionListRow: View {
    let tx: LocalTransaction
    let ledger: Ledger
    let categories: [BudgetCategory]
    let accountId: String?
    let isSelected: Bool
    let onToggleSelect: () -> Void

    @Environment(\.modelContext) private var context
    @State private var showCategorize = false
    @State private var isHovered = false

    @Environment(\.openTransaction) private var openOnMac
    @Environment(\.openTransactionID) private var openID

    var body: some View {
        let row = HStack(spacing: 10) {
            #if os(macOS)
            if isSelected || isHovered {
                Button(action: onToggleSelect) {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(isSelected ? FieldNotes.forest : FieldNotes.inkTertiary)
                        .font(.body)
                }
                .buttonStyle(.plain)
                .transition(.opacity)
            }
            #endif
            TransactionRow(transaction: tx, category: ledger.category(for: tx),
                           accountName: accountId == nil ? ledger.accountNames[tx.accountId] : nil)
        }

        Group {
            if let openOnMac {
                Button { openOnMac(tx) } label: { row.contentShape(Rectangle()) }
                    .buttonStyle(.plain)
            } else {
                NavigationLink { TransactionDetailView(transaction: tx) } label: { row }
            }
        }
        #if os(macOS)
        .onHover { isHovered = $0 }
        .contextMenu {
            Button(isSelected ? "Deselect" : "Select", systemImage: isSelected ? "checkmark.circle.fill" : "circle", action: onToggleSelect)
            if tx.needsReview {
                if tx.categoryId != nil {
                    Button("Mark Reviewed", systemImage: "checkmark") {
                        _ = withAnimation { Categorizer.confirm(tx, categories: categories, context: context) }
                    }
                } else {
                    Button("Categorize…", systemImage: "tag") { showCategorize = true }
                }
            }
            Button(tx.isHidden ? "Unhide" : "Hide", systemImage: tx.isHidden ? "eye" : "eye.slash") {
                withAnimation { tx.isHidden.toggle() }
            }
        }
        .listRowBackground(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(openID == tx.providerTransactionId ? FieldNotes.forestSoft : (isSelected ? FieldNotes.pillBg : FieldNotes.paper))
                .padding(.horizontal, 8)
        )
        #else
        .listRowBackground(FieldNotes.card)
        #endif
        .listRowSeparatorTint(FieldNotes.border)
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            if tx.needsReview {
                if tx.categoryId != nil {
                    Button("Reviewed", systemImage: "checkmark") {
                        _ = withAnimation { Categorizer.confirm(tx, categories: categories, context: context) }
                    }
                    .tint(Theme.income)
                } else {
                    Button("Categorize", systemImage: "tag") { showCategorize = true }
                        .tint(FieldNotes.forest)
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
                .foregroundStyle(total > 0 ? Theme.income : FieldNotes.inkTertiary)
        }
        .font(.subheadline.weight(.medium))
        .foregroundStyle(FieldNotes.inkSecondary)
        .textCase(nil)
        .padding(.vertical, 6)
    }
}

// MARK: - Inline Mac Popovers

#if os(macOS)
private struct DateRangePopover: View {
    @Binding var selection: TransactionFilter.DateRange
    let onSelect: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("DATE RANGE")
                .font(.caption2.weight(.bold))
                .tracking(1.0)
                .foregroundStyle(FieldNotes.inkTertiary)
                .padding(.horizontal, 8)
                .padding(.bottom, 4)

            ForEach(TransactionFilter.DateRange.allCases) { range in
                Button {
                    selection = range
                    onSelect()
                } label: {
                    HStack {
                        Text(range.rawValue)
                            .foregroundStyle(FieldNotes.ink)
                        Spacer()
                        if selection == range {
                            Image(systemName: "checkmark")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(FieldNotes.forest)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(selection == range ? FieldNotes.forestSoft : Color.clear, in: RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .frame(width: 240)
        .background(FieldNotes.paper)
    }
}

private struct MultiTabFiltersPopover: View {
    enum Tab: String, CaseIterable, Identifiable {
        case accounts = "Accounts", categories = "Categories", merchants = "Merchants", tags = "Tags", amounts = "Amounts"
        var id: String { rawValue }
    }

    @Binding var filter: TransactionFilter
    let transactions: [LocalTransaction]
    let accounts: [LocalAccount]
    let categories: [BudgetCategory]
    @State private var tab: Tab = .accounts
    @State private var merchantSearch = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Filters")
                    .font(.headline)
                    .foregroundStyle(FieldNotes.ink)
                Spacer()
                Picker("Sort", selection: $filter.sort) {
                    ForEach(TransactionFilter.Sort.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.menu)
                .labelsHidden()
                .frame(width: 170)
            }
            .padding(12)

            HStack(spacing: 4) {
                ForEach(Tab.allCases) { t in
                    Button {
                        tab = t
                    } label: {
                        Text(t.rawValue)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(tab == t ? FieldNotes.ink : FieldNotes.pillBg, in: Capsule())
                            .foregroundStyle(tab == t ? FieldNotes.paper : FieldNotes.inkSecondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)

            Divider().overlay(FieldNotes.border)

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    switch tab {
                    case .accounts:
                        ForEach(accounts) { account in
                            popoverToggleRow(label: account.displayName, detail: account.institutionName,
                                             selected: filter.accountIds.contains(account.providerAccountId)) {
                                toggle(&filter.accountIds, id: account.providerAccountId)
                            }
                        }
                    case .categories:
                        popoverToggleRow(label: "Uncategorized", detail: nil,
                                         selected: filter.categoryIds.contains("")) {
                            toggle(&filter.categoryIds, id: "")
                        }
                        ForEach(categories.filter { $0.parentId != nil }) { cat in
                            popoverToggleRow(label: "\(cat.icon) \(cat.name)", detail: nil,
                                             selected: filter.categoryIds.contains(cat.id)) {
                                toggle(&filter.categoryIds, id: cat.id)
                            }
                        }
                    case .merchants:
                        TextField("Search merchants…", text: $merchantSearch)
                            .textFieldStyle(.roundedBorder)
                            .padding(.bottom, 6)
                        let merchants = Dictionary(grouping: transactions.filter { !$0.normalizedMerchant.isEmpty },
                                                   by: \.normalizedMerchant)
                            .sorted { $0.value.count > $1.value.count }
                            .map { key, items -> (String, String, String) in
                                let label = Dictionary(grouping: items, by: \.title).max { $0.value.count < $1.value.count }?.key ?? key
                                return (key, label, "\(items.count)")
                            }
                            .filter { merchantSearch.isEmpty || $0.1.localizedCaseInsensitiveContains(merchantSearch) }
                        ForEach(merchants.prefix(40), id: \.0) { key, label, count in
                            popoverToggleRow(label: label, detail: "\(count) tx",
                                             selected: filter.merchants.contains(key)) {
                                toggle(&filter.merchants, id: key)
                            }
                        }
                    case .tags:
                        let allTags = TagStyle.allTags(in: transactions)
                        if allTags.isEmpty {
                            Text("No tags yet").font(.subheadline).foregroundStyle(FieldNotes.inkTertiary).padding(8)
                        } else {
                            ForEach(allTags, id: \.self) { tag in
                                popoverToggleRow(label: "#\(tag)", detail: nil,
                                                 selected: filter.tags.contains(tag)) {
                                    toggle(&filter.tags, id: tag)
                                }
                            }
                        }
                    case .amounts:
                        VStack(alignment: .leading, spacing: 10) {
                            LabeledContent("Minimum") {
                                TextField("Any", value: $filter.minAmount, format: .currency(code: "USD"))
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 120)
                            }
                            LabeledContent("Maximum") {
                                TextField("Any", value: $filter.maxAmount, format: .currency(code: "USD"))
                                    .textFieldStyle(.roundedBorder)
                                    .frame(width: 120)
                            }
                            Text("Matches money in and money out by size.")
                                .font(.caption)
                                .foregroundStyle(FieldNotes.inkTertiary)
                        }
                        .padding(6)
                    }
                }
                .padding(12)
            }
            .frame(height: 260)

            Divider().overlay(FieldNotes.border)

            HStack {
                Button("Clear all") {
                    filter = TransactionFilter()
                }
                .buttonStyle(.plain)
                .foregroundStyle(FieldNotes.inkSecondary)
                Spacer()
                Button("Done") { dismiss() }
                    .buttonStyle(.borderedProminent)
                    .tint(FieldNotes.forest)
            }
            .padding(12)
        }
        .frame(width: 440)
        .background(FieldNotes.paper)
    }

    private func toggle(_ set: inout Set<String>, id: String) {
        if set.contains(id) { set.remove(id) } else { set.insert(id) }
    }

    private func popoverToggleRow(label: String, detail: String?, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.subheadline).foregroundStyle(FieldNotes.ink)
                    if let detail { Text(detail).font(.caption2).foregroundStyle(FieldNotes.inkTertiary) }
                }
                Spacer()
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(selected ? FieldNotes.forest : FieldNotes.inkTertiary)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(selected ? FieldNotes.forestSoft : Color.clear, in: RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }
}
#endif

// MARK: - iOS Filters Sheet (kept for iOS compatibility)

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

private extension EnvironmentValues {
    /// Set on the Mac: rows open their transaction beside the list instead of pushing it.
    @Entry var openTransaction: ((LocalTransaction) -> Void)? = nil
    /// The open transaction's id, so its row can be highlighted.
    @Entry var openTransactionID: String? = nil
}
