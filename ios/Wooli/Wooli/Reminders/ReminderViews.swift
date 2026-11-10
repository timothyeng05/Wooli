import SwiftUI

/// What's due, grouped the way you'd act on it. Shared by the Reminders screen and Today.
enum ReminderBuckets {
    enum Bucket: CaseIterable {
        case overdue, today, upcoming, noDate

        var title: String {
            switch self {
            case .overdue: "Overdue"
            case .today: "Today"
            case .upcoming: "Upcoming"
            case .noDate: "No date"
            }
        }

        var symbol: String {
            switch self {
            case .overdue: "exclamationmark"
            case .today: "sun.max.fill"
            case .upcoming: "calendar"
            case .noDate: "tray.fill"
            }
        }
    }

    /// A reminder due on an earlier day, or earlier today at a set time, is overdue.
    static func bucket(_ r: Reminder, now: Date = .now) -> Bucket {
        guard let due = r.due else { return .noDate }
        let cal = Calendar.current
        if cal.isDate(due, inSameDayAs: now) { return r.hasTime && due < now ? .overdue : .today }
        return due < now ? .overdue : .upcoming
    }

    /// Open reminders that are overdue or due today.
    static func dueNow(_ reminders: [Reminder], now: Date = .now) -> [Reminder] {
        reminders.filter { !$0.isCompleted && [.overdue, .today].contains(bucket($0, now: now)) }
    }

    static func dueText(_ r: Reminder, now: Date = .now) -> String? {
        guard let due = r.due else { return nil }
        let cal = Calendar.current
        let time = r.hasTime ? due.formatted(date: .omitted, time: .shortened) : nil
        let day: String
        if cal.isDateInToday(due) { day = "Today" }
        else if cal.isDateInTomorrow(due) { day = "Tomorrow" }
        else if cal.isDateInYesterday(due) { day = "Yesterday" }
        else if cal.isDate(due, equalTo: now, toGranularity: .year) { day = due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()) }
        else { day = due.formatted(.dateTime.month(.abbreviated).day().year()) }
        return [day, time].compactMap { $0 }.joined(separator: " ")
    }
}

// MARK: - Overview

