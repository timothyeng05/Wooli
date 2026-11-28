import SwiftUI
import SwiftData

/// Bills, subscriptions and paychecks that repeat: what's been paid this
/// month, what's still coming, and anything that seems to have stopped.
struct RecurringView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \RecurringItem.nextDate) private var allItems: [RecurringItem]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query(sort: \TransactionRule.createdAt, order: .reverse) private var rules: [TransactionRule]
    @Query private var accounts: [LocalAccount]
    @State private var editing: RecurringItem?
    @State private var showStopped = false

    private var items: [RecurringItem] {
        let hidden = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        return allItems.filter { !hidden.contains($0.accountId) }
    }

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let accountNames = Dictionary(accounts.map { ($0.providerAccountId, $0.displayName) }, uniquingKeysWith: { a, _ in a })
        let month = RecurringMonth(items: items)
        let stopped = items.filter { !$0.isActive }
        let monthlyTotal = items.filter { $0.isActive && $0.amount < 0 }
            .reduce(0) { $0 + abs($1.amount) * (30.4 / $1.cadence.days) }
        let activeRules = rules.filter(\.isEnabled)

        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    SectionLabel("This month")
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(month.dueOut.currency()).font(.system(size: 28, weight: .bold)).monospacedDigit()
                                .foregroundStyle(Theme.text)
                            Text("still due").font(.subheadline).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(month.paidOut.currency()).font(.title3.weight(.semibold)).monospacedDigit()
                                .foregroundStyle(Theme.textSecondary)
                            Text("paid so far").font(.subheadline).foregroundStyle(Theme.textTertiary)
                        }
                    }
                    BarGauge(value: month.paidOut, total: max(month.paidOut + month.dueOut, 1), tint: Theme.brand)
                    HStack {
                        Text("About \(monthlyTotal.currency(cents: false)) a month in recurring charges")
                        Spacer()
                        if month.expectedIn > 0 {
                            Text("+\(month.expectedIn.currency(cents: false)) income due").foregroundStyle(Theme.income)
                        }
                    }
                    .font(.footnote).foregroundStyle(Theme.textSecondary)
                }
                .padding(.vertical, 6)
            }

            let departures = month.departures()
            if !departures.isEmpty {
                Section {
                    DepartureBoard(rows: departures)
                        .padding(.horizontal, Space.l)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }

            if !month.late.isEmpty {
                Section {
                    ForEach(month.late) { item in
                        row(item, date: item.nextDate, byId: byId, note: "Expected \(item.nextDate.formatted(.dateTime.month(.abbreviated).day()))")
                    }
                } header: {
                    Text("Haven't seen lately")
                } footer: {
                    Text("These didn't show up when expected. If you cancelled one, swipe to stop tracking it.")
                }
            }

            Section("Upcoming") {
                if month.upcoming.isEmpty {
                    Text("Nothing else due this month").foregroundStyle(Theme.textTertiary)
                }
                ForEach(month.upcoming) { occurrence in
                    row(occurrence.item, date: occurrence.date, byId: byId, note: dueText(occurrence.date))
                }
            }

            if !month.paid.isEmpty {
                Section("Paid this month") {
                    ForEach(month.paid) { item in
                        row(item, date: item.lastDate, byId: byId,
                            note: "Paid \(item.lastDate.formatted(.dateTime.month(.abbreviated).day()))", paid: true)
                    }
                }
            }

            if !stopped.isEmpty {
                Section {
                    DisclosureGroup("Not tracking (\(stopped.count))", isExpanded: $showStopped) {
                        ForEach(stopped) { item in
                            Button { editing = item } label: {
                                HStack {
                                    Text(item.title).foregroundStyle(FieldNotes.inkSecondary)
                                    Spacer()
                                    Text(abs(item.amount).currency()).monospacedDigit().foregroundStyle(FieldNotes.inkTertiary)
                                }
                            }
                        }
                    }
                }
            }

            if !activeRules.isEmpty {
                Section("Rules") {
                    ForEach(activeRules.prefix(6)) { rule in
                        NaturalLanguageRuleRow(rule: rule, categories: byId, accounts: accountNames)
                    }
                }
            }

            if items.isEmpty {
                Section {
                    ContentUnavailableView("No Recurring Charges Yet", systemImage: "arrow.triangle.2.circlepath",
                                           description: Text("Wooli spots bills and subscriptions once it has seen them twice. You can also open any transaction and tap \"Mark as recurring\"."))
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(FieldNotes.paper)
        .navigationTitle("Recurring")
        .macInspector($editing) { RecurringEditor(item: $0) }
    }

    private func dueText(_ date: Date) -> String {
        let cal = Calendar.current
        let days = cal.dateComponents([.day], from: cal.startOfDay(for: .now), to: cal.startOfDay(for: date)).day ?? 0
        switch days {
        case ..<0: return "Due \(date.formatted(.dateTime.month(.abbreviated).day())) · not posted yet"
        case 0: return "Due today"
        case 1: return "Due tomorrow"
        default: return "Due \(date.formatted(.dateTime.month(.abbreviated).day())) · in \(days) days"
        }
    }

    private func row(_ item: RecurringItem, date: Date, byId: [String: BudgetCategory], note: String, paid: Bool = false) -> some View {
        Button { editing = item } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    CategoryTile(category: item.categoryId.flatMap { byId[$0] }, size: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title).font(.body.weight(.medium)).foregroundStyle(FieldNotes.ink).lineLimit(1)
                        Text("\(item.cadence.label) · \(note)").font(.footnote).foregroundStyle(FieldNotes.inkTertiary).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    HStack(spacing: 6) {
                        Text(item.amount.signedCurrency()).font(.body.weight(.semibold)).monospacedDigit()
                            .foregroundStyle(item.amount > 0 ? Theme.income : (paid ? FieldNotes.inkSecondary : FieldNotes.ink))
                        if paid { Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.income) }
                    }
                }
                TwelveMonthDotTimeline(item: item)
                    .padding(.leading, 50)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .swipeActions {
            Button("Stop tracking", systemImage: "xmark.circle") {
                withAnimation { item.isActive = false }
            }
            .tint(.gray)
        }
    }
}

