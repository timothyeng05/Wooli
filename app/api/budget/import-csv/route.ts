import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface CsvRow {
  date: string
  merchant: string
  category: string
  account: string
  notes: string
  amount: number
  owner: string | null
}

const VALID_OWNERS = new Set(['Timothy Eng', 'Jessica Li', 'Shared'])

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows, replace }: { rows: CsvRow[]; replace: boolean } = await request.json()

  if (replace) {
    await supabase.from('transactions').delete().eq('user_id', user.id)
  }

  // Build category name → id map (case-insensitive)
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', user.id)

  const catMap = new Map<string, string>()
  for (const c of categories ?? []) catMap.set(c.name.toLowerCase(), c.id)

  // Build mask → plaid_account_id map for linking CSV rows to Plaid accounts
  // CSV names look like "Chase Checking (...1234)" — extract the 4-digit mask
  const { data: plaidAccounts } = await supabase
    .from('plaid_accounts')
    .select('account_id, name, mask')
    .eq('user_id', user.id)

  const maskToPlaidId = new Map<string, string>()
  for (const a of plaidAccounts ?? []) {
    if (a.mask) maskToPlaidId.set(a.mask, a.account_id)
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
      const owner = r.owner && VALID_OWNERS.has(r.owner) ? r.owner : null
      const mask = extractMask(r.account)
      const plaidAccountId = mask ? (maskToPlaidId.get(mask) ?? null) : null
      return {
        user_id: user.id,
        amount: r.amount,
        description: r.merchant || null,
        merchant: r.merchant || null,
        transacted_at: r.date + 'T12:00:00',
        category_id: catId,
        is_transfer: isTransfer,
        notes: r.notes || null,
        owner,
        account_name: r.account || null,
        plaid_account_id: plaidAccountId,
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