struct RemindersView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.scenePhase) private var scenePhase
    @State private var store = ReminderStore.shared
    /// nil shows every list.
    @State private var listFilter: String?
    @State private var editing: Reminder?
    @State private var creating = false

    var body: some View {
        Group {
            switch store.access {
            case .checking: Color.clear
            case .needsConnect:
                ScrollView {
                    WooliEmptyState(symbol: "checklist", title: "Connect Apple Reminders",
                                    message: "Wooli shows your reminders from Apple Reminders and saves changes there, so Siri, the Reminders app and your other devices stay in step.",
                                    actionTitle: "Connect Reminders") {
                        Task { await store.connect() }
                    }
                }
            case .denied:
                ContentUnavailableView("Wooli can't see your reminders", systemImage: "checklist",
                                       description: Text(Self.deniedHelp))
            case .connected: content
            }
        }
        .background(Theme.background)
        .navigationTitle("Reminders")
        .toolbar {
            if store.access == .connected {
                ToolbarItem(placement: .primaryAction) {
                    Button("New reminder", systemImage: "plus") { creating = true }
                }
                if store.lists.count > 1 {
                    ToolbarItem(placement: .primaryAction) { filterMenu }
                }
            }
        }
        .sheet(item: $editing) { ReminderEditor(reminder: $0) }
        .sheet(isPresented: $creating) { ReminderEditor(reminder: nil, listID: listFilter) }
        .task { await store.refresh(sample: app.mode == .sample) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refresh(sample: app.mode == .sample) } }
        }
        .alert("Apple Reminders", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
    }

    #if os(macOS)
    private static let deniedHelp = "Turn on Wooli in System Settings → Privacy & Security → Reminders."
    #else
    private static let deniedHelp = "Choose Full Access in Settings → Apps → Wooli → Reminders."
    #endif

    private var filterMenu: some View {
        Menu {
            Picker("List", selection: $listFilter) {
                Text("All lists").tag(String?.none)
                ForEach(store.lists) { Text($0.title).tag(Optional($0.id)) }
            }
        } label: {
            Label("Lists", systemImage: listFilter == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
        }
    }

    private var shown: [Reminder] {
        store.reminders.filter { listFilter == nil || $0.listID == listFilter }
    }

    private var content: some View {
        let reminders = shown
        let grouped = Dictionary(grouping: reminders) { ReminderBuckets.bucket($0) }
        return ScrollView {
            VStack(spacing: Space.l) {
                hero(reminders)
                if reminders.isEmpty {
                    WooliEmptyState(symbol: "checklist", title: "Add a reminder",
                                    message: "It's saved to Apple Reminders, so it shows up there and on your other devices too.",
                                    actionTitle: "New reminder") { creating = true }
                        .card()
                }
                ForEach(ReminderBuckets.Bucket.allCases, id: \.self) { bucket in
                    if let items = grouped[bucket], !items.isEmpty {
                        section(bucket, items: sorted(items))
                    }
                }
            }
            .padding(Space.l)
        }
        .readableContentWidth()
        .refreshable { await store.refresh(sample: app.mode == .sample) }
    }

    /// Soonest first; no-date reminders by title.
    private func sorted(_ items: [Reminder]) -> [Reminder] {
        items.sorted { a, b in
            if let x = a.due, let y = b.due, x != y { return x < y }
            if (a.due == nil) != (b.due == nil) { return a.due != nil }
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }
    }

    private func hero(_ reminders: [Reminder]) -> some View {
        let open = reminders.filter { !$0.isCompleted }
        let due = ReminderBuckets.dueNow(open)
        let overdue = open.filter { ReminderBuckets.bucket($0) == .overdue }.count
        let week = Calendar.current.date(byAdding: .day, value: 7, to: Calendar.current.startOfDay(for: .now))!
        let thisWeek = open.filter { ReminderBuckets.bucket($0) == .upcoming && ($0.due ?? .distantFuture) < week }.count
        let headline = due.isEmpty ? "All clear" : "\(due.count) due"
        let detail = [overdue > 0 ? "\(overdue) overdue" : nil,
                      thisWeek > 0 ? "\(thisWeek) more this week" : nil,
                      open.isEmpty ? "Nothing to do" : "\(open.count) open"].compactMap { $0 }
        return HeroCard(eyebrow: "Today") {
            Text(headline).wooliFont(.amount)
            Text(detail.joined(separator: " · ")).font(.footnote)
        }
    }

    private func section(_ bucket: ReminderBuckets.Bucket, items: [Reminder]) -> some View {
        let open = items.filter { !$0.isCompleted }.count
        return VStack(spacing: Space.m) {
            SectionBand(title: bucket.title, summary: "\(open) open", badge: .symbol(bucket.symbol))
            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, reminder in
                    if index > 0 { ItemRowDivider() }
                    row(reminder)
                }
            }
            .card(padding: Space.m)
        }
    }

    private func row(_ r: Reminder) -> some View {
        let list = store.list(r.listID)
        let facts = [listFilter == nil ? list?.title : nil, ReminderBuckets.dueText(r),
                     r.repeats == .never ? nil : "Repeats"].compactMap { $0 }
        return ItemRow(title: r.title.isEmpty ? "New reminder" : r.title,
                       subtitle: facts.isEmpty ? nil : Text(facts.joined(separator: " · "))) {
            CheckButton(isOn: r.isCompleted, tint: list?.color ?? Theme.brand) {
                Task { await store.setCompleted(r, !r.isCompleted) }
            }
        } trailing: {
            if r.priority != .none {
                Text(String(repeating: "!", count: r.priority.rawValue))
                    .font(.body.weight(.bold)).foregroundStyle(Theme.brand)
                    .accessibilityLabel("\(r.priority.title) priority")
            }
        }
        .opacity(r.isCompleted ? 0.5 : 1)
        .contentShape(Rectangle())
        .onTapGesture { editing = r }
        .accessibilityAddTraits(.isButton)
    }
}

