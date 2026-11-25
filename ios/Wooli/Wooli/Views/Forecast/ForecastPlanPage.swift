#if os(macOS)
import SwiftUI
import Charts

/// Something pinned to the timeline: a person's retirement, Social Security or
/// end of plan, or a life event. Dragging it changes the plan.
struct ForecastMarker: Identifiable, Equatable {
    enum Target: Equatable { case retirement(String), socialSecurity(String), end(String), event(String) }

    var id: String
    var year: Int
    var title: String
    var symbol: String
    var color: Color
    var target: Target

    static func all(for plan: ForecastPlan) -> [ForecastMarker] {
        var list: [ForecastMarker] = []
        for p in plan.people {
            list.append(.init(id: "ss-\(p.id)", year: p.socialSecurityYear, title: "Social Security (\(p.name))",
                              symbol: "shield.lefthalf.filled", color: Theme.accentAmber, target: .socialSecurity(p.id)))
            list.append(.init(id: "ret-\(p.id)", year: p.retirementYear, title: "Retirement (\(p.name))",
                              symbol: "sun.horizon", color: Theme.accentRose, target: .retirement(p.id)))
            list.append(.init(id: "end-\(p.id)", year: p.endYear, title: "End of plan (\(p.name))",
                              symbol: ForecastEventIcon.ghost, color: Theme.accentSlate, target: .end(p.id)))
        }
        for e in plan.events {
            list.append(.init(id: e.id, year: e.year, title: e.displayTitle, symbol: e.kind.symbol,
                              color: Color(hex: e.kind.colorHex), target: .event(e.id)))
        }
        return list.sorted { $0.year < $1.year }
    }

    /// Move this marker to `year`, keeping ages and years sensible.
    func move(to year: Int, in plan: inout ForecastPlan) {
        switch target {
        case .retirement(let id):
            guard let i = plan.people.firstIndex(where: { $0.id == id }) else { return }
            let p = plan.people[i]
            plan.people[i].retirementAge = min(max(year - p.birthYear, p.currentAge), p.endAge)
        case .socialSecurity(let id):
            guard let i = plan.people.firstIndex(where: { $0.id == id }) else { return }
            plan.people[i].socialSecurityAge = min(max(year - plan.people[i].birthYear, 62), 70)
        case .end(let id):
            guard let i = plan.people.firstIndex(where: { $0.id == id }) else { return }
            let p = plan.people[i]
            plan.people[i].endAge = min(max(year - p.birthYear, max(p.retirementAge, p.currentAge + 1)), 110)
        case .event(let id):
            guard let i = plan.events.firstIndex(where: { $0.id == id }) else { return }
            plan.events[i].year = min(max(year, ForecastEngine.startYear()), plan.endYear)
        }
    }
}

struct ForecastPlanPage: View {
    @Binding var plan: ForecastPlan
    var onEditEvent: (ForecastEvent) -> Void

    enum Table: String, CaseIterable, Identifiable {
        case accounts = "Accounts", cashFlow = "Cash Flow", events = "Events"
        var id: String { rawValue }
    }

    @State private var table: Table = .accounts

