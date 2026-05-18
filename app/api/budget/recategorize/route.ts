import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { categorizeWithGroq, buildSelectableCategories, type FewShotExample } from '@/lib/groq-categorize'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('user_id', user.id)

  const categories = buildSelectableCategories(allCategories ?? [])
  const categoryNameMap = new Map(categories.map(c => [c.id, c.name]))

  // Build few-shot examples from manually categorized transactions
  const { data: examples } = await supabase
    .from('transactions')
    .select('merchant, description, category_id')
    .eq('user_id', user.id)
    .not('category_id', 'is', null)
    .not('merchant', 'is', null)
    .limit(100)

  const fewShot: FewShotExample[] = (examples ?? [])
    .filter(t => categoryNameMap.has(t.category_id))
    .map(t => ({
      merchant: t.merchant!,
      categoryName: categoryNameMap.get(t.category_id)!,
    }))
    // Deduplicate by merchant
    .filter((e, i, arr) => arr.findIndex(x => x.merchant === e.merchant) === i)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, description, merchant')
    .eq('user_id', user.id)

  if (!transactions?.length) return NextResponse.json({ updated: 0 })

  const CHUNK = 50
  let updated = 0

  for (let i = 0; i < transactions.length; i += CHUNK) {
    const chunk = transactions.slice(i, i + CHUNK)
    const categoryMap = await categorizeWithGroq(chunk, categories, fewShot)

    for (const [txId, catId] of categoryMap) {
      if (!catId) continue // never overwrite with null — leave existing category intact
      await supabase.from('transactions').update({ category_id: catId }).eq('id', txId)
      updated++
    }
  }

  return NextResponse.json({ updated })
}
