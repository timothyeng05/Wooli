import SwiftUI
import SwiftData
import Charts

private func moodColor(_ score: Int) -> Color { Color(hex: MoodScale.colorHex[score] ?? "#eab308") }

// MARK: - Home card

struct MoodHomeCard: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \MoodEntry.day, order: .reverse) private var moods: [MoodEntry]
    @State private var lock = ModuleLock.shared
    @State private var editing: MoodEntry?
    @State private var logged = 0

    var body: some View {
        if lock.isLocked(.mood) {
            NavigationLink { moduleScreen(.mood) } label: { LockedModuleCard(module: .mood) }
                .buttonStyle(.plain)
        } else {
            card
        }
    }

    private var card: some View {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        let todayEntry = moods.first { $0.day == today }
        let byDay = Dictionary(moods.map { ($0.day, $0.score) }, uniquingKeysWith: { a, _ in a })

        return VStack(alignment: .leading, spacing: 12) {
            NavigationLink { moduleScreen(.mood) } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        SectionLabel("Mood")
                        if let todayEntry {
                            Text("Today: \(MoodScale.emoji[todayEntry.score] ?? "") \(MoodScale.label[todayEntry.score] ?? "")")
                                .font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                        } else {
                            Text("How are you today?").font(.title3.weight(.semibold)).foregroundStyle(Theme.text)
                        }
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(Theme.textTertiary)
                }
            }
            .buttonStyle(.plain)

            HStack(spacing: 8) {
                ForEach(1...5, id: \.self) { score in
                    Button {
                        MoodScale.log(score: score, context: context)
                        logged += 1
                    } label: {
                        Text(MoodScale.emoji[score] ?? "")
                            .font(.system(size: 28))
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(todayEntry?.score == score ? moodColor(score).opacity(0.2) : Theme.track,
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .strokeBorder(todayEntry?.score == score ? moodColor(score) : .clear, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Log mood: \(MoodScale.label[score] ?? "")")
                }
            }
            .sensoryFeedback(.success, trigger: logged)

            HStack {
                // Last 7 days, oldest first.
                HStack(spacing: 6) {
                    ForEach((0..<7).reversed(), id: \.self) { back in
                        let day = cal.date(byAdding: .day, value: -back, to: today)!
                        Circle()
                            .fill(byDay[day].map(moodColor) ?? Theme.track)
                            .frame(width: 10, height: 10)
                            .accessibilityLabel("\(day.formatted(.dateTime.weekday(.wide))): \(byDay[day].flatMap { MoodScale.label[$0] } ?? "not logged")")
                    }
                }
                Text("Last 7 days").font(.caption).foregroundStyle(Theme.textTertiary)
                Spacer()
                if let todayEntry {
                    Button(todayEntry.note.isEmpty ? "Add note" : "Edit note") { editing = todayEntry }
                        .font(.footnote.weight(.semibold))
                }
            }
        }
        .card(padding: 16)
        .sheet(item: $editing) { MoodEntryEditor(entry: $0) }
    }
}

// MARK: - Full screen

struct MoodView: View {
    @Query(sort: \MoodEntry.day, order: .reverse) private var moods: [MoodEntry]
    @State private var month = Calendar.current.dateInterval(of: .month, for: .now)!.start
    @State private var editing: MoodEntry?
    @State private var logging = false

