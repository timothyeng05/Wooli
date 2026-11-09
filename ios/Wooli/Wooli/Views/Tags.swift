import SwiftUI
import SwiftData

enum TagStyle {
    static let palette: [Color] = [.blue, .teal, .indigo, .green, .orange, .pink, .purple, .brown]

    /// Stable color per tag name (String.hashValue changes every launch).
    static func color(_ tag: String) -> Color {
        palette[tag.lowercased().unicodeScalars.reduce(0) { $0 + Int($1.value) } % palette.count]
    }

    /// Every tag in use, most used first.
    static func allTags(in transactions: [LocalTransaction]) -> [String] {
        var counts: [String: Int] = [:]
        for tx in transactions { for tag in tx.tags { counts[tag, default: 0] += 1 } }
        return counts.sorted { $0.value == $1.value ? $0.key < $1.key : $0.value > $1.value }.map(\.key)
    }
}

struct TagChip: View {
    let tag: String
    var onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: 4) {
            Text("#\(tag)").font(.subheadline.weight(.medium))
            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark").font(.caption2.weight(.bold))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Remove tag \(tag)")
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .foregroundStyle(TagStyle.color(tag))
        .background(TagStyle.color(tag).opacity(0.12), in: Capsule())
    }
}

/// "Tags" section of the transaction editor.
struct TagsSection: View {
    @Bindable var transaction: LocalTransaction
    @State private var picking = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionLabel("Tags")
            FlowLayout(spacing: 8) {
                ForEach(transaction.tags, id: \.self) { tag in
                    TagChip(tag: tag) { withAnimation { transaction.tags.removeAll { $0 == tag } } }
                }
                Chip(label: transaction.tags.isEmpty ? "Add tag" : "Add", symbol: "tag", selected: false) { picking = true }
            }
        }
        .sheet(isPresented: $picking) { TagPickerSheet(transaction: transaction) }
    }
}

/// Pick existing tags or make a new one.
struct TagPickerSheet: View {
    @Bindable var transaction: LocalTransaction
    @Environment(\.dismiss) private var dismiss
    @Query private var transactions: [LocalTransaction]
    @State private var newTag = ""

    var body: some View {
        let existing = TagStyle.allTags(in: transactions)
        let trimmed = newTag.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
        let matching = trimmed.isEmpty ? existing : existing.filter { $0.localizedCaseInsensitiveContains(trimmed) }

        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("New tag, e.g. Japan trip", text: $newTag)
                            .onSubmit { add(trimmed) }
                        Button("Add") { add(trimmed) }
                            .disabled(trimmed.isEmpty)
                    }
                }
                if !matching.isEmpty {
                    Section("Your tags") {
                        ForEach(matching, id: \.self) { tag in
                            Button {
                                toggle(tag)
                            } label: {
                                HStack {
                                    TagChip(tag: tag)
                                    Spacer()
                                    if transaction.tags.contains(tag) {
                                        Image(systemName: "checkmark").fontWeight(.semibold).foregroundStyle(Theme.brand)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Tags")
            .inlineNavigationTitle()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func add(_ tag: String) {
        guard !tag.isEmpty else { return }
        // Reuse an existing tag's spelling if it only differs by case.
        let existing = TagStyle.allTags(in: transactions).first { $0.caseInsensitiveCompare(tag) == .orderedSame } ?? tag
        if !transaction.tags.contains(existing) { transaction.tags.append(existing) }
        newTag = ""
    }

    private func toggle(_ tag: String) {
        if transaction.tags.contains(tag) { transaction.tags.removeAll { $0 == tag } } else { transaction.tags.append(tag) }
    }
}

/// Reports card: spending per tag for the period.
struct TagsReportCard: View {
    let transactions: [LocalTransaction]
    let interval: DateInterval
    let ledger: Ledger

    var body: some View {
        var totals: [String: (spent: Double, count: Int)] = [:]
        for tx in transactions where interval.contains(tx.transactedAt) && !tx.isHidden && !tx.isTransfer && ledger.isVisible(tx) {
            for tag in tx.tags {
                totals[tag, default: (0, 0)].spent -= tx.amount
                totals[tag, default: (0, 0)].count += 1
            }
        }
        let rows = totals.sorted { $0.value.spent > $1.value.spent }

        return VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Tags", subtitle: "Spending by tag, across categories")
            if rows.isEmpty {
                Text("Tag transactions (e.g. \"Japan trip\") to see what a trip or project cost in total.")
                    .font(.footnote).foregroundStyle(Theme.textTertiary)
            }
            ForEach(rows, id: \.key) { tag, value in
                HStack {
                    TagChip(tag: tag)
                    Text("\(value.count) transaction\(value.count == 1 ? "" : "s")").font(.caption).foregroundStyle(Theme.textTertiary)
                    Spacer()
                    Text(value.spent.currency()).font(.subheadline.weight(.semibold)).monospacedDigit()
                }
            }
        }
        .card()
    }
}
