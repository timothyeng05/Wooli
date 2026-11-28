import SwiftUI
import Charts

/// The Health app's root. On the Mac it adds a Training section that reads the user's own
/// garmin-mcp snapshots; on iPhone it's the cycle view as before (Training there will come
/// from Apple Health workouts, BACKLOG H7).
struct HealthRootView: View {
    #if os(macOS)
    enum Section: String, CaseIterable { case training = "Training", cycle = "Cycle" }
    @AppStorage("health.section") private var section: Section = .training

    var body: some View {
        VStack(spacing: 0) {
            Picker("Section", selection: $section) {
                ForEach(Section.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(maxWidth: 260)
            .padding(.vertical, Space.s)
            switch section {
            case .training: TrainingView()
            case .cycle: PeriodView()
            }
        }
        .background(Theme.background)
    }
    #else
    var body: some View { PeriodView() }
    #endif
}

#if os(macOS)
struct TrainingView: View {
    @State private var folder = TrainingFolder.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch folder.state {
            case .needsFolder:
                ScrollView {
                    WooliEmptyState(symbol: "figure.run", title: "Connect your Garmin snapshots",
                                    message: "Wooli can show your training from your own garmin-mcp setup on this Mac. Choose its folder once; Wooli only reads it, and nothing leaves this Mac.",
                                    actionTitle: "Choose folder") { folder.chooseFolder() }
                }
            case .failed(let message):
                ContentUnavailableView {
                    Label("Can't read your snapshots", systemImage: "exclamationmark.triangle")
                } description: { Text(message) } actions: {
                    Button("Try again") { folder.reload() }
                    Button("Choose folder") { folder.chooseFolder() }
                }
            case .loaded(let record, let trend):
                TrainingDashboard(record: record, trend: trend)
            }
        }
        .navigationTitle("Health")
        .toolbar {
            ToolbarItemGroup {
                Button { folder.reload() } label: { Label("Refresh", systemImage: "arrow.clockwise") }
                    .disabled(!folder.hasFolder)
                Menu {
                    Button("Choose snapshot folder…") { folder.chooseFolder() }
                    Button("Disconnect folder", role: .destructive) { folder.forgetFolder() }.disabled(!folder.hasFolder)
                } label: { Label("Training settings", systemImage: "ellipsis.circle") }
            }
        }
        .task { folder.reload() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { folder.reload() } }
    }
}

