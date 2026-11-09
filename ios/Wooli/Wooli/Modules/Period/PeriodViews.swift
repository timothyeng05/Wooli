import SwiftUI
import SwiftData

private func entries(_ periods: [Period]) -> [CycleMath.Entry] { periods.map(\.cycleEntry) }

/// Headline + detail for the cycle right now — shared by the Period Home card and Today.
enum PeriodStatus {
    /// `periods` sorted newest first.
    static func text(_ periods: [Period], today: Date = .now) -> (headline: String, detail: String) {
        let list = entries(periods)
        if periods.isEmpty { return ("Log your first period", "Wooli will start predicting after a couple of cycles.") }
        if let current = periods.first, current.isCurrent(today: today) {
            let loggedToday = Calendar.current.isDate(current.end, inSameDayAs: today)
            return ("Period day \(CycleMath.days(from: current.start, to: today) + 1)", loggedToday ? "" : "Add today if it's still going.")
        }
        guard let cycleDay = CycleMath.cycleDay(list, today: today) else { return ("Cycle", "") }
        let nextText: String = {
            guard let next = CycleMath.predictedNextStart(list) else { return "" }
            let daysToNext = CycleMath.days(from: today, to: next)
            if daysToNext > 1 { return "Next period in about \(daysToNext) days" }
            if daysToNext == 1 { return "Next period expected tomorrow" }
            if daysToNext == 0 { return "Next period expected today" }
            return "Period is \(-daysToNext) day\(daysToNext == -1 ? "" : "s") later than predicted"
        }()
        return ("Cycle day \(cycleDay)", nextText)
    }
}
private func flowColor(_ flow: String) -> Color { Color(hex: CycleMath.flowColors[flow] ?? "#ef4444") }

// MARK: - Full screen

