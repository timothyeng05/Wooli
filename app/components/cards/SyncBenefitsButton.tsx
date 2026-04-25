'use client'

import { useState } from 'react'

interface SyncResult {
  synced: number
  errors: number
  errorDetails: string[]
}

interface SyncBenefitsButtonProps {
  onSyncComplete?: () => void
}

export default function SyncBenefitsButton({ onSyncComplete }: SyncBenefitsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/sync-benefits', {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        setShowDetails(data.errors > 0)
        onSyncComplete?.()
      } else {
        setError(data.error || 'Failed to sync')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync benefits')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={loading}
          className="text-sm px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
          title="Sync benefits from public/data/benefits.xlsx"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Processing benefits...
            </span>
          ) : (
            '🔄 Sync Benefits'
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{result.synced}</div>
                  <div className="text-xs text-gray-600">Synced</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{result.errors}</div>
                  <div className="text-xs text-gray-600">Failed</div>
                </div>
              </div>
            </div>
            {result.errors > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showDetails ? 'Hide' : 'Show'} Errors
              </button>
            )}
          </div>

          {showDetails && result.errorDetails.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-700">Error Details:</h3>
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {result.errorDetails.map((err, idx) => (
                    <div key={idx} className="text-xs text-red-700 bg-red-100 p-2 rounded font-mono break-all">
                      {err}
                    </div>
                  ))}
                  {result.errors > 10 && (
                    <div className="text-xs text-gray-600 italic p-2">
                      ... and {result.errors - 10} more errors
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
