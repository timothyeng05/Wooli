'use client'
import { useState } from 'react'

// Copies an absolute link to the machine-readable itinerary export so it can be
// pasted into an AI assistant (Claude/ChatGPT) to plan a similar trip.
export default function AiShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const url = (typeof window !== 'undefined' ? window.location.origin : '') + path
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard may be blocked; fall back to opening the export in a new tab.
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      title="Copy a machine-readable itinerary link to paste into Claude or ChatGPT"
      className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition text-sm"
    >
      <span>{copied ? '✓' : '🤖'}</span>
      {copied ? 'AI link copied!' : 'AI-readable'}
    </button>
  )
}
