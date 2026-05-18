import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export interface CategorizableTransaction {
  id: string
  description: string | null
  merchant: string | null
}

export interface SelectableCategory {
  id: string
  name: string // should be "Parent → Child" format
}

export interface FewShotExample {
  merchant: string
  categoryName: string
}

export async function categorizeWithGroq(
  transactions: CategorizableTransaction[],
  categories: SelectableCategory[],
  examples: FewShotExample[] = []
): Promise<Map<string, string | null>> {
  if (!categories.length || !transactions.length) return new Map()

  const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')

  const examplesSection = examples.length > 0
    ? `\nExamples from this user's history:\n${examples.slice(0, 30).map(e => `- "${e.merchant}" → ${e.categoryName}`).join('\n')}\n`
    : ''

  const txList = transactions.map((t, i) =>
    `${i}: merchant="${t.merchant ?? t.name ?? t.description}" description="${t.description ?? ''}"`
  ).join('\n')

  const prompt = `You are a personal finance transaction categorizer. Assign the best category id to each transaction based on the user's category list. Use null only if truly no category fits.
${examplesSection}
Available categories (use ONLY these ids):
${categoryList}

Transactions to categorize (index: details):
${txList}

Rules:
- Only use ids from the list above — never invent ids
- Prefer the most specific match
- Use null sparingly

Respond with ONLY a JSON array of category ids (or null), one per transaction in order. Example: ["uuid-1", null, "uuid-2"]`

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 1024,
    })

    const text = res.choices[0]?.message?.content ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return new Map()

    const ids: (string | null)[] = JSON.parse(match[0])
    const validIds = new Set(categories.map(c => c.id))

    const result = new Map<string, string | null>()
    transactions.forEach((t, i) => {
      const catId = ids[i]
      result.set(t.id, catId && validIds.has(catId) ? catId : null)
    })
    return result
  } catch {
    return new Map()
  }
}

export function buildSelectableCategories(
  allCategories: { id: string; name: string; parent_id: string | null }[]
): SelectableCategory[] {
  const parentIds = new Set(
    allCategories.filter(c => c.parent_id).map(c => c.parent_id as string)
  )
  const parentMap = new Map(allCategories.map(c => [c.id, c.name]))

  return allCategories
    .filter(c => c.parent_id !== null || !parentIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.parent_id
        ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}`
        : c.name,
    }))
}
