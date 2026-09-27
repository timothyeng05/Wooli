import SwiftUI
import SwiftData

/// Manage the category tree: add, rename, re-emoji, recolor, move between
/// groups, reorder and delete — groups and categories alike.
struct CategoriesSettingsView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var editing: BudgetCategory?
    @State private var newCategoryIn: BudgetCategory?
    @State private var creatingGroup = false

    var body: some View {
        let groups = categories.filter { $0.parentId == nil }
        List {
            ForEach(groups) { group in
                let children = categories.filter { $0.parentId == group.id }
                Section {
                    ForEach(children) { child in
                        Button { editing = child } label: {
                            HStack(spacing: 12) {
                                CategoryTile(category: child, size: 32)
                                Text(child.name).foregroundStyle(Theme.text)
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption.weight(.semibold))
                                    .foregroundStyle(Theme.textTertiary)
                            }
                        }
                    }
                    .onMove { from, to in move(children, from: from, to: to) }
                    .onDelete { offsets in offsets.forEach { CategoryStore.delete(children[$0], context: context) } }

                    Button("Add Category", systemImage: "plus") { newCategoryIn = group }
                } header: {
                    Button { editing = group } label: {
                        HStack(spacing: 6) {
                            Text("\(group.icon)  \(group.name)")
                            Text(group.isIncome ? "Income" : group.isTransfer ? "Transfer" : "Spending")
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color(hex: group.colorHex).opacity(0.15), in: Capsule())
                                .foregroundStyle(Color(hex: group.colorHex))
                            Spacer()
                            Text("Edit").font(.caption.weight(.semibold)).foregroundStyle(Theme.brand)
                        }
                    }
                    .textCase(nil)
                }
            }
        }
        .navigationTitle("Categories")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { EditButton() }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(groups) { group in
                        Button("\(group.icon) \(group.name)") { newCategoryIn = group }
                    }
                    Divider()
                    Button("New Group", systemImage: "folder.badge.plus") { creatingGroup = true }
                } label: {
                    Label("Add", systemImage: "plus")
                }
            }
        }
        .sheet(item: $editing) { CategoryEditor(mode: .edit($0)) }
        .sheet(item: $newCategoryIn) { CategoryEditor(mode: .newCategory(parent: $0)) }
        .sheet(isPresented: $creatingGroup) { CategoryEditor(mode: .newGroup) }
    }

    private func move(_ children: [BudgetCategory], from: IndexSet, to: Int) {
        var ordered = children
        ordered.move(fromOffsets: from, toOffset: to)
        let base = children.map(\.sortOrder).min() ?? 0
        for (i, c) in ordered.enumerated() { c.sortOrder = base + i }
    }
}

