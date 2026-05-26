'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import PeriodForm from './PeriodForm'
import type { PeriodEntry } from '@/lib/period-utils'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

export default function PeriodDetailClient({
  userId,
  entry,
  entryId,
}: {
  userId: string
  entry: PeriodEntry
  entryId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  const handleDelete = async () => {
    if (!await confirm('Delete this period entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from('period_entries').delete().eq('id', entryId)
    if (error) {
      toast.error('Error deleting entry')
      return
    }
    router.push('/period')
    router.refresh()
  }

  return <PeriodForm userId={userId} entry={entry} onDelete={handleDelete} />
}
