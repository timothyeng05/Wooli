import Foundation

/// Builds a plain-text (Markdown) spending summary the user can share to the
/// Claude app, or any chat assistant, to ask questions about their money.
/// Nothing leaves the phone until the user taps Share or Copy.
struct ClaudeExport {
    enum Period: String, CaseIterable, Identifiable {
        case thisMonth = "This month", lastMonth = "Last month", both = "Both months"
        var id: String { rawValue }

        var interval: DateInterval {
            let cal = Calendar.current
            let now = Date.now
            let thisMonth = cal.dateInterval(of: .month, for: now)!
            let lastMonth = cal.dateInterval(of: .month, for: cal.date(byAdding: .month, value: -1, to: now)!)!
            switch self {
            case .thisMonth: return DateInterval(start: thisMonth.start, end: now)
            case .lastMonth: return lastMonth
            case .both: return DateInterval(start: lastMonth.start, end: now)
            }
        }
    }

    struct Options {
        var question = ""
        var period: Period = .thisMonth
        var includeTransactions = true
        var includeStatements = false
        var includeAccountNames = false
        var includeTransfers = false
    }

    let options: Options
    let transactions: [LocalTransaction]
    let categories: [BudgetCategory]
    let accounts: [LocalAccount]

    var text: String {
        let interval = options.period.interval
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let accountsById = Dictionary(accounts.map { ($0.providerAccountId, $0) }, uniquingKeysWith: { a, _ in a })
        let hidden = Set(accounts.filter(\.isHidden).map(\.providerAccountId))
        let items = transactions
            .filter { interval.contains($0.transactedAt) && !$0.isHidden && !hidden.contains($0.accountId) }
            .filter { options.includeTransfers || !$0.isTransfer }
            .sorted { $0.transactedAt < $1.transactedAt }

        let summary = MonthSummary(transactions: transactions, in: interval, categories: byId, hiddenAccounts: hidden)
        let days = max(1, Calendar.current.dateComponents([.day], from: interval.start, to: min(interval.end, .now)).day ?? 1)
        let dateRange = "\(interval.start.formatted(date: .abbreviated, time: .omitted)) – \(min(interval.end.addingTimeInterval(-1), .now).formatted(date: .abbreviated, time: .omitted))"

        var out: [String] = []
        out.append("# My spending, \(dateRange)")
        out.append("_Exported from Wooli, my personal budgeting app. Amounts in USD; transfers between my own accounts and credit card payments are \(options.includeTransfers ? "included and marked" : "left out")._")
        out.append("")
        let question = options.question.trimmingCharacters(in: .whitespacesAndNewlines)
        if !question.isEmpty {
            out.append("**My question:** \(question)")
            out.append("")
        }

        out.append("## Summary")
        out.append("- Income: \(summary.income.currency())")
        out.append("- Spending: \(summary.spending.currency()) (about \((summary.spending / Double(days)).currency()) a day over \(days) days)")
        out.append("- Net: \(summary.net.currency())")
        let groups = categories.filter { $0.parentId == nil }
        let plannedSpending = groups.filter(\.isExpense).reduce(0) { total, g in
            total + (g.monthlyTarget > 0 ? g.monthlyTarget : categories.filter { $0.parentId == g.id }.reduce(0) { $0 + $1.monthlyTarget })
        }
        if plannedSpending > 0 {
            let months = options.period == .both ? 2.0 : 1.0
            out.append("- Planned spending: \((plannedSpending * months).currency()) (\(plannedSpending.currency()) a month)")
        }
        out.append("")

        let spendRows = summary.spendingByCategory.filter { $0.value > 0.005 }.sorted { $0.value > $1.value }
        if !spendRows.isEmpty {
            out.append("## Spending by category")
            out.append("| Category | Group | Spent | Planned per month |")
            out.append("|---|---|---:|---:|")
            for (id, spent) in spendRows {
                guard let c = byId[id] else { continue }
                let group = c.parentId.flatMap { byId[$0] }
                let planned = c.monthlyTarget > 0 ? c.monthlyTarget.currency(cents: false) : "—"
                out.append("| \(c.name) | \(group?.name ?? "") | \(spent.currency()) | \(planned) |")
            }
            if let uncategorized = summary.spendingByGroup[nil], uncategorized > 0 {
                out.append("| Uncategorized | | \(uncategorized.currency()) | — |")
            }
            out.append("")
        }

        let spending = items.filter { $0.amount < 0 }
        let merchants = Dictionary(grouping: spending, by: \.title)
            .map { (name: $0.key, count: $0.value.count, total: -$0.value.reduce(0) { $0 + $1.amount }) }
            .sorted { $0.total > $1.total }
            .prefix(15)
        if !merchants.isEmpty {
            out.append("## Top merchants")
            out.append("| Merchant | Transactions | Total |")
            out.append("|---|---:|---:|")
            for m in merchants { out.append("| \(m.name) | \(m.count) | \(m.total.currency()) |") }
            out.append("")
        }

        if options.includeTransactions && !items.isEmpty {
            out.append("## Transactions (\(items.count))")
            let header = options.includeStatements
                ? "| Date | Merchant | Category | Account | Amount | Bank statement |\n|---|---|---|---|---:|---|"
                : "| Date | Merchant | Category | Account | Amount |\n|---|---|---|---|---:|"
            out.append(header)
            for tx in items {
                let account = accountsById[tx.accountId]
                let accountLabel = options.includeAccountNames ? (account?.displayName ?? "") : (account?.kind.singularLabel ?? "")
                let category = tx.categoryId.flatMap { byId[$0]?.name } ?? "Uncategorized"
                var row = "| \(tx.transactedAt.formatted(.dateTime.month(.abbreviated).day())) | \(clean(tx.title)) | \(category) | \(clean(accountLabel)) | \(tx.amount.formatted(.number.precision(.fractionLength(2)))) |"
                if options.includeStatements { row += " \(clean(tx.transactionDescription)) |" }
                out.append(row)
            }
            out.append("")
            out.append("_Negative amounts are money out, positive are money in._")
        }

        if question.isEmpty {
            out.append("")
            out.append("Please look over my spending and tell me what stands out, where I could cut back, and anything unusual.")
        }
        return out.joined(separator: "\n")
    }

    private func clean(_ s: String) -> String {
        s.replacingOccurrences(of: "|", with: "/").replacingOccurrences(of: "\n", with: " ")
    }
}
