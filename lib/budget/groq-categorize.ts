// Taxonomy helper shared by the categorization pipeline.
// (Groq calls now live in lib/budget/categorize/groq-fallback.ts — Groq is only a
// last-resort fallback in the layered pipeline.)

export interface SelectableCategory {
  id: string
  name: string // "Parent → Child" format
  keywords?: string | null
}

/**
 * Flattens the category tree into the leaf-and-top-level set the pipeline selects from,
 * rendering child categories as "Parent → Child".
 */
export function buildSelectableCategories(
  allCategories: { id: string; name: string; parent_id: string | null; keywords?: string | null }[],
): SelectableCategory[] {
  const parentIds = new Set(
    allCategories.filter(c => c.parent_id).map(c => c.parent_id as string),
  )
  const parentMap = new Map(allCategories.map(c => [c.id, c.name]))

  return allCategories
    .filter(c => c.parent_id !== null || !parentIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.parent_id
        ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}`
        : c.name,
      keywords: c.keywords,
    }))
}
