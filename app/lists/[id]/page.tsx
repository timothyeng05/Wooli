import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import ListDetailView, { type ListItem } from '@/app/components/lists/ListDetailView'

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list, error } = await supabase
    .from('lists')
    .select('id, name, description, is_archived')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !list) redirect('/lists')

  const { data: items } = await supabase
    .from('list_items')
    .select('id, title, notes, url, is_done, sort_order, created_at, due_date, importance')
    .eq('list_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Lists', href: '/lists' },
            { label: list.name },
          ]} />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <ListDetailView
          userId={user.id}
          list={list}
          initialItems={(items || []) as ListItem[]}
        />
      </div>
    </div>
  )
}
