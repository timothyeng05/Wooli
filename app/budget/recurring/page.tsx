import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import RecurringList from '@/app/components/budget/RecurringList'

export default async function RecurringPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: recurring }, { data: allCategories }] = await Promise.all([
    supabase
      .from('recurring_transactions')
      .select('*, categories(id, name, color)')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('user_id', user.id),
  ])

  const parentIds = new Set(allCategories?.filter(c => c.parent_id).map(c => c.parent_id))
  const parentMap = new Map((allCategories ?? []).map(c => [c.id, c.name]))
  const categories = (allCategories ?? [])
    .filter(c => c.parent_id !== null || !parentIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.parent_id ? `${parentMap.get(c.parent_id) ?? ''} → ${c.name}` : c.name,
      rawName: c.name,
      parent_id: c.parent_id,
    }))

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Budget', href: '/budget' }, { label: 'Recurring' }]} />
          <div className="flex items-start justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Recurring</h1>
              <p className="text-gray-500 mt-1 text-sm">Auto-generated on their scheduled date</p>
            </div>
            <Link
              href="/budget/recurring/new"
              className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              + Add Recurring
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <RecurringList
          userId={user.id}
          initialItems={recurring ?? []}
          categories={categories}
        />
      </div>
    </div>
  )
}
