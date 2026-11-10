import SwiftUI
import SwiftData

// MARK: - Your list

/// Movies' main screen: Seen (ranked, best first) and Want to see, with
/// filter pills, sort and search like Eats.
struct MoviesListView: View {
    @Environment(\.modelContext) private var context
    @Query private var movies: [MovieEntry]
    @State private var adding = false
    @State private var picked: MovieSearch.Result?
    @State private var wished: MovieSearch.Result?
    @State private var ranking: MovieSearch.Result?
    @State private var promoting: MovieEntry?
    @State private var detail: MovieEntry?
    @State private var tab = Tab.seen
    @State private var sort = Sort.rank
    @State private var genre: String?
    @State private var decade: String?
    @State private var director: String?
    @State private var feeling: String?
    @State private var query = ""

    enum Tab: Hashable { case seen, wantToSee }

    enum Sort: String, CaseIterable, Identifiable {
        case rank = "Rank", recent = "Recent", year = "Newest film", name = "A–Z"
        var id: String { rawValue }
    }

    /// Your latest film on a cinema stub, or an invitation when the list is empty.
    private func hero(_ ordered: [MovieEntry]) -> some View {
        let latest = ordered.max { $0.createdAt < $1.createdAt }
        return CinemaStub(
            title: latest?.title ?? "Your list · 0 movies",
            meta: latest.map { [$0.byline, $0.genre].filter { !$0.isEmpty }.joined(separator: " · ") },
            rank: latest.flatMap { latest in ordered.firstIndex { $0.id == latest.id }.map { $0 + 1 } })
    }

