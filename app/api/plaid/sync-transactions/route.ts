import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/plaid-client'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

interface Category { id: string; name: string }
interface PlaidTx {
  transaction_id: string
  name: string
  merchant_name?: string | null
  amount: number
  date: string
  personal_finance_category?: { primary?: string; detailed?: string } | null
}

async function categorizeWithGroq(
  transactions: PlaidTx[],
  categories: Category[]
): Promise<Map<string, string | null>> {
  if (!categories.length || !transactions.length) return new Map()

  const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')
  const txList = transactions.map((t, i) =>
    `${i}: merchant="${t.merchant_name ?? t.name}" plaid_category="${t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary ?? 'unknown'}"`
  ).join('\n')

  const prompt = `You are a transaction categorizer. Given a list of transactions and categories, assign the best category id to each transaction. If none fit, use null.

Categories:
${categoryList}

Transactions (index: details):
${txList}

Respond with ONLY a JSON array of category ids (or null) in the same order as the transactions. Example: ["uuid-1", null, "uuid-2"]`

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
    const result = new Map<string, string | null>()
    transactions.forEach((t, i) => {
      const catId = ids[i]
      const valid = catId && categories.some(c => c.id === catId)
      result.set(t.transaction_id, valid ? catId : null)
    })
    return result
  } catch {
    return new Map()
  }
}

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: items } = await supabase
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', user.id)

  if (!items?.length) return NextResponse.json({ added: 0, modified: 0, removed: 0 })

  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('user_id', user.id)

  // Only allow subcategories (or parents with no children) — mirrors TransactionForm logic
  const parentIds = new Set(allCategories?.filter(c => c.parent_id).map(c => c.parent_id))
  const selectableCategories = (allCategories ?? []).filter(c =>
    c.parent_id !== null || !parentIds.has(c.id)
  )

  // Build full path names (e.g. "Food & Drink → Restaurants") for better Groq context
  const parentMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))
  const categories = selectableCategories.map(c => ({
    id: c.id,
    name: c.parent_id
      ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}`
      : c.name,
  }))

  let totalAdded = 0
  let totalModified = 0
  let totalRemoved = 0

  for (const item of items) {
    let cursor = item.cursor ?? undefined
    let hasMore = true

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: item.access_token,
        cursor,
        count: 500,
      })
      const { added, modified, removed, next_cursor, has_more } = res.data

      if (added.length) {
        // Batch categorize with Groq in chunks of 50
        const CHUNK = 50
        const categoryMap = new Map<string, string | null>()
        for (let i = 0; i < added.length; i += CHUNK) {
          const chunk = added.slice(i, i + CHUNK)
          const partial = await categorizeWithGroq(chunk, categories ?? [])
          partial.forEach((v, k) => categoryMap.set(k, v))
        }

        const rows = added.map(t => ({
          user_id: user.id,
          plaid_transaction_id: t.transaction_id,
          amount: -(t.amount),
          description: t.name,
          merchant: t.merchant_name ?? null,
          transacted_at: t.date + 'T00:00:00',
          category_id: categoryMap.get(t.transaction_id) ?? null,
        }))
        await supabase.from('transactions').upsert(rows, { onConflict: 'plaid_transaction_id' })
        totalAdded += added.length
      }

      for (const t of modified) {
        await supabase
          .from('transactions')
          .update({
            amount: -(t.amount),
            description: t.name,
            merchant: t.merchant_name ?? null,
            transacted_at: t.date + 'T00:00:00',
          })
          .eq('plaid_transaction_id', t.transaction_id)
        totalModified++
      }

      for (const t of removed) {
        await supabase
          .from('transactions')
          .delete()
          .eq('plaid_transaction_id', t.transaction_id)
        totalRemoved++
      }

      cursor = next_cursor
      hasMore = has_more
    }

    await supabase
      .from('plaid_items')
      .update({ cursor })
      .eq('item_id', item.item_id)
  }

  return NextResponse.json({ added: totalAdded, modified: totalModified, removed: totalRemoved })
}
