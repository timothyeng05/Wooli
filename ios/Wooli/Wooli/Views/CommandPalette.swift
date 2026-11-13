#if os(macOS)
import SwiftUI

/// ⌘K: one field over the window. Finds trips, cities, apps and Budget pages by
/// name, and runs a few commands. Return goes or runs; ↑ ↓ choose. (M1-7)
struct CommandPalette: View {
    struct Entry: Identifiable {
        let id: String
        let title: String
        let subtitle: String
        let symbol: String
        let run: () -> Void
    }

    let entries: [Entry]
    let onClose: () -> Void

    @State private var query = ""
    @State private var picked: String?
    @FocusState private var focused: Bool

    private var results: [Entry] {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return Array(entries.prefix(8)) }
        return Array(entries.filter {
            $0.title.localizedCaseInsensitiveContains(q) || $0.subtitle.localizedCaseInsensitiveContains(q)
        }.prefix(8))
    }

    var body: some View {
        VStack(spacing: 0) {
            TextField("Go to a trip, city or app, or run a command", text: $query)
                .textFieldStyle(.plain)
                .font(.title3)
                .padding(14)
                .focused($focused)
                .onSubmit { run(results.first { $0.id == picked } ?? results.first) }
                .onKeyPress(.downArrow) { move(1); return .handled }
                .onKeyPress(.upArrow) { move(-1); return .handled }
            Divider()
            if results.isEmpty {
                Text("Nothing matches").foregroundStyle(Theme.textSecondary).padding(24)
            } else {
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(results) { entry in
                            let on = (picked ?? results.first?.id) == entry.id
                            Button { run(entry) } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: entry.symbol).frame(width: 22).foregroundStyle(Theme.brand)
                                    Text(entry.title).foregroundStyle(Theme.text)
                                    Text(entry.subtitle).font(.callout).foregroundStyle(Theme.textSecondary)
                                    Spacer()
                                }
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(on ? Theme.brand.opacity(0.14) : .clear, in: RoundedRectangle(cornerRadius: 8))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(8)
                }
                .frame(maxHeight: 340)
            }
        }
        .frame(width: 520)
        .background(Theme.card)
        .onAppear { focused = true }
        .onChange(of: query) { _, _ in picked = nil }
        .onExitCommand { onClose() }
    }

    private func move(_ step: Int) {
        guard !results.isEmpty else { return }
        let i = results.firstIndex { $0.id == (picked ?? results.first?.id) } ?? 0
        picked = results[(i + step + results.count) % results.count].id
    }

    private func run(_ entry: Entry?) {
        guard let entry else { return }
        onClose()
        entry.run()
    }
}
#endif
