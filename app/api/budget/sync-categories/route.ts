import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Categories present in Monarch/CSV exports that aren't in the default Wooli setup
const EXTRA_CATEGORIES: { parent: string; name: string }[] = [
  { parent: 'Travel',  name: 'Transit & Rideshare' },
  { parent: 'Travel',  name: 'Trip' },
  { parent: 'Home',    name: 'Housing' },
  { parent: 'Home',    name: 'Home Insurance' },
  { parent: 'Other',   name: 'Credit Card Payment' },
  { parent: 'Other',   name: 'Credit Card Annual Fees' },
  { parent: 'Other',   name: 'Balance Adjustments' },
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
