import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import MoodDetailClient from '@/app/components/mood/MoodDetailClient'
import Breadcrumbs from '@/app/components/Breadcrumbs'

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
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Journal', href: '/mood' },
            { label: 'Edit Entry' },
          ]} />
        </div>
      </div>
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Edit Entry</h1>
        <MoodDetailClient entry={entry} entryId={id} />
      </div>
    </div>
  )
}