    var body: some View {
        let cal = Calendar.current
        let since = cal.date(byAdding: .day, value: -29, to: cal.startOfDay(for: .now))!
        let recent = moods.filter { $0.day >= since }.sorted { $0.day < $1.day }
        let average = recent.isEmpty ? nil : Double(recent.reduce(0) { $0 + $1.score }) / Double(recent.count)

        ScrollView {
            VStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    CardHeader(title: "Last 30 days", subtitle: average.map { "Average \(String(format: "%.1f", $0)) · \(recent.count) days logged" })
                    if recent.isEmpty {
                        Text("Log a mood to start your chart.").font(.subheadline).foregroundStyle(Theme.textTertiary)
                    } else {
                        Chart(recent, id: \.id) { entry in
                            LineMark(x: .value("Day", entry.day, unit: .day), y: .value("Mood", entry.score))
                                .foregroundStyle(Theme.textTertiary.opacity(0.5))
                                .interpolationMethod(.monotone)
                            PointMark(x: .value("Day", entry.day, unit: .day), y: .value("Mood", entry.score))
                                .foregroundStyle(moodColor(entry.score))
                                .symbolSize(60)
                        }
                        .chartYScale(domain: 1...5)
                        .chartYAxis {
                            AxisMarks(values: [1, 2, 3, 4, 5]) { value in
                                AxisGridLine().foregroundStyle(Theme.border)
                                AxisValueLabel { if let v = value.as(Int.self) { Text(MoodScale.emoji[v] ?? "") } }
                            }
                        }
                        .chartXScale(domain: since...Date.now)
                        .frame(height: 170)
                    }
                }
                .card()

                VStack(spacing: 12) {
                    HStack {
                        Button("Previous month", systemImage: "chevron.left") { shift(-1) }.labelStyle(.iconOnly)
                        Spacer()
                        Text(month.formatted(.dateTime.month(.wide).year())).font(.headline)
                        Spacer()
                        Button("Next month", systemImage: "chevron.right") { shift(1) }.labelStyle(.iconOnly)
                    }
                    MoodCalendar(month: month, moods: moods) { editing = $0 }
                }
                .card()

                TagPatternsCard(moods: moods)

                VStack(alignment: .leading, spacing: 10) {
                    CardHeader(title: "History")
                    if moods.isEmpty { Text("Nothing logged yet.").font(.subheadline).foregroundStyle(Theme.textTertiary) }
                    ForEach(moods.prefix(30)) { m in
                        Button { editing = m } label: {
                            HStack(spacing: 10) {
                                Text(MoodScale.emoji[m.score] ?? "").font(.title3)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(m.day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()))
                                        .foregroundStyle(Theme.text)
                                    if !m.tags.isEmpty || !m.note.isEmpty {
                                        Text(([m.tags.joined(separator: ", ")] + [m.note]).filter { !$0.isEmpty }.joined(separator: " · "))
                                            .font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(1)
                                    }
                                }
                                Spacer()
                                Text(MoodScale.label[m.score] ?? "").font(.subheadline).foregroundStyle(moodColor(m.score))
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
        .navigationTitle("Mood")
        .toolbar {
            Button("Log mood", systemImage: "plus") { logging = true }
        }
        .sheet(item: $editing) { MoodEntryEditor(entry: $0) }
        .sheet(isPresented: $logging) { MoodEntryEditor(entry: nil) }
    }

    private func shift(_ n: Int) {
        withAnimation { month = Calendar.current.date(byAdding: .month, value: n, to: month)! }
    }
}

private struct MoodCalendar: View {
    let month: Date
    let moods: [MoodEntry]
    let onSelect: (MoodEntry) -> Void

    var body: some View {
        let cal = Calendar.current
        let byDay = Dictionary(moods.map { ($0.day, $0) }, uniquingKeysWith: { a, _ in a })
        let daysInMonth = cal.range(of: .day, in: .month, for: month)!.count
        let leading = (cal.component(.weekday, from: month) - cal.firstWeekday + 7) % 7
        let symbols = cal.veryShortStandaloneWeekdaySymbols
        let ordered = Array(symbols[(cal.firstWeekday - 1)...] + symbols[..<(cal.firstWeekday - 1)])

        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 6) {
            ForEach(Array(ordered.enumerated()), id: \.offset) { _, s in
                Text(s).font(.caption2.weight(.semibold)).foregroundStyle(Theme.textTertiary)
            }
            ForEach(0..<leading, id: \.self) { _ in Color.clear.frame(height: 34) }
            ForEach(1...daysInMonth, id: \.self) { day in
                let date = cal.date(byAdding: .day, value: day - 1, to: month)!
                let entry = byDay[date]
                Button {
                    if let entry { onSelect(entry) }
                } label: {
                    ZStack {
                        if let entry { Circle().fill(moodColor(entry.score).opacity(0.85)) }
                        if cal.isDateInToday(date) { Circle().strokeBorder(Theme.brand, lineWidth: 2).padding(-2) }
                        Text("\(day)").font(.subheadline).foregroundStyle(entry != nil ? .white : Theme.text)
                    }
                    .frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .disabled(entry == nil)
            }
        }
    }
}

/// Which tags show up on good (4–5) vs. bad (1–2) days — simple counts.
private struct TagPatternsCard: View {
    let moods: [MoodEntry]

    var body: some View {
        let good = counts(moods.filter { $0.score >= 4 })
        let bad = counts(moods.filter { $0.score <= 2 })
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Patterns", subtitle: "Tags on your good and bad days")
            if good.isEmpty && bad.isEmpty {
                Text("Add tags when you log (sleep, work, exercise…) to see what goes with good and bad days.")
                    .font(.footnote).foregroundStyle(Theme.textTertiary)
            } else {
                row(title: "\(MoodScale.emoji[5]!) Good days", items: good)
                row(title: "\(MoodScale.emoji[1]!) Bad days", items: bad)
            }
        }
        .card()
    }

    private func counts(_ entries: [MoodEntry]) -> [(String, Int)] {
        var c: [String: Int] = [:]
        for e in entries { for t in e.tags { c[t, default: 0] += 1 } }
        return c.sorted { $0.value == $1.value ? $0.key < $1.key : $0.value > $1.value }.prefix(4).map { ($0.key, $0.value) }
    }

    @ViewBuilder
    private func row(title: String, items: [(String, Int)]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Theme.text)
            if items.isEmpty {
                Text("No tags yet").font(.caption).foregroundStyle(Theme.textTertiary)
            } else {
                FlowLayout(spacing: 6) {
                    ForEach(items, id: \.0) { tag, count in
                        Text("\(tag) · \(count)").font(.caption.weight(.medium))
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(Theme.track, in: Capsule())
                    }
                }
            }
        }
    }
}

