'use client'

import { useEffect } from 'react'

export default function BenefitsSyncInitializer() {
  useEffect(() => {
    // Start background sync if needed
    const syncIfNeeded = async () => {
      try {
        const checkRes = await fetch('/api/check-templates')
        const { hasTemplates } = await checkRes.json()

        if (!hasTemplates) {
          // Start sync in background without waiting
          fetch('/api/sync-benefits', { method: 'POST' }).catch(() => {
            // Silently fail - not critical
          })
        }
      } catch {
        // Silently fail
      }
    }

    syncIfNeeded()
  }, [])

  return null
}
