import SwiftUI
import SwiftData

// MARK: - Your list

/// Movies' main screen: every film you've ranked, best first, with its score.
struct MoviesListView: View {
    @Environment(\.modelContext) private var context
    @Query private var movies: [MovieEntry]
    @State private var adding = false
    @State private var picked: MovieSearch.Result?
    @State private var ranking: MovieSearch.Result?
    @State private var detail: MovieEntry?

    var body: some View {
        let candidates = movies.map(\.candidate)
        let scores = EatsRanking.scores(candidates)
        let byID = Dictionary(movies.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        let ordered = EatsRanking.ordered(candidates).compactMap { byID[$0.id] }

        List {
            if ordered.isEmpty {
                ContentUnavailableView {
                    Label("Start your list", systemImage: "film")
                } description: {
                    Text("Add movies you've seen and rank them against each other. Scores follow where they land.")
                } actions: {
                    Button("Add a movie") { adding = true }.buttonStyle(.borderedProminent)
                }
            } else {
                Section("Your list") {
                    ForEach(Array(ordered.enumerated()), id: \.element.id) { index, movie in
                        Button { detail = movie } label: {
                            MovieRow(movie: movie, index: index + 1, score: scores[movie.id])
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .navigationTitle("Movies")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Add a movie", systemImage: "plus") { adding = true }
            }
        }
        .sheet(isPresented: $adding, onDismiss: {
            guard let result = picked else { return }
            picked = nil
            // Already ranked: open it instead of adding it twice.
            if let existing = movies.first(where: { $0.appleID == result.id }) { detail = existing } else { ranking = result }
        }) {
            NavigationStack {
                MovieSearchView { picked = $0 }
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { adding = false } } }
            }
        }
        .sheet(item: $ranking) { result in
            RankFlow(candidate: RankCandidate(id: result.id, title: result.title, subtitle: result.byline),
                     others: movies.map(\.candidate),
                     onFinish: { sentiment, rank in
                         let movie = MovieEntry(result)
                         movie.sentiment = sentiment
                         movie.rank = rank
                         context.insert(movie)
                     },
                     symbol: "film", symbolColor: AppSpace.movies.tint, label: { $0.movieLabel })
        }
        .sheet(item: $detail) { movie in
            MovieDetail(movie: movie)
        }
    }
}

/// One ranked film: position, poster, title, year and director, score.
struct MovieRow: View {
    let movie: MovieEntry
    let index: Int
    let score: Double?

    var body: some View {
        HStack(spacing: 12) {
            MoviePoster(url: movie.posterURL, width: 46)
            VStack(alignment: .leading, spacing: 3) {
                Text("\(index). \(movie.title)").font(.headline).foregroundStyle(Theme.text).lineLimit(2)
                if !movie.byline.isEmpty {
                    Text(movie.byline).font(.subheadline).foregroundStyle(Theme.textSecondary).lineLimit(1)
                }
                if !movie.genre.isEmpty {
                    Text(movie.genre).font(.caption).foregroundStyle(Theme.textTertiary).lineLimit(1)
                }
            }
            Spacer(minLength: 8)
            if let score { MealScoreBadge(score: score, size: 46) }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
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

/// Find a film by title on the iTunes Store.
struct MovieSearchView: View {
    let onPick: (MovieSearch.Result) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [MovieSearch.Result] = []
    @State private var searching = false
    @State private var failed = false

    var body: some View {
        List(results) { result in
            Button {
                onPick(result)
                dismiss()
            } label: {
                HStack(spacing: 12) {
                    MoviePoster(url: result.posterURL, width: 40)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(result.title).font(.headline).foregroundStyle(Theme.text)
                        Text(result.byline).font(.subheadline).foregroundStyle(Theme.textSecondary)
                    }
                }
            }
            .buttonStyle(.plain)
        }
        .overlay {
            if searching && results.isEmpty {
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

    var body: some View {
        let all = movies.map(\.candidate)
        let ordered = EatsRanking.ordered(all)
        let score = EatsRanking.scores(all)[movie.id] ?? 0
        let position = (ordered.firstIndex { $0.id == movie.id } ?? 0) + 1
        NavigationStack {
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
                        Text(score.formatted(.number.precision(.fractionLength(1))))
                            .font(.headline.weight(.bold)).monospacedDigit().foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(MealScoreBadge.ink(score), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
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
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        movie.updatedAt = .now
                        dismiss()
                    }
                }
            }
            // Back to the list once it's ranked, like Eats.
            .sheet(isPresented: $reranking, onDismiss: { if closeAfterRank { dismiss() } }) {
                RankFlow(candidate: movie.candidate, others: movies.filter { $0.id != movie.id }.map(\.candidate),
                         onFinish: { sentiment, rank in
                             movie.sentiment = sentiment
                             movie.rank = rank
                             movie.updatedAt = .now
                             closeAfterRank = true
                         },
                         symbol: "film", symbolColor: AppSpace.movies.tint, label: { $0.movieLabel })
            }
            .confirmationDialog("Remove \(movie.title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    dismiss()
                    context.delete(movie)
                }
            }
        }
    }
}
