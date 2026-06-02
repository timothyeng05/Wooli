import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import OnboardingWizard from '@/app/components/budget/OnboardingWizard'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .single()

  if (profile?.onboarding_completed_at) redirect('/budget')

  return <OnboardingWizard userId={user.id} />
}
