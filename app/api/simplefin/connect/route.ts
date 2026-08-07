import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { claimSetupToken } from '@/lib/budget/simplefin-client'
import { upsertConnectionAccounts } from '@/lib/budget/simplefin-sync'

// Handles both a brand-new connection and an in-place access-URL replacement
// (reconnect): pass { connection_id } to replace an existing (broken)
// connection's access URL instead of creating a new row. Reconnecting a frozen
// Plaid-origin connection this way keeps the institution's display slot and
// leaves its old (now-orphaned) synced_accounts rows untouched — new
// SimpleFin-sourced accounts are upserted alongside them.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { setup_token, connection_id, institution_name } = await request.json().catch(() => ({}))
  if (!setup_token) return NextResponse.json({ error: 'setup_token required' }, { status: 400 })

  if (connection_id) {
    const { data: existing } = await supabase
      .from('bank_connections')
      .select('id')
      .eq('id', connection_id)
      .eq('user_id', user.id)
      .single()
    if (!existing) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  let accessUrl: string
  try {
    accessUrl = await claimSetupToken(setup_token)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to claim SimpleFin token' }, { status: 502 })
  }

  const { data: row } = connection_id
    ? await supabase
        .from('bank_connections')
        .update({ access_url: accessUrl, status: 'healthy', error_code: null, error_message: null, last_sync_attempt_at: new Date().toISOString() })
        .eq('id', connection_id)
        .select('id')
        .single()
    : await supabase
        .from('bank_connections')
        .insert({ user_id: user.id, access_url: accessUrl, institution_name: institution_name ?? null, status: 'healthy', last_sync_attempt_at: new Date().toISOString() })
        .select('id')
        .single()
  if (!row) return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 })

  try {
    const { orgName, orgDomain } = await upsertConnectionAccounts(supabase, user.id, row.id, accessUrl)
    await supabase.from('bank_connections').update({ institution_name: institution_name ?? orgName, org_domain: orgDomain }).eq('id', row.id)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Connected, but accounts could not be fetched' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, connection_id: row.id })
}
