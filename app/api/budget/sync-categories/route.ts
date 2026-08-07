import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Categories present in Monarch/CSV exports that aren't in the default Wooli setup.
// Names here must track the live category names — a name that drifts out of sync is
// treated as missing and re-inserted, which silently duplicates the renamed category.
const EXTRA_CATEGORIES: { parent: string; name: string }[] = [
  { parent: 'Travel',    name: 'Transit & Rideshare' },
  { parent: 'Travel',    name: 'Flights & Hotels' },
  { parent: 'Household', name: 'Shelter' },
  { parent: 'Household', name: 'Property Insurance' },
  { parent: 'Transfer',  name: 'Card Autopay' },
  { parent: 'General',   name: 'Annual Fees' },
  { parent: 'Transfer',  name: 'Balance Adjustments' },
]

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabase
    .from('categories')
    .select('id, name, parent_id, color')
    .eq('user_id', user.id)

  if (!existing?.length) return NextResponse.json({ added: 0, message: 'No categories found — run setup first' })

  const existingNames = new Set(existing.map(c => c.name.toLowerCase()))
  const parentMap = new Map(existing.filter(c => !c.parent_id).map(c => [c.name.toLowerCase(), c]))

  let added = 0
  for (const cat of EXTRA_CATEGORIES) {
    if (existingNames.has(cat.name.toLowerCase())) continue

    const parent = parentMap.get(cat.parent.toLowerCase())
    if (!parent) continue

    await supabase.from('categories').insert({
      user_id: user.id,
      name: cat.name,
      color: parent.color,
      is_income: false,
      parent_id: parent.id,
      sort_order: 99,
    })
    added++
  }

  return NextResponse.json({ added })
}
