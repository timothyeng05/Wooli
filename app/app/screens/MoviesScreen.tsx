"use client";

import { useMemo, useState } from "react";
import type { MealSentiment, MovieEntryRecord } from "@/lib/cloudkit/schema";

export interface MoviesScreenProps {
  movies: MovieEntryRecord[];
}

type MovieTab = "seen" | "wishlist";
type SortBy = "rank" | "recent" | "year" | "name";

const SENTIMENT_LABEL: Record<MealSentiment, string> = {
  mustTry: "All-time favorite",
  loved: "All-time favorite",
  liked: "Liked",
  fine: "Fine",
  disliked: "Disliked",
};

const SENTIMENT_STYLE: Record<MealSentiment, { bg: string; color: string }> = {
  mustTry: { bg: "#fef3c7", color: "#b45309" },
  loved: { bg: "#dcfce7", color: "#15803d" },
  liked: { bg: "#dbeafe", color: "#1d4ed8" },
  fine: { bg: "#ccfbf1", color: "#0f766e" },
  disliked: { bg: "#fee2e2", color: "#b91c1c" },
};

function computeMovieScores(
  movies: MovieEntryRecord[],
): Map<string, { score: number; rankPos: number }> {
  const result = new Map<string, { score: number; rankPos: number }>();
  const bands: { sentiments: MealSentiment[]; min: number; max: number }[] = [
    { sentiments: ["mustTry", "loved", "liked"], min: 7.0, max: 10.0 },
    { sentiments: ["fine"], min: 4.0, max: 6.9 },
    { sentiments: ["disliked"], min: 0.0, max: 3.9 },
  ];

  const ordered: MovieEntryRecord[] = [];
  for (const band of bands) {
    const group = band.sentiments.flatMap((s) =>
      movies.filter((m) => !m.isWishlist && m.sentiment === s).sort((a, b) => b.rank - a.rank),
    );
    group.forEach((movie, i) => {
      const t = group.length === 1 ? 0 : i / (group.length - 1);
      const raw = band.max - (band.max - band.min) * t;
      const score = Math.floor(raw * 10 + 1e-9) / 10;
      ordered.push(movie);
      result.set(movie.id, { score, rankPos: ordered.length });
    });
  }
  return result;
}

