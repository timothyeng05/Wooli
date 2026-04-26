import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import MoodDetailClient from '@/app/components/mood/MoodDetailClient'

export default async function MoodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: entry, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !entry) redirect('/mood')

  return (
    <div className="min-h-screen bg-white">
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Entry</h1>
          <Link href="/mood" className="text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
        </div>

        <MoodDetailClient entry={entry} entryId={id} />
      </div>
    </div>
  )
}
