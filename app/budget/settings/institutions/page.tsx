import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import InstitutionsManager from '@/app/components/budget/InstitutionsManager'
import SimplefinConnectionKeys from '@/app/components/budget/SimplefinConnectionKeys'

export default async function InstitutionsSettingsPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const [{ data: connections }, { data: manualAccounts }, logosResult] = await Promise.all([
    supabase.from('bank_connections').select('id, institution_name, status, access_url').eq('user_id', user.id),
    supabase.from('accounts').select('institution').eq('user_id', user.id).eq('is_active', true),
    supabase.from('institution_logos').select('institution_name, logo_url').eq('user_id', user.id),
  ])

  // institution_logos table may not exist yet (migration 043 not run) — degrade gracefully.
  const logos = logosResult.data ?? []

  const names = new Set<string>()
  for (const c of connections ?? []) { if (c.institution_name) names.add(c.institution_name) }
  for (const a of manualAccounts ?? []) { if (a.institution) names.add(a.institution) }

  const institutions = [...names].sort().map(name => ({
    name,
    logoUrl: logos.find(l => l.institution_name === name)?.logo_url ?? null,
  }))

  const connectionKeys = (connections ?? []).map(c => ({
    id: c.id,
    institutionName: c.institution_name,
    status: c.status,
    accessUrl: c.access_url,
  }))

  return (
    <div className="space-y-8">
      <InstitutionsManager userId={user.id} institutions={institutions} />

      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">SimpleFin access</h2>
        <p className="text-xs text-gray-400 mb-3">
          The access URL each bank connection syncs with. Hidden by default.
        </p>
        <SimplefinConnectionKeys rows={connectionKeys} />
      </section>
    </div>
  )
}