export function MoviesScreen({ movies }: MoviesScreenProps) {
  const [tab, setTab] = useState<MovieTab>("seen");
  const [sort, setSort] = useState<SortBy>("rank");
  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const seenMovies = useMemo(() => movies.filter((m) => !m.isWishlist), [movies]);
  const wishMovies = useMemo(() => movies.filter((m) => m.isWishlist), [movies]);
  const scores = useMemo(() => computeMovieScores(seenMovies), [seenMovies]);

  const pool = tab === "seen" ? seenMovies : wishMovies;

  const genres = useMemo(() => {
    const set = new Set<string>();
    for (const m of pool) {
      for (const g of m.genre.split(",")) {
        const trimmed = g.trim();
        if (trimmed) set.add(trimmed);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = pool.filter((m) => {
      if (tab === "seen" && sentimentFilter && m.sentiment !== sentimentFilter) return false;
      if (genreFilter && !m.genre.split(",").map((g) => g.trim()).includes(genreFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.director.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "year") return (b.year || "").localeCompare(a.year || "");
      if (sort === "recent") {
        if (tab === "wishlist") return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        return (b.watchedDay || "").localeCompare(a.watchedDay || "") || (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      if (tab === "seen") {
        return (scores.get(a.id)?.rankPos ?? 999999) - (scores.get(b.id)?.rankPos ?? 999999);
      }
      return (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.title.localeCompare(b.title);
    });
  }, [pool, tab, sentimentFilter, genreFilter, query, sort, scores]);

  const selected = useMemo(
    () => movies.find((m) => m.id === selectedId) ?? null,
    [movies, selectedId],
  );

  return (
    <div style={styles.root}>
      {/* Left list column */}
      <div style={styles.listPane}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Movies</h1>
            <p style={styles.subtitle}>
              {seenMovies.length} ranked · {wishMovies.length} want to see
            </p>
          </div>

          <div style={styles.tabRow}>
            <button
              type="button"
              onClick={() => {
                setTab("seen");
                setSentimentFilter("");
                setGenreFilter("");
              }}
              style={tab === "seen" ? styles.tabActive : styles.tab}
            >
              Seen · {seenMovies.length}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("wishlist");
                setSentimentFilter("");
                setGenreFilter("");
                if (sort === "rank") setSort("recent");
              }}
              style={tab === "wishlist" ? styles.tabActive : styles.tab}
            >
              Want to See · {wishMovies.length}
            </button>
          </div>

          <div style={styles.filterBar}>
            <input
              type="search"
              placeholder="Title, director, or genre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={styles.searchInput}
            />
            {tab === "seen" && (
              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value)}
                style={styles.selectSmall}
                aria-label="Filter by feeling"
              >
                <option value="">All feelings</option>
                <option value="mustTry">All-time favorite</option>
                <option value="loved">Loved</option>
                <option value="liked">Liked</option>
                <option value="fine">Fine</option>
                <option value="disliked">Disliked</option>
              </select>
            )}
            {genres.length > 0 && (
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                style={styles.selectSmall}
                aria-label="Filter by genre"
              >
                <option value="">All genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortBy)}
              style={styles.selectSmall}
              aria-label="Sort movies"
            >
              {tab === "seen" && <option value="rank">Rank</option>}
              <option value="recent">Recent</option>
              <option value="year">Newest film</option>
              <option value="name">A–Z</option>
            </select>
          </div>
        </div>

        <div style={styles.listBody}>
          {shown.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>
                {pool.length === 0 ? "No movies here yet" : "No matches"}
              </p>
              <p style={styles.emptySub}>
                {tab === "wishlist"
                  ? "Films saved to watch later in Wooli appear here."
                  : "Rank movies in Wooli on iPhone or Mac to see your ordered list."}
              </p>
            </div>
          ) : (
            shown.map((movie) => {
              const info = scores.get(movie.id);
              const isSelected = selectedId === movie.id;
              const byline = [movie.year, movie.director, movie.genre].filter(Boolean).join(" · ");
              const badge = SENTIMENT_STYLE[movie.sentiment];

              return (
                <button
                  key={movie.id}
                  type="button"
                  onClick={() => setSelectedId(movie.id)}
                  style={{
                    ...styles.rowBtn,
                    background: isSelected ? "var(--dm-brand-soft, #f0f5ff)" : "transparent",
                  }}
                >
                  {movie.posterURL ? (
                    <img
                      src={movie.posterURL}
                      alt=""
                      style={{
                        ...styles.posterStub,
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div style={styles.posterStub}>🎬</div>
                  )}
                  <div style={styles.rowMain}>
                    <div style={styles.rowName}>{movie.title || "Untitled Film"}</div>
                    <div style={styles.rowMeta}>{byline || "Film"}</div>
                  </div>
                  {!movie.isWishlist && info ? (
                    <div style={styles.rowRight}>
                      <span
                        style={{
                          ...styles.sentimentPill,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {SENTIMENT_LABEL[movie.sentiment]}
                      </span>
                      <span style={styles.rankTag}>
                        #{info.rankPos} · {info.score.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span style={styles.wishTag}>Wishlist</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right detail pane */}
      <div style={styles.detailPane}>
        {selected ? (
          <div style={styles.detailCard}>
            <div style={styles.detailHeader}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, minWidth: 0 }}>
                {selected.posterURL && (
                  <img
                    src={selected.posterURL}
                    alt={`${selected.title} poster`}
                    style={{
                      width: 72,
                      height: 108,
                      borderRadius: 10,
                      objectFit: "cover",
                      flexShrink: 0,
                      border: "1px solid var(--dm-border, #d8e2f0)",
                    }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={styles.eyebrow}>
                    {selected.isWishlist
                      ? "Want to see"
                      : `Ranked #${scores.get(selected.id)?.rankPos ?? "—"} of ${seenMovies.length}`}
                  </div>
                  <h2 style={styles.detailTitle}>{selected.title}</h2>
                  <p style={styles.detailByline}>
                    {[selected.year, selected.director].filter(Boolean).join(" · ") || "Film"}
                  </p>
                </div>
              </div>
              {!selected.isWishlist && scores.get(selected.id) && (
                <div style={styles.bigScoreBox}>
                  <div style={styles.bigScoreNum}>
                    {scores.get(selected.id)!.score.toFixed(1)}
                  </div>
                  <div style={styles.bigScoreSub}>/ 10</div>
                </div>
              )}
            </div>

            <div style={styles.metaChips}>
              {!selected.isWishlist && (
                <span
                  style={{
                    ...styles.sentimentPill,
                    background: SENTIMENT_STYLE[selected.sentiment].bg,
                    color: SENTIMENT_STYLE[selected.sentiment].color,
                  }}
                >
                  {SENTIMENT_LABEL[selected.sentiment]}
                </span>
              )}
              {selected.genre && <span style={styles.metaChip}>{selected.genre}</span>}
              {selected.watchedDay && (
                <span style={styles.metaChip}>Watched {selected.watchedDay}</span>
              )}
            </div>

            {selected.synopsis && (
              <div style={styles.notesSection}>
                <h3 style={styles.sectionHeading}>Synopsis</h3>
                <p style={styles.notesText}>{selected.synopsis}</p>
              </div>
            )}

            <div style={styles.notesSection}>
              <h3 style={styles.sectionHeading}>Notes</h3>
              {selected.notes ? (
                <p style={styles.notesText}>{selected.notes}</p>
              ) : (
                <p style={styles.emptyNotes}>No notes saved for this film yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.stubCard}>
              <div style={styles.stubEyebrow}>Cinema stub</div>
              <div style={styles.stubBig}>{seenMovies.length} films ranked</div>
              <div style={styles.stubSub}>{wishMovies.length} on your watchlist</div>
            </div>
            <p style={styles.placeholderHint}>
              Choose a movie on the left to see its rank, feeling, and notes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 440px) 1fr",
    height: "100%",
    minHeight: 560,
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text, #0f1b33)",
  },
  listPane: {
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-card, #ffffff)",
    minHeight: 0,
  },
  header: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid var(--dm-border, #d8e2f0)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-source-serif), Georgia, serif",
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "2px 0 0",
    fontSize: 12,
    color: "var(--dm-text-2, #475877)",
  },
  tabRow: {
    display: "flex",
    gap: 18,
    borderBottom: "1px solid var(--dm-border, #d8e2f0)",
  },
  tab: {
    border: "none",
    background: "transparent",
    color: "var(--dm-text-3, #5f6f8e)",
    padding: "6px 0 8px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
  },
  tabActive: {
    border: "none",
    background: "transparent",
    color: "var(--dm-text, #0f1b33)",
    padding: "6px 0 8px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    borderBottom: "2px solid var(--dm-text, #0f1b33)",
  },
  filterBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 140,
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text, #0f1b33)",
    fontSize: 13,
  },
  selectSmall: {
    padding: "7px 8px",
    borderRadius: 8,
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-card, #ffffff)",
    color: "var(--dm-text, #0f1b33)",
    fontSize: 12,
  },
  listBody: {
    flex: 1,
    overflowY: "auto",
  },
  rowBtn: {
    width: "100%",
    textAlign: "left",
    border: "none",
    borderBottom: "1px solid var(--dm-border, #d8e2f0)",
    padding: "11px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
  },
  posterStub: {
    width: 32,
    height: 44,
    borderRadius: 6,
    background: "var(--dm-bg, #eef3fa)",
    border: "1px solid var(--dm-border, #d8e2f0)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    flexShrink: 0,
  },
  rowMain: {
    minWidth: 0,
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--dm-text, #0f1b33)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: {
    fontSize: 12,
    color: "var(--dm-text-2, #475877)",
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 3,
    flexShrink: 0,
  },
  sentimentPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
  },
  rankTag: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--dm-text-2, #475877)",
    fontVariantNumeric: "tabular-nums",
  },
  wishTag: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 999,
    background: "var(--dm-pending-soft, #fff4dc)",
    color: "var(--dm-pending, #b45309)",
    flexShrink: 0,
  },
  detailPane: {
    padding: 28,
    overflowY: "auto",
  },
  detailCard: {
    maxWidth: 660,
    background: "var(--dm-card, #ffffff)",
    border: "1px solid var(--dm-border, #d8e2f0)",
    borderRadius: 18,
    padding: 24,
    boxShadow: "var(--dm-shadow, 0 1px 3px rgb(15 27 51 / 0.08))",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#e11d48",
    marginBottom: 6,
  },
  detailTitle: {
    margin: 0,
    fontFamily: "var(--font-source-serif), Georgia, serif",
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.15,
  },
  detailByline: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "var(--dm-text-2, #475877)",
  },
  bigScoreBox: {
    border: "2px solid #e11d48",
    borderRadius: 14,
    padding: "8px 14px",
    textAlign: "center",
    color: "#e11d48",
    flexShrink: 0,
  },
  bigScoreNum: {
    fontSize: 24,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  bigScoreSub: {
    fontSize: 11,
    fontWeight: 600,
    opacity: 0.8,
  },
  metaChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaChip: {
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 999,
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text-2, #475877)",
  },
  notesSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid var(--dm-border, #d8e2f0)",
  },
  sectionHeading: {
    margin: "0 0 8px",
    fontSize: 14,
    fontWeight: 700,
  },
  notesText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  emptyNotes: {
    margin: 0,
    fontSize: 13,
    color: "var(--dm-text-3, #5f6f8e)",
  },
  placeholder: {
    maxWidth: 520,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  stubCard: {
    background: "var(--dm-card, #ffffff)",
    border: "1px solid var(--dm-border, #d8e2f0)",
    borderRadius: 18,
    padding: 24,
    boxShadow: "var(--dm-shadow, 0 1px 3px rgb(15 27 51 / 0.08))",
  },
  stubEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#e11d48",
  },
  stubBig: {
    fontSize: 30,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    marginTop: 6,
  },
  stubSub: {
    fontSize: 13,
    color: "var(--dm-text-2, #475877)",
    marginTop: 4,
  },
  placeholderHint: {
    margin: 0,
    fontSize: 14,
    color: "var(--dm-text-2, #475877)",
  },
  emptyState: {
    padding: "36px 20px",
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
  },
  emptySub: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--dm-text-2, #475877)",
  },
};

export default MoviesScreen;