/// Edit a recurring item: name, amount, how often, category, or stop tracking.
struct RecurringEditor: View {
    @Bindable var item: RecurringItem
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \LocalTransaction.transactedAt, order: .reverse) private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var confirmDelete = false

    init(item: RecurringItem) {
        _item = Bindable(item)
        // Only this merchant's payments, not every transaction.
        let merchant = item.merchant
        _transactions = Query(filter: #Predicate<LocalTransaction> { $0.normalizedMerchant == merchant },
                              sort: \LocalTransaction.transactedAt, order: .reverse)
    }

    var body: some View {
        let history = transactions.filter { $0.normalizedMerchant == item.merchant && ($0.amount < 0) == (item.amount < 0) }
        let category = item.categoryId.flatMap { id in categories.first { $0.id == id } }

        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $item.title)
                    LabeledContent("Amount") {
                        TextField("Amount", value: Binding(get: { abs(item.amount) },
                                                           set: { item.amount = item.amount < 0 ? -abs($0) : abs($0) }),
                                  format: .currency(code: "USD"))
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    Picker("How often", selection: Binding(get: { item.cadence }, set: {
                        item.cadence = $0
                        item.nextDate = $0.next(after: item.lastDate)
                    })) {
                        ForEach(Cadence.allCases) { Text($0.label).tag($0) }
                    }
                    DatePicker("Next charge", selection: $item.nextDate, displayedComponents: .date)
                    NavigationLink {
                        CategoryPickerView(selectedId: item.categoryId) { item.categoryId = $0?.id }
                    } label: {
                        LabeledContent("Category", value: category.map { "\($0.icon) \($0.name)" } ?? "None")
                    }
                }

                Section {
                    Toggle("Track this", isOn: $item.isActive)
                } footer: {
                    Text(item.isManual ? "You added this." : "Wooli found this because it repeats on a regular schedule.")
                }

                if !history.isEmpty {
                    Section("History") {
                        ForEach(history.prefix(12)) { tx in
                            LabeledContent(tx.transactedAt.formatted(date: .abbreviated, time: .omitted)) {
                                Text(tx.amount.signedCurrency()).monospacedDigit()
                            }
                        }
                    }
                }

                Section {
                    Button("Delete", role: .destructive) { confirmDelete = true }
                } footer: {
                    Text("Deleting only removes it from Recurring. Your transactions aren't touched. Wooli may find it again if it keeps repeating — turn off \"Track this\" instead to ignore it for good.")
                }
            }
            
            .navigationTitle(item.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .confirmationDialog("Delete \(item.title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    context.delete(item)
                    try? context.save()
                    dismiss()
                }
            }
        }
    }
}