    var body: some View {
        let projection = ForecastEngine.project(plan)
        let today = plan.settings.showTodaysDollars
        VStack(spacing: Space.l) {
            stats(projection, today: today)
            VStack(alignment: .leading, spacing: Space.s) {
                ForecastNetWorthChart(plan: $plan, projection: projection)
                    .frame(height: 380)
                legend
            }
            .card()

            VStack(alignment: .leading, spacing: Space.m) {
                Picker("Table", selection: $table) {
                    ForEach(Table.allCases) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .fixedSize()
                switch table {
                case .accounts: ForecastGrid(years: projection.years.map(\.year), rows: accountRows(projection, today: today))
                case .cashFlow: ForecastGrid(years: projection.years.map(\.year), rows: cashFlowRows(projection, today: today))
                case .events: eventsList
                }
            }
            .card()
        }
    }

    // MARK: Stats

    private func stats(_ p: ForecastEngine.Projection, today: Bool) -> some View {
        let first = p.years.first
        let retireYear = plan.primaryPerson?.retirementYear ?? 0
        let atRetirement = p.year(retireYear) ?? p.years.last
        let last = p.years.last
        return HStack(spacing: 0) {
            stat("Net worth (EOY)", first.map { ForecastFormat.money($0.shown($0.netWorth, todaysDollars: today)) } ?? "—",
                 negative: (first?.netWorth ?? 0) < 0)
            Divider()
            stat("Net worth at retirement", atRetirement.map { ForecastFormat.money($0.shown($0.netWorth, todaysDollars: today)) } ?? "—",
                 negative: (atRetirement?.netWorth ?? 0) < 0)
            Divider()
            stat("Retirement age", plan.primaryPerson.map { "\($0.retirementAge)" } ?? "—", negative: false)
            Divider()
            stat("Net worth at end", last.map { ForecastFormat.money($0.shown($0.netWorth, todaysDollars: today)) } ?? "—",
                 negative: (last?.netWorth ?? 0) < 0)
        }
        .fixedSize(horizontal: false, vertical: true)
        .card(padding: Space.l)
    }

    private func stat(_ label: String, _ value: String, negative: Bool) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(label).font(.caption).foregroundStyle(Theme.textSecondary)
            Text(value).wooliFont(.amount).foregroundStyle(negative ? Theme.expense : Theme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Space.m)
    }

    private var legend: some View {
        HStack(spacing: Space.l) {
            legendItem(Theme.text, "Projected plan")
            legendItem(Theme.expense, "Below $0 (unfunded)")
            Text(plan.settings.showTodaysDollars ? "In today's dollars" : "In future dollars")
                .foregroundStyle(Theme.textTertiary)
            Spacer()
            Text("Drag an icon to change when it happens").foregroundStyle(Theme.textTertiary)
        }
        .font(.caption)
    }

    private func legendItem(_ color: Color, _ text: String) -> some View {
        HStack(spacing: 6) {
            Capsule().fill(color).frame(width: 16, height: 3)
            Text(text).foregroundStyle(Theme.textSecondary)
        }
    }

    // MARK: Tables

    private func accountRows(_ p: ForecastEngine.Projection, today: Bool) -> [ForecastGrid.Row] {
        let ys = p.years
        func values(_ f: (ForecastEngine.Year) -> Double) -> [Double?] { ys.map { $0.shown(f($0), todaysDollars: today) } }
        func dashIfZero(_ f: @escaping (ForecastEngine.Year) -> Double) -> [Double?] {
            ys.map { y in let v = f(y); return abs(v) < 0.5 ? nil : y.shown(v, todaysDollars: today) }
        }

        var assetChildren: [ForecastGrid.Row] = []
        let ids = ys.first?.accounts.map(\.id) ?? []
        for id in ids {
            func acct(_ y: ForecastEngine.Year) -> ForecastEngine.AccountYear? { y.accounts.first { $0.id == id } }
            let kind = ys.first.flatMap(acct)?.kind
            let account = plan.accounts.first { $0.id == id }
            let rate = account?.growthRate ?? plan.settings.growth(for: kind ?? .cash)
            assetChildren.append(.init(
                id: id, title: plan.accountName(id), symbol: kind?.symbol ?? "square.grid.2x2",
                subtitle: account?.institution, values: values { acct($0)?.end ?? 0 },
                children: [
                    .init(id: "\(id)-start", title: "Starting balance", values: values { acct($0)?.start ?? 0 }),
                    .init(id: "\(id)-growth", title: "Growth \(ForecastFormat.percent(rate))", values: dashIfZero { acct($0)?.growth ?? 0 }),
                    .init(id: "\(id)-dep", title: "Deposits", values: dashIfZero { acct($0)?.deposits ?? 0 }),
                    .init(id: "\(id)-wd", title: "Withdrawals", values: dashIfZero { -(acct($0)?.withdrawals ?? 0) }),
                ]))
        }
        if ys.contains(where: { $0.otherAssets > 0.5 }) {
            assetChildren.append(.init(id: "homes", title: "Home value", symbol: "house", values: dashIfZero(\.otherAssets)))
        }

        var liabilityChildren: [ForecastGrid.Row] = []
        if ys.contains(where: { $0.debts > 0.5 }) {
            liabilityChildren.append(.init(id: "debts", title: "Loans & mortgages", symbol: "creditcard", values: dashIfZero(\.debts)))
        }
        liabilityChildren.append(.init(id: "shortfall", title: "Shortfall", symbol: "exclamationmark.circle",
                                       subtitle: p.isSuccess ? nil : "You have unfunded expenses",
                                       values: values(\.shortfall), warning: !p.isSuccess))

        return [
            .init(id: "nw", title: "Net Worth", values: values(\.netWorth), style: .total),
            .init(id: "assets", title: "Assets", values: values(\.assets), style: .group, children: assetChildren),
            .init(id: "liabilities", title: "Liabilities", values: values(\.liabilities), style: .group, children: liabilityChildren),
        ]
    }