enum CategoryStore {
    /// Transactions in a deleted category become uncategorized and go back to
    /// review; rules pointing at it are cleaned up. Deleting a group deletes
    /// its categories too.
    static func delete(_ category: BudgetCategory, context: ModelContext) {
        let children = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        for child in children where child.parentId == category.id { delete(child, context: context) }

        let id: String? = category.id
        let affected = (try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.categoryId == id }))) ?? []
        for tx in affected {
            tx.categoryId = nil
            tx.isTransfer = false
            tx.aiSuggested = false
            tx.aiAttempted = false
            tx.needsReview = true
        }
        let categoryId = category.id
        ((try? context.fetch(FetchDescriptor<MerchantRule>(predicate: #Predicate { $0.categoryId == categoryId }))) ?? [])
            .forEach(context.delete)
        for rule in (try? context.fetch(FetchDescriptor<TransactionRule>())) ?? [] {
            if rule.setCategoryId == categoryId { rule.setCategoryId = nil }
            rule.categoryIds.removeAll { $0 == categoryId }
        }
        context.delete(category)
        try? context.save()
    }

    /// Keep children's type and color in line with their group.
    static func syncChildren(of group: BudgetCategory, context: ModelContext) {
        let all = (try? context.fetch(FetchDescriptor<BudgetCategory>())) ?? []
        for child in all where child.parentId == group.id {
            child.isIncome = group.isIncome
            child.isTransfer = group.isTransfer
            child.colorHex = group.colorHex
        }
    }
}

private struct CategoryEditor: View {
    enum Mode {
        case edit(BudgetCategory)
        case newCategory(parent: BudgetCategory)
        case newGroup
    }

    enum Kind: String, CaseIterable, Identifiable {
        case spending = "Spending", income = "Income", transfer = "Transfer"
        var id: String { rawValue }
    }

    let mode: Mode

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \BudgetCategory.sortOrder) private var categories: [BudgetCategory]
    @State private var name = ""
    @State private var icon = "📌"
    @State private var parentId: String?
    @State private var kind: Kind = .spending
    @State private var colorHex = "#3b82f6"
    @State private var loaded = false
    @State private var confirmDelete = false

    static let palette = ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4",
                          "#22c55e", "#84cc16", "#f97316", "#64748b"]
    static let emojis = ["🍽️", "🛒", "☕", "🥡", "🏠", "💡", "📶", "🔨", "🚇", "🚗", "✈️", "🏨", "🚘", "🅿️",
                         "🏥", "💊", "🛍️", "🎬", "💅", "🐾", "🎁", "📚", "💪", "📱", "📋", "📌", "💵", "💻",
                         "💰", "↔️", "💳", "⚖️", "👶", "🎓", "🧾", "🍷"]

    private var isGroup: Bool {
        switch mode {
        case .newGroup: true
        case .edit(let c): c.parentId == nil
        case .newCategory: false
        }
    }

    private var existing: BudgetCategory? {
        if case .edit(let c) = mode { return c }
        return nil
    }

    var body: some View {
        let groups = categories.filter { $0.parentId == nil }
        let childCount = existing.map { e in categories.filter { $0.parentId == e.id }.count } ?? 0

        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        Text(icon.isEmpty ? "•" : icon)
                            .font(.system(size: 30))
                            .frame(width: 54, height: 54)
                            .background(Color(hex: currentColor(groups)).opacity(0.15),
                                        in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        TextField(isGroup ? "Group name" : "Category name", text: $name)
                            .font(.title3.weight(.semibold))
                    }
                }

                Section("Icon") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 8), spacing: 10) {
                        ForEach(Self.emojis, id: \.self) { e in
                            Button { icon = e } label: {
                                Text(e).font(.title3)
                                    .frame(width: 36, height: 36)
                                    .background(icon == e ? Theme.brandSoft : .clear, in: RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(icon == e ? Theme.brand : .clear))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    TextField("Or type any emoji", text: $icon)
                        .onChange(of: icon) { _, new in
                            if new.count > 1, let last = new.last { icon = String(last) }
                        }
                }

                if isGroup {
                    Section {
                        Picker("Type", selection: $kind) {
                            ForEach(Kind.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("Type")
                    } footer: {
                        Text("Transfers (card payments, moves between your accounts) aren't counted as income or spending.")
                    }
                    Section("Color") {
                        HStack {
                            ForEach(Self.palette, id: \.self) { hex in
                                Button { colorHex = hex } label: {
                                    Circle().fill(Color(hex: hex)).frame(width: 26, height: 26)
                                        .overlay(Circle().strokeBorder(.white, lineWidth: colorHex == hex ? 3 : 0))
                                        .shadow(color: colorHex == hex ? .black.opacity(0.25) : .clear, radius: 2)
                                }
                                .buttonStyle(.plain)
                                .frame(maxWidth: .infinity)
                            }
                        }
                    }
                } else {
                    Section("Group") {
                        Picker("Group", selection: $parentId) {
                            ForEach(groups) { Text("\($0.icon) \($0.name)").tag(Optional($0.id)) }
                        }
                    }
                }

                if existing != nil {
                    Section {
                        Button(isGroup ? "Delete Group" : "Delete Category", role: .destructive) { confirmDelete = true }
                    } footer: {
                        Text(isGroup && childCount > 0
                             ? "Deletes this group and its \(childCount) categories. Their transactions go back to your review queue."
                             : "Its transactions go back to your review queue.")
                    }
                }
            }
            .navigationTitle(existing == nil ? (isGroup ? "New Group" : "New Category") : (isGroup ? "Edit Group" : "Edit Category"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save(groups: groups) }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .confirmationDialog("Delete \(name)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    if let existing { CategoryStore.delete(existing, context: context) }
                    dismiss()
                }
            }
        }
        .onAppear { load() }
    }

    private func currentColor(_ groups: [BudgetCategory]) -> String {
        if isGroup { return colorHex }
        return groups.first { $0.id == parentId }?.colorHex ?? colorHex
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        switch mode {
        case .edit(let c):
            name = c.name
            icon = c.icon
            parentId = c.parentId
            colorHex = c.colorHex
            kind = c.isIncome ? .income : c.isTransfer ? .transfer : .spending
        case .newCategory(let parent):
            parentId = parent.id
        case .newGroup:
            icon = "📁"
        }
    }

    private func save(groups: [BudgetCategory]) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        let emoji = icon.isEmpty ? "•" : icon
        if isGroup {
            let group = existing ?? {
                let g = BudgetCategory(name: trimmed, icon: emoji, colorHex: colorHex,
                                       sortOrder: (groups.map(\.sortOrder).max() ?? 0) + 100)
                context.insert(g)
                return g
            }()
            group.name = trimmed
            group.icon = emoji
            group.colorHex = colorHex
            group.isIncome = kind == .income
            group.isTransfer = kind == .transfer
            CategoryStore.syncChildren(of: group, context: context)
            // Transfer flags on transactions follow their category.
            let ids = Set(categories.filter { $0.parentId == group.id }.map(\.id) + [group.id])
            for tx in (try? context.fetch(FetchDescriptor<LocalTransaction>())) ?? [] where ids.contains(tx.categoryId ?? "") {
                tx.isTransfer = group.isTransfer
            }
        } else if let parent = groups.first(where: { $0.id == parentId }) {
            let category = existing ?? {
                let siblings = categories.filter { $0.parentId == parent.id }
                let c = BudgetCategory(name: trimmed, icon: emoji, colorHex: parent.colorHex, parentId: parent.id,
                                       sortOrder: (siblings.map(\.sortOrder).max() ?? parent.sortOrder) + 1)
                context.insert(c)
                return c
            }()
            let moved = category.parentId != parent.id
            category.name = trimmed
            category.icon = emoji
            category.parentId = parent.id
            category.colorHex = parent.colorHex
            category.isIncome = parent.isIncome
            category.isTransfer = parent.isTransfer
            if moved {
                category.sortOrder = (categories.filter { $0.parentId == parent.id }.map(\.sortOrder).max() ?? parent.sortOrder) + 1
                let id: String? = category.id
                for tx in (try? context.fetch(FetchDescriptor<LocalTransaction>(predicate: #Predicate { $0.categoryId == id }))) ?? [] {
                    tx.isTransfer = parent.isTransfer
                }
            }
        }
        try? context.save()
        dismiss()
    }
}
