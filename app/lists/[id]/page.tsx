import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import ListDetailView from '@/app/components/lists/ListDetailView'

type ListItem = {
  id: string
  title: string
  notes: string | null
  url: string | null
  is_done: boolean
  sort_order: number
  due_date: string | null
  importance: number | null
  created_at: string
}

type List = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: list } = await supabase
    .from('lists')
    .select('id, name, description, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!list) notFound()

  const { data: items } = await supabase
    .from('list_items')
    .select('id, title, notes, url, is_done, sort_order, due_date, importance, created_at')
    .eq('list_id', id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Lists', href: '/lists' }, { label: list.name }]} />
          <div className="mt-4 sm:mt-6">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{list.name}</h1>
            {list.description && (
              <p className="text-sm sm:text-base text-gray-600">{list.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <ListDetailView
          list={list as List}
          initialItems={(items ?? []) as ListItem[]}
        />
      </div>
    </div>
  )
}
