'use client'
import { useState } from 'react'

export default function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="border border-gray-300 text-gray-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition text-sm flex items-center gap-2"
    >
      <span>{copied ? '✓' : '🔗'}</span>
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
