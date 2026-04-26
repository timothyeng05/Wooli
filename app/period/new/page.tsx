import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PeriodForm from '@/app/components/period/PeriodForm'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default async function NewPeriodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date } = await searchParams
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-pink-50 to-pink-100 border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Period', href: '/period' },
            { label: 'New Entry' },
          ]} />
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Log Period</h1>
          <PeriodForm userId={user.id} initialDate={date} />
        </div>
      </div>
    </div>
  )
}
