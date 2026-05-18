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
  keywords?: string | null
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

  const userKeywordHints = categories
    .filter(c => c.keywords)
    .map(c => `- If merchant/description contains any of [${c.keywords}] → use "${c.name}" (id: ${c.id})`)
    .join('\n')
  const keywordsSection = userKeywordHints
    ? `\nUser-defined keyword rules (highest priority):\n${userKeywordHints}\n`
    : ''

  const examplesSection = examples.length > 0
    ? `\nExamples from this user's history:\n${examples.slice(0, 30).map(e => `- "${e.merchant}" → ${e.categoryName}`).join('\n')}\n`
    : ''

  const txList = transactions.map((t, i) =>
    `${i}: merchant="${t.merchant ?? t.description}" description="${t.description ?? ''}"`
  ).join('\n')

  const prompt = `You are a personal finance transaction categorizer. Assign the best matching category id to each transaction. Always pick the closest match — only use null for bank/credit card payments, wire transfers, or truly unrecognizable entries.
${keywordsSection}${examplesSection}
Available categories (use ONLY these ids):
${categoryList}

General merchant type hints (use when no keyword rule or example matches):
- Transit/subway (MTA, WMATA, BART, Metro, NJ Transit) → transportation or transit subcategory
- Rideshare (Uber, Lyft) → transportation subcategory
- Gas stations (Shell, BP, Exxon, Mobil) → gas or transportation subcategory
- Grocery stores (Whole Foods, Trader Joe's, Stop & Shop, Key Food, Kroger, Aldi) → groceries subcategory
- General retail (Target, Walmart, Costco, TJ Maxx) → shopping subcategory
- Online retail (Amazon, eBay, Etsy) → shopping subcategory
- Pharmacy (Walgreens, CVS, Rite Aid, Duane Reade) → pharmacy or health subcategory
- Restaurants and food delivery (DoorDash, Grubhub, Uber Eats, any restaurant) → dining or restaurants subcategory
- Coffee shops (Starbucks, Dunkin) → coffee or dining subcategory
- Streaming (Netflix, Spotify, Hulu, Disney+, HBO) → entertainment or subscriptions subcategory
- Gym/fitness (Equinox, Planet Fitness, ClassPass, Peloton) → fitness or health subcategory
- Home improvement (Home Depot, Lowe's, IKEA, Ace Hardware) → home improvement subcategory
- Airlines, hotels, Airbnb, Expedia → travel subcategory
- Credit card payments, autopay, bank payments, ACH, Zelle, Venmo, wire transfer → null

Transactions to categorize (index: details):
${txList}

Rules:
- Only use ids from the list above — never invent ids
- Keyword rules above take highest priority
- Always pick the most specific subcategory available
- Prefer any reasonable match over null

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
  allCategories: { id: string; name: string; parent_id: string | null; keywords?: string | null }[]
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
      keywords: c.keywords,
    }))
}