/// Dashboard card: what's still due this month and the next few charges.
struct RecurringCard: View {
    @Query(sort: \RecurringItem.nextDate) private var allItems: [RecurringItem]
    @Query private var accounts: [LocalAccount]

    private var items: [RecurringItem] {
        let hidden = Set(accounts.filter { $0.isHidden || $0.hideTransactions }.map(\.providerAccountId))
        return allItems.filter { !hidden.contains($0.accountId) }
    }

    var body: some View {
        let month = RecurringMonth(items: items)
        NavigationLink {
            RecurringView()
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                CardHeader(title: "Recurring", subtitle: month.dueOut > 0
                           ? "\(month.dueOut.currency(cents: false)) still due this month"
                           : month.expectedIn > 0 ? "No bills left · \(month.expectedIn.currency(cents: false)) income coming"
                           : "All paid this month") {
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                }
                if items.isEmpty {
                    Text("Bills and subscriptions will show up here once Wooli has seen them repeat.")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }
                let departures = month.departures(limit: 3)
                if !departures.isEmpty { DepartureBoard(rows: departures) }
                if !month.late.isEmpty {
                    Label("\(month.late.count) haven't shown up when expected", systemImage: "exclamationmark.circle")
                        .font(.footnote).foregroundStyle(Theme.pending)
                }
            }
            .card()
        }
        .buttonStyle(.plain)
    }
}

/// "Mark as recurring" from a transaction.
struct MarkRecurringButton: View {
    let transaction: LocalTransaction
    @Environment(\.modelContext) private var context
    @Query private var items: [RecurringItem]
    @State private var editing: RecurringItem?

    var body: some View {
        let existing = items.first { $0.merchant == transaction.normalizedMerchant && $0.isActive }
        Menu {
            if let existing {
                Button("Edit recurring \(existing.title)", systemImage: "pencil") { editing = existing }
            } else {
                ForEach(Cadence.allCases) { cadence in
                    Button(cadence.label) {
                        editing = RecurringDetector.track(transaction, cadence: cadence, context: context)
                    }
                }
            }
        } label: {
            Label(existing == nil ? "Mark as recurring" : "Recurring · \(existing!.cadence.label)",
                  systemImage: "arrow.triangle.2.circlepath")
                .font(.subheadline.weight(.medium))
        }
        .sheet(item: $editing) { RecurringEditor(item: $0) }
    }
}

extension RecurringMonth {
    /// Late, due and just-paid charges as departures-board rows, soonest first.
    /// A paid charge drops off the board a day after it posted.
    func departures(limit: Int = 5, now: Date = .now) -> [DepartureRow] {
        var rows = late.map {
            DepartureRow(date: $0.nextDate, title: $0.title, amount: $0.amount.signedCurrency(), status: .late)
        }
        rows += upcoming.map {
            DepartureRow(date: $0.date, title: $0.item.title, amount: $0.item.amount.signedCurrency(), status: .due)
        }
        let dayAgo = now.addingTimeInterval(-86_400)
        rows += paid.filter { $0.lastDate >= dayAgo }.map {
            DepartureRow(date: $0.lastDate, title: $0.title, amount: $0.amount.signedCurrency(), status: .paid)
        }
        return Array(rows.sorted { $0.date < $1.date }.prefix(limit))
    }
}

