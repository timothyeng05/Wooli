import SwiftUI
import SwiftData
#if canImport(FoundationModels)
import FoundationModels
#endif

// A shared reel whose caption reads as a recipe (`SharedReelSheet` decides):
// split it into ingredients and steps and let the user check it before saving.

enum RecipeReader {
    /// The headings parser first, since it keeps the caption's own words;
    /// Apple Intelligence only when that finds no ingredients or no steps.
    static func read(_ caption: String) async -> RecipeParser.Recipe {
        var recipe = RecipeParser.parse(caption)
        guard recipe.ingredients.isEmpty || recipe.steps.isEmpty else { return recipe }
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), case .available = SystemLanguageModel.default.availability {
            let session = LanguageModelSession(instructions: """
                You read Instagram captions that contain a recipe. Split it into the dish's name, the ingredients \
                (one per item, with amounts) and the steps (one per instruction, in order). Copy the caption's \
                wording; never add ingredients or steps it doesn't give. Leave out hashtags and calls to follow.
                """)
            if let response = try? await session.respond(to: caption, generating: CaptionRecipe.self) {
                let found = response.content
                let clean = { (items: [String]) in items.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
                if recipe.ingredients.isEmpty { recipe.ingredients = clean(found.ingredients) }
                if recipe.steps.isEmpty { recipe.steps = clean(found.steps) }
                if recipe.title.isEmpty { recipe.title = found.title }
            }
        }
        #endif
        return recipe
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
private struct CaptionRecipe {
    @Guide(description: "The dish's name, short, without emoji or hashtags")
    var title: String
    @Guide(description: "Each ingredient with its amount, as written; empty if the caption lists none")
    var ingredients: [String]
    @Guide(description: "Each step of the method in order, as written; empty if the caption gives none")
    var steps: [String]
}
#endif

/// The recipe read from a shared reel's caption, ready to fix up and save.
struct RecipeImportSheet: View {
    let reel: SharedReel
    /// Already downloaded; nil when Instagram didn't share it.
    let caption: String?
    /// "It's places to eat": hands the reel to Eats instead.
    let onPlaces: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var recipes: [RecipeEntry]
    @State private var draft: RecipeDraft?

    var body: some View {
        NavigationStack {
            Group {
                if let draft {
                    RecipeEditor(draft: draft,
                                 notice: caption != nil ? nil : "Instagram didn't share this reel's caption. Copy it in Instagram and paste it below.") { saved in
                        save(saved)
                    }
                } else {
                    ProgressView("Reading the reel…").frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Save recipe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .bottomBar) {
                    Button("It's places to eat — find them", systemImage: "fork.knife", action: onPlaces)
                }
            }
            .task {
                let link = RecipeDraft.cleanLink(reel.url)
                guard let caption else {
                    draft = RecipeDraft(sourceURL: link)
                    return
                }
                let recipe = await RecipeReader.read(caption)
                draft = RecipeDraft(recipe, caption: caption, sourceURL: link)
            }
        }
    }

    /// The same reel saved again replaces its recipe instead of adding a second.
    private func save(_ saved: RecipeDraft) {
        if let existing = recipes.first(where: { !$0.sourceURL.isEmpty && $0.sourceURL == saved.sourceURL }) {
            existing.apply(saved)
        } else {
            context.insert(RecipeEntry(saved))
        }
        app.space = .recipes
        dismiss()
    }
}
