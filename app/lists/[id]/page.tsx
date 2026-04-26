import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import ListDetailView, { type ListItem } from '@/app/components/lists/ListDetailView'

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // No user_id filter — RLS handles access (owner or shared-with)
  const { data: list, error } = await supabase
    .from('lists')
    .select('id, name, description, is_archived, user_id')
    .eq('id', id)
    .single()

  if (error || !list) notFound()

  const isOwner = (list as any).user_id === user.id

  const { data: items } = await supabase
    .from('list_items')
    .select('id, title, notes, url, is_done, sort_order, created_at, due_date, importance')
    .eq('list_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  // Owner: fetch current shares + all accepted friends for the share panel
  let shares: any[] = []
  let friends: any[] = []
  let canEdit = isOwner

  if (isOwner) {
    const { data: rawShares } = await supabase
      .from('list_shares')
      .select('id, shared_with_user_id, can_edit')
      .eq('list_id', id)

    const shareList = rawShares || []
    const sharedWithIds = shareList.map((s: any) => s.shared_with_user_id)

    if (sharedWithIds.length > 0) {
      const { data: shareProfs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', sharedWithIds) as any
      const shareProfileMap = new Map<string, { id: string; full_name: string | null; email: string | null }>((shareProfs || []).map((p: any) => [p.id, p]))
      shares = shareList.map((s: any) => {
        const p = shareProfileMap.get(s.shared_with_user_id)
        return { ...s, friend_name: p?.full_name || null, friend_email: p?.email || null }
      })
    } else {
      shares = shareList
    }

    // All accepted friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted') as any

    const friendIds = (friendships || []).map((f: any) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    )

    if (friendIds.length > 0) {
      const { data: friendProfs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', friendIds) as any
      friends = friendProfs || []
    }
  } else {
    // Check if the shared user has edit permission
    const { data: share } = await supabase
      .from('list_shares')
      .select('can_edit')
      .eq('list_id', id)
      .eq('shared_with_user_id', user.id)
      .single()
    canEdit = share?.can_edit ?? false
  }

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
          list={{ id: list.id, name: list.name, description: list.description, is_archived: list.is_archived }}
          initialItems={(items || []) as ListItem[]}
          isOwner={isOwner}
          canEdit={canEdit}
          friends={friends}
          shares={shares}
        />
      </div>
    </div>
  )
}
