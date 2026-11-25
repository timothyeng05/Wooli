#if os(macOS)
import SwiftUI
import SwiftData

/// Budget → Forecast: a long-range plan of net worth through retirement, with
/// life events, scenarios and a Monte Carlo "chance of success". Mac only.
struct ForecastView: View {
    enum Page: String, CaseIterable, Identifiable {
        case plan = "Plan", compare = "Compare", chance = "Chance of success"
        var id: String { rawValue }
    }

    @Environment(\.modelContext) private var context
    @Query(sort: \ForecastScenario.createdAt) private var scenarios: [ForecastScenario]
    @Query private var accounts: [LocalAccount]
    @Query private var transactions: [LocalTransaction]
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @Query(sort: \Person.name) private var people: [Person]

    @AppStorage("forecast.selectedScenario") private var selectedId = ""
    @AppStorage("forecast.seenChanceIntro") private var seenChanceIntro = false
    @State private var page: Page = .plan
    @State private var plan = ForecastPlan()
    @State private var loadedId = ""
    @State private var showAssumptions = true
    @State private var setup: SetupRequest?
    @State private var editingEvent: ForecastEvent?
    @State private var simulation: ForecastEngine.Simulation?
    @State private var isSimulating = false
    /// Latest simulation started; older ones finishing late are ignored.
    @State private var simulationRun = 0
    @State private var compareId = ""

    struct SetupRequest: Identifiable { let id = UUID() }

    private var scenario: ForecastScenario? {
        scenarios.first { $0.id == selectedId } ?? scenarios.first
    }

    private var actuals: ForecastSeed.Actuals {
        ForecastSeed.actuals(transactions: transactions, categories: categories, accounts: accounts)
    }

    var body: some View {
        Group {
            if scenarios.isEmpty {
                ForecastSetupFlow(people: people, accounts: accounts, actuals: actuals, isFirst: true) { finish($0) }
            } else {
                workspace
            }
        }
        .background(Theme.background)
        .sheet(item: $setup) { _ in
            ForecastSetupFlow(people: people, accounts: accounts, actuals: actuals, isFirst: false,
                              onCancel: { setup = nil }) { finish($0); setup = nil }
                .frame(minWidth: 640, minHeight: 640)
        }
        .sheet(item: $editingEvent) { event in
            ForecastEventEditor(event: event, plan: plan,
                                isNew: !plan.events.contains { $0.id == event.id }) { saved in
                if let saved {
                    if let i = plan.events.firstIndex(where: { $0.id == saved.id }) { plan.events[i] = saved } else { plan.events.append(saved) }
                } else {
                    plan.events.removeAll { $0.id == event.id }
                }
                editingEvent = nil
            } onCancel: { editingEvent = nil }
        }
        .onChange(of: scenario?.id, initial: true) { _, _ in load() }
        .onChange(of: plan) { _, new in save(new) }
    }

    // MARK: Workspace

    private var workspace: some View {
        // A plain side column rather than `.inspector`: an inspector inside the
        // Mac shell's split view loops on its size limits and crashes AppKit.
        HStack(spacing: 0) {
            main
            if showAssumptions {
                Divider()
                ForecastAssumptions(plan: $plan, actualSpending: actuals.spending, onClose: { showAssumptions = false })
                    // The Mac shell centres page content with scroll margins;
                    // the side panel must not inherit them or it collapses.
                    .contentMargins(.horizontal, 0, for: .scrollContent)
                    .frame(width: 360)
                    .transition(.move(edge: .trailing))
            }
        }
        .toolbar {
            ToolbarItem {
                Button("Assumptions", systemImage: "slider.horizontal.3") {
                    withAnimation(.snappy) { showAssumptions.toggle() }
                }
                .help("Edit assumptions")
            }
        }
    }