    var body: some View {
        let wishlist = movies.filter(\.isWishlist).sorted { $0.createdAt > $1.createdAt }
        let ranked = movies.filter { !$0.isWishlist }
        let candidates = ranked.map(\.candidate)
        let scores = EatsRanking.scores(candidates, scale: .movies)
        let byID = Dictionary(ranked.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let ordered = EatsRanking.ordered(candidates).compactMap { byID[$0.id] }
        // Rank numbers stay each film's place on the whole list, whatever's filtered.
        let position = Dictionary(ordered.enumerated().map { ($1.id, $0 + 1) }, uniquingKeysWith: { a, _ in a })
        let pool = tab == .seen ? ordered : wishlist
        let shown = sorted(filtered(pool))

        List {
            if tab == .seen {
                Section {
                    hero(ordered)
                        .listRowInsets(EdgeInsets(top: Space.s, leading: Space.l, bottom: Space.s, trailing: Space.l))
                        .listRowBackground(Color.clear)
                }
            }
            Section {
                controls(pool, wishCount: wishlist.count)
                    .listRowInsets(EdgeInsets(top: Space.s, leading: Space.l, bottom: Space.s, trailing: Space.l))
                    .listRowBackground(Color.clear)
            }
            if pool.isEmpty {
                if tab == .seen {
                    WooliEmptyState(symbol: "film", title: "Add a movie you loved",
                                    message: "Rank the movies you've seen against each other; where they land sets their place on your list.",
                                    actionTitle: "Add movie") { adding = true }
                        .listRowBackground(Color.clear)
                } else {
                    WooliEmptyState(symbol: "popcorn", title: "Nothing saved to watch",
                                    message: "Search a film and tap Want to see to keep it here until you've watched it.",
                                    actionTitle: "Find a movie") { adding = true }
                        .listRowBackground(Color.clear)
                }
            } else if shown.isEmpty {
                ContentUnavailableView {
                    Label("No matches", systemImage: "line.3.horizontal.decrease.circle")
                } actions: {
                    Button("Clear filters") { clearFilters() }
                }
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(shown) { movie in
                        if tab == .seen {
                            Button { detail = movie } label: {
                                MovieRow(movie: movie, index: position[movie.id] ?? 0, score: scores[movie.id])
                            }
                            .buttonStyle(.plain)
                        } else {
                            wishRow(movie)
                        }
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Title, director or genre")
        .navigationTitle("Movies")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add a movie", systemImage: "plus") { adding = true }
            }
        }
        .sheet(isPresented: $adding, onDismiss: {
            // Already on the list: open it (or rank it, if it was only a wish)
            // instead of adding it twice. Films added before the move to TMDB
            // have iTunes ids, so match title and year too.
            if let result = picked {
                picked = nil
                if let existing = movies.first(where: { $0.appleID == result.id || ($0.title == result.title && $0.year == result.year) }) {
                    if existing.isWishlist { promoting = existing } else { detail = existing }
                } else {
                    ranking = result
                }
            }
            if let result = wished {
                wished = nil
                if !movies.contains(where: { $0.appleID == result.id || ($0.title == result.title && $0.year == result.year) }) {
                    context.insert(MovieEntry(result, wishlist: true))
                }
            }
        }) {
            NavigationStack {
                MovieSearchView(onPick: { picked = $0 }, onWish: { wished = $0 })
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false } } }
            }
        }
        .sheet(item: $ranking) { result in
            RankFlow(candidate: RankCandidate(id: result.id, title: result.title, subtitle: result.byline),
                     others: candidates,
                     onFinish: { sentiment, rank in
                         let movie = MovieEntry(result)
                         movie.sentiment = sentiment
                         movie.rank = rank
                         context.insert(movie)
                     },
                     symbol: "film", symbolColor: AppSpace.movies.tint, label: { $0.movieLabel }, scale: .movies)
        }
        .sheet(item: $promoting) { movie in
            RankFlow(candidate: movie.candidate, others: candidates.filter { $0.id != movie.id },
                     onFinish: { sentiment, rank in
                         movie.sentiment = sentiment
                         movie.rank = rank
                         movie.isWishlist = false
                         movie.watchedDay = DayKey.key(.now)
                         movie.createdAt = .now
                     },
                     symbol: "film", symbolColor: AppSpace.movies.tint, label: { $0.movieLabel }, scale: .movies)
        }
        .listDetail($detail) { movie in
            MovieDetail(movie: movie)
        } empty: {
            SideDetailPlaceholder(text: "Choose a movie to see it here.", systemImage: "popcorn")
        }
    }

    // MARK: Filters

    /// Tabs, then pills for what this list actually has, then sort.
    private func controls(_ pool: [MovieEntry], wishCount: Int) -> some View {
        let genres = Set(pool.flatMap(\.genre.commaParts)).sorted()
        let decades = Set(pool.compactMap(\.decade)).sorted(by: >)
        let directors = Set(pool.flatMap(\.director.commaParts)).sorted()
        let feelings = MealSentiment.allCases.filter { s in pool.contains { $0.sentiment == s } }.map(\.movieLabel)
        return VStack(alignment: .leading, spacing: 14) {
            UnderlineTabs(tabs: [(Tab.seen, "Seen"), (Tab.wantToSee, wishCount > 0 ? "Want to see · \(wishCount)" : "Want to see")],
                          selection: Binding(get: { tab }, set: { tab = $0; clearFilters() }))
            if pool.count > 1 {
                FilterPillRow(isFiltering: isFiltering, onClear: clearFilters) {
                    if genres.count > 1 || genre != nil { FilterPill(title: "Genre", value: $genre, options: genres) }
                    if decades.count > 1 || decade != nil { FilterPill(title: "Decade", value: $decade, options: decades) }
                    if tab == .seen, feelings.count > 1 || feeling != nil { FilterPill(title: "Feeling", value: $feeling, options: feelings) }
                    if directors.count > 1 || director != nil { FilterPill(title: "Director", value: $director, options: directors) }
                }
                SortMenu(options: tab == .seen ? Sort.allCases : [.recent, .year, .name], selection: $sort)
            }
        }
    }

    private var isFiltering: Bool { genre != nil || decade != nil || director != nil || feeling != nil }

    private func clearFilters() {
        genre = nil
        decade = nil
        director = nil
        feeling = nil
        query = ""
        if tab == .wantToSee && sort == .rank { sort = .recent }
    }

    private func filtered(_ list: [MovieEntry]) -> [MovieEntry] {
        let text = query.trimmingCharacters(in: .whitespaces)
        return list.filter { movie in
            (genre == nil || movie.genre.commaParts.contains(genre!))
                && (decade == nil || movie.decade == decade)
                && (director == nil || movie.director.commaParts.contains(director!))
                && (feeling == nil || movie.sentiment.movieLabel == feeling)
                && (text.isEmpty || movie.title.localizedStandardContains(text) || movie.director.localizedStandardContains(text)
                    || movie.genre.localizedStandardContains(text))
        }
    }

    /// Rank keeps the list's own order (best first; wishes newest first).
    private func sorted(_ list: [MovieEntry]) -> [MovieEntry] {
        switch sort {
        case .rank: list
        case .recent: list.sorted { tab == .seen ? ($0.watchedDay, $0.createdAt) > ($1.watchedDay, $1.createdAt) : $0.createdAt > $1.createdAt }
        case .year: list.sorted { $0.year > $1.year }
        case .name: list.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        }
    }

    /// A saved-but-unseen film: same row as the list, with a way to rank it once you have.
    private func wishRow(_ movie: MovieEntry) -> some View {
        ItemRow(title: movie.title, subtitle: wishSubtitle(movie), leading: {
            MoviePoster(url: movie.posterURL, width: 40)
        }, trailing: {
            Button("Seen it") { promoting = movie }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(.secondary).controlSize(.small)
                .fixedSize()
        })
        .swipeActions {
            Button("Remove", role: .destructive) { context.delete(movie) }
        }
    }

    private func wishSubtitle(_ movie: MovieEntry) -> Text? {
        let facts = [movie.byline, movie.genre].filter { !$0.isEmpty }
        return facts.isEmpty ? nil : Text(facts.joined(separator: " · "))
    }
}

