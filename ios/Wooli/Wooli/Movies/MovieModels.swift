import Foundation
import SwiftData

// Movies: Beli for films. Same flow as Eats — pick a feeling, then "which
// was better?" against movies with that feeling — reusing `RankFlow` and
// `EatsRanking`. Stored in SwiftData, so it syncs through the user's iCloud
// like Period; there's no sharing with friends yet.

@Model
final class MovieEntry {
    var id: String = UUID().uuidString
    var title: String = ""
    /// Release year, "" if unknown.
    var year: String = ""
    var director: String = ""
    var genre: String = ""
    var posterURL: String = ""
    var synopsis: String = ""
    /// Source id ("tmdb:<id>", or an iTunes id for films added before
    /// 2026-10), so the same film added on two devices merges.
    var appleID: String = ""
    var sentimentRaw: String = "liked"
    /// Order within the sentiment (higher = better); only the order matters.
    var rank: Double = 0
    /// "yyyy-MM-dd" you watched it.
    var watchedDay: String = ""
    var notes: String = ""
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now
    /// Saved to watch, not ranked yet; doesn't count toward your list or score.
    var isWishlist: Bool = false

    init(_ result: MovieSearch.Result, wishlist: Bool = false) {
        title = result.title
        year = result.year
        director = result.director
        genre = result.genre
        posterURL = result.posterURL
        synopsis = result.synopsis
        appleID = result.id
        watchedDay = DayKey.key(.now)
        isWishlist = wishlist
    }

    var sentiment: MealSentiment {
        get { MealSentiment(rawValue: sentimentRaw) ?? .liked }
        set { sentimentRaw = newValue.rawValue }
    }

    /// "2010 · Christopher Nolan"
    var byline: String { [year, director].filter { !$0.isEmpty }.joined(separator: " · ") }

    var candidate: RankCandidate {
        RankCandidate(id: id, title: title, subtitle: byline, sentiment: sentiment, rank: rank,
                      detail: [genre, notes, synopsis].filter { !$0.isEmpty }.joined(separator: "\n\n"))
    }
}

extension MealSentiment {
    /// The feeling's name for a film; Eats' "Must try" reads wrong here.
    var movieLabel: String {
        switch self {
        case .mustTry: "All-time favorite"
        default: label
        }
    }
}

/// Film lookup through TMDB (themoviedb.org). Apple's iTunes Search stopped
/// returning films in 2026-10. The key comes from `TMDB_API_KEY` in the
/// git-ignored `Config/Secrets.xcconfig`, through Info.plist.
enum MovieSearch {
    struct Result: Identifiable, Hashable {
        /// "tmdb:<id>"; films added before the switch keep their iTunes id.
        let id: String
        let title: String
        let year: String
        let director: String
        let genre: String
        let posterURL: String
        let synopsis: String

        var byline: String { [year, director].filter { !$0.isEmpty }.joined(separator: " · ") }
    }

    enum SearchError: Error {
        case noKey
    }

    private struct Response: Decodable {
        let results: [Item]
    }

    private struct Item: Decodable {
        let id: Int
        let title: String?
        let release_date: String?
        let poster_path: String?
        let overview: String?
    }

    private struct Details: Decodable {
        struct Genre: Decodable { let name: String }
        struct Crew: Decodable { let job: String?; let name: String }
        struct Credits: Decodable { let crew: [Crew] }
        let genres: [Genre]?
        let credits: Credits?
    }

    private static let key = (Bundle.main.object(forInfoDictionaryKey: "TMDBAPIKey") as? String ?? "")
        .trimmingCharacters(in: .whitespaces)

    static var isConfigured: Bool { !key.isEmpty && !key.hasPrefix("$(") }

    static func search(_ term: String) async throws -> [Result] {
        let response: Response = try await get("search/movie", [
            URLQueryItem(name: "query", value: term),
            URLQueryItem(name: "include_adult", value: "false"),
        ])
        return response.results.compactMap { item in
            guard let title = item.title, !title.isEmpty else { return nil }
            return Result(id: "tmdb:\(item.id)", title: title,
                          year: String((item.release_date ?? "").prefix(4)),
                          director: "", genre: "",
                          posterURL: item.poster_path.map { "https://image.tmdb.org/t/p/w500\($0)" } ?? "",
                          synopsis: item.overview ?? "")
        }
    }

    /// Fills in director and genre, which search results don't carry. On
    /// failure the film is added without them.
    static func details(_ result: Result) async -> Result {
        guard let id = result.id.split(separator: ":").last,
              let details: Details = try? await get("movie/\(id)", [URLQueryItem(name: "append_to_response", value: "credits")])
        else { return result }
        let directors = (details.credits?.crew ?? []).filter { $0.job == "Director" }.map(\.name)
        return Result(id: result.id, title: result.title, year: result.year,
                      director: directors.prefix(2).joined(separator: ", "),
                      genre: (details.genres ?? []).prefix(2).map(\.name).joined(separator: ", "),
                      posterURL: result.posterURL, synopsis: result.synopsis)
    }

    /// TMDB takes the v3 API key as a parameter, or the longer read access
    /// token as a bearer header; either works here.
    private static func get<T: Decodable>(_ path: String, _ items: [URLQueryItem]) async throws -> T {
        guard isConfigured else { throw SearchError.noKey }
        var components = URLComponents(string: "https://api.themoviedb.org/3/\(path)")!
        let bearer = key.contains(".")
        components.queryItems = items + [URLQueryItem(name: "language", value: "en-US")]
            + (bearer ? [] : [URLQueryItem(name: "api_key", value: key)])
        var request = URLRequest(url: components.url!)
        if bearer { request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
