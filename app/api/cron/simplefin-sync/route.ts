import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncTransactionsForUser } from '@/lib/budget/simplefin-sync'

// Scheduled daily via vercel.json ("15 11 * * *" = 7:15am ET during standard
// time / 8:15am ET during daylight time — Vercel Cron is UTC-only with no DST
// awareness), shortly after /api/cron/sync.
// Safe to run on Vercel because the categorizer (groq-fallback.ts) calls Groq's
// cloud API, not a local LM Studio server — if that ever changes back to a local
// model, this needs to go back to a local-only trigger instead: pull and
// categorization happen together inside syncTransactionsForUser, and the sync
// guard there skips re-categorizing anything already in the database, so a
// cloud-triggered pull with no reachable categorizer would permanently strand
// those rows uncategorized even once a later run could otherwise place them.
export const maxDuration = 60

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  // An unset secret has to fail closed — comparing against `Bearer undefined`
  // would let anyone sending that literal header trigger a service-role run.
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = adminClient()

  const { data: connections } = await admin
    .from('bank_connections')
    .select('id, user_id, access_url, last_successful_sync_at')

  const byUser = new Map<string, typeof connections>()
  for (const c of connections ?? []) {
    if (!byUser.has(c.user_id)) byUser.set(c.user_id, [])
    byUser.get(c.user_id)!.push(c)
  }

  const summary: Record<string, { added: number; modified: number; removed: number; merged: number; error?: string }> = {}
  for (const [userId, userConnections] of byUser) {
    try {
      const results = await syncTransactionsForUser(admin, userId, userConnections!)
      summary[userId] = results.reduce(
        (s, r) => ({ added: s.added + r.added, modified: s.modified + r.modified, removed: s.removed + r.removed, merged: s.merged + r.merged }),
        { added: 0, modified: 0, removed: 0, merged: 0 }
      )
    } catch (e) {
      summary[userId] = { added: 0, modified: 0, removed: 0, merged: 0, error: e instanceof Error ? e.message : 'Sync failed' }
    }
  }

  return NextResponse.json({ ok: true, users: byUser.size, summary })
}
