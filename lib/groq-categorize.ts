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
    `${i}: merchant="${t.merchant ?? t.description}" description="${t.description ?? ''}"`
  ).join('\n')

  const prompt = `You are a personal finance transaction categorizer. Your job is to assign the best matching category to every transaction. Always pick the closest match — only use null if the transaction is completely unrecognizable.
${examplesSection}
Available categories (use ONLY these ids):
${categoryList}

Common merchant type hints (use to infer category when no example exists):
- Transit/subway/bus: MTA, WMATA, BART, CTA, Metro, NJ Transit, PATH → Transportation
- Rideshare: Uber, Lyft, Via → Transportation
- Gas stations: Shell, BP, Exxon, Mobil, Sunoco, Gulf → Transportation / Gas
- Grocery: Whole Foods, Trader Joe's, Safeway, Stop & Shop, Key Food, Kroger, Wegmans, Aldi, Sprouts → Groceries / Food
- General retail: Target, Walmart, Costco, Kohl's, TJ Maxx, Marshalls, HomeGoods → Shopping
- Online retail: Amazon, eBay, Etsy → Shopping
- Pharmacy/drugstore: Walgreens, CVS, Rite Aid, Duane Reade → Health / Pharmacy / Personal Care
- Restaurants/food: any restaurant or food delivery name (DoorDash, Grubhub, Uber Eats) → Dining / Restaurants / Food
- Coffee: Starbucks, Dunkin, Blue Bottle, Intelligentsia → Dining / Coffee
- Streaming: Netflix, Spotify, Hulu, Disney+, Apple TV, HBO, Peacock, Tidal → Entertainment / Subscriptions
- Gym/fitness: Equinox, Planet Fitness, LA Fitness, ClassPass, Peloton → Health / Fitness
- Utilities: electric, gas, water, internet, cable, phone bills → Bills / Utilities
- Insurance: any insurance company → Insurance / Bills
- Travel: airlines, hotels, Airbnb, Booking.com, Expedia → Travel
- Home improvement/hardware: Home Depot, Lowe's, IKEA, Ace Hardware → Home
- Furniture/home goods: Wayfair, Crate & Barrel, West Elm, Pottery Barn → Home
- Rent/mortgage payments → Home / Housing
- Cleaning/laundry services → Home
- Bank/credit card payments, wire transfers, ACH: mark as null (these are transfers, not expenses)

Transactions to categorize (index: details):
${txList}

Rules:
- Only use ids from the list above — never invent ids
- Match the hint category concept to the closest available category name
- Always pick SOMETHING reasonable rather than returning null
- Only use null for bank/transfer transactions or truly unidentifiable entries
- Prefer the most specific subcategory

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
