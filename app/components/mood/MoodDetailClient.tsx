'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import MoodFormClient from './MoodFormClient'

export default function MoodDetailClient({ entry, entryId }: {
  entry: { id: string; mood: number; note: string; logged_at: string; user_id: string; grateful_for?: string | null; activities?: string[] | null }
  entryId: string
}) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Delete this mood entry?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('mood_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      alert('Error deleting entry')
      return
    }

    router.push('/mood')
  }

  return <MoodFormClient userId={entry.user_id} entry={entry} onDelete={handleDelete} />
}