struct PeriodView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase
    /// Periods from before Wooli used Apple Health, waiting to move there.
    @Query(sort: \PeriodEntry.startDay, order: .reverse) private var oldEntries: [PeriodEntry]
    @State private var store = PeriodStore.shared
    @State private var month = Calendar.current.dateInterval(of: .month, for: .now)!.start
    @State private var editing: Period?
    @State private var creating = false
    @State private var confirmMove = false

    private var periods: [Period] { store.periods }

    var body: some View {
        Group {
            switch store.access {
            case .checking: Color.clear
            case .unavailable:
                ContentUnavailableView("Apple Health isn't available", systemImage: "heart.text.square",
                                       description: Text("Your cycle lives in Apple Health, which this device doesn't have."))
            case .needsConnect:
                ScrollView {
                    WooliEmptyState(symbol: "heart.text.square", title: "Connect Apple Health",
                                    message: "Wooli reads your cycle from Apple Health and saves what you log there, so it's all in one place. Choose All Recorded Data so predictions can use your history.",
                                    actionTitle: "Connect Apple Health") {
                        Task { await store.connect() }
                    }
                }
            case .connected: content
            }
        }
        .background(Theme.background)
        .navigationTitle("Health")
        .toolbar {
            if store.access == .connected { Button("Log period", systemImage: "plus") { creating = true } }
        }
        .sheet(item: $editing) { PeriodEntryEditor(period: $0) }
        .sheet(isPresented: $creating) { PeriodEntryEditor(period: nil) }
        .task { await store.refresh(sample: app.mode == .sample) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refresh(sample: app.mode == .sample) } }
        }
        .alert("Apple Health", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
        .confirmationDialog("Move \(oldEntries.count) \(oldEntries.count == 1 ? "period" : "periods") to Apple Health?",
                            isPresented: $confirmMove, titleVisibility: .visible) {
            Button("Move to Apple Health") { Task { await store.moveToHealth(oldEntries, context: context) } }
        } message: {
            Text(moveMessage)
        }
    }

    private var moveMessage: String {
        let notes = oldEntries.filter { !$0.note.isEmpty }.count
        let lost = notes == 0 ? "" : " \(notes) \(notes == 1 ? "note" : "notes") can't move, because Health has nowhere to keep them, and will be deleted."
        return "They'll be saved to Apple Health, then deleted from Wooli and your iCloud.\(lost)"
    }

    private var content: some View {
        let list = entries(periods)
        let next = CycleMath.predictedNextStart(list)

        return ScrollView {
            VStack(spacing: 16) {
                hero(list)
                if !oldEntries.isEmpty, app.mode != .sample { moveCard }
                if let current = periods.first, current.isCurrent(), !Calendar.current.isDateInToday(current.end) {
                    Button("Add today") { Task { await store.addToday(to: current) } }
                        .buttonStyle(WooliButtonStyle(level: .secondary))
                }
                Text("Period").font(.title3.bold()).frame(maxWidth: .infinity, alignment: .leading)
                VStack(spacing: 12) {
                    HStack {
                        Button("Previous month", systemImage: "chevron.left") { shift(-1) }.labelStyle(.iconOnly)
                        Spacer()
                        Text(month.formatted(.dateTime.month(.wide).year())).font(.headline)
                        Spacer()
                        Button("Next month", systemImage: "chevron.right") { shift(1) }.labelStyle(.iconOnly)
                    }
                    CycleCalendar(month: month, periods: periods)
                    HStack(spacing: 14) {
                        Legend(color: WooliModule.period.tint, dashed: false, label: "Logged")
                        Legend(color: WooliModule.period.tint, dashed: true, label: "Predicted")
                        Legend(color: Theme.brand, dashed: false, ring: true, label: "Today")
                    }
                    .font(.caption)
                }
                .card()

                HStack(spacing: 12) {
                    Stat(label: "Average cycle", value: "\(CycleMath.averageCycleLength(list)) days")
                    Stat(label: "Average period", value: "\(CycleMath.averagePeriodLength(list)) days")
                    Stat(label: "Next start", value: next.map { $0.formatted(.dateTime.month(.abbreviated).day()) } ?? "—")
                }
                if list.count < 2 {
                    Text("Predictions appear once Apple Health has two periods.")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    CardHeader(title: "History")
                    if periods.isEmpty {
                        Text("Nothing in Apple Health yet. If you've logged periods there, check Wooli's access in Settings → Health → Data Access & Devices.")
                            .font(.subheadline).foregroundStyle(Theme.textTertiary)
                    }
                    ForEach(periods) { p in
                        Button { editing = p } label: { historyRow(p) }
                            .buttonStyle(.plain)
                            .disabled(!p.isEditable)
                    }
                }
                .card()
            }
            .padding(16)
        }
    }

    private var moveCard: some View {
        VStack(alignment: .leading, spacing: Space.s) {
            Text("Move your periods to Apple Health").font(.headline).foregroundStyle(Theme.text)
            Text("Wooli now keeps your cycle in Apple Health. You have \(oldEntries.count) older \(oldEntries.count == 1 ? "period" : "periods") to bring across.")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
            Button("Move periods") { confirmMove = true }
                .buttonStyle(WooliButtonStyle(level: .primary))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func historyRow(_ p: Period) -> some View {
        HStack {
            Circle().fill(flowColor(p.flow.isEmpty ? "medium" : p.flow)).frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(range(p)).foregroundStyle(Theme.text)
                if !p.symptoms.isEmpty {
                    Text(p.symptoms.joined(separator: ", ")).font(.caption).foregroundStyle(Theme.textTertiary)
                }
                if !p.isEditable {
                    Text("Edit in the Health app").font(.caption).foregroundStyle(Theme.textTertiary)
                }
            }
            Spacer()
            let length = CycleMath.days(from: p.start, to: p.end) + 1
            Text("\(length) \(length == 1 ? "day" : "days")")
                .font(.subheadline).foregroundStyle(Theme.textSecondary)
            if p.isEditable {
                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
        .contentShape(Rectangle())
    }

    /// Where you are in the cycle, as a road from day 1 to about the average length.
    private func hero(_ list: [CycleMath.Entry]) -> some View {
        let status = PeriodStatus.text(periods)
        let current = periods.first?.isCurrent() ?? false
        return HeroCard(eyebrow: "Cycle") {
            Text(status.headline).wooliFont(.amount)
            if !status.detail.isEmpty { Text(status.detail).font(.footnote) }
            if !current, list.count >= 2, let day = CycleMath.cycleDay(list, today: .now) {
                let length = max(CycleMath.averageCycleLength(list), 1)
                RouteProgress(progress: Double(day) / Double(length), startLabel: "Day 1",
                              middleLabel: "Day \(day)", endLabel: "About day \(length)")
            }
        }
    }

    private func range(_ p: Period) -> String {
        let start = p.start.formatted(.dateTime.month(.abbreviated).day())
        return p.start == p.end ? start : "\(start) – \(p.end.formatted(.dateTime.month(.abbreviated).day()))"
    }

    private func shift(_ n: Int) {
        withAnimation { month = Calendar.current.date(byAdding: .month, value: n, to: month)! }
    }
}

private struct Stat: View {
    let label: String
    let value: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionLabel(label)
            Text(value).font(.headline).foregroundStyle(Theme.text).minimumScaleFactor(0.8).lineLimit(1)
        }
        .card(padding: 12)
    }
}

