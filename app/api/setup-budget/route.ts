import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const DEFAULT_CATEGORIES = [
  // Expenses
  {
    name: 'Food & Dining', color: '#f59e0b', icon: '🍽️', is_income: false, is_transfer: false,
    children: [
      { name: 'Restaurants', icon: '🍽️' },
      { name: 'Groceries', icon: '🛒' },
      { name: 'Coffee', icon: '☕' },
      { name: 'Takeout', icon: '🥡' },
    ],
  },
  {
    name: 'Home', color: '#8b5cf6', icon: '🏠', is_income: false, is_transfer: false,
    children: [
      { name: 'Rent', icon: '🏠' },
      { name: 'Utilities', icon: '💡' },
      { name: 'Internet', icon: '📶' },
      { name: 'Home Improvement', icon: '🔨' },
    ],
  },
  {
    name: 'Travel', color: '#06b6d4', icon: '✈️', is_income: false, is_transfer: false,
    children: [
      { name: 'Transit', icon: '🚇' },
      { name: 'Rideshare', icon: '🚗' },
      { name: 'Flights', icon: '✈️' },
      { name: 'Hotels', icon: '🏨' },
      { name: 'Car', icon: '🚘' },
    ],
  },
  {
    name: 'Personal', color: '#ec4899', icon: '🧴', is_income: false, is_transfer: false,
    children: [
      { name: 'Medical', icon: '🏥' },
      { name: 'Shopping', icon: '🛍️' },
      { name: 'Entertainment', icon: '🎬' },
      { name: 'Personal Care', icon: '💅' },
    ],
  },
  {
    name: 'Other', color: '#64748b', icon: '📁', is_income: false, is_transfer: false,
    children: [
      { name: 'Taxes', icon: '📋' },
      { name: 'Subscriptions', icon: '📱' },
      { name: 'Miscellaneous', icon: '📌' },
    ],
  },
  // Income
  {
    name: 'Income', color: '#22c55e', icon: '💵', is_income: true, is_transfer: false,
    children: [
      { name: 'Salary', icon: '💵' },
      { name: 'Freelance', icon: '💻' },
      { name: 'Rent Income', icon: '💰' },
      { name: 'Other Income', icon: '💰' },
    ],
  },
  // Transfers
  {
    name: 'Transfer', color: '#8b5cf6', icon: '↔️', is_income: false, is_transfer: true,
    children: [
      { name: 'Balance Adjustments', icon: '⚖️' },
      { name: 'Transfer', icon: '↔️' },
      { name: 'Credit Card Payment', icon: '💳' },
    ],
  },
]

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }
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

  // Batch-insert all parents in one round-trip
  const { data: parents, error: parentError } = await supabase
    .from('categories')
    .insert(
      DEFAULT_CATEGORIES.map((cat, i) => ({
        user_id: user.id,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        is_income: cat.is_income,
        is_transfer: cat.is_transfer,
        sort_order: i,
      }))
    )
    .select()

  if (parentError) return NextResponse.json({ error: parentError.message }, { status: 500 })
  if (!parents) return NextResponse.json({ error: 'No parents returned' }, { status: 500 })

  // Build name → id map
  const parentMap = new Map(parents.map(p => [p.name, p.id]))

  // Batch-insert all children in one round-trip
  const children = DEFAULT_CATEGORIES.flatMap((cat, pi) =>
    cat.children.map((child, ci) => ({
      user_id: user.id,
      name: child.name,
      icon: child.icon,
      color: cat.color,
      is_income: cat.is_income,
      is_transfer: cat.is_transfer,
      parent_id: parentMap.get(cat.name),
      sort_order: DEFAULT_CATEGORIES.length + pi * 10 + ci,
    }))
  )

  const { error: childError } = await supabase.from('categories').insert(children)
  if (childError) return NextResponse.json({ error: childError.message }, { status: 500 })

  return NextResponse.json({ message: `Created ${parents.length + children.length} categories` })
}
