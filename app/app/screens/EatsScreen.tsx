"use client";

import { useMemo, useState } from "react";
import type { EatsPlaceRecord, MealSentiment } from "@/lib/cloudkit/schema";

export interface EatsScreenProps {
  eats: EatsPlaceRecord[];
  onAddCloudEat: (input: {
    name: string;
    address: string;
    sentiment: MealSentiment;
    isWish: boolean;
  }) => Promise<void>;
}

type ScopeFilter = "all" | "mine" | "shared";
type ListTab = "ranked" | "wish";
type SortBy = "score" | "recent" | "name";

const SENTIMENT_ORDER: MealSentiment[] = ["loved", "liked", "fine", "disliked"];

const SENTIMENT_LABEL: Record<MealSentiment, string> = {
  loved: "Loved",
  liked: "Liked",
  fine: "Fine",
  disliked: "Disliked",
};

const SENTIMENT_COLOR: Record<MealSentiment, string> = {
  loved: "#15803d",
  liked: "#2563eb",
  fine: "#0f766e",
  disliked: "#b91c1c",
};

function extractCity(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (
      /\d/.test(last) ||
      (last.length <= 3 && last === last.toUpperCase()) ||
      ["USA", "UK", "UAE", "Canada", "Japan", "France", "Italy", "Spain", "United States"].includes(last)
    ) {
      parts.pop();
    } else {
      break;
    }
  }
  const candidate = parts[parts.length - 1];
  if (!candidate || /\d/.test(candidate)) return null;
  return candidate;
}

function extractCuisine(notes: string): string | null {
  const first = notes.split("\n")[0]?.trim();
  if (!first || first.startsWith("http")) return null;
  return first.length > 40 ? `${first.slice(0, 38)}…` : first;
}

function computeScores(items: EatsPlaceRecord[]): Map<string, { score: number; rankPos: number }> {
  const result = new Map<string, { score: number; rankPos: number }>();
  const bands: { sentiments: MealSentiment[]; min: number; max: number }[] = [
    { sentiments: ["loved", "liked"], min: 6.7, max: 10.0 },
    { sentiments: ["fine"], min: 3.4, max: 6.6 },
    { sentiments: ["disliked"], min: 1.0, max: 3.3 },
  ];

  const ordered: EatsPlaceRecord[] = [];
  for (const band of bands) {
    const group = band.sentiments.flatMap((s) =>
      items.filter((p) => !p.isWish && p.sentiment === s).sort((a, b) => b.rank - a.rank),
    );
    group.forEach((place, i) => {
      const t = group.length === 1 ? 0 : i / (group.length - 1);
      const raw = band.max - (band.max - band.min) * t;
      const score = Math.floor(raw * 10 + 1e-9) / 10;
      ordered.push(place);
      result.set(place.id, { score, rankPos: ordered.length });
    });
  }
  return result;
}

function verdictForScore(score: number): string {
  if (score >= 9.3) return "Must try";
  if (score >= 8.4) return "Should try";
  if (score >= 7.5) return "Safe bet";
  if (score >= 6.7) return "Average";
  if (score >= 5.6) return "Plan B";
  if (score >= 4.5) return "Tolerable";
  if (score >= 3.4) return "Skip";
  if (score >= 2.2) return "Avoid";
  return "Pass";
}

function scoreColor(score: number): string {
  if (score >= 6.7) return "#15803d";
  if (score >= 3.4) return "#0f766e";
  return "#b91c1c";
}

