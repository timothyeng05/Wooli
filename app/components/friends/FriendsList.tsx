'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Friend {
  friendship_id: string
  id: string
  full_name: string | null
  email: string | null
}

export default function FriendsList({ friends }: { friends: Friend[] }) {
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

  const removeFriend = async (friendship_id: string) => {
    if (!confirm('Remove this friend?')) return
    setRemoving(friendship_id)
    await fetch('/api/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id }),
    })
    setRemoving(null)
    router.refresh()
  }

  if (friends.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4">
        No friends yet. Send someone a request above.
      </p>
    )
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Friends ({friends.length})
      </h2>
      <div className="space-y-2">
        {friends.map(f => (
          <div key={f.friendship_id} className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{f.full_name || f.email || 'Unknown'}</p>
              {f.full_name && f.email && (
                <p className="text-xs text-gray-500">{f.email}</p>
              )}
            </div>
            <button
              onClick={() => removeFriend(f.friendship_id)}
              disabled={removing === f.friendship_id}
              className="text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