    private func cashFlowRows(_ p: ForecastEngine.Projection, today: Bool) -> [ForecastGrid.Row] {
        let ys = p.years
        func values(_ f: (ForecastEngine.Year) -> Double) -> [Double?] { ys.map { $0.shown(f($0), todaysDollars: today) } }
        func lines(_ pick: (ForecastEngine.Year) -> [ForecastEngine.Line]) -> [ForecastGrid.Row] {
            var order: [(id: String, title: String, symbol: String)] = []
            for y in ys { for l in pick(y) where !order.contains(where: { $0.id == l.id }) { order.append((l.id, l.title, l.symbol)) } }
            return order.map { item in
                .init(id: item.id, title: item.title, symbol: item.symbol,
                      values: ys.map { y in y.shown(pick(y).first { $0.id == item.id }?.amount ?? 0, todaysDollars: today) })
            }
        }
        let accountIds = ys.first?.accounts.map(\.id) ?? []
        let withdrawalRows: [ForecastGrid.Row] = accountIds.compactMap { id in
            let v = ys.map { y in y.shown(y.accounts.first { $0.id == id }?.withdrawals ?? 0, todaysDollars: today) }
            return v.contains { $0 > 0.5 } ? .init(id: "wd-\(id)", title: plan.accountName(id), symbol: "arrow.up.right", values: v) : nil
        }
        let depositRows: [ForecastGrid.Row] = accountIds.compactMap { id in
            let v = ys.map { y in y.shown(y.accounts.first { $0.id == id }?.deposits ?? 0, todaysDollars: today) }
            return v.contains { $0 > 0.5 } ? .init(id: "dep-\(id)", title: plan.accountName(id), symbol: "arrow.down.left", values: v) : nil
        }
        return [
            .init(id: "income", title: "Income", values: values(\.totalIncome), style: .group, children: lines(\.incomes)),
            .init(id: "expenses", title: "Expenses", values: values(\.totalExpenses), style: .group, children: lines(\.expenses)),
            .init(id: "withdrawals", title: "Withdrawals", values: values(\.withdrawals), style: .group, children: withdrawalRows),
            .init(id: "savings", title: "Savings", values: values(\.deposits), style: .group, children: depositRows),
            .init(id: "net", title: "Net Cash Flow", values: ys.map { y in
                y.shown(y.totalIncome + y.withdrawals - y.totalExpenses - y.deposits, todaysDollars: today)
            }, style: .total),
        ]
    }

    private var eventsList: some View {
        VStack(spacing: 0) {
            ForEach(ForecastMarker.all(for: plan)) { m in
                Button {
                    if case .event(let id) = m.target, let e = plan.events.first(where: { $0.id == id }) { onEditEvent(e) }
                } label: {
                    HStack(spacing: Space.m) {
                        ForecastEventIcon(symbol: m.symbol, color: m.color, size: 32)
                        Text(m.title).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                        Spacer()
                        Text(verbatim: "\(m.year)").monospacedDigit().foregroundStyle(Theme.textSecondary)
                        Stepper("Year", value: Binding(get: { m.year }, set: { m.move(to: $0, in: &plan) }))
                            .labelsHidden()
                        if case .event = m.target {
                            Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
                        } else {
                            Image(systemName: "chevron.right").font(.caption).hidden()
                        }
                    }
                    .padding(.vertical, Space.s)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Divider()
            }
        }
    }
}

// MARK: - Net worth chart

struct ForecastNetWorthChart: View {
    @Binding var plan: ForecastPlan
    let projection: ForecastEngine.Projection

