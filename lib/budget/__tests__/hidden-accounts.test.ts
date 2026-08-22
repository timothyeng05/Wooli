import { describe, it, expect } from 'vitest'
import { buildHiddenAccountFilter } from '@/lib/budget/hidden-accounts'

describe('buildHiddenAccountFilter', () => {
  it('returns null when nothing is hidden, so callers apply no filter', () => {
    // PostgREST rejects an empty in.() list, so "no filter" has to be signalled
    // rather than expressed as an empty one.
    expect(buildHiddenAccountFilter([])).toBeNull()
  })

  it('keeps rows with no provider account id', () => {
    // The load-bearing case: SQL's `NULL NOT IN (…)` is NULL, not true, so
    // without the is.null arm every manually-added transaction would vanish.
    const filter = buildHiddenAccountFilter(['ACT-1'])
    expect(filter).toContain('provider_account_id.is.null')
    expect(filter?.startsWith('provider_account_id.is.null,')).toBe(true)
  })

  it('excludes a single hidden account', () => {
    expect(buildHiddenAccountFilter(['ACT-1'])).toBe(
      'provider_account_id.is.null,provider_account_id.not.in.("ACT-1")',
    )
  })

  it('excludes several hidden accounts as one comma-separated list', () => {
    expect(buildHiddenAccountFilter(['ACT-1', 'ACT-2', 'ACT-3'])).toBe(
      'provider_account_id.is.null,provider_account_id.not.in.("ACT-1","ACT-2","ACT-3")',
    )
  })

  it('quotes values so a comma in an id cannot split the list', () => {
    // Provider ids come from the bank; an unquoted comma would silently widen
    // the exclusion to ids that were never hidden.
    expect(buildHiddenAccountFilter(['ACT-a,ACT-b'])).toBe(
      'provider_account_id.is.null,provider_account_id.not.in.("ACT-a,ACT-b")',
    )
  })

  it('escapes embedded quotes and backslashes', () => {
    expect(buildHiddenAccountFilter(['say"hi']))
      .toBe('provider_account_id.is.null,provider_account_id.not.in.("say\\"hi")')
    expect(buildHiddenAccountFilter(['back\\slash']))
      .toBe('provider_account_id.is.null,provider_account_id.not.in.("back\\\\slash")')
  })
})