/// The round tick in front of a reminder, in its list's colour.
private struct CheckButton: View {
    let isOn: Bool
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                .font(.title2)
                .foregroundStyle(tint)
                .frame(width: ItemRowMetrics.leadingWidth, height: ItemRowMetrics.leadingWidth)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isOn ? "Mark as not done" : "Mark as done")
        .sensoryFeedback(.success, trigger: isOn) { _, new in new }
    }
}

// MARK: - Editor

struct ReminderEditor: View {
    /// nil to create.
    let reminder: Reminder?
    /// The list a new reminder goes in; nil for the Reminders app's default.
    var listID: String?
    @Environment(\.dismiss) private var dismiss
    @State private var store = ReminderStore.shared
    @State private var draft = Reminder()
    @State private var hasDate = false
    @State private var loaded = false
    @State private var confirmDelete = false
    @FocusState private var titleFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Title", text: $draft.title).focused($titleFocused)
                    TextField("Notes", text: $draft.notes, axis: .vertical).lineLimit(1...6)
                }
                Section("List") {
                    Picker("List", selection: $draft.listID) {
                        ForEach(store.lists.filter(\.allowsEdits)) { list in
                            Label {
                                Text(list.title)
                            } icon: {
                                Image(systemName: "circle.fill").foregroundStyle(list.color)
                            }
                            .tag(list.id)
                        }
                    }
                    .labelsHidden()
                }
                Section("Due") {
                    Toggle("Date", isOn: $hasDate.animation())
                    if hasDate {
                        DatePicker("Day", selection: dueBinding, displayedComponents: .date)
                        Toggle("Time", isOn: $draft.hasTime.animation())
                        if draft.hasTime {
                            DatePicker("Time", selection: dueBinding, displayedComponents: .hourAndMinute)
                        }
                        Picker("Repeat", selection: $draft.repeats) {
                            ForEach(Reminder.Repeat.allCases.filter { $0 != .custom || draft.repeats == .custom }) {
                                Text($0.title).tag($0)
                            }
                        }
                    }
                }
                Section("Priority") {
                    Picker("Priority", selection: $draft.priority) {
                        ForEach(Reminder.Priority.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }
                if reminder != nil {
                    Section {
                        Button("Delete reminder", role: .destructive) { confirmDelete = true }
                    }
                }
            }
            .navigationTitle(reminder == nil ? "New reminder" : "Edit reminder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .safeAreaInset(edge: .bottom) {
                Button(action: save) {
                    Text(reminder == nil ? "Add reminder" : "Save changes").frame(maxWidth: .infinity)
                }
                .buttonStyle(.wooliPrimary)
                .disabled(draft.title.trimmingCharacters(in: .whitespaces).isEmpty)
                .padding(.horizontal, Space.l).padding(.vertical, Space.m)
                .background(.bar)
            }
            .confirmationDialog("Delete this reminder?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        if let reminder { await store.delete(reminder) }
                        dismiss()
                    }
                }
            } message: {
                Text("This also removes it from Apple Reminders.")
            }
        }
        .onAppear(perform: load)
    }

    /// The due date, starting at 9 AM tomorrow the first time a date is turned on.
    private var dueBinding: Binding<Date> {
        Binding(get: { draft.due ?? Self.defaultDue }, set: { draft.due = $0 })
    }

    private static var defaultDue: Date {
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: .now))!
        return cal.date(byAdding: .hour, value: 9, to: tomorrow)!
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        if let reminder {
            draft = reminder
            hasDate = reminder.due != nil
        } else {
            draft.listID = listID ?? store.defaultListID
            titleFocused = true
        }
    }

    private func save() {
        var r = draft
        r.title = r.title.trimmingCharacters(in: .whitespaces)
        if hasDate {
            r.due = r.due ?? Self.defaultDue
        } else {
            r.due = nil
            r.hasTime = false
            r.repeats = .never
        }
        Task {
            if await store.save(r) { dismiss() }
        }
    }
}
