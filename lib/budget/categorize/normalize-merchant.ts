// Deterministic merchant-name normalization.
//
// Bank merchant strings are noisy: "SQ *BLUE BOTTLE COFFEE 0123 NEW YORK NY",
// "TST* JOE'S PIZZA", "AMZN MKTP US*2X4AB", "POS DEBIT 04/12 WHOLEFDS NYC". We strip
// the noise so the same real-world merchant collapses to one stable key that rules,
// merchant memory, and similarity can all match on — while preserving the brand words.

// Payment-processor / aggregator prefixes that wrap the real merchant name.
const PROCESSOR_PREFIXES = [
  'sq', 'sqc', 'tst', 'tst*', 'sp', 'spk', 'pp', 'paypal', 'pos', 'ach',
  'dd', 'doordash', 'gh', 'ext', 'che', 'pmt', 'web', 'bill', 'recur',
]

// Whole tokens that are pure noise (card/network/transaction-type words).
const NOISE_TOKENS = new Set([
  'debit', 'credit', 'card', 'purchase', 'pos', 'ach', 'visa', 'mastercard',
  'mc', 'amex', 'discover', 'payment', 'pmt', 'recurring', 'recur', 'autopay',
  'auto', 'pay', 'web', 'id', 'ppd', 'des', 'indn', 'co', 'ref', 'trn',
  'transaction', 'online', 'bill', 'checkcard', 'ckcd', 'withdrawal', 'dda',
  'us', 'usa', 'inc', 'llc', 'intl',
])

// US state codes — stripped only when they trail the string (a location suffix).
const STATE_CODES = new Set([
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il',
  'in', 'ia', 'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt',
  'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri',
  'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va', 'wa', 'wv', 'wi', 'wy', 'dc',
])

export function normalizeMerchant(raw: string | null | undefined): string {
  if (!raw) return ''

  let s = raw.toLowerCase()

  // Drop everything after a '*' separator's processor marker but keep the merchant
  // that usually follows it: "sq *blue bottle" -> "blue bottle". Replace '*' with space.
  s = s.replace(/\*/g, ' ')

  // Strip dates (mm/dd, mm/dd/yy, mm-dd) and standalone long digit runs (terminal/txn ids).
  s = s.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
  s = s.replace(/#\s*\d+/g, ' ')               // "#1234"
  s = s.replace(/\bx{2,}\d+\b/g, ' ')          // "xxxx1234" masked card
  s = s.replace(/\b\d{4,}\b/g, ' ')            // long id numbers (4+ digits)
  s = s.replace(/\b\d+\s*(?:st|nd|rd|th)\b/g, ' ') // ordinals like "5th"

  // Collapse punctuation to spaces, keep alphanumerics and the apostrophe in brands.
  s = s.replace(/[^a-z0-9'\s]/g, ' ')

  let tokens = s.split(/\s+/).filter(Boolean)

  // Strip a leading processor prefix (only the first token, only if it's pure noise).
  if (tokens.length > 1 && PROCESSOR_PREFIXES.includes(tokens[0])) {
    tokens = tokens.slice(1)
  }

  // Strip trailing location suffix: "... new york ny" / "... ny" / "... ny 10001".
  // Remove a trailing zip, then a trailing state code.
  if (tokens.length > 1 && /^\d{5}$/.test(tokens[tokens.length - 1])) tokens.pop()
  if (tokens.length > 1 && STATE_CODES.has(tokens[tokens.length - 1])) tokens.pop()

  // Drop noise tokens and purely-numeric / single-char leftovers, but never drop the
  // last remaining meaningful token (so a merchant never normalizes to empty).
  const meaningful = tokens.filter(t => !NOISE_TOKENS.has(t) && !/^\d+$/.test(t) && t.length > 1)
  const result = (meaningful.length ? meaningful : tokens).join(' ').trim()

  return result
}
