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
    /// iTunes Store id, so the same film added on two devices merges.
    var appleID: String = ""
    var sentimentRaw: String = "liked"
    /// Order within the sentiment (higher = better); only the order matters.
    var rank: Double = 0
    /// "yyyy-MM-dd" you watched it.
    var watchedDay: String = ""
    var notes: String = ""
    var createdAt: Date = Date.now
    var updatedAt: Date = Date.now

    init(_ result: MovieSearch.Result) {
        title = result.title
        year = result.year
        director = result.director
        genre = result.genre
        posterURL = result.posterURL
        synopsis = result.synopsis
        appleID = result.id
        watchedDay = DayKey.key(.now)
    }

    var sentiment: MealSentiment {
        get { MealSentiment(rawValue: sentimentRaw) ?? .liked }
        set { sentimentRaw = newValue.rawValue }
    }

    /// "2010 · Christopher Nolan"
    var byline: String { [year, director].filter { !$0.isEmpty }.joined(separator: " · ") }

    var candidate: RankCandidate {
        RankCandidate(id: id, title: title, subtitle: byline, sentiment: sentiment, rank: rank)
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

/// Film lookup through Apple's iTunes Search API: free, no key, and the
/// same company that already powers place search.
enum MovieSearch {
    struct Result: Identifiable, Hashable {
        let id: String
        let title: String
        let year: String
        let director: String
        let genre: String
        let posterURL: String
        let synopsis: String

        var byline: String { [year, director].filter { !$0.isEmpty }.joined(separator: " · ") }
    }

    private struct Response: Decodable {
        let results: [Item]
    }

    private struct Item: Decodable {
        let trackId: Int?
        let trackName: String?
        let artistName: String?
        let releaseDate: String?
        let primaryGenreName: String?
        let artworkUrl100: String?
        let longDescription: String?
    }

    static func search(_ term: String) async throws -> [Result] {
        var components = URLComponents(string: "https://itunes.apple.com/search")!
        components.queryItems = [
            URLQueryItem(name: "term", value: term),
            URLQueryItem(name: "media", value: "movie"),
            URLQueryItem(name: "entity", value: "movie"),
            URLQueryItem(name: "limit", value: "25"),
        ]
        let (data, _) = try await URLSession.shared.data(from: components.url!)
        return try JSONDecoder().decode(Response.self, from: data).results.compactMap { item in
            guard let id = item.trackId, let title = item.trackName else { return nil }
            return Result(id: String(id), title: title,
                          year: String((item.releaseDate ?? "").prefix(4)),
                          director: item.artistName ?? "",
                          genre: item.primaryGenreName ?? "",
                          // The 100 px artwork has larger sizes at the same path.
                          posterURL: (item.artworkUrl100 ?? "").replacingOccurrences(of: "100x100bb", with: "600x600bb"),
                          synopsis: item.longDescription ?? "")
        }
    }
}
