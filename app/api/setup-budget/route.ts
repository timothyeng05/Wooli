import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_CATEGORIES = [
  // Expenses
  { name: 'Food & Dining', color: '#f59e0b', is_income: false, children: ['Restaurants', 'Groceries', 'Coffee', 'Takeout'] },
  { name: 'Home', color: '#8b5cf6', is_income: false, children: ['Rent', 'Utilities', 'Internet', 'Home Improvement'] },
  { name: 'Travel', color: '#06b6d4', is_income: false, children: ['Transit', 'Rideshare', 'Flights', 'Hotels', 'Car'] },
  { name: 'Personal', color: '#ec4899', is_income: false, children: ['Medical', 'Shopping', 'Entertainment', 'Personal Care'] },
  { name: 'Other', color: '#64748b', is_income: false, children: ['Taxes', 'Subscriptions', 'Miscellaneous'] },
  // Income
  { name: 'Income', color: '#22c55e', is_income: true, children: ['Salary', 'Freelance', 'Rent Income', 'Other Income'] },
]

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user already has categories
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Categories already set up' })
  }

  let created = 0
  for (const cat of DEFAULT_CATEGORIES) {
    const { data: parent, error: parentError } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: cat.name, color: cat.color, is_income: cat.is_income, sort_order: created })
      .select()
      .single()

    if (parentError) return NextResponse.json({ error: parentError.message, code: parentError.code }, { status: 500 })
    if (!parent) continue
    created++

    for (const childName of cat.children) {
      await supabase.from('categories').insert({
        user_id: user.id,
        name: childName,
        color: cat.color,
        is_income: cat.is_income,
        parent_id: parent.id,
        sort_order: created
      })
      created++
    }
  }

  return NextResponse.json({ message: `Created ${created} categories` })
}
