"use client";

import { useMemo, useState } from "react";
import type { EatsPlaceRecord, MealSentiment } from "@/lib/cloudkit/schema";
import { Badge, Card, InspectorDrawer, ListMapSplit, Pill, type BadgeTone } from "@/app/components/ds";

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

const SENTIMENT_LABEL: Record<MealSentiment, string> = {
  mustTry: "Must try",
  loved: "Loved",
  liked: "Liked",
  fine: "Fine",
  disliked: "Disliked",
};

const SENTIMENT_TONE: Record<MealSentiment, BadgeTone> = {
  mustTry: "income",
  loved: "income",
  liked: "travel",
  fine: "brand",
  disliked: "expense",
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
  return first.length > 44 ? `${first.slice(0, 42)}…` : first;
}

function computeScores(items: EatsPlaceRecord[]): Map<string, { score: number; rankPos: number }> {
  const result = new Map<string, { score: number; rankPos: number }>();
  const bands: { sentiments: MealSentiment[]; min: number; max: number }[] = [
    { sentiments: ["mustTry", "loved", "liked"], min: 6.7, max: 10.0 },
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

function scoreTone(score: number): BadgeTone {
  if (score >= 6.7) return "income";
  if (score >= 3.4) return "brand";
  return "expense";
}

function mapsUrlFor(place: EatsPlaceRecord): string {
  const q = encodeURIComponent(place.address ? `${place.name}, ${place.address}` : place.name);
  return `https://maps.apple.com/?q=${q}`;
}

export function EatsScreen({ eats }: EatsScreenProps) {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [tab, setTab] = useState<ListTab>("ranked");
  const [sort, setSort] = useState<SortBy>("score");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scoped = useMemo(() => {
    if (scope === "mine") return eats.filter((e) => e.scope === "private");
    if (scope === "shared") return eats.filter((e) => e.scope === "shared");
    return eats;
  }, [eats, scope]);

  const myScores = useMemo(() => computeScores(eats.filter((e) => e.scope !== "shared")), [eats]);
  const sharedScores = useMemo(() => computeScores(eats.filter((e) => e.scope === "shared")), [eats]);
  const scores = useMemo(() => {
    const merged = new Map<string, { score: number; rankPos: number }>();
    for (const [k, v] of sharedScores) merged.set(k, v);
    for (const [k, v] of myScores) merged.set(k, v);
    return merged;
  }, [myScores, sharedScores]);

  const wishCount = useMemo(() => scoped.filter((e) => e.isWish).length, [scoped]);
  const rankedCount = useMemo(() => scoped.filter((e) => !e.isWish).length, [scoped]);

  const pool = useMemo(() => scoped.filter((e) => (tab === "wish" ? e.isWish : !e.isWish)), [scoped, tab]);

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

  const selected = useMemo(() => eats.find((e) => e.id === selectedId) ?? null, [eats, selectedId]);

  const listColumn = (
    <div>
      {/* Header */}
      <header style={{ marginBottom: "var(--space-16)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: "var(--space-12)",
            marginBottom: "var(--space-12)",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 var(--space-4)",
                fontSize: 11,
                fontWeight: "var(--weight-semibold)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-tertiary)",
              }}
            >
              Read-only iCloud Places
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                margin: 0,
                color: "var(--ink-primary)",
              }}
            >
              Eats
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-tertiary)" }}>
              {rankedCount} ranked · {wishCount} want to try · {cities.length} cities
            </p>
          </div>
          <Badge tone="neutral">Read-only</Badge>
        </div>

        {/* Scope + Tab Pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", marginBottom: "var(--space-12)" }}>
          <Pill size="sm" active={tab === "ranked"} count={rankedCount} onClick={() => { setTab("ranked"); setCityFilter(""); }}>
            Ranked
          </Pill>
          <Pill size="sm" active={tab === "wish"} count={wishCount} onClick={() => { setTab("wish"); setCityFilter(""); }}>
            Want to Try
          </Pill>
          <span style={{ width: 1, height: 22, background: "var(--border-hairline)", alignSelf: "center" }} />
          {(
            [
              { id: "all", label: `All (${eats.length})` },
              { id: "mine", label: `Mine (${eats.filter((e) => e.scope === "private").length})` },
              { id: "shared", label: `Shared (${eats.filter((e) => e.scope === "shared").length})` },
            ] as const
          ).map((item) => (
            <Pill key={item.id} size="sm" variant="outline" active={scope === item.id} onClick={() => setScope(item.id)}>
              {item.label}
            </Pill>
          ))}
        </div>

        {/* Search + Sort + City filter */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", alignItems: "center" }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search restaurants, neighborhoods, notes…"
            style={{
              flex: "1 1 220px",
              padding: "8px 12px",
              borderRadius: "var(--radius-s)",
              border: "1px solid var(--border-hairline)",
              background: "var(--bg-card)",
              fontSize: 13.5,
              color: "var(--ink-primary)",
            }}
          />
          {cities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filter by city"
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-s)",
                border: "1px solid var(--border-hairline)",
                background: "var(--bg-card)",
                fontSize: 13,
                color: "var(--ink-primary)",
              }}
            >
              <option value="">All cities ({cities.length})</option>
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
            aria-label="Sort places"
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-s)",
              border: "1px solid var(--border-hairline)",
              background: "var(--bg-card)",
              fontSize: 13,
              color: "var(--ink-primary)",
            }}
          >
            <option value="score">Rank</option>
            <option value="recent">Recent</option>
            <option value="name">Name</option>
          </select>
        </div>
      </header>

      {/* Results */}
      {shown.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: "var(--ink-tertiary)", fontSize: 14 }}>No places match your filter.</p>
        </Card>
      ) : tab === "wish" ? (
        /* Airbnb Wishlists / Saves Cards */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "var(--space-12)",
          }}
        >
          {shown.map((place) => {
            const city = extractCity(place.address);
            const active = selectedId === place.id;
            return (
              <Card
                key={place.id}
                interactive
                padding="sm"
                onClick={() => setSelectedId(active ? null : place.id)}
                style={{
                  borderColor: active ? "var(--brand)" : undefined,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "var(--space-8)",
                }}
              >
                <div>
                  <div
                    style={{
                      height: 84,
                      borderRadius: "var(--radius-s)",
                      background: "var(--bg-paper-soft)",
                      border: "1px solid var(--border-hairline)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      marginBottom: "var(--space-8)",
                    }}
                  >
                    🍽️
                  </div>
                  <div style={{ fontSize: 15, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)" }}>
                    {place.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-tertiary)", marginTop: 2 }}>
                    {city || place.address || "Saved spot"}
                  </div>
                </div>
                <div
                  style={{
                    padding: "6px 8px",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--bg-paper-soft)",
                    fontSize: 12,
                    color: "var(--ink-secondary)",
                    minHeight: 28,
                  }}
                >
                  {place.notes ? extractCuisine(place.notes) : "Saved to Want to Try"}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Ranked Borderless List */
        <Card padding="none" style={{ overflow: "hidden" }}>
          {shown.map((place, idx) => {
            const sc = scores.get(place.id);
            const city = extractCity(place.address);
            const note = extractCuisine(place.notes);
            const active = selectedId === place.id;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => setSelectedId(active ? null : place.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-12)",
                  padding: "var(--space-12) var(--space-16)",
                  border: "none",
                  borderTop: idx > 0 ? "1px solid var(--border-hairline)" : "none",
                  background: active ? "var(--brand-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 28,
                    fontSize: 12.5,
                    fontWeight: "var(--weight-semibold)",
                    color: "var(--ink-tertiary)",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {sc ? `#${sc.rankPos}` : "—"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: "var(--weight-semibold)",
                      color: "var(--ink-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {place.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>
                    {[city, note].filter(Boolean).join(" · ") || place.address || "No address"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flexShrink: 0 }}>
                  {place.scope === "shared" && <Badge tone="neutral">Shared</Badge>}
                  {sc && <Badge tone={scoreTone(sc.score)}>{sc.score.toFixed(1)}</Badge>}
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );

  const mapColumn = (
    <EatsSpatialMap
      places={shown}
      scores={scores}
      selectedId={selectedId}
      onSelect={(id) => setSelectedId(id)}
    />
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <ListMapSplit
        left={listColumn}
        right={mapColumn}
        mapToggleLabel={{ show: "Show map", hide: "Hide map" }}
      />

      {selected && (
        <div style={{ marginTop: "var(--space-16)" }}>
          <InspectorDrawer
            open
            onClose={() => setSelectedId(null)}
            eyebrow={selected.isWish ? "Want to Try" : "Ranked Place"}
            title={selected.name}
            subtitle={selected.address || "No address saved"}
          >
            <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap", marginBottom: "var(--space-16)" }}>
              {!selected.isWish && scores.get(selected.id) && (
                <Badge tone={scoreTone(scores.get(selected.id)!.score)} size="md">
                  {scores.get(selected.id)!.score.toFixed(1)} · {verdictForScore(scores.get(selected.id)!.score)}
                </Badge>
              )}
              {!selected.isWish && (
                <Badge tone={SENTIMENT_TONE[selected.sentiment]} size="md">
                  {SENTIMENT_LABEL[selected.sentiment]}
                </Badge>
              )}
              {selected.scope === "shared" && <Badge tone="neutral">Shared</Badge>}
            </div>

            {selected.notes && (
              <div style={{ marginBottom: "var(--space-16)" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: "var(--weight-semibold)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-tertiary)",
                    marginBottom: 4,
                  }}
                >
                  Notes
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", color: "var(--ink-primary)" }}>
                  {selected.notes}
                </p>
              </div>
            )}

            {selected.visits.length > 0 && (
              <div style={{ marginBottom: "var(--space-16)" }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: "var(--weight-semibold)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--ink-tertiary)",
                    marginBottom: 6,
                  }}
                >
                  Visits ({selected.visits.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selected.visits.map((v, i) => (
                    <div
                      key={v.id ?? i}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "var(--radius-s)",
                        background: "var(--bg-paper-soft)",
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ fontWeight: "var(--weight-semibold)" }}>{v.day}</div>
                      {(v.note || v.notes) && (
                        <div style={{ color: "var(--ink-tertiary)", marginTop: 2 }}>{v.note || v.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a
              href={mapsUrlFor(selected)}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: "var(--weight-semibold)",
                color: "var(--brand)",
                textDecoration: "none",
              }}
            >
              Open in Apple Maps ↗
            </a>
          </InspectorDrawer>
        </div>
      )}
    </div>
  );
}

function EatsSpatialMap({
  places,
  scores,
  selectedId,
  onSelect,
}: {
  places: EatsPlaceRecord[];
  scores: Map<string, { score: number; rankPos: number }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const geo = useMemo(
    () => places.filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number"),
    [places],
  );

  const bounds = useMemo(() => {
    if (geo.length === 0) return null;
    const lats = geo.map((p) => p.latitude!);
    const lngs = geo.map((p) => p.longitude!);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
      latSpan: Math.max(0.01, maxLat - minLat),
      lngSpan: Math.max(0.01, maxLng - minLng),
    };
  }, [geo]);

  return (
    <Card padding="none" style={{ height: 520, overflow: "hidden", position: "relative", background: "var(--bg-paper-soft)" }}>
      <div
        style={{
          padding: "var(--space-12) var(--space-16)",
          borderBottom: "1px solid var(--border-hairline)",
          background: "var(--bg-card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: "var(--weight-semibold)", color: "var(--ink-primary)" }}>
          Places Map
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-tertiary)" }}>{geo.length} pinned</span>
      </div>

      {!bounds ? (
        <div
          style={{
            height: "calc(100% - 44px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-24)",
            textAlign: "center",
            color: "var(--ink-tertiary)",
            fontSize: 13.5,
          }}
        >
          No coordinates synced for the current filter.
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            height: "calc(100% - 44px)",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--border-hairline) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          {geo.slice(0, 60).map((place) => {
            const xPct = 10 + ((place.longitude! - bounds.minLng) / bounds.lngSpan) * 80;
            const yPct = 88 - ((place.latitude! - bounds.minLat) / bounds.latSpan) * 76;
            const sc = scores.get(place.id);
            const active = selectedId === place.id;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => onSelect(place.id)}
                title={place.name}
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  top: `${yPct}%`,
                  transform: `translate(-50%, -50%) scale(${active ? 1.12 : 1})`,
                  zIndex: active ? 20 : 5,
                  padding: "4px 9px",
                  borderRadius: "var(--radius-full)",
                  border: active ? "2px solid var(--ink-primary)" : "1px solid var(--border-strong)",
                  background: active ? "var(--brand)" : "var(--bg-card)",
                  color: active ? "var(--on-brand)" : "var(--ink-primary)",
                  fontSize: 11.5,
                  fontWeight: "var(--weight-semibold)",
                  boxShadow: "var(--shadow-card)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  maxWidth: 150,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {sc ? `${sc.score.toFixed(1)} · ` : ""}
                {place.name}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default EatsScreen;
