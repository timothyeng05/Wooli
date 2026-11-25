#if os(macOS)
import SwiftUI
import Charts

/// "Chance of success": a short walkthrough the first time, then the Monte
/// Carlo results — gauge, outcome histograms and the fan of paths.
struct ForecastChancePage: View {
    let plan: ForecastPlan
    let simulation: ForecastEngine.Simulation?
    let isRunning: Bool
    @Binding var seenIntro: Bool
    var run: () -> Void

    var body: some View {
        if !seenIntro {
            ForecastChanceIntro { seenIntro = true; run() } skip: { seenIntro = true; run() }
        } else if let simulation {
            ForecastChanceResults(simulation: simulation, todaysDollars: plan.settings.showTodaysDollars,
                                  onReplay: { seenIntro = false })
        } else {
            VStack(spacing: Space.m) {
                if isRunning || !seenIntro {
                    ProgressView().controlSize(.large)
                    Text("Running 1,000 simulations…").foregroundStyle(Theme.textSecondary)
                } else {
                    Image(systemName: "dice").font(.largeTitle).foregroundStyle(Theme.brand)
                    Text("Your plan changed").font(.title3.weight(.semibold))
                    Text("Run the simulation again to see how your chance of success moved.")
                        .foregroundStyle(Theme.textSecondary)
                    Button("Run simulation", systemImage: "play.fill", action: run).buttonStyle(.borderedProminent)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 80)
            .card()
            // Opening the page (or editing the plan while on it) runs a fresh simulation.
            .task(id: plan) { if !isRunning { run() } }
        }
    }
}

// MARK: - Results

struct ForecastChanceResults: View {
    let simulation: ForecastEngine.Simulation
    let todaysDollars: Bool
    var onReplay: () -> Void

    enum Mode: String, CaseIterable, Identifiable { case paths = "Paths", range = "Range"; var id: String { rawValue } }
    @State private var mode: Mode = .paths
    @State private var hoverYear: Int?

    private var plan: ForecastPlan { simulation.plan }
    private var primary: ForecastPerson? { plan.primaryPerson }

