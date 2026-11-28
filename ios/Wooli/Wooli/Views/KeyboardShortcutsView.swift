#if os(macOS)
import SwiftUI

/// Help → Keyboard Shortcuts: the Trips menu commands in one place (M1-7).
struct KeyboardShortcutsView: View {
    private struct Group: Identifiable {
        let title: String
        let rows: [(String, String)]
        var id: String { title }
    }

    private let groups: [Group] = [
        Group(title: "File", rows: [
            ("New Trip…", "⇧⌘N"), ("New Plan (quick add)", "⌘N"), ("Sync Bank", "⌘R"),
        ]),
        Group(title: "Edit", rows: [
            ("Undo / Redo", "⌘Z / ⇧⌘Z"), ("Copy / Paste plans", "⌘C / ⌘V"), ("Duplicate", "⌘D"),
            ("Delete", "⌫"), ("Find in trip", "⌘F"),
        ]),
        Group(title: "View", rows: [
            ("Itinerary, Calendar, Map", "⌘1 ⌘2 ⌘3"), ("Show Map", "⇧⌘M"),
            ("Show Inspector", "⌥⌘I"), ("Show Open Slots", "⇧⌘O"),
        ]),
        Group(title: "Plan", rows: [
            ("Move Up / Down", "⌘↑ / ⌘↓"), ("Move to Previous / Next Day", "⌥⌘↑ / ⌥⌘↓"),
            ("Move to Ideas", "⇧⌘U"), ("Toggle Booked", "⌘B"), ("Open in Maps", "⌘⏎"),
            ("Rename", "⏎"),
        ]),
        Group(title: "Go", rows: [
            ("Today", "⌘0"), ("Trips", "⇧⌘T"), ("Next / Previous City", "⌘] / ⌘["),
            ("Review Transactions", "⇧⌘R"),
        ]),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                ForEach(groups) { group in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(group.title).font(.headline)
                        ForEach(group.rows, id: \.0) { row in
                            HStack {
                                Text(row.0)
                                Spacer()
                                Text(row.1).font(.body.monospaced()).foregroundStyle(.secondary)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            .padding(24)
        }
        .frame(width: 420, height: 520)
    }
}
#endif
