'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import MoodFormClient from './MoodFormClient'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

export default function MoodDetailClient({ entry, entryId, customActivities }: {
  entry: { id: string; mood: number; note: string; logged_at: string; user_id: string; grateful_for?: string | null; activities?: string[] | null }
  entryId: string
  customActivities?: string[] | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  const handleDelete = async () => {
    if (!await confirm('Delete this mood entry?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('mood_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      toast.error('Error deleting entry')
      return
    }

    router.push('/mood')
  }

  return <MoodFormClient userId={entry.user_id} entry={entry} onDelete={handleDelete} customActivities={customActivities} />
}
