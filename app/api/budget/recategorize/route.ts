import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { buildPipelineContext } from '@/lib/budget/categorize/context'
import { categorizeBatch } from '@/lib/budget/categorize/pipeline'
import type { CategorizeInput } from '@/lib/budget/categorize/types'

// Streams newline-delimited JSON progress events so the client can show a progress bar:
//   { type: 'start',    total }
//   { type: 'progress', done, total, updated }
//   { type: 'done',     total, updated, bySource, groqCalls }
//   { type: 'error',    message, updated }
//
// Runs the full layered pipeline (deterministic layers first, Groq only as fallback).
export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  // Service role for DB ops so RLS can't silently block rows in the route handler
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const ctx = await buildPipelineContext(admin, user.id, { enableGroq: true })

  // Only uncategorized, non-transfer transactions. Fetched once so pagination can't
  // shift as rows get categorized.
  const { data: transactions } = await admin
    .from('transactions')
    .select('id, description, merchant, account_name, amount, notes, provider_category')
    .eq('user_id', user.id)
    .is('category_id', null)
    .eq('is_transfer', false)

  const list = transactions ?? []
  const encoder = new TextEncoder()
  const CHUNK = 100

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      let updated = 0
      let groqCalls = 0
      const bySource: Record<string, number> = {}

      try {
        const total = list.length
        send({ type: 'start', total })
        if (!total) { send({ type: 'done', total: 0, updated: 0, bySource, groqCalls }); controller.close(); return }

        for (let i = 0; i < total; i += CHUNK) {
          const chunk = list.slice(i, i + CHUNK)
          const inputs: CategorizeInput[] = chunk.map(t => ({
            id: t.id,
            raw_merchant: t.merchant,
            description: t.description,
            amount: t.amount,
            account_name: t.account_name,
            notes: t.notes,
            provider_category: t.provider_category,
          }))

          const results = await categorizeBatch(inputs, ctx)

          await Promise.all(results.map((r, j) => {
            if (r.groq_called) groqCalls++
            bySource[r.source] = (bySource[r.source] ?? 0) + 1
            if (r.category_id || r.is_transfer) updated++
            return admin.from('transactions').update({
              category_id: r.category_id,
              is_transfer: r.is_transfer,
              normalized_merchant: r.normalized_merchant,
              categorization_source: r.source,
              categorization_confidence: r.confidence,
              // Re-categorizing is an AI action, not a human review — leave the
              // reviewed/unreviewed state untouched so it still awaits confirmation.
              groq_called: r.groq_called,
            }).eq('id', chunk[j].id)
          }))

          send({ type: 'progress', done: Math.min(i + CHUNK, total), total, updated })
        }

        send({ type: 'done', total, updated, bySource, groqCalls })
      } catch (e) {
        const err = e as { status?: number }
        const message = err?.status === 429
          ? 'Groq daily token limit reached. Deterministic matches were saved; try again later to finish the rest.'
          : (e instanceof Error ? e.message : 'Categorization failed')
        send({ type: 'error', message, updated })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
