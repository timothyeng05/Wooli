'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SyncBenefitsButton from './SyncBenefitsButton'

export default function TemplatesWaiter({ userId }: { userId: string }) {
  const router = useRouter()
  const [templateLoaded, setTemplateLoaded] = useState(false)

  useEffect(() => {
    let pollCount = 0
    const maxPolls = 15 // 15 * 2 seconds = 30 second timeout

    const poll = async () => {
      pollCount++
      try {
        const res = await fetch('/api/check-templates')
        const { hasTemplates } = await res.json()

        if (hasTemplates) {
          router.refresh()
          return
        }
      } catch (error) {
        console.error('Check templates failed:', error)
      }

      if (pollCount >= maxPolls) {
        setTemplateLoaded(true)
        return
      }

      setTimeout(poll, 2000)
    }

    poll()
  }, [router])

  if (!templateLoaded) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-block">
          <div className="animate-spin text-4xl">⏳</div>
        </div>
        <p className="text-gray-600 font-medium">Loading card templates...</p>
        <p className="text-sm text-gray-500">This only happens once when syncing benefits</p>
      </div>
    )
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-gray-600">Card templates haven't been synced yet.</p>
      <div className="inline-block">
        <SyncBenefitsButton onSyncComplete={() => router.refresh()} />
      </div>
      <p className="text-sm text-gray-500">Click "Sync Benefits" to load card templates.</p>
    </div>
  )
}
