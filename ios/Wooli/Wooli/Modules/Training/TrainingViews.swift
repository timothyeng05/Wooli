import SwiftUI
import Charts
import MapKit

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
                TrainingDashboard(record: record, trend: trend, routes: folder.routes)
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
    let routes: [Int: [CLLocationCoordinate2D]]
    @State private var selected: Int?
    @State private var camera: MapCameraPosition = .automatic

    private var ins: TrainingInsights { record.insights }
    private var today: TrainingSnapshot.Markers { record.snapshot.today }
    /// Newest first.
    private var activities: [TrainingSnapshot.Activity] {
        (record.snapshot.activities ?? []).sorted { ($0.start ?? $0.date) > ($1.start ?? $1.date) }
    }
    private var mapped: [TrainingSnapshot.Activity] { activities.filter { routes[$0.id] != nil } }
    private var selectedActivity: TrainingSnapshot.Activity? { activities.first { $0.id == selected } }

    var body: some View {
        GeometryReader { geo in
        HStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.l) {
                    hero
                    activityList
                    HStack(alignment: .top, spacing: Space.l) { recovery; week }
                    HStack(alignment: .top, spacing: Space.l) { heatmap; trends }
                    footer
                }
                .padding(Space.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(width: min(760, max(560, geo.size.width * 0.5)))
            Divider()
            routeMap.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        }
        .background(Theme.background)
        .onAppear { if selected == nil { select(mapped.first?.id ?? activities.first?.id) } }
    }

    private func select(_ id: Int?) {
        selected = id
        guard let id, let coords = routes[id] else { return }
        withAnimation(.easeInOut(duration: 0.6)) { camera = Self.fit(coords) }
    }

    private static func fit(_ coords: [CLLocationCoordinate2D]) -> MapCameraPosition {
        let lats = coords.map(\.latitude), lons = coords.map(\.longitude)
        let center = CLLocationCoordinate2D(latitude: (lats.min()! + lats.max()!) / 2, longitude: (lons.min()! + lons.max()!) / 2)
        let span = MKCoordinateSpan(latitudeDelta: max((lats.max()! - lats.min()!) * 1.5, 0.005),
                                    longitudeDelta: max((lons.max()! - lons.min()!) * 1.5, 0.005))
        return .region(MKCoordinateRegion(center: center, span: span))
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

    // MARK: Activities — a calm, date-grouped list; picking one shows it on the map

    private var activityList: some View {
        let recent = Array(activities.prefix(8))
        let days = recent.reduce(into: [String]()) { if !$0.contains($1.date) { $0.append($1.date) } }
        return VStack(alignment: .leading, spacing: Space.m) {
            CardHeader(title: "Activities", subtitle: "\(mapped.count) with a route · pick one to see it on the map")
            ForEach(days, id: \.self) { day in
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text(Self.dayLabel(day)).wooliFont(.eyebrow).foregroundStyle(Theme.textTertiary)
                    ForEach(recent.filter { $0.date == day }) { a in activityRow(a) }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card(padding: Space.l)
    }

    private func activityRow(_ a: TrainingSnapshot.Activity) -> some View {
        let on = a.id == selected
        return Button { select(a.id) } label: {
            HStack(spacing: Space.m) {
                SportTile(sport: a.sport)
                VStack(alignment: .leading, spacing: 2) {
                    Text(a.name ?? Sport.name(a.sport)).font(.body.weight(.medium)).foregroundStyle(Theme.text)
                    Text(Self.statsLine(a)).font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                if let hr = a.avgHeartRate {
                    Text("\(Int(hr)) bpm").font(.subheadline.monospacedDigit()).foregroundStyle(Theme.textSecondary)
                }
                Image(systemName: routes[a.id] != nil ? "map" : "map.slash")
                    .foregroundStyle(routes[a.id] != nil ? Theme.accentTeal : Theme.textTertiary)
                    .help(routes[a.id] != nil ? "Show route" : "No GPS route")
            }
            .padding(.horizontal, Space.s).padding(.vertical, Space.s)
            .background(on ? Theme.brandSoft : .clear, in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    // MARK: Map — sticky on the right, every route faint, the picked one bold

    private var routeMap: some View {
        Map(position: $camera) {
            ForEach(mapped.filter { $0.id != selected }) { a in
                MapPolyline(coordinates: routes[a.id] ?? [])
                    .stroke(Theme.accentTeal.opacity(0.3), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            }
            if let id = selected, let coords = routes[id], let first = coords.first, let last = coords.last {
                MapPolyline(coordinates: coords)
                    .stroke(Theme.accentTeal, style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                Annotation("Start", coordinate: first) { RouteDot(filled: false) }
                Annotation("Finish", coordinate: last) { RouteDot(filled: true) }
            }
        }
        .mapStyle(.standard(pointsOfInterest: .excludingAll))
        .overlay(alignment: .topLeading) {
            if let a = selectedActivity { RouteSummary(activity: a, hasRoute: routes[a.id] != nil).padding(Space.l) }
        }
        .overlay {
            if mapped.isEmpty {
                ContentUnavailableView("Routes show up here", systemImage: "map",
                                       description: Text("Your next garmin-mcp snapshot saves the GPS route of each ride and run."))
                    .frame(maxWidth: 360)
                    .card()
            }
        }
    }

    // MARK: Recovery — value against target as a thin bar, Copilot-style

    private var recovery: some View {
        let known = ins.checks.values.compactMap(\.met)
        return VStack(alignment: .leading, spacing: Space.m) {
            CardHeader(title: "Recovery", subtitle: known.isEmpty ? "Last night" : "Last night · \(known.filter { $0 }.count) of \(known.count) on target")
            gaugeRow("Sleep", value: today.sleep?.sleepDurationHours, text: today.sleep?.sleepDurationHours.map { String(format: "%.1f h", $0) },
                     check: ins.checks["sleepHours"], targetText: ins.checks["sleepHours"]?.target.map { String(format: "%.1f h", $0) })
            gaugeRow("Sleep score", value: today.sleep?.sleepScore.map(Double.init), text: today.sleep?.sleepScore.map(String.init),
                     check: ins.checks["sleepScore"], targetText: ins.checks["sleepScore"]?.target.map { "\(Int($0))" })
            gaugeRow("Body Battery charged", value: today.bodyBattery?.charged.map(Double.init), text: today.bodyBattery?.charged.map(String.init),
                     check: ins.checks["bodyBatteryCharged"], targetText: ins.checks["bodyBatteryCharged"]?.target.map { "\(Int($0))" })
            gaugeRow("HRV", value: today.hrv?.lastNightAvg.map(Double.init), text: today.hrv?.lastNightAvg.map { "\($0) ms" },
                     check: ins.checks["hrv"], total: today.hrv?.baselineHigh.map(Double.init),
                     targetText: today.hrv?.baselineLow.flatMap { low in today.hrv?.baselineHigh.map { "\(low)–\($0) ms" } })
            gaugeRow("Resting heart rate", value: nil, text: today.restingHeartRate.map { "\(Int($0)) bpm" }, check: nil, targetText: nil)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .card(padding: Space.l)
    }

    private func gaugeRow(_ title: String, value: Double?, text: String?, check: TrainingInsights.Check?,
                          total: Double? = nil, targetText: String?) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.subheadline).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text(text ?? "—").font(.subheadline.weight(.semibold).monospacedDigit()).foregroundStyle(Theme.text)
            }
            if let value, let target = total ?? check?.target {
                BarGauge(value: value, total: target, tint: check?.met == false ? Theme.pending : Theme.accentTeal, height: 6)
            }
            if let targetText {
                Text("Target \(targetText)").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
    }

    // MARK: Week

    private var week: some View {
        let sports = ["swim", "bike", "run", "strength", "other"].filter { ins.week.bySport[$0] != nil }
        let totalMinutes = ins.week.bySport.values.reduce(0) { $0 + $1.minutes }
        let totalKm = ins.week.bySport.values.reduce(0) { $0 + $1.km }
        return VStack(alignment: .leading, spacing: Space.m) {
            CardHeader(title: "This week", subtitle: "Last 7 days")
            HStack(alignment: .firstTextBaseline, spacing: Space.s) {
                Text("\(ins.week.sessions)").wooliFont(.amount).foregroundStyle(Theme.text)
                Text(ins.week.sessions == 1 ? "session" : "sessions").font(.subheadline).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text("\(Self.duration(totalMinutes))\(totalKm > 0 ? String(format: " · %.1f km", totalKm) : "")")
                    .font(.subheadline.monospacedDigit()).foregroundStyle(Theme.textSecondary)
            }
            ForEach(sports, id: \.self) { key in
                let s = ins.week.bySport[key]!
                VStack(alignment: .leading, spacing: Space.xs) {
                    HStack {
                        Label(Sport.name(key), systemImage: Sport.symbol(key)).font(.subheadline).foregroundStyle(Theme.text)
                        Spacer()
                        Text("\(s.sessions)× · \(Self.duration(s.minutes))\(s.km > 0 ? String(format: " · %.1f km", s.km) : "")")
                            .font(.caption.monospacedDigit()).foregroundStyle(Theme.textSecondary)
                    }
                    BarGauge(value: s.minutes, total: totalMinutes, tint: Theme.accentTeal, height: 6)
                }
            }
            Divider()
            easyShare
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .card(padding: Space.l)
    }

    private var easyShare: some View {
        let pct = Double(ins.week.easySharePct ?? 0)
        let target = Double(ins.week.easyShareTarget)
        return VStack(alignment: .leading, spacing: Space.xs) {
            HStack {
                Text("Easy-zone share").font(.subheadline).foregroundStyle(Theme.textSecondary)
                Spacer()
                Text(ins.week.easySharePct.map { "\($0)%" } ?? "—").font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(pct >= target ? Theme.text : Theme.pending)
            }
            BarGauge(value: pct, total: 100, tint: pct >= target ? Theme.accentTeal : Theme.pending, height: 6)
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Capsule().fill(Theme.text).frame(width: 2, height: 12)
                            .offset(x: g.size.width * target / 100 - 1, y: -3)
                    }
                }
            Text("Target \(Int(target))% in zones 1–2 · Zone 2: \(Int(ins.week.zone2Minutes)) min")
                .font(.caption).foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: Heat map

    private var heatmap: some View {
        let days = ins.heatmap
        let weeks = stride(from: 0, to: days.count, by: 7).map { Array(days[$0..<min($0 + 7, days.count)]) }
        let active = days.filter { $0.minutes > 0 }.count
        return VStack(alignment: .leading, spacing: Space.m) {
            CardHeader(title: "Workout days", subtitle: "\(active) of the last \(days.count) days")
            HStack(alignment: .top, spacing: Space.xs) {
                ForEach(weeks.indices, id: \.self) { w in
                    VStack(spacing: Space.xs) {
                        ForEach(weeks[w]) { day in HeatCell(minutes: day.minutes)
                            .help("\(day.date): \(day.minutes) min \(day.sports.joined(separator: ", "))")
                            .accessibilityLabel("\(day.date), \(day.minutes) minutes")
                        }
                    }
                }
            }
            HStack(spacing: Space.xs) {
                Text("Less").font(.caption).foregroundStyle(Theme.textTertiary)
                ForEach([0, 20, 45, 90], id: \.self) { HeatCell(minutes: $0) }
                Text("More").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .card(padding: Space.l)
    }

    // MARK: Trends

    private var trends: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            CardHeader(title: "Sleep", subtitle: trend.count < 2 ? "Builds up one night at a time" : "Last \(trend.count) nights")
            if trend.count < 2 {
                Text("Wooli draws sleep and resting heart rate once there are two days of snapshots.")
                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
            } else {
                Chart {
                    ForEach(trend.filter { $0.sleepHours != nil }) { p in
                        AreaMark(x: .value("Night", p.date, unit: .day), y: .value("Sleep (h)", p.sleepHours!))
                            .foregroundStyle(LinearGradient(colors: [Theme.accentTeal.opacity(0.25), Theme.accentTeal.opacity(0)],
                                                            startPoint: .top, endPoint: .bottom))
                        LineMark(x: .value("Night", p.date, unit: .day), y: .value("Sleep (h)", p.sleepHours!))
                            .foregroundStyle(Theme.accentTeal).interpolationMethod(.catmullRom)
                    }
                    if let target = ins.checks["sleepHours"]?.target {
                        RuleMark(y: .value("Target", target)).lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                            .foregroundStyle(Theme.textTertiary)
                    }
                }
                .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated).day()) } }
                .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) }
                .frame(height: 140)
                Chart(trend.filter { $0.restingHR != nil }) { p in
                    LineMark(x: .value("Night", p.date, unit: .day), y: .value("Resting HR", p.restingHR!))
                        .foregroundStyle(Theme.accentSlate).interpolationMethod(.catmullRom)
                }
                .chartXAxis(.hidden)
                .chartYAxis { AxisMarks(position: .leading, values: .automatic(desiredCount: 2)) }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 70)
                Text("Resting heart rate (bpm)").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .card(padding: Space.l)
    }

    @ViewBuilder private var footer: some View {
        if let synced = record.snapshot.lastSynced {
            Text("From your garmin-mcp snapshot · \(synced.prefix(16).replacingOccurrences(of: "T", with: " ")) · stays on this Mac")
                .font(.footnote).foregroundStyle(Theme.textTertiary)
        }
    }

    // MARK: Formatting

    static func duration(_ minutes: Double) -> String {
        let m = Int(minutes.rounded())
        return m >= 60 ? "\(m / 60) h \(m % 60) min" : "\(m) min"
    }

    static func statsLine(_ a: TrainingSnapshot.Activity) -> String {
        var parts: [String] = []
        if let d = a.durationMinutes { parts.append(duration(d)) }
        if let km = a.distanceKm, km > 0 { parts.append(String(format: "%.1f km", km)) }
        if let pace = pace(a) { parts.append(pace) }
        return parts.joined(separator: " · ")
    }

    /// km/h for rides, min/km for runs, min/100 m for swims.
    static func pace(_ a: TrainingSnapshot.Activity) -> String? {
        guard let km = a.distanceKm, km > 0, let min = a.durationMinutes, min > 0 else { return nil }
        switch a.sport {
        case "bike": return String(format: "%.1f km/h", km / (min / 60))
        case "run":
            let p = min / km
            return String(format: "%d:%02d /km", Int(p), Int((p - Double(Int(p))) * 60))
        case "swim":
            let p = min / (km * 10)
            return String(format: "%d:%02d /100 m", Int(p), Int((p - Double(Int(p))) * 60))
        default: return nil
        }
    }

    static func dayLabel(_ day: String) -> String {
        guard let date = DateFormatter.trainingDay.date(from: day) else { return day.uppercased() }
        if Calendar.current.isDateInToday(date) { return "TODAY" }
        if Calendar.current.isDateInYesterday(date) { return "YESTERDAY" }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()).uppercased()
    }
}

private enum Sport {
    static func symbol(_ s: String?) -> String {
        switch s {
        case "bike": "figure.outdoor.cycle"
        case "run": "figure.run"
        case "swim": "figure.open.water.swim"
        case "strength": "dumbbell.fill"
        default: "figure.mixed.cardio"
        }
    }
    static func name(_ s: String?) -> String {
        switch s {
        case "bike": "Bike"
        case "run": "Run"
        case "swim": "Swim"
        case "strength": "Strength"
        default: "Workout"
        }
    }
}

private struct SportTile: View {
    let sport: String?
    var body: some View {
        Image(systemName: Sport.symbol(sport))
            .font(.body.weight(.semibold))
            .foregroundStyle(Theme.accentTeal)
            .frame(width: 36, height: 36)
            .background(Theme.accentTeal.opacity(0.14), in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
            .accessibilityLabel(Sport.name(sport))
    }
}

private struct HeatCell: View {
    let minutes: Int
    var body: some View {
        RoundedRectangle(cornerRadius: Space.xs, style: .continuous)
            .fill(minutes == 0 ? Theme.track : Theme.accentTeal.opacity(0.3 + 0.7 * min(Double(minutes) / 90, 1)))
            .frame(width: 18, height: 18)
    }
}

private struct RouteDot: View {
    let filled: Bool
    var body: some View {
        Circle().fill(filled ? Theme.accentTeal : Theme.card)
            .frame(width: 14, height: 14)
            .overlay(Circle().strokeBorder(filled ? Theme.card : Theme.accentTeal, lineWidth: 3))
            .shadow(color: Theme.cardShadow, radius: 2)
    }
}

/// The floating card over the map: the picked activity at a glance (Expedia's overlay card).
private struct RouteSummary: View {
    let activity: TrainingSnapshot.Activity
    let hasRoute: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Space.m) {
            HStack(spacing: Space.m) {
                SportTile(sport: activity.sport)
                VStack(alignment: .leading, spacing: 2) {
                    Text(activity.name ?? Sport.name(activity.sport)).font(.headline).foregroundStyle(Theme.text)
                    Text(TrainingDashboard.dayLabel(activity.date).capitalized).font(.caption).foregroundStyle(Theme.textSecondary)
                }
            }
            HStack(spacing: Space.xl) {
                stat("Distance", activity.distanceKm.flatMap { $0 > 0 ? String(format: "%.1f km", $0) : nil })
                stat("Time", activity.durationMinutes.map(TrainingDashboard.duration))
                stat(activity.sport == "bike" ? "Avg speed" : "Pace", TrainingDashboard.pace(activity))
                stat("Avg HR", activity.avgHeartRate.map { "\(Int($0)) bpm" })
            }
            if !hasRoute {
                Text("No GPS route for this one (indoor or pool).").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(Space.l)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radius.card, style: .continuous).strokeBorder(Theme.border))
        .shadow(color: Theme.cardShadow, radius: 12, y: 2)
    }

    @ViewBuilder private func stat(_ label: String, _ value: String?) -> some View {
        if let value {
            VStack(alignment: .leading, spacing: 2) {
                Text(label.uppercased()).wooliFont(.eyebrow).foregroundStyle(Theme.textTertiary)
                Text(value).font(.body.weight(.semibold).monospacedDigit()).foregroundStyle(Theme.text)
            }
        }
    }
}
#endif
