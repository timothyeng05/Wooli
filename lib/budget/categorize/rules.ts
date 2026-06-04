import type { CategorizeInput, UserRule } from './types'

// A rule matches when ALL of its non-null predicates hold. Predicates available:
// normalized merchant, raw merchant, regex (vs normalized||raw), amount range,
// account name, MCC/provider category, and notes.
function ruleMatches(rule: UserRule, input: CategorizeInput, normalized: string): boolean {
  const raw = (input.raw_merchant ?? '').toLowerCase()
  let any = false

  if (rule.match_normalized_merchant != null) {
    any = true
    if (!normalized.includes(rule.match_normalized_merchant.toLowerCase())) return false
  }
  if (rule.match_raw_merchant != null) {
    any = true
    if (!raw.includes(rule.match_raw_merchant.toLowerCase())) return false
  }
  if (rule.match_regex != null) {
    any = true
    let re: RegExp
    try { re = new RegExp(rule.match_regex, 'i') } catch { return false }
    if (!re.test(normalized) && !re.test(raw)) return false
  }
  if (rule.match_amount_min != null) {
    any = true
    if (input.amount == null || input.amount < rule.match_amount_min) return false
  }
  if (rule.match_amount_max != null) {
    any = true
    if (input.amount == null || input.amount > rule.match_amount_max) return false
  }
  if (rule.match_account_name != null) {
    any = true
    if (!(input.account_name ?? '').toLowerCase().includes(rule.match_account_name.toLowerCase())) return false
  }
  if (rule.match_mcc != null) {
    any = true
    if (!(input.provider_category ?? input.mcc ?? '').toLowerCase().includes(rule.match_mcc.toLowerCase())) return false
  }
  if (rule.match_notes != null) {
    any = true
    if (!(input.notes ?? '').toLowerCase().includes(rule.match_notes.toLowerCase())) return false
  }

  // A rule with no predicates never matches (guards against an empty rule catching everything).
  return any
}

/**
 * Returns the first matching rule (rules must already be sorted by priority asc, created_at asc),
 * or null if none match.
 */
export function matchUserRule(
  input: CategorizeInput,
  normalized: string,
  rules: UserRule[],
): UserRule | null {
  for (const rule of rules) {
    if (ruleMatches(rule, input, normalized)) return rule
  }
  return null
}
