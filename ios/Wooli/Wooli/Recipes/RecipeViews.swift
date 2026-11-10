import SwiftUI
import SwiftData

// MARK: - Your recipes

/// Recipes' main screen: everything you've saved, with filter pills
/// (meal, cuisine, main ingredient, time, where it came from), sort and search.
struct RecipesListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \RecipeEntry.createdAt, order: .reverse) private var recipes: [RecipeEntry]
    @State private var adding = false
    @State private var query = ""
    @State private var sort = Sort.newest
    @State private var meal: String?
    @State private var cuisine: String?
    @State private var main: String?
    @State private var time: String?
    @State private var source: String?
    /// The recipe open beside the list on the Mac.
    @State private var open: RecipeEntry?

    enum Sort: String, CaseIterable, Identifiable {
        case newest = "Newest", name = "A–Z", quickest = "Quickest", fewest = "Fewest ingredients"
        var id: String { rawValue }
    }

    private static let fromInstagram = "From Instagram", yourOwn = "Your own"

    /// Matches the name or any ingredient ("what can I make with leeks?"), then the pills.
    private var shown: [RecipeEntry] {
        let term = query.trimmingCharacters(in: .whitespaces)
        let matching = recipes.filter { r in
            (term.isEmpty || r.title.localizedStandardContains(term) || r.ingredientsText.localizedStandardContains(term))
                && (meal == nil || r.meal == meal) && (cuisine == nil || r.cuisine == cuisine)
                && (main == nil || r.mainIngredient == main) && (time == nil || RecipeTags.timeBucket(r.minutes) == time)
                && (source == nil || (r.link != nil) == (source == Self.fromInstagram))
        }
        switch sort {
        case .newest: return matching
        case .name: return matching.sorted { $0.displayTitle.localizedStandardCompare($1.displayTitle) == .orderedAscending }
        // Unknown times go last.
        case .quickest: return matching.sorted { ($0.minutes == 0 ? Int.max : $0.minutes) < ($1.minutes == 0 ? Int.max : $1.minutes) }
        case .fewest: return matching.sorted { $0.ingredients.count < $1.ingredients.count }
        }
    }

    private var isFiltering: Bool { meal != nil || cuisine != nil || main != nil || time != nil || source != nil }

    private func clearFilters() {
        meal = nil
        cuisine = nil
        main = nil
        time = nil
        source = nil
        query = ""
    }

    var body: some View {
        let shown = shown
        List {
            Section {
                HeroCard(eyebrow: "Your recipes") {
                    Text("\(recipes.count) saved").wooliFont(.amount)
                    let reels = recipes.filter { $0.link != nil }.count
                    Text(reels > 0 ? "\(reels) from Instagram reels" : "Share a recipe reel to Wooli to add one")
                        .font(.footnote)
                }
                .listRowInsets(EdgeInsets(top: Space.s, leading: Space.l, bottom: Space.s, trailing: Space.l))
                .listRowBackground(Color.clear)
            }
            if recipes.isEmpty {
                WooliEmptyState(symbol: AppSpace.recipes.systemImage, title: "Save your first recipe",
                                message: "In Instagram, tap Share on a recipe reel, pick Wooli, then Save as a recipe. The caption becomes ingredients and steps.",
                                actionTitle: "Add recipe") { adding = true }
                    .listRowBackground(Color.clear)
            } else {
                if recipes.count > 1 {
                    Section {
                        controls
                            .listRowInsets(EdgeInsets(top: Space.s, leading: Space.l, bottom: Space.s, trailing: Space.l))
                            .listRowBackground(Color.clear)
                    }
                }
                if shown.isEmpty {
                    ContentUnavailableView {
                        Label("No matches", systemImage: "line.3.horizontal.decrease.circle")
                    } actions: {
                        Button("Clear filters") { clearFilters() }
                    }
                    .listRowBackground(Color.clear)
                }
                Section {
                    ForEach(shown) { recipe in
                        #if os(macOS)
                        Button { open = recipe } label: { RecipeRow(recipe: recipe).contentShape(Rectangle()) }
                            .buttonStyle(.plain)
                            .listRowBackground(open?.id == recipe.id ? Theme.brandSoft : nil)
                        #else
                        NavigationLink { RecipeDetail(recipe: recipe) } label: { RecipeRow(recipe: recipe) }
                        #endif
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Recipe or ingredient")
        // Tag new and older recipes in the background; the pills fill in as it goes.
        .task(id: recipes.filter { $0.tagVersion < RecipeTagger.version }.count) {
            await RecipeTagger.tagUntagged(recipes)
        }
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
        .listDetail($open) { recipe in
            RecipeDetail(recipe: recipe)
        } empty: {
            SideDetailPlaceholder(text: "Choose a recipe to see it here.", systemImage: "frying.pan")
        }
    }
}

private extension RecipesListView {
    /// Pills only for tags the list actually has more than one of.
    var controls: some View {
        let present = { (values: [String], order: [String]) in order.filter(Set(values).contains) }
        let meals = present(recipes.map(\.meal), RecipeTags.meals)
        let cuisines = present(recipes.map(\.cuisine), RecipeTags.cuisines)
        let mains = present(recipes.map(\.mainIngredient), RecipeTags.mains)
        let times = present(recipes.compactMap { RecipeTags.timeBucket($0.minutes) }, RecipeTags.times)
        let reels = recipes.filter { $0.link != nil }.count
        return VStack(alignment: .leading, spacing: 14) {
            FilterPillRow(isFiltering: isFiltering, onClear: clearFilters) {
                if meals.count > 1 || meal != nil { FilterPill(title: "Meal", value: $meal, options: meals) }
                if mains.count > 1 || main != nil { FilterPill(title: "Main", value: $main, options: mains) }
                if cuisines.count > 1 || cuisine != nil { FilterPill(title: "Cuisine", value: $cuisine, options: cuisines) }
                if times.count > 1 || time != nil { FilterPill(title: "Time", value: $time, options: times) }
                if (reels > 0 && reels < recipes.count) || source != nil {
                    FilterPill(title: "Source", value: $source, options: [Self.fromInstagram, Self.yourOwn])
                }
            }
            SortMenu(options: Sort.allCases, selection: $sort)
        }
    }
}

struct RecipeRow: View {
    let recipe: RecipeEntry

    var body: some View {
        ItemRow(title: recipe.displayTitle, subtitle: subtitle, leading: {
            Image(systemName: AppSpace.recipes.systemImage)
                .font(.headline)
                .foregroundStyle(Theme.Group.food.onColor)
                .frame(width: 40, height: 40)
                .background(Theme.Group.food.color, in: RoundedRectangle(cornerRadius: Radius.small, style: .continuous))
        }, trailing: {
            if recipe.link != nil {
                Image(systemName: "play.rectangle").foregroundStyle(Theme.textTertiary)
                    .accessibilityLabel("From Instagram")
            }
        })
    }

    private var subtitle: Text? {
        // Tags plus the ingredient count once tagged; the step count too before then.
        let count = recipe.ingredients.count
        let line = recipe.tagLine.isEmpty ? recipe.summary
            : [recipe.tagLine, count > 0 ? "\(count) ingredients" : ""].filter { !$0.isEmpty }.joined(separator: " · ")
        return line.isEmpty ? nil : Text(line)
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
    @Environment(\.closeSideDetail) private var closeSideDetail

    var body: some View {
        List {
            Section {
                Text(recipe.displayTitle)
                    .wooliFont(.display)
                    .foregroundStyle(Theme.text)
                let tags = [recipe.tagLine, recipe.mainIngredient].filter { !$0.isEmpty }.joined(separator: " · ")
                if !tags.isEmpty {
                    Text(tags).font(.subheadline).foregroundStyle(Theme.textSecondary)
                }
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
                Section {
                    Postcard(from: recipe.link != nil ? "Instagram" : "your kitchen", title: "Notes",
                             message: recipe.notes, stamp: "🍳", group: .food)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
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
                closeSideDetail()
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
            Section {
                tagPicker("Meal", $draft.meal, RecipeTags.meals)
                tagPicker("Main ingredient", $draft.mainIngredient, RecipeTags.mains)
                tagPicker("Cuisine", $draft.cuisine, RecipeTags.cuisines)
                Picker("Time", selection: Binding(get: { draft.minutes }, set: { draft.minutes = $0; draft.tagsEdited = true })) {
                    Text("Not set").tag(0)
                    ForEach([10, 15, 20, 30, 45, 60, 90, 120, 180, 240], id: \.self) { Text(RecipeTags.timeLabel($0)).tag($0) }
                    if draft.minutes > 0 && ![10, 15, 20, 30, 45, 60, 90, 120, 180, 240].contains(draft.minutes) {
                        Text(RecipeTags.timeLabel(draft.minutes)).tag(draft.minutes)
                    }
                }
            } header: {
                Text("Tags")
            } footer: {
                Text("Wooli fills these in with Apple Intelligence; change any that are wrong.")
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

    private func tagPicker(_ title: String, _ value: Binding<String>, _ options: [String]) -> some View {
        Picker(title, selection: Binding(get: { value.wrappedValue }, set: { value.wrappedValue = $0; draft.tagsEdited = true })) {
            Text("Not set").tag("")
            ForEach(options, id: \.self) { Text($0).tag($0) }
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