export function EatsScreen({ eats, onAddCloudEat }: EatsScreenProps) {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [tab, setTab] = useState<ListTab>("ranked");
  const [sort, setSort] = useState<SortBy>("score");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newSentiment, setNewSentiment] = useState<MealSentiment>("liked");
  const [newIsWish, setNewIsWish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const scoped = useMemo(() => {
    if (scope === "mine") return eats.filter((e) => e.scope === "private");
    if (scope === "shared") return eats.filter((e) => e.scope === "shared");
    return eats;
  }, [eats, scope]);

  const scores = useMemo(() => computeScores(scoped), [scoped]);

  const wishCount = useMemo(() => scoped.filter((e) => e.isWish).length, [scoped]);
  const rankedCount = useMemo(() => scoped.filter((e) => !e.isWish).length, [scoped]);

  const pool = useMemo(
    () => scoped.filter((e) => (tab === "wish" ? e.isWish : !e.isWish)),
    [scoped, tab],
  );

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of pool) {
      const c = extractCity(p.address);
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = pool.filter((p) => {
      if (cityFilter && extractCity(p.address) !== cityFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "recent") {
        return (b.visitedDay || "").localeCompare(a.visitedDay || "") || b.createdAt - a.createdAt;
      }
      if (tab === "ranked") {
        const sa = scores.get(a.id)?.rankPos ?? 999999;
        const sb = scores.get(b.id)?.rankPos ?? 999999;
        return sa - sb;
      }
      return b.createdAt - a.createdAt;
    });
  }, [pool, cityFilter, query, sort, tab, scores]);

  const selected = useMemo(
    () => eats.find((e) => e.id === selectedId) ?? null,
    [eats, selectedId],
  );

  const allCitiesCount = useMemo(() => {
    const set = new Set<string>();
    for (const p of scoped) {
      const c = extractCity(p.address);
      if (c) set.add(c);
    }
    return set.size;
  }, [scoped]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onAddCloudEat({
        name: newName.trim(),
        address: newAddress.trim(),
        sentiment: newSentiment,
        isWish: newIsWish,
      });
      setNewName("");
      setNewAddress("");
      setShowAdd(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save to iCloud");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.root}>
      {/* Left browser column */}
      <div style={styles.listPane}>
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <div>
              <h1 style={styles.title}>Eats</h1>
              <p style={styles.subtitle}>
                {rankedCount} ranked · {wishCount} want to try
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              style={showAdd ? styles.secondaryBtn : styles.primaryBtn}
            >
              {showAdd ? "Cancel" : "+ Add Place"}
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAddSubmit} style={styles.addForm}>
              <input
                type="text"
                placeholder="Restaurant name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Neighborhood, City (optional)"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                style={styles.input}
              />
              <div style={styles.formRow}>
                <select
                  value={newIsWish ? "wish" : "ranked"}
                  onChange={(e) => setNewIsWish(e.target.value === "wish")}
                  style={styles.select}
                >
                  <option value="ranked">Ranked (Been)</option>
                  <option value="wish">Want to Try</option>
                </select>
                {!newIsWish && (
                  <select
                    value={newSentiment}
                    onChange={(e) => setNewSentiment(e.target.value as MealSentiment)}
                    style={styles.select}
                  >
                    {SENTIMENT_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SENTIMENT_LABEL[s]}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" disabled={saving || !newName.trim()} style={styles.primaryBtn}>
                  {saving ? "Saving…" : "Save to iCloud"}
                </button>
              </div>
              {saveError && <div style={styles.errorText}>{saveError}</div>}
            </form>
          )}

          {/* Scope filter */}
          <div style={styles.pillRow}>
            {(
              [
                { id: "all", label: `All (${eats.length})` },
                { id: "mine", label: `My Eats (${eats.filter((e) => e.scope === "private").length})` },
                { id: "shared", label: `Shared with Me (${eats.filter((e) => e.scope === "shared").length})` },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                style={scope === item.id ? styles.pillActive : styles.pill}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Ranked vs Want to Try tabs */}
          <div style={styles.tabRow}>
            <button
              type="button"
              onClick={() => {
                setTab("ranked");
                setCityFilter("");
              }}
              style={tab === "ranked" ? styles.tabActive : styles.tab}
            >
              Ranked · {rankedCount}
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("wish");
                setCityFilter("");
              }}
              style={tab === "wish" ? styles.tabActive : styles.tab}
            >
              Want to Try · {wishCount}
            </button>
          </div>

          {/* Search, city, sort */}
          <div style={styles.filterBar}>
            <input
              type="search"
              placeholder="Search places, cities, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={styles.searchInput}
            />
            {cities.length > 0 && (
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                style={styles.selectSmall}
                aria-label="Filter by city"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortBy)}
              style={styles.selectSmall}
              aria-label="Sort eats"
            >
              <option value="score">Score</option>
              <option value="recent">Recent</option>
              <option value="name">A–Z</option>
            </select>
          </div>
        </div>

        <div style={styles.listBody}>
          {shown.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>No places match</p>
              <p style={styles.emptySub}>
                {pool.length === 0
                  ? "Add a place above to save it to your iCloud Eats list."
                  : "Try clearing your search or city filter."}
              </p>
            </div>
          ) : (
            shown.map((place) => {
              const info = scores.get(place.id);
              const isSelected = selectedId === place.id;
              const city = extractCity(place.address);
              const cuisine = extractCuisine(place.notes);
              const meta = [city, cuisine, place.scope === "shared" ? "Shared" : null]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => setSelectedId(place.id)}
                  style={{
                    ...styles.rowBtn,
                    background: isSelected ? "var(--dm-brand-soft, #f0f5ff)" : "transparent",
                  }}
                >
                  <div style={styles.rowMain}>
                    <div style={styles.rowName}>{place.name || "Untitled Place"}</div>
                    <div style={styles.rowMeta}>{meta || place.address || "Saved"}</div>
                  </div>
                  {!place.isWish && info ? (
                    <div
                      style={{
                        ...styles.scoreBadge,
                        borderColor: scoreColor(info.score),
                        color: scoreColor(info.score),
                      }}
                    >
                      <span style={styles.scoreNum}>{info.score.toFixed(1)}</span>
                      <span style={styles.scoreRank}>#{info.rankPos}</span>
                    </div>
                  ) : (
                    <span style={styles.wishBadge}>Want to try</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right detail / passport pane */}
      <div style={styles.detailPane}>
        {selected ? (
          <div style={styles.detailCard}>
            <div style={styles.detailHeader}>
              <div>
                <div style={styles.eyebrowRow}>
                  <span style={styles.eyebrow}>
                    {selected.isWish ? "Want to try" : "Ranked place"}
                  </span>
                  {selected.scope === "shared" && (
                    <span style={styles.sharedBadge}>Shared with Me</span>
                  )}
                </div>
                <h2 style={styles.detailTitle}>{selected.name}</h2>
                {selected.address && <p style={styles.detailAddress}>{selected.address}</p>}
              </div>

              {!selected.isWish && scores.get(selected.id) && (
                <div
                  style={{
                    ...styles.bigStamp,
                    borderColor: scoreColor(scores.get(selected.id)!.score),
                    color: scoreColor(scores.get(selected.id)!.score),
                  }}
                >
                  <div style={styles.bigScore}>
                    {scores.get(selected.id)!.score.toFixed(1)}
                  </div>
                  <div style={styles.bigRank}>
                    #{scores.get(selected.id)!.rankPos} ·{" "}
                    {verdictForScore(scores.get(selected.id)!.score)}
                  </div>
                </div>
              )}
            </div>

            <div style={styles.metaChips}>
              <span
                style={{
                  ...styles.sentimentChip,
                  background: `${SENTIMENT_COLOR[selected.sentiment]}18`,
                  color: SENTIMENT_COLOR[selected.sentiment],
                }}
              >
                {SENTIMENT_LABEL[selected.sentiment]}
              </span>
              {selected.visitedDay && (
                <span style={styles.metaChip}>Last visited {selected.visitedDay}</span>
              )}
              {typeof selected.latitude === "number" && typeof selected.longitude === "number" && (
                <span style={styles.metaChip}>
                  {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                </span>
              )}
            </div>

            {selected.visits.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionHeading}>Visits ({selected.visits.length})</h3>
                <div style={styles.visitsList}>
                  {selected.visits.map((v, idx) => (
                    <div key={v.id ?? `${v.day}-${idx}`} style={styles.visitItem}>
                      <span style={styles.visitDay}>{v.day || "Visited"}</span>
                      {v.notes && <span style={styles.visitNote}>{v.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div style={styles.section}>
                <h3 style={styles.sectionHeading}>Notes</h3>
                <p style={styles.notesText}>{selected.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.passportWrap}>
            <div style={styles.passportCard}>
              <div style={styles.passportEyebrow}>Your passport</div>
              <div style={styles.passportBig}>{rankedCount} places</div>
              <div style={styles.passportSub}>
                {allCitiesCount} {allCitiesCount === 1 ? "city" : "cities"} · {wishCount} on want to try
              </div>
            </div>
            <p style={styles.placeholderHint}>
              Select a place on the left to inspect its score, visits, and notes.
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
    gridTemplateColumns: "minmax(340px, 430px) 1fr",
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
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  primaryBtn: {
    border: "none",
    background: "var(--dm-brand, #2563eb)",
    color: "var(--dm-on-brand, #ffffff)",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryBtn: {
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "transparent",
    color: "var(--dm-text, #0f1b33)",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  addForm: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    background: "var(--dm-bg, #eef3fa)",
    border: "1px solid var(--dm-border, #d8e2f0)",
  },
  formRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-card, #ffffff)",
    color: "var(--dm-text, #0f1b33)",
    fontSize: 13,
  },
  select: {
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-card, #ffffff)",
    color: "var(--dm-text, #0f1b33)",
    fontSize: 13,
  },
  errorText: {
    fontSize: 12,
    color: "var(--dm-expense, #b91c1c)",
  },
  pillRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  pill: {
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "transparent",
    color: "var(--dm-text-2, #475877)",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  pillActive: {
    border: "1px solid var(--dm-brand, #2563eb)",
    background: "var(--dm-brand-soft, #f0f5ff)",
    color: "var(--dm-brand, #2563eb)",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
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
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 120,
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
    maxWidth: 120,
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
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
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
  scoreBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1.5px solid",
    borderRadius: 10,
    padding: "3px 8px",
    minWidth: 46,
    flexShrink: 0,
  },
  scoreNum: {
    fontSize: 14,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  scoreRank: {
    fontSize: 10,
    fontWeight: 700,
    opacity: 0.85,
  },
  wishBadge: {
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
    maxWidth: 680,
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
  eyebrowRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--dm-brand, #2563eb)",
  },
  sharedBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
    background: "var(--dm-pending-soft, #fff4dc)",
    color: "var(--dm-pending, #b45309)",
  },
  detailTitle: {
    margin: 0,
    fontFamily: "var(--font-source-serif), Georgia, serif",
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.15,
  },
  detailAddress: {
    margin: "6px 0 0",
    fontSize: 14,
    color: "var(--dm-text-2, #475877)",
  },
  bigStamp: {
    border: "2px solid",
    borderRadius: 14,
    padding: "8px 14px",
    textAlign: "center",
    flexShrink: 0,
  },
  bigScore: {
    fontSize: 26,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.1,
  },
  bigRank: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 2,
  },
  metaChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  sentimentChip: {
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
  },
  metaChip: {
    fontSize: 12,
    fontWeight: 500,
    padding: "4px 10px",
    borderRadius: 999,
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text-2, #475877)",
  },
  section: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid var(--dm-border, #d8e2f0)",
  },
  sectionHeading: {
    margin: "0 0 10px",
    fontSize: 14,
    fontWeight: 700,
    color: "var(--dm-text, #0f1b33)",
  },
  visitsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  visitItem: {
    display: "flex",
    gap: 12,
    fontSize: 13,
    padding: "8px 10px",
    borderRadius: 10,
    background: "var(--dm-bg, #eef3fa)",
  },
  visitDay: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    color: "var(--dm-text, #0f1b33)",
  },
  visitNote: {
    color: "var(--dm-text-2, #475877)",
  },
  notesText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "var(--dm-text, #0f1b33)",
    whiteSpace: "pre-line",
  },
  passportWrap: {
    maxWidth: 520,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  passportCard: {
    background: "linear-gradient(135deg, var(--dm-ticket-start, #1e3a8a), var(--dm-ticket-end, #2563eb))",
    color: "#ffffff",
    borderRadius: 20,
    padding: 24,
    boxShadow: "var(--dm-shadow-ticket, 0 5px 20px rgb(37 99 235 / 0.3))",
  },
  passportEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.85,
  },
  passportBig: {
    fontSize: 32,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    marginTop: 6,
  },
  passportSub: {
    fontSize: 13,
    opacity: 0.9,
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

export default EatsScreen;
