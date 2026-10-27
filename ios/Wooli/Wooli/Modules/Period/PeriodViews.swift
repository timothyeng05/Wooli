import SwiftUI
import SwiftData

private func entries(_ periods: [PeriodEntry]) -> [CycleMath.Entry] { periods.map(\.cycleEntry) }

/// Headline + detail for the cycle right now — shared by the Period Home card and Today.
enum PeriodStatus {
    /// `periods` sorted newest first.
    static func text(_ periods: [PeriodEntry], today: Date = .now) -> (headline: String, detail: String) {
        let list = entries(periods)
        if periods.isEmpty { return ("Log your first period", "Wooli will start predicting after a couple of cycles.") }
        if let ongoing = periods.first(where: { $0.endDay == nil }) {
            return ("Period day \(CycleMath.days(from: ongoing.startDay, to: today) + 1)", "Tap \"Period ended\" when it's over.")
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
    @Environment(\.modelContext) private var context
    @Query(sort: \PeriodEntry.startDay, order: .reverse) private var periods: [PeriodEntry]
    @State private var month = Calendar.current.dateInterval(of: .month, for: .now)!.start
    @State private var editing: PeriodEntry?
    @State private var creating = false

    var body: some View {
        let list = entries(periods)
        let next = CycleMath.predictedNextStart(list)

        ScrollView {
            VStack(spacing: 16) {
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
                    Text("Predictions appear after you've logged two periods.")
                        .font(.footnote).foregroundStyle(Theme.textTertiary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    CardHeader(title: "History")
                    if periods.isEmpty {
                        Text("No periods logged yet.").font(.subheadline).foregroundStyle(Theme.textTertiary)
                    }
                    ForEach(periods) { p in
                        Button { editing = p } label: {
                            HStack {
                                Circle().fill(flowColor(p.flowRaw.isEmpty ? "medium" : p.flowRaw)).frame(width: 10, height: 10)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(range(p)).foregroundStyle(Theme.text)
                                    if !p.symptoms.isEmpty {
                                        Text(p.symptoms.joined(separator: ", ")).font(.caption).foregroundStyle(Theme.textTertiary)
                                    }
                                }
                                Spacer()
                                Text(p.endDay == nil ? "Ongoing" : "\(CycleMath.days(from: p.startDay, to: p.endDay!) + 1) days")
                                    .font(.subheadline).foregroundStyle(Theme.textSecondary)
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Theme.textTertiary)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .card()
            }
            .padding(16)
        }
        .background(Theme.background)
        .navigationTitle("Health")
        .toolbar {
            Button("Log period", systemImage: "plus") { creating = true }
        }
        .sheet(item: $editing) { PeriodEntryEditor(entry: $0) }
        .sheet(isPresented: $creating) { PeriodEntryEditor(entry: nil) }
    }

    private func range(_ p: PeriodEntry) -> String {
        let start = p.startDay.formatted(.dateTime.month(.abbreviated).day())
        guard let end = p.endDay else { return "\(start) – now" }
        return "\(start) – \(end.formatted(.dateTime.month(.abbreviated).day()))"
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
    let periods: [PeriodEntry]

    var body: some View {
        let cal = Calendar.current
        let list = entries(periods)
        let daysInMonth = cal.range(of: .day, in: .month, for: month)!.count
        let leading = (cal.component(.weekday, from: month) - cal.firstWeekday + 7) % 7
        let symbols = cal.veryShortStandaloneWeekdaySymbols
        let ordered = Array(symbols[(cal.firstWeekday - 1)...] + symbols[..<(cal.firstWeekday - 1)])
        let columns = Array(repeating: GridItem(.flexible(), spacing: 4), count: 7)

        LazyVGrid(columns: columns, spacing: 6) {
            ForEach(Array(ordered.enumerated()), id: \.offset) { _, s in
                Text(s).font(.caption2.weight(.semibold)).foregroundStyle(Theme.textTertiary)
            }
            ForEach(0..<leading, id: \.self) { i in Color.clear.frame(height: 34).id("pad\(i)") }
            ForEach(1...daysInMonth, id: \.self) { day in
                let date = cal.date(byAdding: .day, value: day - 1, to: month)!
                let logged = periods.first { p in CycleMath.isPeriodDay(date, in: [p.cycleEntry]) }
                let predicted = logged == nil && CycleMath.isPredictedDay(date, in: list)
                let isToday = cal.isDateInToday(date)
                ZStack {
                    if let logged {
                        Circle().fill(flowColor(logged.flowRaw.isEmpty ? "medium" : logged.flowRaw))
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
    }
}

// MARK: - Editor

struct PeriodEntryEditor: View {
    /// nil to create.
    let entry: PeriodEntry?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @State private var start = Date.now
    @State private var ongoing = true
    @State private var end = Date.now
    @State private var flow = ""
    @State private var symptoms: [String] = []
    @State private var note = ""
    @State private var loaded = false
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    DatePicker("Started", selection: $start, in: ...Date.now, displayedComponents: .date)
                    Toggle("Still going", isOn: $ongoing.animation())
                    if !ongoing {
                        DatePicker("Ended", selection: $end, in: start...Date.now, displayedComponents: .date)
                    }
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
                Section("Note") {
                    TextField("Add a note", text: $note, axis: .vertical)
                }
                if entry != nil {
                    Section {
                        Button("Delete", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(entry == nil ? "Log period" : "Edit period")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
            .confirmationDialog("Delete this period?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    if let entry { context.delete(entry) }
                    try? context.save()
                    dismiss()
                }
            }
        }
        .onAppear {
            guard !loaded, let entry else { loaded = true; return }
            loaded = true
            start = entry.startDay
            ongoing = entry.endDay == nil
            end = entry.endDay ?? .now
            flow = entry.flowRaw
            symptoms = entry.symptoms
            note = entry.note
        }
    }

    private func save() {
        let target = entry ?? {
            let e = PeriodEntry(startDay: start)
            context.insert(e)
            return e
        }()
        target.startDay = Calendar.current.startOfDay(for: start)
        target.endDay = ongoing ? nil : Calendar.current.startOfDay(for: max(end, start))
        target.flowRaw = flow
        target.symptoms = symptoms
        target.note = note
        target.updatedAt = .now
        try? context.save()
        dismiss()
    }
}
