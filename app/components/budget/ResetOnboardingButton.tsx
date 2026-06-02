'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetOnboardingButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!confirm('Reset the setup wizard? This will delete all your categories and restart onboarding.')) return
    setLoading(true)
    await fetch('/api/reset-onboarding', { method: 'POST' })
    localStorage.removeItem('wooli_setup_dismissed')
    router.push('/budget/onboarding')
  }

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition disabled:opacity-50"
    >
      {loading ? 'Resetting…' : 'Restart setup wizard'}
    </button>
  )
}
