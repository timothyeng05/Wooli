"use client";

import { useMemo, useState } from "react";
import type { SightEntryRecord } from "@/lib/cloudkit/schema";

export interface SightsScreenProps {
  sights: SightEntryRecord[];
}

type SightTab = "wantToGo" | "visited";

const OTHER_CITY = "Other places";

function extractCity(address: string): string {
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
  if (!candidate || /\d/.test(candidate)) return OTHER_CITY;
  return candidate;
}

export function SightsScreen({ sights }: SightsScreenProps) {
  const [tab, setTab] = useState<SightTab>("wantToGo");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visitedCount = useMemo(() => sights.filter((s) => Boolean(s.visitedDay)).length, [sights]);
  const wantCount = sights.length - visitedCount;

  const citiesCount = useMemo(() => {
    const set = new Set(sights.map((s) => extractCity(s.address)).filter((c) => c !== OTHER_CITY));
    return set.size;
  }, [sights]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = sights.filter((s) => {
      const isVisited = Boolean(s.visitedDay);
      if (tab === "visited" ? !isVisited : isVisited) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    });

    const map = new Map<string, SightEntryRecord[]>();
    for (const sight of shown) {
      const city = extractCity(sight.address);
      const arr = map.get(city) ?? [];
      arr.push(sight);
      map.set(city, arr);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === OTHER_CITY) return 1;
      if (b === OTHER_CITY) return -1;
      return a.localeCompare(b);
    });

    return keys.map((city) => {
      const list = map.get(city) ?? [];
      if (tab === "visited") {
        list.sort((a, b) => b.visitedDay.localeCompare(a.visitedDay));
      } else {
        list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      }
      return { city, items: list };
    });
  }, [sights, tab, query]);

  const selected = useMemo(
    () => sights.find((s) => s.id === selectedId) ?? null,
    [sights, selectedId],
  );

  return (
    <div style={styles.root}>
      {/* Left list column */}
      <div style={styles.listPane}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Sights</h1>
            <p style={styles.subtitle}>
              {visitedCount} visited · {wantCount} to go
              {citiesCount > 0 ? ` · ${citiesCount} ${citiesCount === 1 ? "city" : "cities"}` : ""}
            </p>
          </div>

          <div style={styles.segmented}>
            <button
              type="button"
              onClick={() => setTab("wantToGo")}
              style={tab === "wantToGo" ? styles.segBtnActive : styles.segBtn}
            >
              Want to Go ({wantCount})
            </button>
            <button
              type="button"
              onClick={() => setTab("visited")}
              style={tab === "visited" ? styles.segBtnActive : styles.segBtn}
            >
              Visited ({visitedCount})
            </button>
          </div>

          <input
            type="search"
            placeholder="Search sights, cities, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.listBody}>
          {grouped.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>
                {sights.length === 0 ? "No sights saved yet" : "No sights match"}
              </p>
              <p style={styles.emptySub}>
                {tab === "visited"
                  ? "Visited landmarks and museums will appear here."
                  : "Save landmarks, museums, and viewpoints in Wooli on iPhone or Mac."}
              </p>
            </div>
          ) : (
            grouped.map(({ city, items }) => (
              <div key={city}>
                <div style={styles.sectionHeader}>{city}</div>
                {items.map((sight) => {
                  const isSelected = selectedId === sight.id;
                  const isVisited = Boolean(sight.visitedDay);
                  return (
                    <button
                      key={sight.id}
                      type="button"
                      onClick={() => setSelectedId(sight.id)}
                      style={{
                        ...styles.rowBtn,
                        background: isSelected ? "var(--dm-brand-soft, #f0f5ff)" : "transparent",
                      }}
                    >
                      <span
                        style={{
                          ...styles.pinIcon,
                          background: isVisited ? "#0d9488" : "var(--dm-brand, #2563eb)",
                        }}
                      >
                        {isVisited ? "✓" : "📍"}
                      </span>
                      <div style={styles.rowMain}>
                        <div style={styles.rowName}>{sight.name || "Untitled Sight"}</div>
                        <div style={styles.rowMeta}>
                          {isVisited ? `Visited ${sight.visitedDay}` : sight.address || "Saved"}
                        </div>
                      </div>
                      <span style={styles.chevron}>›</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right detail pane */}
      <div style={styles.detailPane}>
        {selected ? (
          <div style={styles.detailCard}>
            <div style={styles.detailTop}>
              <span
                style={{
                  ...styles.statusBadge,
                  background: selected.visitedDay ? "#dcf5f1" : "var(--dm-brand-soft, #f0f5ff)",
                  color: selected.visitedDay ? "#0d9488" : "var(--dm-brand, #2563eb)",
                }}
              >
                {selected.visitedDay ? `Visited · ${selected.visitedDay}` : "Want to Go"}
              </span>
              <span style={styles.cityTag}>{extractCity(selected.address)}</span>
            </div>

            <h2 style={styles.detailTitle}>{selected.name}</h2>
            {selected.address && <p style={styles.detailAddress}>{selected.address}</p>}

            {typeof selected.latitude === "number" && typeof selected.longitude === "number" && (
              <div style={styles.coordPill}>
                Coordinates: {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
              </div>
            )}

            <div style={styles.notesSection}>
              <h3 style={styles.sectionHeading}>Notes</h3>
              {selected.notes ? (
                <p style={styles.notesText}>{selected.notes}</p>
              ) : (
                <p style={styles.emptyNotes}>No notes saved for this place yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div style={styles.placeholder}>
            <div style={styles.heroCard}>
              <div style={styles.heroEyebrow}>Your sights</div>
              <div style={styles.heroBig}>
                {sights.length} {sights.length === 1 ? "place" : "places"}
              </div>
              <div style={styles.heroSub}>
                {visitedCount} visited · {wantCount} to go
              </div>
            </div>
            <p style={styles.placeholderHint}>Choose a sight on the left to see its address and notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 410px) 1fr",
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
  segmented: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    padding: 3,
    borderRadius: 10,
    background: "var(--dm-bg, #eef3fa)",
  },
  segBtn: {
    border: "none",
    background: "transparent",
    color: "var(--dm-text-2, #475877)",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  segBtnActive: {
    border: "none",
    background: "var(--dm-card, #ffffff)",
    color: "var(--dm-text, #0f1b33)",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgb(15 27 51 / 0.08)",
  },
  searchInput: {
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--dm-border, #d8e2f0)",
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text, #0f1b33)",
    fontSize: 13,
  },
  listBody: {
    flex: 1,
    overflowY: "auto",
  },
  sectionHeader: {
    padding: "8px 16px 6px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--dm-text-3, #5f6f8e)",
    background: "var(--dm-bg, #eef3fa)",
    borderBottom: "1px solid var(--dm-border, #d8e2f0)",
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
  pinIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
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
  chevron: {
    fontSize: 18,
    color: "var(--dm-text-3, #5f6f8e)",
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
  detailTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 999,
  },
  cityTag: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--dm-text-2, #475877)",
  },
  detailTitle: {
    margin: 0,
    fontFamily: "var(--font-source-serif), Georgia, serif",
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.15,
  },
  detailAddress: {
    margin: "8px 0 0",
    fontSize: 14,
    color: "var(--dm-text-2, #475877)",
  },
  coordPill: {
    display: "inline-block",
    marginTop: 12,
    fontSize: 12,
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
  heroCard: {
    background: "var(--dm-card, #ffffff)",
    border: "1px solid var(--dm-border, #d8e2f0)",
    borderRadius: 18,
    padding: 24,
    boxShadow: "var(--dm-shadow, 0 1px 3px rgb(15 27 51 / 0.08))",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#0d9488",
  },
  heroBig: {
    fontSize: 32,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    marginTop: 6,
  },
  heroSub: {
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

export default SightsScreen;
