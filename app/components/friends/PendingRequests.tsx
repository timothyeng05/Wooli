'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface PendingRequest {
  id: string
  requester_name: string | null
  requester_email: string | null
}

export default function PendingRequests({ requests }: { requests: PendingRequest[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const respond = async (friendship_id: string, action: 'accepted' | 'rejected') => {
    setLoading(friendship_id)
    await fetch('/api/friends/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendship_id, action }),
    })
    setLoading(null)
    router.refresh()
  }

  if (requests.length === 0) return null

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Pending Requests ({requests.length})
      </h2>
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">
                {r.requester_name || r.requester_email || 'Unknown'}
              </p>
              {r.requester_name && r.requester_email && (
                <p className="text-xs text-gray-500">{r.requester_email}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => respond(r.id, 'accepted')}
                disabled={loading === r.id}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                Accept
              </button>
              <button
                onClick={() => respond(r.id, 'rejected')}
                disabled={loading === r.id}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 transition"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
