import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import RecurringForm from '@/app/components/budget/RecurringForm'

export default async function NewRecurringPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { data: allCategories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .eq('user_id', user.id)

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('id, full_name, display_name, color')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
  const members = memberRows ?? []

  const parentIds = new Set(allCategories?.filter(c => c.parent_id).map(c => c.parent_id))
  const parentMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))
  const categories = (allCategories ?? [])
    .filter(c => c.parent_id !== null || !parentIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.parent_id ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}` : c.name,
    }))

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">New Recurring Transaction</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-8">
        <RecurringForm userId={user.id} categories={categories} members={members} />
      </div>
    </div>
  )
}