private struct TrainingDashboard: View {
    let record: TrainingRecord
    let trend: [TrainingTrendPoint]
    private var ins: TrainingInsights { record.insights }
    private var today: TrainingSnapshot.Markers { record.snapshot.today }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                hero
                HStack(alignment: .top, spacing: Space.l) {
                    VStack(alignment: .leading, spacing: Space.l) { recovery; week }
                    VStack(alignment: .leading, spacing: Space.l) { heatmap; trends }
                }
                if let synced = record.snapshot.lastSynced {
                    Text("From your garmin-mcp snapshot · \(synced.prefix(16).replacingOccurrences(of: "T", with: " ")) · stays on this Mac")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }
            }
            .padding(Space.xl)
            .readableContentWidth(ReadableWidth.dashboard)
        }
        .pageBackground()
    }

    // MARK: Hero — today's call

    private var hero: some View {
        HeroCard(eyebrow: "TODAY · \(ins.location.uppercased())\(ins.raining == true ? " · RAIN" : "")") {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Space.s) {
                    Label(ins.verdict.title, systemImage: ins.verdict.symbol).font(.title.weight(.bold))
                    Text(ins.sessionLine).font(.title3)
                    ForEach(ins.today.notes, id: \.self) { Text($0).font(.subheadline).opacity(0.85) }
                }
                Spacer()
                if let race = ins.race {
                    VStack(alignment: .trailing, spacing: Space.xs) {
                        Text(raceCount(race)).wooliFont(.display)
                        Text(race.name).font(.footnote).multilineTextAlignment(.trailing).frame(maxWidth: 220, alignment: .trailing)
                        if race.dateTBA == true { Text("Exact date not announced").font(.caption).opacity(0.75) }
                    }
                }
            }
        }
    }

    private func raceCount(_ r: TrainingInsights.Race) -> String {
        if let weeks = r.days.map({ $0 / 7 }) { return "\(weeks) wk" }
        if let m = r.months { return "\(m) mo" }
        return "—"
    }

    // MARK: Recovery

    private var recovery: some View {
        card(SectionBand(title: "Recovery", summary: "Last night", badge: .symbol("moon.zzz.fill"), group: .health)) {
            row("Sleep", value: today.sleep?.sleepDurationHours.map { String(format: "%.1f h", $0) },
                target: ins.checks["sleepHours"]?.target.map { String(format: "%.1f h", $0) }, met: ins.checks["sleepHours"]?.met)
            ItemRowDivider()
            row("Sleep score", value: today.sleep?.sleepScore.map(String.init),
                target: ins.checks["sleepScore"]?.target.map { "\(Int($0))" }, met: ins.checks["sleepScore"]?.met)
            ItemRowDivider()
            row("Body Battery charged", value: today.bodyBattery?.charged.map(String.init),
                target: ins.checks["bodyBatteryCharged"]?.target.map { "\(Int($0))" }, met: ins.checks["bodyBatteryCharged"]?.met)
            ItemRowDivider()
            row("HRV last night", value: today.hrv?.lastNightAvg.map { "\($0) ms" },
                target: today.hrv?.baselineLow.flatMap { low in today.hrv?.baselineHigh.map { "\(low)–\($0) ms" } },
                met: ins.checks["hrv"]?.met)
            ItemRowDivider()
            row("Resting heart rate", value: today.restingHeartRate.map { "\(Int($0)) bpm" }, target: nil, met: nil)
        }
    }

    private func row(_ title: String, value: String?, target: String?, met: Bool?) -> some View {
        ItemRow(title: title, subtitle: target.map { Text("Target \($0)") }) {
            Image(systemName: met == nil ? "circle.dashed" : (met! ? "checkmark.circle.fill" : "exclamationmark.circle.fill"))
                .font(.title3)
                .foregroundStyle(met == nil ? Theme.textTertiary : (met! ? Theme.accentTeal : Theme.pending))
                .accessibilityLabel(met == nil ? "No target" : (met! ? "Met" : "Short"))
        } trailing: {
            Text(value ?? "—").font(.body.weight(.semibold).monospacedDigit()).foregroundStyle(Theme.text)
        }
    }

    // MARK: Week

    private static let sportNames = ["swim": "🏊 Swim", "bike": "🚴 Bike", "run": "🏃 Run", "strength": "🏋️ Gym S&C", "other": "Other"]

    private var week: some View {
        card(SectionBand(title: "Last 7 days", summary: "\(ins.week.sessions) session\(ins.week.sessions == 1 ? "" : "s")",                         badge: .number(ins.week.sessions), group: .health)) {
            ForEach(["swim", "bike", "run", "strength", "other"].filter { ins.week.bySport[$0] != nil }, id: \.self) { key in
                let s = ins.week.bySport[key]!
                ItemRow(title: Self.sportNames[key] ?? key,
                        subtitle: Text("\(s.sessions) × · \(Int(s.minutes)) min\(s.km > 0 ? String(format: " · %.1f km", s.km) : "")")) {
                    EmptyView()
                } trailing: { EmptyView() }
                ItemRowDivider()
            }
            ItemRow(title: "Easy-zone share",
                    subtitle: Text("Zone 1–2 time, target \(ins.week.easyShareTarget)% · Zone 2: \(Int(ins.week.zone2Minutes)) min")) {
                EmptyView()
            } trailing: {
                Text(ins.week.easySharePct.map { "\($0)%" } ?? "—")
                    .font(.body.weight(.semibold).monospacedDigit())
                    .foregroundStyle((ins.week.easySharePct ?? 100) >= ins.week.easyShareTarget ? Theme.text : Theme.pending)
            }
        }
    }

    // MARK: Heat map — the summary that's fine to show anywhere

    private var heatmap: some View {
        let days = ins.heatmap
        let weeks = stride(from: 0, to: days.count, by: 7).map { Array(days[$0..<min($0 + 7, days.count)]) }
        let active = days.filter { $0.minutes > 0 }.count
        return card(SectionBand(title: "Workout days", summary: "\(active) of the last \(days.count) days", badge: .symbol("square.grid.3x3.fill"), group: .health)) {
            HStack(alignment: .top, spacing: 4) {
                ForEach(weeks.indices, id: \.self) { w in
                    VStack(spacing: 4) {
                        ForEach(weeks[w]) { day in
                            RoundedRectangle(cornerRadius: 3, style: .continuous)
                                .fill(day.minutes == 0 ? Theme.track : Theme.accentTeal.opacity(0.35 + 0.65 * min(Double(day.minutes) / 90, 1)))
                                .frame(width: 16, height: 16)
                                .help("\(day.date): \(day.minutes) min \(day.sports.joined(separator: ", "))")
                                .accessibilityLabel("\(day.date), \(day.minutes) minutes")
                        }
                    }
                }
            }
            .padding(.vertical, Space.m)
            Text("Darker squares are longer sessions. Columns are weeks, oldest on the left.")
                .font(.footnote).foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: Trends

    private var trends: some View {
        card(SectionBand(title: "Trends", summary: trend.count < 2 ? "Builds up one night at a time" : "Last \(trend.count) nights",                         badge: .symbol("chart.xyaxis.line"), group: .health)) {
            if trend.count < 2 {
                Text("Wooli draws sleep and resting heart rate once there are two days of snapshots.")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary).padding(.vertical, Space.m)
            } else {
                Chart {
                    ForEach(trend) { p in
                        if let h = p.sleepHours {
                            LineMark(x: .value("Night", p.date, unit: .day), y: .value("Sleep (h)", h))
                                .foregroundStyle(by: .value("Metric", "Sleep (h)"))
                        }
                    }
                    if let target = ins.checks["sleepHours"]?.target {
                        RuleMark(y: .value("Target", target)).lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            .foregroundStyle(Theme.textTertiary)
                    }
                }
                .chartForegroundStyleScale(["Sleep (h)": Theme.accentTeal])
                .frame(height: 140)
                .padding(.vertical, Space.s)
                Chart(trend.filter { $0.restingHR != nil }) { p in
                    LineMark(x: .value("Night", p.date, unit: .day), y: .value("Resting HR", p.restingHR!))
                        .foregroundStyle(by: .value("Metric", "Resting HR (bpm)"))
                }
                .chartForegroundStyleScale(["Resting HR (bpm)": Theme.accentSlate])
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 110)
            }
        }
    }

    private func card<B: View, C: View>(_ band: B, @ViewBuilder _ content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            band
            VStack(alignment: .leading, spacing: 0) { content() }.padding(.horizontal, Space.l)
        }
        .padding(.bottom, Space.s)
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .background(Theme.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).stroke(Theme.border))
            .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}
#endif