    var body: some View {
        VStack(spacing: Space.l) {
            HStack(alignment: .top, spacing: Space.l) {
                gauge.frame(width: 300)
                VStack(spacing: 0) {
                    let retireYear = primary?.retirementYear ?? simulation.years.first ?? 0
                    histogram(title: "Net worth at retirement (age \(primary?.retirementAge ?? 65))",
                              values: simulation.column(year: retireYear, todaysDollars: todaysDollars),
                              planValue: planValue(retireYear))
                    Divider()
                    histogram(title: "Net worth at plan end (age \(primary?.endAge ?? 90))",
                              values: simulation.column(year: simulation.years.last ?? 0, todaysDollars: todaysDollars),
                              planValue: planValue(simulation.years.last ?? 0))
                    Divider()
                    shortfallHistogram
                }
                .frame(maxWidth: .infinity)
            }
            .card()

            VStack(alignment: .leading, spacing: Space.m) {
                HStack {
                    Spacer()
                    Picker("View", selection: $mode) { ForEach(Mode.allCases) { Text($0.rawValue).tag($0) } }
                        .pickerStyle(.segmented).labelsHidden().fixedSize()
                }
                pathsChart.frame(height: 420)
                HStack(spacing: Space.l) {
                    legend(Theme.text, "Projected plan", line: true)
                    legend(Theme.textTertiary.opacity(0.35), mode == .paths ? "Middle 20% of paths (1 in 5)" : "Middle 50% / 80% of paths", line: false)
                    legend(Theme.textTertiary, "On track", line: true)
                    legend(Theme.expense, "Ran short", line: true)
                }
                .font(.caption)
                .frame(maxWidth: .infinity)
            }
            .card()

            Button("Replay walkthrough", systemImage: "play.circle", action: onReplay)
                .buttonStyle(.borderless)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    private func planValue(_ year: Int) -> Double? {
        let p = ForecastEngine.project(plan, startYear: simulation.startYear)
        return p.year(year).map { $0.shown($0.netWorth, todaysDollars: todaysDollars) }
    }

    // MARK: Gauge

    private var gauge: some View {
        let rate = simulation.successRate
        let color = rate >= 0.8 ? Theme.income : rate >= 0.5 ? Theme.pending : Theme.expense
        return VStack(alignment: .leading, spacing: Space.m) {
            HStack(spacing: 4) {
                Text("Chance of success").font(.callout.weight(.medium)).foregroundStyle(Theme.textSecondary)
                Image(systemName: "info.circle").font(.caption).foregroundStyle(Theme.textTertiary)
                    .help("The share of 1,000 simulated futures in which your plan never runs short of money before the end.")
            }
            ZStack {
                ArcShape(progress: 1).stroke(Theme.track, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                ArcShape(progress: rate).stroke(color, style: StrokeStyle(lineWidth: 16, lineCap: .round))
                VStack(spacing: 4) {
                    Text("\(Int((rate * 100).rounded()))%").font(.system(size: 56, weight: .semibold)).monospacedDigit()
                    Text("\(simulation.successes) of \(simulation.shortfallYears.count.formatted()) paths")
                        .font(.caption).foregroundStyle(Theme.textSecondary)
                }
                .offset(y: 10)
            }
            .frame(height: 200)
            Text(summary(rate)).font(.callout).foregroundStyle(Theme.textSecondary)
        }
    }

    private func summary(_ rate: Double) -> String {
        switch rate {
        case 0.8...: "In most futures your plan holds up all the way to the end."
        case 0.5..<0.8: "Your plan works in many futures, but a rough stretch could leave expenses unfunded."
        default: "In most futures your plan runs short. Try spending less, saving more, or retiring later — then run it again."
        }
    }

    // MARK: Histograms

    private struct Bin: Identifiable { let id: Int; let low: Double; let high: Double; let count: Int }

    private func bins(_ values: [Double], count: Int = 40) -> [Bin] {
        let sorted = values.sorted()
        let lo = ForecastEngine.percentile(sorted, 0.01)
        let hi = ForecastEngine.percentile(sorted, 0.99)
        guard !sorted.isEmpty, hi > lo else {
            return [Bin(id: 0, low: values.first ?? 0, high: (values.first ?? 0) + 1, count: values.count)]
        }
        let width = (hi - lo) / Double(count)
        var counts = Array(repeating: 0, count: count)
        for v in values { counts[min(max(Int((v - lo) / width), 0), count - 1)] += 1 }
        return counts.enumerated().map { Bin(id: $0.offset, low: lo + Double($0.offset) * width, high: lo + Double($0.offset + 1) * width, count: $0.element) }
    }

    private func histogram(title: String, values: [Double], planValue: Double?) -> some View {
        let b = bins(values)
        let sorted = values.sorted()
        let mid = (ForecastEngine.percentile(sorted, 0.4), ForecastEngine.percentile(sorted, 0.6))
        return VStack(alignment: .leading, spacing: Space.xs) {
            Text(title).font(.caption.weight(.medium)).foregroundStyle(Theme.textSecondary)
            Chart {
                RectangleMark(xStart: .value("Low", mid.0), xEnd: .value("High", mid.1))
                    .foregroundStyle(Theme.track.opacity(0.8))
                ForEach(b) { bin in
                    BarMark(xStart: .value("Low", bin.low + (bin.high - bin.low) * 0.2),
                            xEnd: .value("High", bin.high - (bin.high - bin.low) * 0.2),
                            y: .value("Paths", bin.count))
                        .foregroundStyle(bin.high < 0 ? Theme.expense.opacity(0.75) : Theme.brand.opacity(0.7))
                        .clipShape(Capsule())
                }
                if let planValue {
                    RuleMark(x: .value("Plan", planValue))
                        .foregroundStyle(Theme.text)
                        .annotation(position: .top, spacing: 2) {
                            Text("plan \(ForecastFormat.money(planValue))").font(.caption2.weight(.semibold))
                        }
                }
            }
            .chartYAxis(.hidden)
            .chartXAxis {
                AxisMarks(values: [b.first?.low ?? 0, mid.0, b.last?.high ?? 0]) { value in
                    AxisValueLabel { if let v = value.as(Double.self) { Text(ForecastFormat.money(v)) } }
                }
            }
            .frame(height: 86)
            Text("Middle 20%: \(ForecastFormat.money(mid.0)) – \(ForecastFormat.money(mid.1))")
                .font(.caption2).foregroundStyle(Theme.textTertiary)
        }
        .padding(.vertical, Space.s)
    }

    private var shortfallHistogram: some View {
        let birth = primary?.birthYear ?? simulation.startYear - 30
        let ages = simulation.shortfallYears.compactMap { $0 }.map { $0 - birth }
        let counts = Dictionary(grouping: ages, by: { $0 }).mapValues(\.count)
        let endAge = primary?.endAge ?? 90
        let startAge = (simulation.years.first ?? simulation.startYear) - birth
        return VStack(alignment: .leading, spacing: Space.xs) {
            Text("Age when money runs short").font(.caption.weight(.medium)).foregroundStyle(Theme.textSecondary)
            if ages.isEmpty {
                Text("No simulated path ran short before age \(endAge).")
                    .font(.callout).foregroundStyle(Theme.income).frame(height: 86, alignment: .leading)
            } else {
                Chart {
                    ForEach(counts.sorted { $0.key < $1.key }, id: \.key) { age, n in
                        BarMark(x: .value("Age", age), y: .value("Paths", n), width: .fixed(5))
                            .foregroundStyle(Theme.expense.opacity(0.75))
                            .clipShape(Capsule())
                    }
                    RuleMark(x: .value("End", endAge)).foregroundStyle(Theme.text)
                        .annotation(position: .top, alignment: .trailing, spacing: 2) {
                            Text("end of plan · \(endAge)").font(.caption2.weight(.semibold))
                        }
                }
                .chartXScale(domain: startAge...(endAge + 1))
                .chartYAxis(.hidden)
                .frame(height: 86)
                Text("\(ages.count) of \(simulation.shortfallYears.count.formatted()) paths ran short, most often around age \(counts.max { $0.value < $1.value }?.key ?? 0).")
                    .font(.caption2).foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(.vertical, Space.s)
    }

    // MARK: Paths chart

    private var pathsChart: some View {
        let values = simulation.values(todaysDollars: todaysDollars)
        let shown = Array(stride(from: 0, to: values.count, by: max(values.count / 120, 1)))
        let middle = simulation.band(0.4, 0.6, todaysDollars: todaysDollars)
        let wide = simulation.band(0.1, 0.9, todaysDollars: todaysDollars)
        let quart = simulation.band(0.25, 0.75, todaysDollars: todaysDollars)
        let planProjection = ForecastEngine.project(plan, startYear: simulation.startYear)
        let markers = ForecastMarker.all(for: plan)
        let years = simulation.years

        return Chart {
            RuleMark(y: .value("Zero", 0)).foregroundStyle(Theme.textTertiary.opacity(0.6))
            ForEach(markers) { m in
                RuleMark(x: .value("Year", m.year)).foregroundStyle(Theme.border)
                    .annotation(position: .top, spacing: 4) { ForecastEventIcon(symbol: m.symbol, color: m.color, size: 20) }
            }
            if mode == .paths {
                ForEach(shown, id: \.self) { i in
                    let failed = simulation.shortfallYears[i] != nil
                    ForEach(years.indices, id: \.self) { j in
                        LineMark(x: .value("Year", years[j]), y: .value("Net worth", values[i][j]), series: .value("Path", i))
                            .foregroundStyle(failed ? Theme.expense.opacity(0.18) : Theme.textTertiary.opacity(0.08))
                            .lineStyle(StrokeStyle(lineWidth: 1))
                    }
                }
                ForEach(middle, id: \.year) { b in
                    AreaMark(x: .value("Year", b.year), yStart: .value("Low", b.low), yEnd: .value("High", b.high))
                        .foregroundStyle(Theme.expense.opacity(0.25))
                }
            } else {
                ForEach(wide, id: \.year) { b in
                    AreaMark(x: .value("Year", b.year), yStart: .value("Low", b.low), yEnd: .value("High", b.high), series: .value("Band", "80"))
                        .foregroundStyle(Theme.brand.opacity(0.12))
                }
                ForEach(quart, id: \.year) { b in
                    AreaMark(x: .value("Year", b.year), yStart: .value("Low", b.low), yEnd: .value("High", b.high), series: .value("Band", "50"))
                        .foregroundStyle(Theme.brand.opacity(0.22))
                }
            }
            ForEach(planProjection.years) { y in
                LineMark(x: .value("Year", y.year), y: .value("Net worth", y.shown(y.netWorth, todaysDollars: todaysDollars)),
                         series: .value("Path", "plan"))
                    .foregroundStyle(Theme.text)
                    .lineStyle(StrokeStyle(lineWidth: 2.5))
            }
            if let hoverYear, let b = middle.first(where: { $0.year == hoverYear }) {
                RuleMark(x: .value("Year", hoverYear)).foregroundStyle(Theme.textTertiary).lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                PointMark(x: .value("Year", hoverYear), y: .value("Net worth", b.median)).foregroundStyle(Theme.expense)
            }
        }
        // Years are Ints, which Swift Charts would otherwise start at 0.
        .chartXScale(domain: (years.first ?? 0)...max(years.last ?? 1, (years.first ?? 0) + 1))
        .chartXAxis {
            AxisMarks(values: .stride(by: 4)) { value in
                AxisValueLabel { if let v = value.as(Int.self) { Text(verbatim: "\(v)") } }
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
                            if case .active(let loc) = phase, let x: Double = proxy.value(atX: loc.x - frame.minX) {
                                hoverYear = min(max(Int(x.rounded()), years.first ?? 0), years.last ?? 0)
                            } else { hoverYear = nil }
                        }
                    if let hoverYear, let px = proxy.position(forX: hoverYear),
                       let b = middle.first(where: { $0.year == hoverYear }),
                       let planYear = planProjection.year(hoverYear) {
                        let age = primary.map { " · Age \($0.age(in: hoverYear))" } ?? ""
                        VStack(alignment: .leading, spacing: 6) {
                            Text(verbatim: "\(hoverYear)\(age)").font(.headline)
                            tipRow("Projected plan", planYear.shown(planYear.netWorth, todaysDollars: todaysDollars), bold: true)
                            tipRow("Top of 1 in 5", b.high)
                            tipRow("Bottom of 1 in 5", b.low)
                        }
                        .foregroundStyle(.white)
                        .padding(Space.m)
                        .frame(width: 220)
                        .background(Color.black.opacity(0.85), in: RoundedRectangle(cornerRadius: Radius.small))
                        .position(x: min(max(frame.minX + px, frame.minX + 120), frame.maxX - 120), y: frame.minY + 70)
                        .allowsHitTesting(false)
                    }
                }
            }
        }
    }

    private func tipRow(_ label: String, _ value: Double, bold: Bool = false) -> some View {
        HStack {
            Text(label).opacity(bold ? 1 : 0.7)
            Spacer()
            Text(ForecastFormat.money(value)).monospacedDigit()
        }
        .font(bold ? .callout.weight(.semibold) : .caption)
    }

    private func legend(_ color: Color, _ text: String, line: Bool) -> some View {
        HStack(spacing: 6) {
            if line { Capsule().fill(color).frame(width: 16, height: 3) } else { RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 16, height: 8) }
            Text(text).foregroundStyle(Theme.textSecondary)
        }
    }
}

/// A 240° gauge arc, open at the bottom.
struct ArcShape: Shape {
    var progress: Double
    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let start = 150.0, sweep = 240.0
        var p = Path()
        p.addArc(center: CGPoint(x: rect.midX, y: rect.midY + rect.height * 0.08),
                 radius: min(rect.width, rect.height) / 2 - 10,
                 startAngle: .degrees(start), endAngle: .degrees(start + sweep * min(max(progress, 0), 1)), clockwise: false)
        return p
    }
}

// MARK: - Walkthrough

/// Five quick cards that explain what a Monte Carlo forecast is before the first run.
struct ForecastChanceIntro: View {
    var finish: () -> Void
    var skip: () -> Void