extension MovieEntry {
    /// "1990s", or nil without a year.
    var decade: String? {
        guard let y = Int(year.prefix(4)), y > 1800 else { return nil }
        return "\(y / 10 * 10)s"
    }
}

/// One ranked film: poster, title, director and genre, and its stamp.
struct MovieRow: View {
    let movie: MovieEntry
    let index: Int
    let score: Double?

    var body: some View {
        ItemRow(title: movie.title, subtitle: subtitle, leading: {
            MoviePoster(url: movie.posterURL, width: 40)
        }, trailing: {
            if let score { MealScoreBadge(score: score, size: 40, rank: index, usesOwnRank: false, scale: .movies) }
        })
        .contentShape(Rectangle())
    }

    private var subtitle: Text? {
        let facts = [movie.byline, movie.genre].filter { !$0.isEmpty }
        return facts.isEmpty ? nil : Text(facts.joined(separator: " · "))
    }
}

/// A poster at 2:3, with a film icon while it loads or when there's none.
struct MoviePoster: View {
    let url: String
    var width: CGFloat

    var body: some View {
        AsyncImage(url: URL(string: url)) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Image(systemName: "film").font(.system(size: width * 0.35)).foregroundStyle(Theme.textTertiary)
        }
        .frame(width: width, height: width * 1.5)
        .background(Theme.border.opacity(0.4))
        .clipShape(RoundedRectangle(cornerRadius: max(4, width * 0.08), style: .continuous))
        .accessibilityHidden(true)
    }
}

// MARK: - Search

/// Find a film by title on TMDB.
struct MovieSearchView: View {
    let onPick: (MovieSearch.Result) -> Void
    let onWish: (MovieSearch.Result) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [MovieSearch.Result] = []
    @State private var searching = false
    @State private var failed = false
    @State private var picking: String?

    var body: some View {
        List {
            Section {
                ForEach(results) { result in
                    HStack(spacing: 12) {
                        MoviePoster(url: result.posterURL, width: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.title).font(.headline).foregroundStyle(Theme.text).lineLimit(2)
                            Text(result.byline).font(.subheadline).foregroundStyle(Theme.textSecondary).lineLimit(1)
                        }
                        Spacer()
                        if picking == result.id {
                            ProgressView()
                        } else {
                            // Stacked so two buttons don't squeeze the title on a phone.
                            VStack(alignment: .trailing, spacing: 6) {
                                Button("Seen it") { pick(result, wish: false) }
                                    .buttonStyle(.borderedProminent)
                                Button("Want to see") { pick(result, wish: true) }
                                    .buttonStyle(.bordered).tint(.secondary)
                            }
                            .font(.subheadline.weight(.semibold))
                            .buttonBorderShape(.capsule).controlSize(.small)
                            .fixedSize()
                        }
                    }
                    .disabled(picking != nil)
                }
            } footer: {
                // Attribution TMDB's terms ask for.
                if !results.isEmpty {
                    Text("Movie data from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.")
                }
            }
        }
        .overlay {
            if !MovieSearch.isConfigured {
                ContentUnavailableView("Movie search isn't set up", systemImage: "key",
                                       description: Text("This build has no TMDB API key."))
            } else if searching && results.isEmpty {
                ProgressView()
            } else if failed {
                ContentUnavailableView("Couldn't search", systemImage: "wifi.exclamationmark",
                                       description: Text("Check your connection and try again."))
            } else if results.isEmpty && !query.trimmingCharacters(in: .whitespaces).isEmpty {
                ContentUnavailableView.search(text: query)
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Movie title")
        .navigationTitle("Add a movie")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: query) {
            let term = query.trimmingCharacters(in: .whitespaces)
            guard !term.isEmpty else {
                results = []
                return
            }
            // Wait for a pause in typing; a newer keystroke cancels this task.
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            searching = true
            defer { searching = false }
            do {
                results = try await MovieSearch.search(term)
                failed = false
            } catch {
                if !Task.isCancelled { failed = true }
            }
        }
    }

