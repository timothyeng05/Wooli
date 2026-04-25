'use client'

import { useRouter } from 'next/navigation'
import SyncBenefitsButton from './SyncBenefitsButton'

export default function SyncBenefitsSection() {
  const router = useRouter()

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