private struct Legend: View {
    let color: Color
    let dashed: Bool
    var ring = false
    let label: String
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(ring || dashed ? Color.clear : color.opacity(0.85))
                .overlay(Circle().strokeBorder(color, style: StrokeStyle(lineWidth: 1.5, dash: dashed ? [3, 2] : [])))
                .frame(width: 12, height: 12)
            Text(label).foregroundStyle(Theme.textSecondary)
        }
    }
}

/// Month grid: logged days filled with flow color, predicted days dashed, today ringed.
struct CycleCalendar: View {
    let month: Date
    let periods: [Period]

    var body: some View {
        let cal = Calendar.current
        let list = entries(periods)
        let daysInMonth = cal.range(of: .day, in: .month, for: month)!.count
        let leading = (cal.component(.weekday, from: month) - cal.firstWeekday + 7) % 7
        let symbols = cal.veryShortStandaloneWeekdaySymbols
        let ordered = Array(symbols[(cal.firstWeekday - 1)...] + symbols[..<(cal.firstWeekday - 1)])
        let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)
        // One list of cells: separate ForEach loops in a grid share ids, and days 1–6 vanish.
        let cells: [Int?] = Array(repeating: nil, count: leading) + (1...daysInMonth).map(Optional.some)

        VStack(spacing: 6) {
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(Array(ordered.enumerated()), id: \.offset) { _, s in
                    Text(s).font(.caption2.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                }
            }
            LazyVGrid(columns: columns, spacing: 6) {
                ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                    if let day {
                        dayCell(day, list: list)
                    } else {
                        Color.clear.frame(height: 34)
                    }
                }
            }
        }
    }

    private func dayCell(_ day: Int, list: [CycleMath.Entry]) -> some View {
        let cal = Calendar.current
        let date = cal.date(byAdding: .day, value: day - 1, to: month)!
        let logged = periods.first { p in CycleMath.isPeriodDay(date, in: [p.cycleEntry]) }
        let predicted = logged == nil && CycleMath.isPredictedDay(date, in: list)
        let isToday = cal.isDateInToday(date)
        return ZStack {
            if let logged {
                Circle().fill(flowColor(logged.flow.isEmpty ? "medium" : logged.flow))
            } else if predicted {
                Circle().strokeBorder(WooliModule.period.tint, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2]))
            }
            if isToday { Circle().strokeBorder(Theme.brand, lineWidth: 2).padding(-2) }
            Text("\(day)").font(.subheadline.weight(isToday ? .bold : .regular))
                .foregroundStyle(logged != nil ? .white : Theme.text)
        }
        .frame(width: 34, height: 34)
        .accessibilityLabel("\(date.formatted(date: .abbreviated, time: .omitted))\(logged != nil ? ", period" : predicted ? ", predicted" : "")")
    }
}

// MARK: - Editor

struct PeriodEntryEditor: View {
    /// nil to create.
    let period: Period?
    @Environment(\.dismiss) private var dismiss
    @State private var store = PeriodStore.shared
    @State private var start = Date.now
    @State private var end = Date.now
    @State private var flow = ""
    @State private var symptoms: [String] = []
    @State private var loaded = false
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Started", selection: $start, in: ...Date.now, displayedComponents: .date)
                    DatePicker("Ended", selection: $end, in: start...Date.now, displayedComponents: .date)
                } footer: {
                    Text("Saved to Apple Health.")
                }
                Section("Flow") {
                    Picker("Flow", selection: $flow) {
                        Text("—").tag("")
                        Text("Light").tag("light")
                        Text("Medium").tag("medium")
                        Text("Heavy").tag("heavy")
                    }
                    .pickerStyle(.segmented)
                }
                Section("Symptoms") {
                    FlowLayout(spacing: 8) {
                        ForEach(CycleMath.symptoms, id: \.self) { s in
                            Chip(label: s.capitalized, selected: symptoms.contains(s)) {
                                if symptoms.contains(s) { symptoms.removeAll { $0 == s } } else { symptoms.append(s) }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                if period != nil {
                    Section {
                        Button("Delete", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(period == nil ? "Log period" : "Edit period")
            .inlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
            .confirmationDialog("Delete this period?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        if let period { await store.delete(period) }
                        dismiss()
                    }
                }
            } message: {
                Text("This also removes it from Apple Health.")
            }
        }
        .onChange(of: start) { _, new in if end < new { end = new } }
        .onAppear {
            guard !loaded, let period else { loaded = true; return }
            loaded = true
            start = period.start
            end = period.end
            flow = period.flow
            symptoms = period.symptoms
        }
    }

    private func save() {
        Task {
            if await store.save(start: start, end: end, flow: flow, symptoms: symptoms, replacing: period) { dismiss() }
        }
    }
}