    private var main: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(spacing: Space.l) {
                    switch page {
                    case .plan:
                        ForecastPlanPage(plan: $plan, onEditEvent: { editingEvent = $0 })
                    case .compare:
                        ForecastComparePage(plan: plan, scenarios: scenarios.filter { $0.id != scenario?.id },
                                            compareId: $compareId, onDuplicate: duplicate)
                    case .chance:
                        ForecastChancePage(plan: plan, simulation: simulation, isRunning: isSimulating,
                                           seenIntro: $seenChanceIntro, run: runSimulation,
                                           onApply: { plan = $0 },
                                           onSaveScenario: { finish($0); page = .plan })
                            // Live: re-run shortly after any change to the plan.
                            .task(id: plan) {
                                guard seenChanceIntro, simulation?.plan != plan else { return }
                                try? await Task.sleep(for: .milliseconds(simulation == nil ? 0 : 350))
                                guard !Task.isCancelled else { return }
                                runSimulation()
                            }
                    }
                    Text("Estimates only, not guarantees or personalized investment, tax or financial advice. Results depend on your assumptions and may differ materially.")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(Space.xl)
            }
        }
        .frame(minWidth: 640)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Space.m) {
        HStack(spacing: Space.m) {
            Text("Forecasting").font(.title2.weight(.bold)).foregroundStyle(Theme.text).fixedSize()
            scenarioMenu
            Spacer(minLength: Space.m)
            if let scenario {
                TimelineView(.periodic(from: .now, by: 30)) { _ in
                    Text("Saved \(scenario.updatedAt.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundStyle(Theme.textTertiary)
                        .lineLimit(1)
                        .fixedSize()
                }
            }
        }
        HStack(spacing: Space.m) {
            Picker("Page", selection: $page) {
                ForEach(Page.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            Spacer(minLength: Space.m)
            if page == .plan {
                addEventMenu
            } else if page == .chance, seenChanceIntro {
                Button { runSimulation() } label: {
                    Label(simulation == nil ? "Run simulation" : "Run again", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSimulating)
            }
        }
        }
        .padding(.horizontal, Space.xl)
        .padding(.vertical, Space.m)
    }

    private var scenarioMenu: some View {
        Menu {
            Section("Scenarios") {
                ForEach(scenarios) { s in
                    Button {
                        selectedId = s.id
                    } label: {
                        if s.id == scenario?.id { Label(s.plan.name, systemImage: "checkmark") } else { Text(s.plan.name) }
                    }
                }
            }
            Divider()
            Button("Start from scratch…", systemImage: "plus") { setup = SetupRequest() }
            Button("Duplicate scenario", systemImage: "plus.square.on.square") { duplicate() }
            Button("Refresh balances from accounts", systemImage: "arrow.clockwise") {
                ForecastSeed.refreshBalances(&plan, from: accounts)
            }
            if scenarios.count > 1 {
                Divider()
                Button("Delete \(plan.name)", systemImage: "trash", role: .destructive) { deleteCurrent() }
            }
        } label: {
            Label(plan.name, systemImage: plan.icon)
                .font(.callout.weight(.semibold))
        }
        .menuStyle(.button)
        .buttonStyle(.bordered)
        .buttonBorderShape(.capsule)
        .fixedSize()
    }

    private var addEventMenu: some View {
        Menu {
            ForEach(ForecastEventKind.allCases) { kind in
                Button {
                    var e = ForecastEvent.template(kind, year: ForecastEngine.startYear() + 5)
                    e.ownerId = plan.primaryPerson?.id
                    editingEvent = e
                } label: {
                    Label(kind.label, systemImage: kind.symbol)
                }
            }
        } label: {
            Label("Add event", systemImage: "plus")
        }
        .menuStyle(.button)
        .buttonStyle(.borderedProminent)
        .fixedSize()
    }

    // MARK: Persistence

    private func load() {
        guard let scenario else { return }
        var p = scenario.plan
        if p.useActualExpenses {
            let spent = actuals.spending.rounded()
            if spent > 0 { p.yearlyExpenses = spent }
        }
        ForecastSeed.refreshBalances(&p, from: accounts)
        loadedId = scenario.id
        selectedId = scenario.id
        simulation = nil
        plan = p
    }

    private func save(_ new: ForecastPlan) {
        guard let scenario, scenario.id == loadedId, scenario.plan != new else { return }
        scenario.plan = new
        try? context.save()
    }

    private func finish(_ new: ForecastPlan) {
        let s = ForecastScenario(plan: new)
        context.insert(s)
        try? context.save()
        selectedId = s.id
    }

    private func duplicate() {
        var copy = plan
        copy.name = "\(plan.name) copy"
        finish(copy)
        page = .plan
    }

    private func deleteCurrent() {
        guard let scenario else { return }
        context.delete(scenario)
        try? context.save()
        selectedId = scenarios.first { $0.id != scenario.id }?.id ?? ""
    }

    private func runSimulation() {
        let snapshot = plan
        simulationRun += 1
        let run = simulationRun
        isSimulating = true
        Task {
            let result = await Task.detached(priority: .userInitiated) {
                ForecastEngine.simulate(snapshot, seed: UInt64.random(in: 1...UInt64.max))
            }.value
            guard run == simulationRun else { return }
            simulation = result
            isSimulating = false
        }
    }
}

// MARK: - Shared bits

enum ForecastFormat {
    /// "$23.2K", "$1.02M", "-$16.3K".
    static func money(_ value: Double) -> String {
        let a = abs(value)
        let sign = value < -0.5 ? "-" : ""
        switch a {
        case 1_000_000...: return sign + "$" + String(format: "%.2fM", a / 1_000_000)
        case 10_000...: return sign + "$" + String(format: a >= 100_000 ? "%.0fK" : "%.1fK", a / 1_000)
        case 1_000...: return sign + "$" + String(format: "%.1fK", a / 1_000)
        default: return sign + "$" + String(format: "%.0f", a)
        }
    }

    static func percent(_ value: Double) -> String {
        let p = (value * 1000).rounded() / 10
        return p == p.rounded() ? "\(Int(p))%" : String(format: "%.1f%%", p)
    }
}

/// A person's round avatar: their emoji, or the first letter on their colour.
struct ForecastAvatar: View {
    let person: ForecastPerson
    var size: CGFloat = 26

    var body: some View {
        ZStack {
            Circle().fill(Color(hex: person.colorHex))
            if person.emoji.isEmpty {
                Text(person.name.prefix(1).uppercased())
                    .font(.system(size: size * 0.5, weight: .semibold))
                    .foregroundStyle(.white)
            } else {
                Text(person.emoji).font(.system(size: size * 0.6))
            }
        }
        .frame(width: size, height: size)
    }
}

/// The small rounded icon used for events on the chart and in lists.
struct ForecastEventIcon: View {
    /// End of plan: a small ghost, drawn here since SF Symbols has none.
    static let ghost = "wooli.ghost"

    let symbol: String
    let color: Color
    var size: CGFloat = 26

    var body: some View {
        Group {
            if symbol == Self.ghost {
                GhostGlyph(color: color).frame(width: size * 0.5, height: size * 0.56)
            } else {
                Image(systemName: symbol).font(.system(size: size * 0.5, weight: .semibold))
            }
        }
        .foregroundStyle(color)
        .frame(width: size, height: size)
        .background(color.opacity(0.16), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

/// Outline ghost: domed head, wavy hem, two eyes.
private struct GhostGlyph: View {
    let color: Color

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            ZStack {
                GhostShape().stroke(color, style: StrokeStyle(lineWidth: max(w * 0.13, 1.4), lineJoin: .round))
                HStack(spacing: w * 0.22) {
                    Capsule().fill(color).frame(width: w * 0.14, height: w * 0.2)
                    Capsule().fill(color).frame(width: w * 0.14, height: w * 0.2)
                }
                .position(x: w / 2, y: h * 0.42)
            }
        }
    }
}

private struct GhostShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        let w = r.width, h = r.height, x = r.minX, y = r.minY
        let radius = w / 2
        p.move(to: CGPoint(x: x, y: y + h * 0.9))
        p.addLine(to: CGPoint(x: x, y: y + radius))
        p.addArc(center: CGPoint(x: x + radius, y: y + radius), radius: radius,
                 startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        p.addLine(to: CGPoint(x: x + w, y: y + h * 0.9))
        // Three scallops along the hem.
        let step = w / 3
        for i in 0..<3 {
            let endX = x + w - step * CGFloat(i + 1)
            p.addQuadCurve(to: CGPoint(x: endX, y: y + h * 0.9),
                           control: CGPoint(x: endX + step / 2, y: y + h * (i % 2 == 0 ? 1.08 : 0.72)))
        }
        p.closeSubpath()
        return p
    }
}
#endif