/// 12-month horizontal dot timeline (JAN–DEC) for a recurring item's annual cadence.
private struct TwelveMonthDotTimeline: View {
    let item: RecurringItem

    private static let monthLabels = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

    var body: some View {
        let cal = Calendar.current
        let now = Date.now
        let currentMonth = cal.component(.month, from: now)
        let currentYear = cal.component(.year, from: now)
        let activeMonths = scheduledMonths(year: currentYear, calendar: cal)
        let lastPaidMonth = cal.component(.year, from: item.lastDate) == currentYear ? cal.component(.month, from: item.lastDate) : 0

        HStack(spacing: 6) {
            ForEach(1...12, id: \.self) { m in
                let isExpected = activeMonths.contains(m)
                let isPaid = isExpected && (m < currentMonth || (m == currentMonth && lastPaidMonth == currentMonth))
                let isCurrent = m == currentMonth

                VStack(spacing: 3) {
                    Circle()
                        .fill(dotFill(expected: isExpected, paid: isPaid))
                        .overlay(
                            Circle().strokeBorder(
                                isExpected ? FieldNotes.forest : FieldNotes.border,
                                lineWidth: isCurrent ? 1.5 : 1
                            )
                        )
                        .frame(width: 8, height: 8)
                    Text(Self.monthLabels[m - 1])
                        .font(.system(size: 8, weight: isCurrent ? .bold : .medium))
                        .foregroundStyle(isCurrent ? FieldNotes.ink : FieldNotes.inkTertiary)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func dotFill(expected: Bool, paid: Bool) -> Color {
        if !expected { return .clear }
        return paid ? FieldNotes.forest : FieldNotes.forestSoft
    }

    private func scheduledMonths(year: Int, calendar: Calendar) -> Set<Int> {
        var result = Set<Int>()
        guard let yearStart = calendar.date(from: DateComponents(year: year, month: 1, day: 1)),
              let yearEnd = calendar.date(from: DateComponents(year: year, month: 12, day: 31)) else {
            return result
        }
        var d = item.lastDate
        while d > yearStart {
            let prev = item.cadence.previous(before: d)
            if prev >= d { break }
            d = prev
        }
        while d <= yearEnd {
            if calendar.component(.year, from: d) == year {
                result.insert(calendar.component(.month, from: d))
            }
            let next = item.cadence.next(after: d)
            if next <= d { break }
            d = next
        }
        return result
    }
}

/// Natural-language pill-token representation of a `TransactionRule`.
private struct NaturalLanguageRuleRow: View {
    let rule: TransactionRule
    let categories: [String: BudgetCategory]
    let accounts: [String: String]

    var body: some View {
        let conditions = RuleEngine.conditionLines(rule, categories: categories, accounts: accounts)
        let actions = RuleEngine.actionLines(rule, categories: categories)

        FlowLayout(spacing: 6) {
            Text("If")
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldNotes.inkTertiary)
            ForEach(conditions, id: \.self) { cond in
                pillToken(cond, background: FieldNotes.pillBg, foreground: FieldNotes.ink)
            }
            Text("then")
                .font(.caption.weight(.semibold))
                .foregroundStyle(FieldNotes.inkTertiary)
            ForEach(actions, id: \.self) { act in
                pillToken(act, background: FieldNotes.forestSoft, foreground: FieldNotes.forest)
            }
        }
        .padding(.vertical, 4)
    }

    private func pillToken(_ text: String, background: Color, foreground: Color) -> some View {
        Text(text)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(background, in: Capsule())
            .foregroundStyle(foreground)
    }
}
