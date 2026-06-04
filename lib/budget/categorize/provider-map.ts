import type { SelectableCategory } from '@/lib/budget/groq-categorize'

// Maps Plaid's personal_finance_category to candidate keywords we try to match against
// the user's own category names. Detailed keys are checked first, then the primary key.
// Each value is an ordered list of keywords (most specific first); the first keyword that
// appears in a user category name wins.
const PFC_KEYWORDS: Record<string, string[]> = {
  // Food & drink
  FOOD_AND_DRINK_GROCERIES: ['groceries', 'grocery'],
  FOOD_AND_DRINK_RESTAURANT: ['restaurant', 'dining', 'food'],
  FOOD_AND_DRINK_FAST_FOOD: ['fast food', 'restaurant', 'dining'],
  FOOD_AND_DRINK_COFFEE: ['coffee', 'cafe', 'dining'],
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: ['alcohol', 'liquor', 'bar'],
  FOOD_AND_DRINK: ['dining', 'restaurant', 'food'],
  // Transportation
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: ['rideshare', 'transportation', 'transit'],
  TRANSPORTATION_PUBLIC_TRANSIT: ['transit', 'transportation'],
  TRANSPORTATION_GAS: ['gas', 'fuel', 'transportation'],
  TRANSPORTATION_PARKING: ['parking', 'transportation'],
  TRANSPORTATION: ['transportation', 'transit'],
  // Travel
  TRAVEL_FLIGHTS: ['flight', 'airfare', 'travel'],
  TRAVEL_LODGING: ['hotel', 'lodging', 'travel'],
  TRAVEL: ['travel'],
  // Merchandise / shopping
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: ['shopping', 'online'],
  GENERAL_MERCHANDISE_ELECTRONICS: ['electronics', 'shopping'],
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: ['clothing', 'shopping'],
  GENERAL_MERCHANDISE: ['shopping', 'merchandise'],
  // Home
  HOME_IMPROVEMENT: ['home improvement', 'home', 'hardware'],
  RENT_AND_UTILITIES_RENT: ['rent'],
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: ['utilities', 'electric', 'gas'],
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: ['internet', 'cable', 'utilities'],
  RENT_AND_UTILITIES: ['utilities', 'bills'],
  // Health / personal
  MEDICAL: ['medical', 'health', 'pharmacy'],
  PERSONAL_CARE: ['personal care', 'health', 'beauty'],
  // Entertainment / services
  ENTERTAINMENT: ['entertainment', 'subscription'],
  GENERAL_SERVICES: ['services'],
  // Income / transfers / fees (handled mostly as transfers elsewhere, but map income)
  INCOME: ['income', 'salary', 'paycheck'],
  BANK_FEES: ['fees', 'bank'],
}

function confidenceScore(level: string | null | undefined): number {
  switch ((level ?? '').toUpperCase()) {
    case 'VERY_HIGH': return 1.0
    case 'HIGH': return 0.9
    case 'MEDIUM': return 0.7
    case 'LOW': return 0.5
    default: return 0.85 // Plaid often omits the level; treat a present PFC as reasonably confident
  }
}

/**
 * Map a Plaid provider category to one of the user's categories.
 * Returns the matched category + a confidence derived from Plaid's confidence_level.
 * The caller decides whether the confidence clears the mcc_mapping threshold.
 */
export function matchProvider(
  providerCategory: string | null | undefined,
  providerConfidence: string | null | undefined,
  categories: SelectableCategory[],
): { category_id: string; confidence: number } | null {
  if (!providerCategory) return null

  const detailed = providerCategory.toUpperCase()
  const primary = detailed.split('_').slice(0, detailedPrimaryLen(detailed)).join('_')

  const keywords = PFC_KEYWORDS[detailed] ?? PFC_KEYWORDS[primary]
  if (!keywords) return null

  for (const kw of keywords) {
    const hit = categories.find(c => c.name.toLowerCase().includes(kw))
    if (hit) return { category_id: hit.id, confidence: confidenceScore(providerConfidence) }
  }
  return null
}

// Plaid primaries can be 1-3 underscore-joined words (FOOD_AND_DRINK, TRANSPORTATION,
// RENT_AND_UTILITIES). Find the primary by checking which known prefix the detailed starts with.
const KNOWN_PRIMARIES = [
  'FOOD_AND_DRINK', 'RENT_AND_UTILITIES', 'GENERAL_MERCHANDISE', 'HOME_IMPROVEMENT',
  'GENERAL_SERVICES', 'PERSONAL_CARE', 'TRANSPORTATION', 'TRAVEL', 'ENTERTAINMENT',
  'MEDICAL', 'INCOME', 'BANK_FEES', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS',
]
function detailedPrimaryLen(detailed: string): number {
  const match = KNOWN_PRIMARIES.find(p => detailed === p || detailed.startsWith(p + '_'))
  return match ? match.split('_').length : 1
}
