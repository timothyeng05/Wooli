'use client'

import { useState } from 'react'
import { useToast } from '@/app/components/ui/ToastProvider'

export interface ConnectionKeyRow {
  id: string
  institutionName: string | null
  status: string | null
  accessUrl: string | null
}

/**
 * SimpleFin access URLs carry their credentials inline
 * (https://user:pass@bridge.simplefin.org/…), so the userinfo is the secret —
 * mask it and leave the host visible so the connection is still identifiable.
 */
function maskAccessUrl(url: string): string {
  try {
    const u = new URL(url)
    const rest = `${u.host}${u.pathname}`
    return u.username || u.password
      ? `${u.protocol}//•••:•••@${rest}`
      : `${u.protocol}//${rest}`
  } catch {
    return '•'.repeat(32)
  }
}

function ConnectionKeyCard({ row }: { row: ConnectionKeyRow }) {
  const { toast } = useToast()
  const [revealed, setRevealed] = useState(false)

  if (!row.accessUrl) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(row.accessUrl!)
      toast.success('Access URL copied')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-gray-800">
          {row.institutionName ?? 'SimpleFin connection'}
        </p>
        {row.status && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            row.status === 'healthy'
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {row.status}
          </span>
        )}
      </div>

      <p className="text-xs font-mono break-all text-gray-600 bg-gray-50 rounded-lg px-2.5 py-2">
        {revealed ? row.accessUrl : maskAccessUrl(row.accessUrl)}
      </p>

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => setRevealed(v => !v)}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          onClick={copy}
          className="text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Copy
        </button>
      </div>
    </div>
  )
}

export default function SimplefinConnectionKeys({ rows }: { rows: ConnectionKeyRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No SimpleFin connections yet — connect a bank from the Accounts page.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-semibold text-amber-800 mb-1">Treat this like a password</p>
        <p className="text-sm text-amber-700">
          This URL grants read access to every account in your SimpleFin bridge. Anyone who
          has it can see your transactions and balances without signing in here. Revoke it
          from your SimpleFin bridge if it&apos;s ever exposed.
        </p>
      </div>
      {rows.map(row => (
        <ConnectionKeyCard key={row.id} row={row} />
      ))}
    </div>
  )
}
