'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Friend {
  id: string
  full_name: string | null
  email: string | null
}

interface Share {
  id: string
  shared_with_user_id: string
  can_edit: boolean
  friend_name: string | null
  friend_email: string | null
}

export default function ListSharePanel({
  listId,
  friends,
  shares: initialShares,
}: {
  listId: string
  friends: Friend[]
  shares: Share[]
}) {
  const router = useRouter()
  const [shares, setShares] = useState<Share[]>(initialShares)
  const [friendId, setFriendId] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')

  const sharedIds = new Set(shares.map(s => s.shared_with_user_id))
  const available = friends.filter(f => !sharedIds.has(f.id))

  const addShare = async () => {
    if (!friendId) return
    setSharing(true)
    setError('')
    const res = await fetch(`/api/lists/${listId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friend_id: friendId, can_edit: canEdit }),
    })
    const data = await res.json()
    setSharing(false)
    if (!res.ok) {
      setError(data.error || 'Failed to share')
      return
    }
    const friend = friends.find(f => f.id === friendId)!
    setShares(prev => [...prev, {
      id: data.share.id,
      shared_with_user_id: friendId,
      can_edit: canEdit,
      friend_name: friend.full_name,
      friend_email: friend.email,
    }])
    setFriendId('')
    setCanEdit(false)
    router.refresh()
  }

  const removeShare = async (shareId: string) => {
    const res = await fetch(`/api/lists/${listId}/share`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_id: shareId }),
    })
    if (res.ok) {
      setShares(prev => prev.filter(s => s.id !== shareId))
      router.refresh()
    }
  }

  return (
    <div className="pt-4 border-t border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Sharing</h3>

      {shares.length > 0 && (
        <div className="space-y-2 mb-4">
          {shares.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">
                  {s.friend_name || s.friend_email || 'Unknown'}
                </span>
                <span className="ml-2 text-xs text-gray-400">
                  {s.can_edit ? 'can edit' : 'view only'}
                </span>
              </div>
              <button
                onClick={() => removeShare(s.id)}
                className="text-xs text-gray-400 hover:text-red-500 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {shares.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">Not shared with anyone yet</p>
      )}

      {available.length > 0 ? (
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={friendId}
            onChange={e => setFriendId(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Share with a friend...</option>
            {available.map(f => (
              <option key={f.id} value={f.id}>
                {f.full_name || f.email}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={canEdit}
              onChange={e => setCanEdit(e.target.checked)}
              className="rounded"
            />
            Can edit
          </label>
          <button
            onClick={addShare}
            disabled={!friendId || sharing}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {sharing ? 'Sharing...' : 'Share'}
          </button>
        </div>
      ) : friends.length === 0 ? (
        <p className="text-sm text-gray-400">
          Add friends first to share lists.{' '}
          <Link href="/friends" className="text-blue-600 hover:underline">Go to Friends</Link>
        </p>
      ) : (
        <p className="text-sm text-gray-400">Shared with all friends</p>
      )}

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  )
}
