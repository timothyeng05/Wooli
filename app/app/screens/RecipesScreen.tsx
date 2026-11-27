"use client";

import { useMemo, useState } from "react";
import type { RecipeEntryRecord } from "@/lib/cloudkit/schema";

export interface RecipesScreenProps {
  recipes: RecipeEntryRecord[];
}

type SortBy = "newest" | "name" | "quickest" | "fewest";

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function RecipesScreen({ recipes }: RecipesScreenProps) {
  const [query, setQuery] = useState("");
  const [mealFilter, setMealFilter] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [sort, setSort] = useState<SortBy>("newest");
  const [selectedId, setSelectedId] = useState<string | null>(recipes[0]?.id ?? null);

  const meals = useMemo(() => {
    return Array.from(new Set(recipes.map((r) => r.meal).filter(Boolean))).sort();
  }, [recipes]);

  const cuisines = useMemo(() => {
    return Array.from(new Set(recipes.map((r) => r.cuisine).filter(Boolean))).sort();
  }, [recipes]);

  const reelsCount = useMemo(() => recipes.filter((r) => Boolean(r.sourceURL)).length, [recipes]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = recipes.filter((r) => {
      if (mealFilter && r.meal !== mealFilter) return false;
      if (cuisineFilter && r.cuisine !== cuisineFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.ingredientsText.toLowerCase().includes(q) ||
        r.cuisine.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "name") return (a.title || "Untitled").localeCompare(b.title || "Untitled");
      if (sort === "quickest") {
        return (a.minutes > 0 ? a.minutes : 999999) - (b.minutes > 0 ? b.minutes : 999999);
      }
      if (sort === "fewest") {
        return splitLines(a.ingredientsText).length - splitLines(b.ingredientsText).length;
      }
      return 0;
    });
  }, [recipes, mealFilter, cuisineFilter, query, sort]);

  const selected = useMemo(
    () => recipes.find((r) => r.id === selectedId) ?? shown[0] ?? null,
    [recipes, selectedId, shown],
  );

  const selectedIngredients = selected ? splitLines(selected.ingredientsText) : [];
  const selectedSteps = selected ? splitLines(selected.stepsText) : [];

  return (
    <div style={styles.root}>
      {/* Left recipe list */}
      <div style={styles.listPane}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Recipes</h1>
            <p style={styles.subtitle}>
              {recipes.length} saved
              {reelsCount > 0 ? ` · ${reelsCount} from Instagram` : ""}
            </p>
          </div>

          <div style={styles.filterBar}>
            <input
              type="search"
              placeholder="Recipe or ingredient…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filterBar}>
            {meals.length > 0 && (
              <select
                value={mealFilter}
                onChange={(e) => setMealFilter(e.target.value)}
                style={styles.selectSmall}
                aria-label="Filter by meal"
              >
                <option value="">All meals</option>
                {meals.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            {cuisines.length > 0 && (
              <select
                value={cuisineFilter}
                onChange={(e) => setCuisineFilter(e.target.value)}
                style={styles.selectSmall}
                aria-label="Filter by cuisine"
              >
                <option value="">All cuisines</option>
                {cuisines.map((c) => (
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
              aria-label="Sort recipes"
            >
              <option value="newest">Newest</option>
              <option value="name">A–Z</option>
              <option value="quickest">Quickest</option>
              <option value="fewest">Fewest ingredients</option>
            </select>
          </div>
        </div>

        <div style={styles.listBody}>
          {shown.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyTitle}>
                {recipes.length === 0 ? "No recipes saved yet" : "No matches"}
              </p>
              <p style={styles.emptySub}>
                Share a recipe reel to Wooli on iPhone to save its ingredients and steps.
              </p>
            </div>
          ) : (
            shown.map((recipe) => {
              const isSelected = selected?.id === recipe.id;
              const ingCount = splitLines(recipe.ingredientsText).length;
              const tagLine = [
                recipe.meal,
                recipe.cuisine,
                recipe.minutes > 0 ? `${recipe.minutes} min` : "",
                ingCount > 0 ? `${ingCount} ingredients` : "",
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => setSelectedId(recipe.id)}
                  style={{
                    ...styles.rowBtn,
                    background: isSelected ? "var(--dm-brand-soft, #f0f5ff)" : "transparent",
                  }}
                >
                  <span style={styles.foodBadge}>🍳</span>
                  <div style={styles.rowMain}>
                    <div style={styles.rowName}>{recipe.title || "Untitled recipe"}</div>
                    <div style={styles.rowMeta}>{tagLine || "Saved recipe"}</div>
                  </div>
                  {recipe.sourceURL && (
                    <span style={styles.reelTag} title="Saved from Instagram">
                      Reel
                    </span>
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
              <div>
                <div style={styles.eyebrow}>
                  {[
                    selected.meal,
                    selected.cuisine,
                    selected.minutes > 0 ? `${selected.minutes} min` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Recipe"}
                </div>
                <h2 style={styles.detailTitle}>{selected.title || "Untitled recipe"}</h2>
              </div>

              {selected.sourceURL && (
                <a
                  href={selected.sourceURL}
                  target="_blank"
                  rel="noreferrer"
                  style={styles.sourceLink}
                >
                  Watch Reel ↗
                </a>
              )}
            </div>

            {selectedIngredients.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionHeading}>
                  Ingredients ({selectedIngredients.length})
                </h3>
                <ul style={styles.ingredientList}>
                  {selectedIngredients.map((ing, idx) => (
                    <li key={idx} style={styles.ingredientItem}>
                      <span style={styles.dot} />
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedSteps.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionHeading}>Steps</h3>
                <ol style={styles.stepsList}>
                  {selectedSteps.map((step, idx) => (
                    <li key={idx} style={styles.stepItem}>
                      <span style={styles.stepNum}>{idx + 1}</span>
                      <span style={styles.stepText}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {selected.notes && (
              <div style={styles.notesBox}>
                <div style={styles.notesEyebrow}>
                  {selected.sourceURL ? "From Instagram" : "Your kitchen"} · Notes
                </div>
                <p style={styles.notesText}>{selected.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.placeholder}>
            <p style={styles.placeholderHint}>Choose a recipe on the left to see it here.</p>
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
  filterBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  searchInput: {
    width: "100%",
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
  foodBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "var(--dm-food-soft, #fff6d1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
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
  reelTag: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 999,
    background: "var(--dm-bg, #eef3fa)",
    color: "var(--dm-text-2, #475877)",
    flexShrink: 0,
  },
  detailPane: {
    padding: 28,
    overflowY: "auto",
  },
  detailCard: {
    maxWidth: 720,
    background: "var(--dm-card, #ffffff)",
    border: "1px solid var(--dm-border, #d8e2f0)",
    borderRadius: 18,
    padding: 26,
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
    color: "#d97706",
    marginBottom: 6,
  },
  detailTitle: {
    margin: 0,
    fontFamily: "var(--font-source-serif), Georgia, serif",
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1.15,
  },
  sourceLink: {
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 999,
    background: "var(--dm-brand-soft, #f0f5ff)",
    color: "var(--dm-brand, #2563eb)",
    fontSize: 12,
    fontWeight: 700,
    textDecoration: "none",
    flexShrink: 0,
  },
  section: {
    marginTop: 22,
    paddingTop: 18,
    borderTop: "1px solid var(--dm-border, #d8e2f0)",
  },
  sectionHeading: {
    margin: "0 0 12px",
    fontSize: 15,
    fontWeight: 700,
  },
  ingredientList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "8px 16px",
  },
  ingredientItem: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 14,
    lineHeight: 1.45,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: "#d97706",
    flexShrink: 0,
  },
  stepsList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  stepItem: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    fontSize: 14,
    lineHeight: 1.55,
  },
  stepNum: {
    fontSize: 14,
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    color: "#d97706",
    minWidth: 20,
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
  },
  notesBox: {
    marginTop: 22,
    padding: 16,
    borderRadius: 14,
    background: "var(--dm-food-soft, #fff6d1)",
    border: "1px solid var(--dm-border, #d8e2f0)",
  },
  notesEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#b45309",
    marginBottom: 4,
  },
  notesText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: "pre-line",
  },
  placeholder: {
    padding: 20,
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

export default RecipesScreen;
