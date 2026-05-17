import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function categorizeWithGroq(
  transactions: { id: string; description: string | null; merchant: string | null; plaid_category?: string | null }[],
  categories: { id: string; name: string }[]
): Promise<Map<string, string | null>> {
  if (!categories.length || !transactions.length) return new Map()

  const categoryList = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n')
  const txList = transactions.map((t, i) =>
    `${i}: merchant="${t.merchant ?? t.description}" description="${t.description ?? ''}"`
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
      result.set(t.id, valid ? catId : null)
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

  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('user_id', user.id)

  const parentIds = new Set(allCategories?.filter(c => c.parent_id).map(c => c.parent_id))
  const selectableCategories = (allCategories ?? []).filter(c =>
    c.parent_id !== null || !parentIds.has(c.id)
  )
  const parentMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))
  const categories = selectableCategories.map(c => ({
    id: c.id,
    name: c.parent_id ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}` : c.name,
  }))

  // Fetch all transactions (not just uncategorized) for re-run
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, description, merchant')
    .eq('user_id', user.id)

  if (!transactions?.length) return NextResponse.json({ updated: 0 })

  const CHUNK = 50
  let updated = 0

  for (let i = 0; i < transactions.length; i += CHUNK) {
    const chunk = transactions.slice(i, i + CHUNK)
    const categoryMap = await categorizeWithGroq(chunk, categories)

    for (const [txId, catId] of categoryMap) {
      await supabase
        .from('transactions')
        .update({ category_id: catId })
        .eq('id', txId)
      if (catId) updated++
    }
  }

  return NextResponse.json({ updated })
}
