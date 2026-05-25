import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RecurringForm from '@/app/components/budget/RecurringForm'

export default async function EditRecurringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: item }, { data: allCategories }] = await Promise.all([
    supabase.from('recurring_transactions').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('categories').select('id, name, parent_id').eq('user_id', user.id),
  ])

  if (!item) notFound()

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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Edit Recurring Transaction</h1>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-8">
        <RecurringForm userId={user.id} categories={categories} item={item} />
      </div>
    </div>
  )
}
