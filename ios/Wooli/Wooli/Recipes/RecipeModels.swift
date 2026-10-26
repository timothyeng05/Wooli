import Foundation
import SwiftData

// Recipes: share an Instagram reel to Wooli and keep its recipe. The caption
// is split into ingredients and steps on the iPhone (`RecipeParser`, then
// Apple Intelligence if that finds nothing). Stored in SwiftData, so it
// syncs through the user's iCloud like Movies.

@Model
final class RecipeEntry {
    var id: String = UUID().uuidString
    var title: String = ""
    /// One ingredient per line.
    var ingredientsText: String = ""
    /// One step per line.
    var stepsText: String = ""
    var notes: String = ""
    /// The caption as Instagram gave it, so nothing the parser dropped is lost.
    var caption: String = ""
    /// The reel, without Instagram's tracking query; also how the same reel merges.
    var sourceURL: String = ""
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now

    init(_ draft: RecipeDraft) {
        apply(draft)
    }

    var ingredients: [String] { RecipeDraft.lines(ingredientsText) }
    var steps: [String] { RecipeDraft.lines(stepsText) }
    var link: URL? { URL(string: sourceURL) }

    var draft: RecipeDraft {
        RecipeDraft(title: title, ingredients: ingredientsText, steps: stepsText, notes: notes, caption: caption, sourceURL: sourceURL)
    }

    func apply(_ draft: RecipeDraft) {
        title = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        ingredientsText = RecipeDraft.lines(draft.ingredients).joined(separator: "\n")
        stepsText = RecipeDraft.lines(draft.steps).joined(separator: "\n")
        notes = draft.notes
        caption = draft.caption
        sourceURL = draft.sourceURL
        updatedAt = .now
    }

    /// "8 ingredients · 5 steps"
    var summary: String {
        let i = ingredients.count, s = steps.count
        return [i > 0 ? "\(i) ingredient\(i == 1 ? "" : "s")" : "", s > 0 ? "\(s) step\(s == 1 ? "" : "s")" : ""]
            .filter { !$0.isEmpty }.joined(separator: " · ")
    }
}

/// What the editor works on before it's saved; lists are one item per line.
struct RecipeDraft: Equatable {
    var title = ""
    var ingredients = ""
    var steps = ""
    var notes = ""
    var caption = ""
    var sourceURL = ""

    init(title: String = "", ingredients: String = "", steps: String = "", notes: String = "", caption: String = "", sourceURL: String = "") {
        self.title = title
        self.ingredients = ingredients
        self.steps = steps
        self.notes = notes
        self.caption = caption
        self.sourceURL = sourceURL
    }

    init(_ parsed: RecipeParser.Recipe, caption: String, sourceURL: String) {
        self.init(title: parsed.title, ingredients: parsed.ingredients.joined(separator: "\n"),
                  steps: parsed.steps.joined(separator: "\n"), caption: caption, sourceURL: sourceURL)
    }

    static func lines(_ text: String) -> [String] {
        text.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }

    /// instagram.com/reel/ABC/?igsh=… → instagram.com/reel/ABC/
    static func cleanLink(_ url: URL) -> String {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url.absoluteString }
        components.query = nil
        components.fragment = nil
        return components.url?.absoluteString ?? url.absoluteString
    }
}

/// Splits a recipe caption into a title, ingredients and steps. Captions
/// usually have "Ingredients:" / "Method:" headings; without them, bulleted
/// or measured lines read as ingredients and numbered lines as steps.
enum RecipeParser {
    struct Recipe: Equatable {
        var title = ""
        var ingredients: [String] = []
        var steps: [String] = []
    }

    private enum Section { case intro, ingredients, steps, other }

    /// Whether a shared reel is a recipe rather than places to eat: an
    /// "Ingredients" heading, or a list of at least 3 things plus steps. A
    /// 📍 means places unless there's that heading.
    static func looksLikeRecipe(_ caption: String) -> Bool {
        let hasHeading = caption.split(whereSeparator: \.isNewline)
            .contains { heading($0.trimmingCharacters(in: .whitespaces))?.0 == .ingredients }
        if hasHeading { return true }
        if caption.contains("📍") { return false }
        let recipe = parse(caption)
        return recipe.ingredients.count >= 3 && !recipe.steps.isEmpty
    }

    static func parse(_ caption: String) -> Recipe {
        var recipe = Recipe()
        var intro: [String] = []
        var section = Section.intro
        var afterBlank = false
        /// Some lists number their ingredients; then only a gap and a new
        /// number start the method.
        var numberedList = false

        for raw in caption.split(omittingEmptySubsequences: false, whereSeparator: \.isNewline) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                afterBlank = true
                continue
            }
            defer { afterBlank = false }
            if isNoise(line) { continue }

            if case let (kind, rest)? = heading(line) {
                section = kind
                // "Ingredients: 2 eggs, 1 cup flour, salt"
                if kind == .ingredients, !rest.isEmpty {
                    recipe.ingredients += rest.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                } else if kind == .steps, !rest.isEmpty {
                    recipe.steps.append(rest)
                }
                continue
            }

