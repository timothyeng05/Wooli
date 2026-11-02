import Foundation
import SwiftData
import OSLog
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Tags recipes for the list's filters — meal, cuisine, main ingredient and
/// rough time — with Apple Intelligence on the phone. Runs on recipes that
/// haven't been tagged at this `version`; a tag the user set by hand counts
/// as tagged. Without Apple Intelligence it guesses the main ingredient from
/// the ingredient list and tries again later.
@MainActor
enum RecipeTagger {
    /// Bump to re-tag everything after improving the prompt or the choices.
    nonisolated static let version = 1

    private static var running = false
    private static let log = Logger(subsystem: "com.timothyeng.wooli", category: "Recipes")

    static func tagUntagged(_ recipes: [RecipeEntry]) async {
        guard !running else { return }
        running = true
        defer { running = false }
        for recipe in recipes where recipe.tagVersion < version {
            guard !Task.isCancelled else { return }
            await tag(recipe)
        }
    }

    static func tag(_ recipe: RecipeEntry) async {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), case .available = SystemLanguageModel.default.availability,
           let tags = await ask(recipe) {
            // Something may have been tagged by hand while the model worked.
            guard recipe.tagVersion < version else { return }
            recipe.meal = RecipeTags.meals.contains(tags.meal) ? tags.meal : ""
            recipe.cuisine = RecipeTags.cuisines.contains(tags.cuisine) ? tags.cuisine : ""
            recipe.mainIngredient = RecipeTags.mains.contains(tags.mainIngredient) ? tags.mainIngredient : ""
            recipe.minutes = (5...600).contains(tags.minutes) ? tags.minutes : 0
            recipe.tagVersion = version
            log.info("Tagged a recipe: \(recipe.tagLine, privacy: .public) · \(recipe.mainIngredient, privacy: .public)")
            return
        }
        #endif
        if recipe.mainIngredient.isEmpty { recipe.mainIngredient = guessMain(recipe.ingredients) }
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func ask(_ recipe: RecipeEntry) async -> GeneratedTags? {
        let session = LanguageModelSession(instructions: """
            You tag home recipes so they can be filtered. Pick each answer only from the choices given. \
            The main ingredient is what the dish is mostly about (a chicken curry is Chicken; spaghetti \
            carbonara is Pasta). Estimate the total time to make it from the steps, in minutes.
            """)
        let prompt = """
            Name: \(recipe.displayTitle)
            Ingredients:
            \(recipe.ingredients.prefix(30).joined(separator: "\n"))
            Steps:
            \(recipe.steps.prefix(15).joined(separator: "\n"))
            """
        do {
            return try await session.respond(to: prompt, generating: GeneratedTags.self,
                                             options: GenerationOptions(samplingMode: .greedy)).content
        } catch {
            log.error("Tagging \(recipe.displayTitle, privacy: .private) failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
    #endif

    /// Without Apple Intelligence: the first main ingredient named in the list.
    static func guessMain(_ ingredients: [String]) -> String {
        let words: [(String, [String])] = [
            ("Chicken", ["chicken"]), ("Beef", ["beef", "steak", "mince"]), ("Pork", ["pork", "bacon", "sausage", "ham"]),
            ("Lamb", ["lamb"]), ("Fish", ["salmon", "cod", "tuna", "fish"]), ("Seafood", ["shrimp", "prawn", "scallop", "crab", "mussel"]),
            ("Tofu", ["tofu"]), ("Pasta", ["pasta", "spaghetti", "rigatoni", "penne", "linguine", "fettuccine", "macaroni"]),
            ("Noodles", ["noodle", "ramen", "udon", "soba"]), ("Rice", ["rice"]), ("Beans & lentils", ["lentil", "chickpea", "beans"]),
            ("Chocolate", ["chocolate", "cocoa"]), ("Eggs", ["egg"]),
        ]
        let text = ingredients.joined(separator: " ").lowercased()
        return words.first { $0.1.contains(where: text.contains) }?.0 ?? ""
    }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
private struct GeneratedTags {
    @Guide(description: "When it's eaten", .anyOf(RecipeTags.meals))
    var meal: String
    @Guide(description: "The cuisine it comes from", .anyOf(RecipeTags.cuisines))
    var cuisine: String
    @Guide(description: "What the dish is mostly about", .anyOf(RecipeTags.mains))
    var mainIngredient: String
    @Guide(description: "Rough total time to make it, in minutes", .range(5...600))
    var minutes: Int
}
#endif
