import SwiftUI
import SwiftData

/// Split a transaction into parts, each with its own category and amount.
/// Parts must add up to the original before saving.
struct SplitEditor: View {
    /// The original (unsplit) transaction.
    let original: LocalTransaction

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var parts: [SplitService.Part] = []
    @State private var pickingFor: UUID?
    @State private var loaded = false
    @State private var confirmUnsplit = false

    private var total: Double { abs(original.amount) }
    private var assigned: Double { parts.reduce(0) { $0 + abs($1.amount) } }
    private var remaining: Double { ((total - assigned) * 100).rounded() / 100 }
    private var canSave: Bool { parts.count >= 2 && abs(remaining) < 0.005 && parts.allSatisfy { $0.amount > 0 } }

    var body: some View {
        let byId = Dictionary(categories.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        NavigationStack {
            Form {
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(original.title).font(.headline).foregroundStyle(Theme.text)
                            Text(original.transactedAt.formatted(date: .abbreviated, time: .omitted))
                                .font(.footnote).foregroundStyle(Theme.textTertiary)
                        }
                        Spacer()
                        Text(original.amount.signedCurrency()).font(.title3.weight(.bold)).monospacedDigit()
                    }
                }

                Section {
                    ForEach($parts) { $part in
                        HStack(spacing: 12) {
                            Button {
                                pickingFor = part.id
                            } label: {
                                HStack(spacing: 10) {
                                    CategoryTile(category: part.categoryId.flatMap { byId[$0] }, size: 32)
                                    Text(part.categoryId.flatMap { byId[$0]?.name } ?? "Choose category")
                                        .foregroundStyle(part.categoryId == nil ? Theme.pending : Theme.text)
                                        .lineLimit(1)
                                }
                            }
                            .buttonStyle(.borderless)
                            Spacer(minLength: 8)
                            TextField("$0.00", value: $part.amount, format: .currency(code: "USD"))
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                                .font(.body.monospacedDigit())
                                .frame(width: 110)
                        }
                    }
                    .onDelete { parts.remove(atOffsets: $0) }

                    Button("Add a part", systemImage: "plus") {
                        parts.append(.init(categoryId: nil, amount: max(remaining, 0)))
                    }
                } header: {
                    Text("Parts")
                } footer: {
                    HStack {
                        if abs(remaining) < 0.005 {
                            Label("Adds up to \(total.currency())", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(Theme.income)
                        } else if remaining > 0 {
                            Text("\(remaining.currency()) left to assign").foregroundStyle(Theme.pending)
                        } else {
                            Text("\(abs(remaining).currency()) more than the total").foregroundStyle(Theme.expense)
                        }
                        Spacer()
                        if parts.count >= 2 {
                            Button("Split evenly") { splitEvenly() }.font(.footnote.weight(.semibold))
                        }
                    }
                }

                if original.isSplit {
                    Section {
                        Button("Undo split", role: .destructive) { confirmUnsplit = true }
                    } footer: {
                        Text("Brings back the original transaction as one line.")
                    }
                }
            }
            .navigationTitle(original.isSplit ? "Edit split" : "Split transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        SplitService.split(original, into: parts, categories: categories, context: context)
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
            .sheet(isPresented: Binding(get: { pickingFor != nil }, set: { if !$0 { pickingFor = nil } })) {
                NavigationStack {
                    CategoryPickerView(selectedId: parts.first { $0.id == pickingFor }?.categoryId) { picked in
                        if let i = parts.firstIndex(where: { $0.id == pickingFor }) { parts[i].categoryId = picked?.id }
                        pickingFor = nil
                    }
                }
            }
            .confirmationDialog("Undo this split?", isPresented: $confirmUnsplit, titleVisibility: .visible) {
                Button("Undo split", role: .destructive) {
                    SplitService.unsplit(original, context: context)
                    dismiss()
                }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        let existing = SplitService.parts(of: original, context: context)
        if existing.isEmpty {
            // Start with the current category and an empty second part.
            let half = (total / 2 * 100).rounded() / 100
            parts = [.init(categoryId: original.categoryId, amount: total - half), .init(categoryId: nil, amount: half)]
        } else {
            parts = existing.map { .init(categoryId: $0.categoryId, amount: abs($0.amount)) }
        }
    }

    private func splitEvenly() {
        let cents = Int((total * 100).rounded())
        let each = cents / parts.count
        for i in parts.indices {
            // Any leftover cent goes to the first part.
            parts[i].amount = Double(each + (i == 0 ? cents - each * parts.count : 0)) / 100
        }
    }
}

/// On a transaction screen: "Split transaction", or for a part, "Edit split".
struct SplitButton: View {
    let transaction: LocalTransaction
    @Environment(\.modelContext) private var context
    @State private var editing: LocalTransaction?

    var body: some View {
        let original = transaction.splitParentId.isEmpty ? transaction : SplitService.original(of: transaction, context: context)
        Group {
            if let original {
                Button {
                    editing = original
                } label: {
                    Label(transaction.splitParentId.isEmpty ? "Split transaction" : "Edit split (\(original.amount.signedCurrency()) total)",
                          systemImage: "arrow.triangle.branch")
                        .font(.subheadline.weight(.medium))
                }
                .disabled(transaction.isPending)
            }
        }
        .sheet(item: $editing) { SplitEditor(original: $0) }
    }
}
