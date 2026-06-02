import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import SettingsActivitiesClient from '@/app/components/settings/SettingsActivitiesClient'
import HouseholdMembersClient from '@/app/components/settings/HouseholdMembersClient'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase
      .from('profiles')
      .select('custom_activities')
      .eq('id', user.id)
      .single(),
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  const savedActivities = (profile?.custom_activities as string[] | null) ?? null

  return (
    <div>
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Settings' }]} />
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Settings</h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        <HouseholdMembersClient initialMembers={members ?? []} userId={user.id} />
        <hr className="border-gray-200" />
        <SettingsActivitiesClient savedActivities={savedActivities} userId={user.id} />
      </div>
    </div>
  )
}