// MARK: - Editor

struct MoodEntryEditor: View {
    /// nil = log for a chosen day.
    let entry: MoodEntry?
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query private var moods: [MoodEntry]
    @State private var day = Date.now
    @State private var score = 3
    @State private var tags: [String] = []
    @State private var note = ""
    @State private var newTag = ""
    @State private var loaded = false
    @State private var confirmDelete = false

    var body: some View {
        let allTags = Array(Set(MoodScale.defaultTags + moods.flatMap(\.tags) + tags)).sorted()
        NavigationStack {
            Form {
                if entry == nil {
                    DatePicker("Day", selection: $day, in: ...Date.now, displayedComponents: .date)
                }
                Section("How was it?") {
                    HStack {
                        ForEach(1...5, id: \.self) { s in
                            Button { score = s } label: {
                                VStack(spacing: 2) {
                                    Text(MoodScale.emoji[s] ?? "").font(.system(size: 30))
                                    Text(MoodScale.label[s] ?? "").font(.caption2).foregroundStyle(Theme.textSecondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 6)
                                .background(score == s ? moodColor(s).opacity(0.2) : .clear, in: RoundedRectangle(cornerRadius: 10))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                Section("Tags") {
                    FlowLayout(spacing: 8) {
                        ForEach(allTags, id: \.self) { t in
                            Chip(label: t, selected: tags.contains(t)) {
                                if tags.contains(t) { tags.removeAll { $0 == t } } else { tags.append(t) }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                    HStack {
                        TextField("New tag", text: $newTag).textInputAutocapitalization(.never)
                        Button("Add") {
                            let t = newTag.trimmingCharacters(in: .whitespaces).lowercased()
                            if !t.isEmpty && !tags.contains(t) { tags.append(t) }
                            newTag = ""
                        }
                        .disabled(newTag.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
                Section("Note") {
                    TextField("What happened today?", text: $note, axis: .vertical)
                }
                if entry != nil {
                    Section { Button("Delete", role: .destructive) { confirmDelete = true } }
                }
            }
            .navigationTitle(entry.map { $0.day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()) } ?? "Log mood")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
            .confirmationDialog("Delete this mood?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    if let entry { context.delete(entry) }
                    try? context.save()
                    dismiss()
                }
            }
        }
        .onAppear {
            guard !loaded else { return }
            loaded = true
            if let entry { day = entry.day; score = entry.score; tags = entry.tags; note = entry.note }
        }
    }

    private func save() {
        // Logging for a day that already has an entry updates that entry.
        let target = entry ?? MoodScale.log(score: score, on: day, context: context)
        target.score = score
        target.tags = tags
        target.note = note
        target.updatedAt = .now
        try? context.save()
        dismiss()
    }
}