    @State private var hoverYear: Int?
    @State private var dragging: (id: String, year: Int)?

    private struct Point: Identifiable {
        let id = UUID()
        let year: Double
        let value: Double
        let series: Int
        let negative: Bool
    }

    /// Splits the line at $0 so the part below can be drawn red.
    private func points(today: Bool) -> [Point] {
        var out: [Point] = []
        var series = 0
        var prev: (Double, Double)?
        for y in projection.years {
            let v = y.shown(y.netWorth, todaysDollars: today)
            let x = Double(y.year)
            if let (px, pv) = prev, (pv < 0) != (v < 0) {
                let cross = px + (x - px) * (pv / (pv - v))
                out.append(Point(year: cross, value: 0, series: series, negative: pv < 0))
                series += 1
                out.append(Point(year: cross, value: 0, series: series, negative: v < 0))
            }
            out.append(Point(year: x, value: v, series: series, negative: v < 0))
            prev = (x, v)
        }
        return out
    }

    var body: some View {
        let today = plan.settings.showTodaysDollars
        let pts = points(today: today)
        let markers = ForecastMarker.all(for: plan)
        let first = projection.years.first?.year ?? ForecastEngine.startYear()
        let last = max(projection.years.last?.year ?? first + 1, first + 1)
        // Headroom at the top keeps the line clear of the event icons drawn there.
        let values = pts.map(\.value)
        let lo = min(values.min() ?? 0, 0), hi = max(values.max() ?? 1, 1)
        let span = hi - lo
        let yDomain = (lo - span * 0.05)...(hi + span * 0.3)

        Chart {
            RuleMark(y: .value("Zero", 0)).foregroundStyle(Theme.textTertiary.opacity(0.6)).lineStyle(StrokeStyle(lineWidth: 1))
            ForEach(pts) { p in
                AreaMark(x: .value("Year", p.year), yStart: .value("Zero", 0), yEnd: .value("Net worth", min(p.value, 0)),
                         series: .value("Segment", "a\(p.series)"))
                    .foregroundStyle(Theme.expense.opacity(0.08))
                LineMark(x: .value("Year", p.year), y: .value("Net worth", p.value), series: .value("Segment", "l\(p.series)"))
                    .foregroundStyle(p.negative ? Theme.expense : Theme.text)
                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .interpolationMethod(.monotone)
            }
            ForEach(markers) { m in
                RuleMark(x: .value("Year", Double(dragging?.id == m.id ? dragging!.year : m.year)))
                    .foregroundStyle(Theme.border)
                    .lineStyle(StrokeStyle(lineWidth: 1))
            }
            if let hoverYear, let y = projection.year(hoverYear) {
                RuleMark(x: .value("Year", Double(hoverYear)))
                    .foregroundStyle(Theme.textTertiary)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                PointMark(x: .value("Year", Double(hoverYear)), y: .value("Net worth", y.shown(y.netWorth, todaysDollars: today)))
                    .foregroundStyle(y.netWorth < 0 ? Theme.expense : Theme.brand)
                    .symbolSize(70)
            }
        }
        .chartXScale(domain: Double(first)...Double(last))
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: .stride(by: 4)) { value in
                AxisGridLine().foregroundStyle(.clear)
                AxisValueLabel { if let v = value.as(Double.self) { Text(verbatim: "\(Int(v))") } }
            }
        }
        .chartYAxis {
            AxisMarks(position: .leading) { value in
                AxisGridLine().foregroundStyle(Theme.border.opacity(0.6))
                AxisValueLabel { if let v = value.as(Double.self) { Text(ForecastFormat.money(v)) } }
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                if let frame = proxy.plotFrame.map({ geo[$0] }) {
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .onContinuousHover { phase in
                            switch phase {
                            case .active(let loc):
                                if let x: Double = proxy.value(atX: loc.x - frame.minX) {
                                    hoverYear = min(max(Int(x.rounded()), first), last)
                                }
                            case .ended: hoverYear = nil
                            }
                        }
                    markerIcons(markers, proxy: proxy, frame: frame, first: first, last: last)
                    if let hoverYear, let y = projection.year(hoverYear),
                       let px = proxy.position(forX: Double(hoverYear)) {
                        tooltip(y, today: today)
                            .fixedSize()
                            .position(x: min(max(frame.minX + px + (px > frame.width / 2 ? -120 : 120), frame.minX + 110), frame.maxX - 110), y: frame.minY + 110)
                            .allowsHitTesting(false)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func markerIcons(_ markers: [ForecastMarker], proxy: ChartProxy, frame: CGRect, first: Int, last: Int) -> some View {
        // Icons too close to sit side by side stack into rows, like Monarch's.
        let rows = markerRows(markers, proxy: proxy)
        ForEach(markers) { m in
            let year = dragging?.id == m.id ? dragging!.year : m.year
            let slot = rows[m.id] ?? 0
            if let x = proxy.position(forX: Double(year)) {
                ForecastEventIcon(symbol: m.symbol, color: m.color, size: 24)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .scaleEffect(dragging?.id == m.id ? 1.15 : 1)
                    .shadow(color: dragging?.id == m.id ? Theme.cardShadow : .clear, radius: 4)
                    .position(x: frame.minX + x, y: frame.minY + 16 + CGFloat(slot) * 30)
                    .help("\(m.title) · \(year) — drag to move")
                    .gesture(
                        DragGesture(minimumDistance: 1, coordinateSpace: .local)
                            .onChanged { g in
                                if let v: Double = proxy.value(atX: g.location.x - frame.minX) {
                                    dragging = (m.id, min(max(Int(v.rounded()), first), last))
                                }
                            }
                            .onEnded { _ in
                                if let d = dragging { m.move(to: d.year, in: &plan) }
                                dragging = nil
                            }
                    )
            }
        }
    }

    private func markerRows(_ markers: [ForecastMarker], proxy: ChartProxy) -> [String: Int] {
        var rowEnds: [CGFloat] = []
        var out: [String: Int] = [:]
        let placed = markers.map { m in (m, dragging?.id == m.id ? dragging!.year : m.year) }.sorted { $0.1 < $1.1 }
        for (m, year) in placed {
            guard let x = proxy.position(forX: Double(year)) else { continue }
            let row = rowEnds.firstIndex { x - $0 >= 28 } ?? rowEnds.count
            if row == rowEnds.count { rowEnds.append(x) } else { rowEnds[row] = x }
            out[m.id] = row
        }
        return out
    }

    private func tooltip(_ y: ForecastEngine.Year, today: Bool) -> some View {
        let ages = plan.people.map { "\($0.name) \($0.age(in: y.year))" }.joined(separator: " · ")
        return VStack(alignment: .leading, spacing: 6) {
            Text(verbatim: "\(y.year)").font(.headline)
            if !ages.isEmpty { Text(ages).font(.caption).opacity(0.7) }
            row("Net worth", y.shown(y.netWorth, todaysDollars: today), bold: true)
            row("Income", y.shown(y.totalIncome, todaysDollars: today))
            row("Expenses", y.shown(y.totalExpenses, todaysDollars: today))
            if y.shortfall > 0.5 { row("Shortfall", y.shown(y.shortfall, todaysDollars: today)) }
        }
        .foregroundStyle(.white)
        .padding(Space.m)
        .frame(width: 200, alignment: .leading)
        .background(Color.black.opacity(0.85), in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
    }

    private func row(_ label: String, _ value: Double, bold: Bool = false) -> some View {
        HStack {
            Text(label).opacity(bold ? 1 : 0.75)
            Spacer()
            Text(ForecastFormat.money(value)).monospacedDigit()
        }
        .font(bold ? .callout.weight(.semibold) : .caption)
    }
}

// MARK: - Year grid

/// Monarch-style table: names pinned on the left, one column per year
/// scrolling sideways, groups that fold open.
struct ForecastGrid: View {
    struct Row: Identifiable {
        enum Style { case normal, group, total }
        var id: String
        var title: String
        var symbol: String?
        var subtitle: String?
        var values: [Double?]
        var style: Style = .normal
        var warning = false
        var children: [Row] = []
    }

    let years: [Int]
    let rows: [Row]
    @State private var expanded: Set<String> = ["assets", "liabilities", "income", "expenses"]

    private let labelWidth: CGFloat = 280
    private let columnWidth: CGFloat = 96
    private let rowHeight: CGFloat = 40

    private var flat: [(row: Row, level: Int)] {
        var out: [(Row, Int)] = []
        func walk(_ rows: [Row], _ level: Int) {
            for r in rows {
                out.append((r, level))
                if expanded.contains(r.id) { walk(r.children, level + 1) }
            }
        }
        walk(rows, 0)
        return out
    }

    var body: some View {
        let flat = flat
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                Color.clear.frame(height: rowHeight)
                ForEach(flat, id: \.row.id) { item in label(item.row, level: item.level) }
            }
            .frame(width: labelWidth)
            .background(Theme.card)
            Divider()
            ScrollView(.horizontal) {
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        ForEach(years, id: \.self) { y in
                            Text(verbatim: "\(y)").font(.caption.weight(.semibold)).foregroundStyle(Theme.textSecondary)
                                .frame(width: columnWidth, height: rowHeight, alignment: .trailing)
                        }
                    }
                    .background(Theme.track.opacity(0.5))
                    ForEach(flat, id: \.row.id) { item in
                        HStack(spacing: 0) {
                            ForEach(Array(item.row.values.enumerated()), id: \.offset) { _, v in
                                cell(v, row: item.row)
                            }
                        }
                        .frame(height: rowHeight)
                        .background(item.row.style == .normal ? Color.clear : Theme.track.opacity(0.25))
                        .overlay(alignment: .bottom) { Divider() }
                    }
                }
                .padding(.trailing, Space.m)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
    }

    private func label(_ row: Row, level: Int) -> some View {
        HStack(spacing: Space.s) {
            if row.children.isEmpty {
                Color.clear.frame(width: 12)
            } else {
                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.bold))
                    .rotationEffect(.degrees(expanded.contains(row.id) ? 90 : 0))
                    .frame(width: 12)
                    .foregroundStyle(Theme.textSecondary)
            }
            if let symbol = row.symbol {
                Image(systemName: symbol).font(.caption).foregroundStyle(Theme.textSecondary).frame(width: 18)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(row.title)
                    .font(row.style == .normal ? .callout : .callout.weight(.semibold))
                    .foregroundStyle(row.warning ? Theme.textSecondary : Theme.text)
                    .lineLimit(1)
                if let sub = row.subtitle, !sub.isEmpty {
                    Label(sub, systemImage: row.warning ? "exclamationmark.circle" : "")
                        .labelStyle(.titleOnly)
                        .font(.caption2)
                        .foregroundStyle(row.warning ? Theme.pending : Theme.textTertiary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.leading, CGFloat(level) * 18 + Space.s)
        .frame(height: rowHeight)
        .background(row.style == .normal ? Color.clear : Theme.track.opacity(0.25))
        .overlay(alignment: .bottom) { Divider() }
        .contentShape(Rectangle())
        .onTapGesture {
            guard !row.children.isEmpty else { return }
            withAnimation(.snappy) {
                if expanded.contains(row.id) { expanded.remove(row.id) } else { expanded.insert(row.id) }
            }
        }
    }

    private func cell(_ value: Double?, row: Row) -> some View {
        Group {
            if let value {
                Text(ForecastFormat.money(value))
                    .foregroundStyle(value < -0.5 ? Theme.expense : Theme.text)
            } else {
                Text("–").foregroundStyle(Theme.textTertiary)
            }
        }
        .font(row.style == .normal ? .callout : .callout.weight(.semibold))
        .monospacedDigit()
        .frame(width: columnWidth, alignment: .trailing)
    }
}

// MARK: - Compare

struct ForecastComparePage: View {
    let plan: ForecastPlan
    let scenarios: [ForecastScenario]
    @Binding var compareId: String
    var onDuplicate: () -> Void

    var body: some View {
        if scenarios.isEmpty {
            VStack(spacing: Space.m) {
                Image(systemName: "square.split.2x1").font(.largeTitle).foregroundStyle(Theme.brand)
                Text("Compare scenarios").font(.title3.weight(.semibold))
                Text("Duplicate this plan, change something — retire earlier, buy a home — and see both side by side.")
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 420)
                Button("Duplicate \(plan.name)", action: onDuplicate).buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 60)
            .card()
        } else {
            let other = scenarios.first { $0.id == compareId } ?? scenarios[0]
            comparison(other.plan)
        }
    }

    private func comparison(_ otherPlan: ForecastPlan) -> some View {
        let today = plan.settings.showTodaysDollars
        let a = ForecastEngine.project(plan)
        let b = ForecastEngine.project(otherPlan)
        let colorA = Theme.text, colorB = Theme.brand
        return VStack(spacing: Space.l) {
            VStack(alignment: .leading, spacing: Space.m) {
                HStack {
                    Text("Compare with").foregroundStyle(Theme.textSecondary)
                    Picker("Scenario", selection: Binding(get: { compareId.isEmpty ? scenarios[0].id : compareId }, set: { compareId = $0 })) {
                        ForEach(scenarios) { Text($0.plan.name).tag($0.id) }
                    }
                    .labelsHidden()
                    .fixedSize()
                    Spacer()
                }
                Chart {
                    RuleMark(y: .value("Zero", 0)).foregroundStyle(Theme.textTertiary.opacity(0.6))
                    ForEach(a.years) { y in
                        LineMark(x: .value("Year", y.year), y: .value("Net worth", y.shown(y.netWorth, todaysDollars: today)),
                                 series: .value("Plan", plan.name))
                            .foregroundStyle(colorA)
                    }
                    ForEach(b.years) { y in
                        LineMark(x: .value("Year", y.year), y: .value("Net worth", y.shown(y.netWorth, todaysDollars: today)),
                                 series: .value("Plan", otherPlan.name + " "))
                            .foregroundStyle(colorB)
                            .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
                    }
                }
                .chartXScale(domain: min(a.years.first?.year ?? 0, b.years.first?.year ?? 0)...max(a.years.last?.year ?? 1, b.years.last?.year ?? 1))
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine().foregroundStyle(Theme.border.opacity(0.6))
                        AxisValueLabel { if let v = value.as(Double.self) { Text(ForecastFormat.money(v)) } }
                    }
                }
                .frame(height: 320)
                HStack(spacing: Space.l) {
                    HStack(spacing: 6) { Capsule().fill(colorA).frame(width: 16, height: 3); Text(plan.name) }
                    HStack(spacing: 6) { Capsule().fill(colorB).frame(width: 16, height: 3); Text(otherPlan.name) }
                }
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            }
            .card()

            VStack(spacing: 0) {
                compareRow("", plan.name, otherPlan.name, header: true)
                compareRow("Net worth at retirement", metric(a, plan.primaryPerson?.retirementYear, today), metric(b, otherPlan.primaryPerson?.retirementYear, today))
                compareRow("Net worth at end", metric(a, a.years.last?.year, today), metric(b, b.years.last?.year, today))
                compareRow("Retirement age", plan.primaryPerson.map { "\($0.retirementAge)" } ?? "—",
                           otherPlan.primaryPerson.map { "\($0.retirementAge)" } ?? "—")
                compareRow("Runs short of money", a.shortfallYear.map { "In \($0)" } ?? "Never",
                           b.shortfallYear.map { "In \($0)" } ?? "Never")
                compareRow("Yearly living expenses", ForecastFormat.money(plan.yearlyExpenses), ForecastFormat.money(otherPlan.yearlyExpenses))
                compareRow("Life events", "\(plan.events.count)", "\(otherPlan.events.count)")
            }
            .card(padding: Space.l)
        }
    }

    private func metric(_ p: ForecastEngine.Projection, _ year: Int?, _ today: Bool) -> String {
        guard let year, let y = p.year(year) ?? p.years.last else { return "—" }
        return ForecastFormat.money(y.shown(y.netWorth, todaysDollars: today))
    }

    private func compareRow(_ label: String, _ a: String, _ b: String, header: Bool = false) -> some View {
        HStack {
            Text(label).foregroundStyle(Theme.textSecondary).frame(maxWidth: .infinity, alignment: .leading)
            Text(a).frame(width: 200, alignment: .trailing)
            Text(b).frame(width: 200, alignment: .trailing).foregroundStyle(header ? Theme.brand : Theme.text)
        }
        .font(header ? .callout.weight(.semibold) : .callout)
        .monospacedDigit()
        .padding(.vertical, Space.s)
        .overlay(alignment: .bottom) { Divider() }
    }
}
#endif