    private func pick(_ result: MovieSearch.Result, wish: Bool) {
        picking = result.id
        Task {
            let detailed = await MovieSearch.details(result)
            if wish { onWish(detailed) } else { onPick(detailed) }
            dismiss()
        }
    }
}

// MARK: - A movie

/// A film on your list, laid out like the Eats place page: poster, title,
/// score and rank, the synopsis, then your own notes.
struct MovieDetail: View {
    @Bindable var movie: MovieEntry
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var movies: [MovieEntry]
    @State private var reranking = false
    @State private var closeAfterRank = false
    @State private var confirmDelete = false
    @Environment(\.closeSideDetail) private var closeSideDetail

    var body: some View {
        let all = movies.map(\.candidate)
        let ordered = EatsRanking.ordered(all)
        let score = EatsRanking.scores(all, scale: .movies)[movie.id] ?? 0
        let position = (ordered.firstIndex { $0.id == movie.id } ?? 0) + 1
        DetailFrame(onDone: { movie.updatedAt = .now; dismiss() }) {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack(alignment: .bottom, spacing: 16) {
                        MoviePoster(url: movie.posterURL, width: 120)
                            .shadow(color: .black.opacity(0.2), radius: 8, y: 4)
                        VStack(alignment: .leading, spacing: 6) {
                            Text(movie.title)
                                .font(.system(size: 28, weight: .heavy, design: .serif))
                                .foregroundStyle(Theme.text)
                                .lineLimit(4).minimumScaleFactor(0.7)
                            if !movie.byline.isEmpty {
                                Text(movie.byline).font(.subheadline).foregroundStyle(Theme.textSecondary)
                            }
                            if !movie.genre.isEmpty {
                                Text(movie.genre).font(.subheadline.weight(.semibold)).foregroundStyle(AppSpace.movies.tint)
                            }
                        }
                    }
                    HStack(spacing: 10) {
                        MealScoreBadge(score: score, size: 58, rank: position, usesOwnRank: false, scale: .movies)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(movie.sentiment.movieLabel).font(.subheadline.weight(.medium)).foregroundStyle(Theme.text)
                            Text("#\(position) of \(ordered.count) on your list").font(.caption).foregroundStyle(Theme.textSecondary)
                        }
                        Spacer()
                        Button("Rank again") { reranking = true }
                            .font(.subheadline.weight(.semibold))
                            .buttonStyle(.bordered).buttonBorderShape(.capsule).tint(.secondary)
                    }
                    if !movie.synopsis.isEmpty {
                        Text(movie.synopsis).font(.subheadline).foregroundStyle(Theme.textSecondary)
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Your notes").font(.title3.weight(.bold)).foregroundStyle(Theme.text).padding(.bottom, 6)
                        PlaceDetailRow(systemImage: "calendar") {
                            DatePicker("Watched", selection: Binding(get: { DayKey.date(movie.watchedDay) },
                                                                     set: { movie.watchedDay = DayKey.key($0) }),
                                       displayedComponents: .date)
                        }
                        PlaceDetailRow(systemImage: "square.and.pencil") {
                            TextField("Add notes — where you saw it, who with", text: $movie.notes, axis: .vertical)
                                .lineLimit(1...8)
                        }
                    }
                    Button("Remove from Movies", role: .destructive) { confirmDelete = true }
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.card)
            // Back to the list once it's ranked, like Eats.
            .sheet(isPresented: $reranking, onDismiss: { if closeAfterRank { dismiss() } }) {
                RankFlow(candidate: movie.candidate, others: movies.filter { $0.id != movie.id }.map(\.candidate),
                         onFinish: { sentiment, rank in
                             movie.sentiment = sentiment
                             movie.rank = rank
                             movie.updatedAt = .now
                             closeAfterRank = true
                         },
                         symbol: "film", symbolColor: AppSpace.movies.tint, label: { $0.movieLabel }, scale: .movies)
            }
            .confirmationDialog("Remove \(movie.title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    dismiss()
                    closeSideDetail()
                    context.delete(movie)
                }
            }
        }
    }
}
