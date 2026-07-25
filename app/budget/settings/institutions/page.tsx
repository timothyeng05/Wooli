import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import InstitutionsManager from '@/app/components/budget/InstitutionsManager'

export default async function InstitutionsSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: plaidItems }, { data: manualAccounts }, logosResult] = await Promise.all([
    supabase.from('plaid_items').select('institution_name').eq('user_id', user.id),
    supabase.from('accounts').select('institution').eq('user_id', user.id).eq('is_active', true),
    supabase.from('institution_logos').select('institution_name, logo_url').eq('user_id', user.id),
  ])

  // institution_logos table may not exist yet (migration 043 not run) — degrade gracefully.
  const logos = logosResult.data ?? []

  const names = new Set<string>()
  for (const i of plaidItems ?? []) { if (i.institution_name) names.add(i.institution_name) }
  for (const a of manualAccounts ?? []) { if (a.institution) names.add(a.institution) }

  const institutions = [...names].sort().map(name => ({
    name,
    logoUrl: logos.find(l => l.institution_name === name)?.logo_url ?? null,
  }))

  return <InstitutionsManager userId={user.id} institutions={institutions} />
}
