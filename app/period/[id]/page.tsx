import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import PeriodDetailClient from '@/app/components/period/PeriodDetailClient'
import type { PeriodEntry } from '@/lib/period-utils'

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: entry, error } = await supabase
    .from('period_entries')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !entry) redirect('/period')

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-pink-50 to-pink-100 border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Journal', href: '/mood' },
            { label: 'Periods', href: '/period' },
            { label: 'Edit Entry' },
          ]} />
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Period</h1>
          <PeriodDetailClient userId={user.id} entry={entry as PeriodEntry} entryId={id} />
        </div>
      </div>
    </div>
  )
}
