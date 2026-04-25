'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function JournalDeleteButton({ entryId }: { entryId: string }) {
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this entry?')) return

    const supabase = createClient()
    const { error } = await supabase.from('mood_entries').delete().eq('id', entryId)
    if (error) { alert('Error deleting entry'); return }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      title="Delete entry"
      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  )
}
