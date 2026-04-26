import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import FriendRequestForm from '@/app/components/friends/FriendRequestForm'
import PendingRequests from '@/app/components/friends/PendingRequests'
import FriendsList from '@/app/components/friends/FriendsList'

export default async function FriendsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: friendships } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .order('created_at', { ascending: false }) as any

  const fs = friendships || []

  // Collect counterpart IDs to fetch profiles
  const counterpartIds = fs.map((f: any) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id
  )

  const profileMap = new Map<string, { id: string; full_name: string | null; email: string | null }>()
  if (counterpartIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', counterpartIds) as any
    ;(profiles || []).forEach((p: any) => profileMap.set(p.id, p))
  }

  const pending = fs
    .filter((f: any) => f.status === 'pending' && f.addressee_id === user.id)
    .map((f: any) => {
      const p = profileMap.get(f.requester_id)
      return { id: f.id, requester_name: p?.full_name || null, requester_email: p?.email || null }
    })

  const sentPending = fs
    .filter((f: any) => f.status === 'pending' && f.requester_id === user.id)
    .map((f: any) => {
      const p = profileMap.get(f.addressee_id)
      return { id: f.id, name: p?.full_name || p?.email || 'Unknown', email: p?.email || null }
    })

  const accepted = fs
    .filter((f: any) => f.status === 'accepted')
    .map((f: any) => {
      const friendId = f.requester_id === user.id ? f.addressee_id : f.requester_id
      const p = profileMap.get(friendId)
      return { friendship_id: f.id, id: friendId, full_name: p?.full_name || null, email: p?.email || null }
    })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Friends' }]} />
          <div className="mt-4">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Friends</h1>
            <p className="text-gray-600">Share lists with people you know</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Friend</h2>
          <FriendRequestForm />
        </div>

        <PendingRequests requests={pending} />

        {sentPending.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Sent Requests</h2>
            <div className="space-y-2">
              {sentPending.map((r: any) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  <span className="flex-1">{r.name}</span>
                  <span className="text-xs text-gray-400">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <FriendsList friends={accepted} />
      </div>
    </div>
  )
}
