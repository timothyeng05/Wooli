import Foundation
import SwiftData

/// Demo data for modules in sample mode: ~6 months of periods.
/// Only seeds when the module has no data yet.
enum ModuleSampleData {
    static func seed(_ module: WooliModule, context: ModelContext) {
        let cal = Calendar.current
        let today = cal.startOfDay(for: .now)
        var rng = SeededRNG(seed: 11)
        switch module {
        case .period:
            guard ((try? context.fetchCount(FetchDescriptor<PeriodEntry>())) ?? 0) == 0 else { return }
            // Walk back from a recent start: cycles 27–30 days, periods 4–6 days.
            var start = cal.date(byAdding: .day, value: -Int.random(in: 9...14, using: &rng), to: today)!
            let flows = ["light", "medium", "heavy"]
            for _ in 0..<7 {
                let length = Int.random(in: 4...6, using: &rng)
                let e = PeriodEntry(startDay: start, endDay: cal.date(byAdding: .day, value: length - 1, to: start))
                e.flowRaw = flows.randomElement(using: &rng)!
                e.symptoms = Array(CycleMath.symptoms.shuffled(using: &rng).prefix(Int.random(in: 0...3, using: &rng)))
                context.insert(e)
                start = cal.date(byAdding: .day, value: -Int.random(in: 27...30, using: &rng), to: start)!
            }
        }
        try? context.save()
    }

    /// Eats places and wishes, ranked movies and two recipes, for Simulator
    /// screenshots (`-sampleApps`). Skips any app that already has data.
    @MainActor static func seedApps(context: ModelContext) {
        let cal = Calendar.current
        let book = EatsBook.shared
        if book.mine.isEmpty {
            let places: [(String, String, Double, Double, MealSentiment, Int)] = [
                ("Lucali", "575 Henry St, Brooklyn", 40.6818, -73.9995, .mustTry, 12),
                ("Via Carota", "51 Grove St, New York", 40.7334, -74.0036, .mustTry, 30),
                ("Los Tacos No. 1", "75 9th Ave, New York", 40.7423, -74.0060, .mustTry, 5),
                ("Xi'an Famous Foods", "45 Bayard St, New York", 40.7149, -73.9978, .liked, 21),
                ("Katz's Delicatessen", "205 E Houston St, New York", 40.7223, -73.9874, .liked, 44),
                ("Joe's Pizza", "7 Carmine St, New York", 40.7306, -74.0021, .liked, 9),
                ("Russ & Daughters", "179 E Houston St, New York", 40.7226, -73.9882, .fine, 60),
            ]
            for (i, p) in places.enumerated() {
                let day = DayKey.key(cal.date(byAdding: .day, value: -p.5, to: .now)!)
                var place = EatsPlace(name: p.0, place: TripPlace(name: p.0, address: p.1, latitude: p.2, longitude: p.3), visitedDay: day)
                place.sentiment = p.4
                place.rank = Double(places.count - i)
                book.save(place)
            }
            for (name, address, lat, lon) in [("Thai Diner", "186 Mott St, New York", 40.7203, -73.9955),
                                               ("Raku", "342 E 6th St, New York", 40.7270, -73.9862)] {
                book.addToWishlist(EatsPlace(name: name, place: TripPlace(name: name, address: address, latitude: lat, longitude: lon)))
            }
        }

        if ((try? context.fetchCount(FetchDescriptor<MovieEntry>())) ?? 0) == 0 {
            let films: [(String, String, String, String, MealSentiment)] = [
                ("Spirited Away", "2001", "Hayao Miyazaki", "Animation", .mustTry),
                ("Parasite", "2019", "Bong Joon Ho", "Thriller", .mustTry),
                ("In the Mood for Love", "2000", "Wong Kar-wai", "Romance", .mustTry),
                ("Past Lives", "2023", "Celine Song", "Drama", .liked),
                ("La La Land", "2016", "Damien Chazelle", "Musical", .liked),
                ("Dune: Part Two", "2024", "Denis Villeneuve", "Science Fiction", .liked),
                ("Tenet", "2020", "Christopher Nolan", "Action", .fine),
            ]
            for (i, f) in films.enumerated() {
                let movie = MovieEntry(MovieSearch.Result(id: "sample:\(i)", title: f.0, year: f.1, director: f.2,
                                                          genre: f.3, posterURL: "", synopsis: ""))
                movie.sentiment = f.4
                movie.rank = Double(films.count - i)
                movie.watchedDay = DayKey.key(cal.date(byAdding: .day, value: -(i * 9 + 3), to: .now)!)
                context.insert(movie)
            }
        }

        if ((try? context.fetchCount(FetchDescriptor<RecipeEntry>())) ?? 0) == 0 {
            context.insert(RecipeEntry(RecipeDraft(
                title: "Spicy vodka rigatoni",
                ingredients: "200 g rigatoni\n2 tbsp butter\n1 shallot, finely chopped\n2 cloves garlic\n2 tbsp tomato paste\n1 tsp chili flakes\n2 tbsp vodka\n120 ml heavy cream\n40 g parmesan, grated\nBasil to serve",
                steps: "Boil the rigatoni in salted water until al dente; keep a cup of pasta water.\nMelt the butter and soften the shallot and garlic.\nStir in the tomato paste and chili flakes and cook until deep red.\nAdd the vodka and let it bubble off.\nPour in the cream, then toss in the pasta with a splash of pasta water.\nFinish with parmesan and basil.",
                notes: "Use a splash more chili if you like it hot.")))
            context.insert(RecipeEntry(RecipeDraft(
                title: "Miso salmon rice bowl",
                ingredients: "2 salmon fillets\n1 tbsp white miso\n1 tbsp honey\n1 tsp soy sauce\n2 cups cooked rice\n1 cucumber\n1 avocado\nSesame seeds",
                steps: "Mix the miso, honey and soy sauce.\nBrush over the salmon and bake at 200°C for 12 minutes.\nSlice the cucumber and avocado.\nServe the salmon over rice with the vegetables and sesame seeds.")))
        }
        try? context.save()
    }
}

/// Deterministic randomness so sample data looks the same each time.
struct SeededRNG: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}