    @State private var step = 0
    @State private var volatility = 0.02
    private let steps = 5

    var body: some View {
        VStack(spacing: Space.l) {
            HStack {
                HStack(spacing: 6) {
                    ForEach(0..<steps, id: \.self) { i in
                        Circle().fill(i == step ? Theme.brand : Theme.track).frame(width: 7, height: 7)
                    }
                }
                Spacer()
                if step < steps - 1 { Button("Skip", action: skip).buttonStyle(.borderless) }
            }
            // Side by side when there's room; stacked beside the Assumptions panel.
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: Space.xxl) { picture; words }
                VStack(alignment: .leading, spacing: Space.l) { picture; words }
            }
            .frame(maxWidth: .infinity)
            HStack {
                Button { step = 0 } label: { Image(systemName: "arrow.counterclockwise") }
                    .buttonStyle(.borderless).help("Start over")
                Spacer()
                if step > 0 { Button { step -= 1 } label: { Image(systemName: "arrow.left") }.buttonStyle(.borderless) }
                Button(step == steps - 1 ? "Run simulation" : "Next") {
                    if step == steps - 1 { finish() } else { step += 1 }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .keyboardShortcut(.defaultAction)
            }
        }
        .padding(Space.xxl)
        .card()
    }

    private var picture: some View {
        illustration
            .padding(Space.l)
            .frame(width: 460, height: 300)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.hero, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.hero, style: .continuous).strokeBorder(Theme.border))
            .animation(.snappy, value: step)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: Space.m) { copy }
            .frame(minWidth: 300, maxWidth: 440, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            .font(.title3)
            .foregroundStyle(Theme.textSecondary)
    }

    @ViewBuilder
    private var copy: some View {
        switch step {
        case 0:
            Text("Chance of success").font(.caption.weight(.semibold)).foregroundStyle(Theme.brand)
                .padding(.horizontal, 8).padding(.vertical, 4).background(Theme.brandSoft, in: Capsule())
            Text("A plan follows one smooth path from now to the end, with no volatility baked in.")
            Text("Inflation and growth rates are fixed, and don't vary over time.")
        case 1:
            Text("Markets don't move in straight lines.").foregroundStyle(Theme.text)
            Text("Here's the same plan run through simulated volatility. An early stumble, a hard crash, a long recovery.")
            Text("In this future the plan still makes it. In another, it might not. Drag the volatility slider to see.")
        case 2:
            Text("Wooli tests your plan **1,000 times** — each path has random swings in inflation and growth rates that produce a variety of outcomes.")
        case 3:
            Text("No path is made of typical years. Some draw more good years than bad, others the reverse — and over time, that adds up.")
            Text("Any path that runs out of money to pay for expenses counts as a failed path.")
        default:
            Text("The shaded band is the middle 20% of outcomes — **1 in 5** paths land there each year.")
            Text("Your chance of success is the share of paths that never run short before the end. Change your plan and run it again to see it move.")
        }
    }

    // Illustrative data only — not the user's numbers.
    private var smooth: [(Double, Double)] {
        (0...50).map { i in
            let t = Double(i) / 50
            return (40 + Double(i), 0.3 + 3.1 * (t * t * (3 - 2 * t)))
        }
    }

    private func path(seed: UInt64, vol: Double) -> [(Double, Double)] {
        var rng = ForecastRandom(seed: seed)
        var drift = 0.0
        return smooth.map { x, y in
            drift += rng.normal() * vol * 3
            return (x, max(y * (1 + drift), -0.2))
        }
    }

    @ViewBuilder
    private var illustration: some View {
        switch step {
        case 0:
            demoChart(paths: [], highlight: smooth, band: false) { volatilityBadge(0, interactive: false) }
        case 1:
            demoChart(paths: [], highlight: path(seed: 7, vol: volatility), ghost: smooth, band: false) {
                volatilityBadge(volatility, interactive: true)
            }
        case 2:
            demoChart(paths: (1...60).map { path(seed: $0, vol: 0.06) }, highlight: nil, band: false) {
                Text("**1,000** paths simulated").font(.callout).padding(8).background(Theme.card, in: RoundedRectangle(cornerRadius: 8))
            }
        case 3:
            demoChart(paths: (1...60).map { path(seed: $0, vol: 0.06) }, highlight: nil, band: false, redFailures: true) {
                Text("below $0 — failed").font(.caption).foregroundStyle(Theme.expense)
            }
        default:
            demoChart(paths: (1...60).map { path(seed: $0, vol: 0.06) }, highlight: smooth, band: true) {
                Text("1 in 5 paths in here").font(.caption).foregroundStyle(Theme.textSecondary)
            }
        }
    }

    private func volatilityBadge(_ value: Double, interactive: Bool) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Volatility")
                Spacer()
                Text(ForecastFormat.percent(value)).monospacedDigit()
            }
            .font(.callout)
            if interactive {
                Slider(value: $volatility, in: 0...0.1, step: 0.01).tint(Theme.brand)
            } else {
                Capsule().fill(Theme.track).frame(height: 4).overlay(alignment: .leading) { Circle().fill(Theme.brand).frame(width: 8) }
            }
        }
        .padding(Space.m)
        .frame(width: 220)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.small))
        .shadow(color: Theme.cardShadow, radius: 6, y: 2)
    }

    private func demoChart<Badge: View>(paths: [[(Double, Double)]], highlight: [(Double, Double)]?, ghost: [(Double, Double)]? = nil,
                                        band: Bool, redFailures: Bool = false, @ViewBuilder badge: () -> Badge) -> some View {
        Chart {
            ForEach(paths.indices, id: \.self) { i in
                let failed = redFailures && paths[i].contains { $0.1 <= 0 }
                ForEach(paths[i].indices, id: \.self) { j in
                    LineMark(x: .value("Age", paths[i][j].0), y: .value("$M", paths[i][j].1), series: .value("P", i))
                        .foregroundStyle(failed ? Theme.expense.opacity(0.5) : Theme.textTertiary.opacity(0.35))
                        .lineStyle(StrokeStyle(lineWidth: 0.8))
                }
            }
            if band {
                ForEach(smooth.indices, id: \.self) { j in
                    let (x, y) = smooth[j]
                    AreaMark(x: .value("Age", x), yStart: .value("Low", y * 0.85), yEnd: .value("High", y * 1.15))
                        .foregroundStyle(Theme.textTertiary.opacity(0.35))
                }
            }
            if let ghost {
                ForEach(ghost.indices, id: \.self) { j in
                    LineMark(x: .value("Age", ghost[j].0), y: .value("$M", ghost[j].1), series: .value("P", "ghost"))
                        .foregroundStyle(Theme.textTertiary.opacity(0.5))
                }
            }
            if let highlight {
                ForEach(highlight.indices, id: \.self) { j in
                    LineMark(x: .value("Age", highlight[j].0), y: .value("$M", highlight[j].1), series: .value("P", "plan"))
                        .foregroundStyle(Theme.text)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                }
            }
        }
        .chartYScale(domain: -0.3...6)
        .chartXScale(domain: 40...90)
        .chartXAxis { AxisMarks(values: [40, 50, 60, 70, 80, 90]) { v in AxisValueLabel { Text("Age \(v.as(Int.self) ?? 0)") } } }
        .chartYAxis { AxisMarks(position: .leading, values: [0, 2, 4, 6]) { v in AxisValueLabel { Text("$\(v.as(Int.self) ?? 0)M") } } }
        .overlay(alignment: .bottomTrailing) { badge().padding(Space.m) }
    }
}
#endif
