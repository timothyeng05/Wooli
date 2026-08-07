import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { normalizeMerchant } from '@/lib/budget/categorize/normalize-merchant'

interface CsvRow {
  date: string
  merchant: string
  category: string
  account: string
  notes: string
  amount: number
  owner: string | null
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: householdMembers } = await supabase
    .from('household_members')
    .select('full_name')
    .eq('user_id', user.id)
  const validOwners = new Set((householdMembers ?? []).map(m => m.full_name))

  const { rows, replace, accountNames }: { rows: CsvRow[]; replace: boolean; accountNames?: string[] } = await request.json()

  if (replace) {
    // Only delete transactions from the accounts being imported, not everything
    const accounts = accountNames && accountNames.length > 0
      ? accountNames
      : [...new Set(rows.map(r => r.account).filter(Boolean))]
    if (accounts.length > 0) {
      await supabase.from('transactions').delete()
        .eq('user_id', user.id)
        .in('account_name', accounts)
    }
  }

  // Build category name → id map (case-insensitive)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)

  const catMap = new Map<string, string>()
  for (const c of categories ?? []) catMap.set(c.name.toLowerCase(), c.id)

  // Build mask → provider_account_id map for linking CSV rows to synced accounts
  // CSV names look like "Chase Checking (...1234)" — extract the 4-digit mask
  const { data: syncedAccounts } = await supabase
    .from('synced_accounts')
    .select('provider_account_id, name, mask')
    .eq('user_id', user.id)

  const maskToAccountId = new Map<string, string>()
  for (const a of syncedAccounts ?? []) {
    if (a.mask) maskToAccountId.set(a.mask, a.provider_account_id)
  }

  function extractMask(accountName: string): string | null {
    return accountName.match(/\.*\.(\d{4})\)?$/)?.[1] ?? accountName.match(/\(\.+(\d{4})\)/)?.[1] ?? null
  }

  // Match Monarch's transfer categories and common transfer descriptions
  const transferCategory = /^(transfer|credit card payment|loan payment|mortgage payment)$/i
  const transferMerchant = /^(autopay|auto pay|automatic payment|zelle|venmo|paypal|cashapp|wire transfer|ach transfer)$/i

  const batch = rows
    .filter(r => isFinite(r.amount))
    .map(r => {
      const isTransfer = transferCategory.test(r.category.trim()) || transferMerchant.test(r.merchant.trim())
      const catId = isTransfer ? null : (catMap.get(r.category.toLowerCase()) ?? null)
      const owner = r.owner && validOwners.has(r.owner) ? r.owner : null
      const mask = extractMask(r.account)
      const providerAccountId = mask ? (maskToAccountId.get(mask) ?? null) : null
      // Monarch categories are user-curated, so treat the import as user-confirmed:
      // this seeds merchant_memory (via the DB trigger) and bootstraps the
      // deterministic layers for future bank syncs.
      return {
        user_id: user.id,
        amount: r.amount,
        description: r.merchant || null,
        merchant: r.merchant || null,
        transacted_at: r.date + 'T12:00:00',
        category_id: catId,
        is_transfer: isTransfer,
        is_pending: false,
        notes: r.notes || null,
        owner,
        account_name: r.account || null,
        provider_account_id: providerAccountId,
        normalized_merchant: normalizeMerchant(r.merchant),
        categorization_source: 'user_confirmed',
        categorization_confidence: 1.0,
        needs_review: false,
      }
    })

  const CHUNK = 200
  let imported = 0
  for (let i = 0; i < batch.length; i += CHUNK) {
    const { error } = await supabase.from('transactions').insert(batch.slice(i, i + CHUNK))
    if (!error) imported += Math.min(CHUNK, batch.length - i)
  }

  return NextResponse.json({ imported, total: batch.length })
}
