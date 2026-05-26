'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
]

function avatarInitials(name: string | null, email: string | null): string {
  const src = name || email || '?'
  const parts = src.split(/[\s@]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

interface Friend {
  friendship_id: string
  id: string
  full_name: string | null
  email: string | null
}

export default function FriendsList({ friends }: { friends: Friend[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [removing, setRemoving] = useState<string | null>(null)

  const removeFriend = async (friendship_id: string) => {
    if (!await confirm('Remove this friend?')) return
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
      <div className="text-center py-12 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <p className="text-sm font-medium text-gray-500">No friends yet</p>
        <p className="text-xs text-gray-400 mt-1">Send a request above to get started</p>
      </div>
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
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColor(f.id)}`}>
              {avatarInitials(f.full_name, f.email)}
            </div>
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
