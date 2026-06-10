import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'

type ListWithCount = {
  id: string
  name: string
  description: string | null
  created_at: string
  total_items: number
  done_items: number
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ListCard({ list }: { list: ListWithCount }) {
  return (
    <Link href={`/lists/${list.id}`}>
      <div className="p-4 rounded-lg border border-gray-200 hover:shadow-sm transition hover:border-blue-200 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-base text-gray-900">{list.name}</h2>
            {list.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{list.description}</p>
            )}
          </div>
          <span className="text-sm text-gray-400 whitespace-nowrap flex-shrink-0">
            {list.done_items}/{list.total_items}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400">{formatDate(list.created_at)}</span>
          {list.total_items > 0 && (
            <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-24">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.round((list.done_items / list.total_items) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default async function ListsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lists } = await supabase
    .from('lists')
    .select('id, name, description, created_at')
    .eq('user_id', user.id)
    .eq('is_archived', false)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // Fetch item counts per list
  const listIds = (lists ?? []).map(l => l.id)
  const countMap: Record<string, { total: number; done: number }> = {}

  if (listIds.length > 0) {
    const { data: items } = await supabase
      .from('list_items')
      .select('list_id, is_done')
      .in('list_id', listIds)
      .eq('user_id', user.id)

    for (const item of items ?? []) {
      if (!countMap[item.list_id]) countMap[item.list_id] = { total: 0, done: 0 }
      countMap[item.list_id].total++
      if (item.is_done) countMap[item.list_id].done++
    }
  }

  const listsWithCounts: ListWithCount[] = (lists ?? []).map(l => ({
    ...l,
    total_items: countMap[l.id]?.total ?? 0,
    done_items: countMap[l.id]?.done ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Lists' }]} />
          <div className="flex items-center justify-between mt-4 sm:mt-6">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Lists</h1>
              <p className="text-sm sm:text-base text-gray-600">Keep track of anything that matters</p>
            </div>
            <Link
              href="/lists/new"
              className="bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              + New List
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {listsWithCounts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-5xl mb-4">📋</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Your lists live here</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-8">
              Create lists for anything — packing for a trip, groceries, gift ideas, things to research. Stay organised and check things off as you go.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8 text-left">
              {[
                { icon: '🧳', title: 'Packing lists', desc: 'Never forget something important when you travel' },
                { icon: '🛒', title: 'Shopping lists', desc: 'Groceries, wish lists, or anything to buy' },
                { icon: '💡', title: 'Ideas & tasks', desc: 'Capture thoughts and get things done' },
              ].map(f => (
                <div key={f.title} className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xl mb-1.5">{f.icon}</p>
                  <p className="text-sm font-semibold text-gray-800 mb-0.5">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
            <Link
              href="/lists/new"
              className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create your first list
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {listsWithCounts.map(list => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
