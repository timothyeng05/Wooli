import SwiftUI
import SwiftData

// MARK: - Your recipes

/// Recipes' main screen: everything you've saved, newest first.
struct RecipesListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \RecipeEntry.createdAt, order: .reverse) private var recipes: [RecipeEntry]
    @State private var adding = false
    @State private var query = ""

    /// Matches the name or any ingredient ("what can I make with leeks?").
    private var shown: [RecipeEntry] {
        let term = query.trimmingCharacters(in: .whitespaces)
        guard !term.isEmpty else { return recipes }
        return recipes.filter { $0.title.localizedStandardContains(term) || $0.ingredientsText.localizedStandardContains(term) }
    }

    var body: some View {
        List {
            if recipes.isEmpty {
                ContentUnavailableView {
                    Label("Save your first recipe", systemImage: AppSpace.recipes.systemImage)
                } description: {
                    Text("In Instagram, tap Share on a recipe reel, pick Wooli, then Save as a recipe. The caption becomes ingredients and steps.")
                } actions: {
                    Button("Add a recipe") { adding = true }.buttonStyle(.borderedProminent)
                }
            } else {
                ForEach(shown) { recipe in
                    NavigationLink { RecipeDetail(recipe: recipe) } label: { RecipeRow(recipe: recipe) }
                }
            }
        }
        .overlay {
            if !recipes.isEmpty && shown.isEmpty { ContentUnavailableView.search(text: query) }
        }
        .searchable(text: $query, prompt: "Recipe or ingredient")
        .navigationTitle("Recipes")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add a recipe", systemImage: "plus") { adding = true }
            }
        }
        .sheet(isPresented: $adding) {
            NavigationStack {
                RecipeEditor(draft: RecipeDraft()) { draft in
                    context.insert(RecipeEntry(draft))
                    adding = false
                }
                .navigationTitle("New recipe")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false } } }
            }
        }
    }
}

struct RecipeRow: View {
    let recipe: RecipeEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(recipe.displayTitle).font(.headline).foregroundStyle(Theme.text).lineLimit(2)
            if !recipe.summary.isEmpty {
                Text(recipe.summary).font(.subheadline).foregroundStyle(Theme.textSecondary)
            }
            if recipe.link != nil {
                Label("Instagram", systemImage: "play.rectangle").font(.caption).foregroundStyle(Theme.textTertiary)
            }
        }
        .padding(.vertical, 4)
    }
}

extension RecipeEntry {
    var displayTitle: String { title.isEmpty ? "Untitled recipe" : title }
}

// MARK: - A recipe

/// Ingredients, then numbered steps, then your notes and the original caption.
struct RecipeDetail: View {
    let recipe: RecipeEntry
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var confirmDelete = false
    @State private var showCaption = false

    var body: some View {
        List {
            Section {
                Text(recipe.displayTitle)
                    .font(.system(size: 28, weight: .heavy, design: .serif))
                    .foregroundStyle(Theme.text)
                if let link = recipe.link {
                    Link(destination: link) { Label("Watch on Instagram", systemImage: "play.rectangle") }
                }
            }
            if !recipe.ingredients.isEmpty {
                Section("Ingredients") {
                    ForEach(Array(recipe.ingredients.enumerated()), id: \.offset) { _, ingredient in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Circle().fill(AppSpace.recipes.tint).frame(width: 6, height: 6)
                            Text(ingredient)
                        }
                    }
                }
            }
            if !recipe.steps.isEmpty {
                Section("Steps") {
                    ForEach(Array(recipe.steps.enumerated()), id: \.offset) { index, step in
                        HStack(alignment: .firstTextBaseline, spacing: 12) {
                            Text("\(index + 1)").font(.headline).monospacedDigit().foregroundStyle(AppSpace.recipes.tint)
                            Text(step)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
            if !recipe.notes.isEmpty {
                Section("Notes") { Text(recipe.notes) }
            }
            if !recipe.caption.isEmpty {
                Section("Caption") {
                    Text(recipe.caption).font(.subheadline).foregroundStyle(Theme.textSecondary)
                        .lineLimit(showCaption ? nil : 4)
                        .onTapGesture { withAnimation(.snappy) { showCaption.toggle() } }
                }
            }
            Section {
                Button("Remove from Recipes", role: .destructive) { confirmDelete = true }
                    .frame(maxWidth: .infinity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Edit") { editing = true } }
        }
        .sheet(isPresented: $editing) {
            NavigationStack {
                RecipeEditor(draft: recipe.draft) { draft in
                    recipe.apply(draft)
                    editing = false
                }
                .navigationTitle("Edit recipe")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { editing = false } } }
            }
        }
        .confirmationDialog("Remove \(recipe.displayTitle)?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                dismiss()
                context.delete(recipe)
            }
        }
    }
}

// MARK: - Editor

/// Name, ingredients and steps (one per line), notes. Without a caption it
/// offers a box to paste one and split it, for reels Instagram won't share
/// and recipes from anywhere else. The caller adds Cancel.
struct RecipeEditor: View {
    @State private var draft: RecipeDraft
    private let notice: String?
    private let onSave: (RecipeDraft) -> Void
    @State private var pasted = ""
    @State private var reading = false

    init(draft: RecipeDraft, notice: String? = nil, onSave: @escaping (RecipeDraft) -> Void) {
        _draft = State(initialValue: draft)
        self.notice = notice
        self.onSave = onSave
    }

    var body: some View {
        Form {
            if let notice {
                Section { Text(notice).font(.subheadline).foregroundStyle(Theme.textSecondary) }
            }
            if draft.caption.isEmpty {
                Section {
                    TextField("Paste a recipe caption", text: $pasted, axis: .vertical).lineLimit(2...8)
                    Button("Split into ingredients and steps", systemImage: "wand.and.stars") { split() }
                        .disabled(pasted.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || reading)
                } header: {
                    Text("From a caption")
                }
            }
            Section("Name") {
                TextField("Dish name", text: $draft.title, axis: .vertical)
            }
            Section {
                TextField("2 cups flour\n1 tsp salt", text: $draft.ingredients, axis: .vertical).lineLimit(3...30)
            } header: {
                Text("Ingredients")
            } footer: {
                Text("One per line.")
            }
            Section {
                TextField("Mix the dry ingredients…", text: $draft.steps, axis: .vertical).lineLimit(3...30)
            } header: {
                Text("Steps")
            } footer: {
                Text("One step per line.")
            }
            Section("Notes") {
                TextField("Your changes, who liked it", text: $draft.notes, axis: .vertical).lineLimit(1...8)
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { onSave(draft) }
                    .disabled([draft.title, draft.ingredients, draft.steps].allSatisfy { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
            }
        }
    }

    /// Fills the lists from the pasted caption; a name you typed stays.
    private func split() {
        let caption = pasted.trimmingCharacters(in: .whitespacesAndNewlines)
        reading = true
        Task {
            let recipe = await RecipeReader.read(caption)
            if draft.title.trimmingCharacters(in: .whitespaces).isEmpty { draft.title = recipe.title }
            draft.ingredients = recipe.ingredients.joined(separator: "\n")
            draft.steps = recipe.steps.joined(separator: "\n")
            draft.caption = caption
            pasted = ""
            reading = false
        }
    }
}
