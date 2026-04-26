import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'

interface ListRow {
  id: string
  name: string
  description: string | null
  is_archived: boolean
  created_at: string
}

interface ItemCountRow {
  list_id: string
  is_done: boolean
}

export default async function ListsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawLists } = await supabase
    .from('lists')
    .select('id, name, description, is_archived, created_at')
    .eq('user_id', user.id)
    .order('is_archived', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  const lists = (rawLists || []) as ListRow[]
  const listIds = lists.map(l => l.id)

  let counts: ItemCountRow[] = []
  if (listIds.length > 0) {
    const { data } = await supabase
      .from('list_items')
      .select('list_id, is_done')
      .in('list_id', listIds)
    counts = (data || []) as ItemCountRow[]
  }

  const countByList = new Map<string, { total: number; done: number }>()
  counts.forEach(c => {
    const cur = countByList.get(c.list_id) || { total: 0, done: 0 }
    cur.total += 1
    if (c.is_done) cur.done += 1
    countByList.set(c.list_id, cur)
  })

  const active = lists.filter(l => !l.is_archived)
  const archived = lists.filter(l => l.is_archived)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Lists' }]} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Lists</h1>
              <p className="text-gray-600">Wish lists, to-dos, anything</p>
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

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {active.length > 0 ? (
          <div className="space-y-3">
            {active.map(l => {
              const c = countByList.get(l.id) || { total: 0, done: 0 }
              const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
              return (
                <Link key={l.id} href={`/lists/${l.id}`}>
                  <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{l.name}</p>
                      {l.description && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">{l.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-500">
                          {c.total === 0 ? 'Empty' : `${c.done}/${c.total} done`}
                        </span>
                        {c.total > 0 && (
                          <div className="flex-1 max-w-[160px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-600 mb-6">No lists yet</p>
            <Link
              href="/lists/new"
              className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create your first list
            </Link>
          </div>
        )}

        {archived.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Archived</h2>
            <div className="space-y-2">
              {archived.map(l => {
                const c = countByList.get(l.id) || { total: 0, done: 0 }
                return (
                  <Link key={l.id} href={`/lists/${l.id}`}>
                    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-gray-100 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-600 truncate">{l.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.total} item{c.total === 1 ? '' : 's'}</p>
                      </div>
                      <span className="text-gray-300">›</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