            switch section {
            case .ingredients:
                // Many captions go straight from the list to the method:
                // a numbered line, or a sentence after a gap.
                if recipe.ingredients.isEmpty && isNumbered(line) { numberedList = true }
                let numberedStep = isNumbered(line) && (!numberedList || afterBlank)
                if numberedStep || (afterBlank && !isBulleted(line) && !startsWithAmount(line) && line.count > 50) {
                    section = .steps
                    recipe.steps.append(stepText(line))
                } else {
                    recipe.ingredients.append(numberedList ? stepText(line) : itemText(line))
                }
            case .steps:
                recipe.steps.append(stepText(line))
            case .other:
                continue
            case .intro:
                intro.append(line)
            }
        }

        // No headings: go by the shape of each line.
        if recipe.ingredients.isEmpty && recipe.steps.isEmpty {
            var rest: [String] = []
            for line in intro {
                if isNumbered(line) {
                    recipe.steps.append(stepText(line))
                } else if isBulleted(line) || startsWithAmount(line) {
                    recipe.ingredients.append(itemText(line))
                } else {
                    rest.append(line)
                }
            }
            intro = rest
        }

        recipe.title = intro.first.map(title) ?? ""
        return recipe
    }

    // MARK: Lines

    private static let ingredientWords = ["ingredients", "ingredient", "you'll need", "you will need", "what you need", "shopping list"]
    private static let stepWords = ["instructions", "instruction", "method", "directions", "steps", "how to make it", "how to make",
                                    "preparation"]
    /// Headings that end the recipe part ("Notes:", "Tips:"); what follows is skipped.
    private static let otherWords = ["notes", "note", "tips", "tip", "nutrition", "macros", "storage"]

    /// "🛒 INGREDIENTS (serves 4):" → (.ingredients, "") ;  "Method: mix it all" → (.steps, "mix it all")
    private static func heading(_ line: String) -> (Section, String)? {
        var label = line
        var rest = ""
        if let colon = line.firstIndex(of: ":") {
            label = String(line[..<colon])
            rest = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
        }
        let words = label.lowercased().filter { $0.isLetter || $0 == " " || $0 == "'" }
            .split(separator: " ").joined(separator: " ")
        // A heading is short: the keyword plus a few words ("Ingredients for 2").
        guard !words.isEmpty, words.count <= 30 else { return nil }
        // Without a colon, the whole line has to be the heading ("INGREDIENTS").
        let allowsMore = line.contains(":")
        func hit(_ keywords: [String]) -> Bool {
            keywords.contains { words == $0 || (allowsMore && words.hasPrefix($0 + " ")) || words.hasPrefix($0 + " for ") || words.hasPrefix($0 + " serves ") }
        }
        if hit(ingredientWords) { return (.ingredients, rest) }
        if hit(stepWords) { return (.steps, rest) }
        if line.contains(":"), hit(otherWords) { return (.other, rest) }
        return nil
    }

    /// Hashtag blocks, "follow / save this" lines, and "Prep time: 10 min".
    static func isNoise(_ line: String) -> Bool {
        let tokens = line.split(separator: " ")
        if !tokens.isEmpty && tokens.allSatisfy({ $0.hasPrefix("#") || $0.hasPrefix("@") }) { return true }
        let lower = line.lowercased()
        if line.contains(":"), ["prep time", "cook time", "total time", "serves", "servings", "makes", "yield"].contains(where: { lower.hasPrefix($0) }) {
            return true
        }
        return ["link in bio", "follow @", "follow for", "follow me", "save this", "save for later", "share this", "tag a friend", "tag someone"]
            .contains { lower.contains($0) }
    }

    /// "1.", "1)", "Step 1:", "1️⃣" — but not "1.5 cups" or "1 cup".
    static func isNumbered(_ line: String) -> Bool {
        line.contains(numberPrefix)
    }

    // Scalar semantics, so "1️⃣" is a digit plus its keycap marks.
    private static let numberPrefix = try! Regex("^(?:(?i:step)\\s*\\d{1,2}|\\d{1,2}\\u{FE0F}?\\u{20E3}|\\d{1,2}\\s*[.):\\-]\\s)")
        .matchingSemantics(.unicodeScalar)
    private static let numberToStrip = try! Regex("^(?:(?i:step)\\s*\\d{1,2}\\s*[.):\\-]?\\s*|\\d{1,2}\\u{FE0F}?\\u{20E3}\\s*|\\d{1,2}\\s*[.):\\-]\\s+)")
        .matchingSemantics(.unicodeScalar)

    static func isBulleted(_ line: String) -> Bool {
        guard let first = line.first else { return false }
        return bullets.contains(first)
    }

    /// "2 cups…", "½ tsp…", "a pinch of…"
    static func startsWithAmount(_ line: String) -> Bool {
        guard let first = line.first else { return false }
        if first.isNumber || "½⅓⅔¼¾⅛".contains(first) { return true }
        let lower = line.lowercased()
        return ["a pinch", "pinch of", "a handful", "handful of", "a splash", "a dash", "salt and pepper", "salt & pepper"].contains { lower.hasPrefix($0) }
    }

    private static let bullets: Set<Character> = ["-", "•", "*", "▪", "▪️", "◦", "‣", "·", "–", "—", "✔", "✔️", "✅", "🔸", "🔹", "▫️", "➡️", "👉", "○", "●"]

    private static func itemText(_ line: String) -> String {
        String(line.drop { bullets.contains($0) || $0 == " " })
    }

    private static func stepText(_ line: String) -> String {
        var text = itemText(line)
        text = text.replacing(numberToStrip, with: "")
        return text.isEmpty ? line : text
    }

    private static let trailingTags = try! Regex("(\\s+[#@]\\S+)+$")

    /// The first line, without trailing hashtags, cut at a sentence if it's long.
    private static func title(_ line: String) -> String {
        var text = line.replacing(trailingTags, with: "").trimmingCharacters(in: .whitespaces)
        if text.count > 80, let end = text.firstIndex(where: { ".!?".contains($0) }), text.distance(from: text.startIndex, to: end) >= 10 {
            text = String(text[..<end])
        }
        return text.count > 80 ? String(text.prefix(80)).trimmingCharacters(in: .whitespaces) + "…" : text
    }
}
