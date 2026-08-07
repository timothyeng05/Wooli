import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import OnboardingWizard from '@/app/components/budget/OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed_at) redirect('/budget')

  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return <OnboardingWizard userId={user.id} hasExistingSetup={!!count && count > 0} />
}
