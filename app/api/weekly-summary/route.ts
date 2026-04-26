import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGroq, GROQ_MODEL } from '@/lib/groq'

function lastSundayISO(today: Date): string {
  const d = new Date(today)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().split('T')[0]
}

const moodLabels: Record<number, string> = { 1: 'bad', 2: 'stressed', 3: 'okay', 4: 'good', 5: 'great' }

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const weekStart = lastSundayISO(today)

  const { data: cached } = await supabase
    .from('weekly_summaries')
    .select('summary, week_start, created_at')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({ summary: cached.summary, week_start: cached.week_start, source: 'cache' })
  }

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [moodResult, txResult] = await Promise.all([
    supabase
      .from('mood_entries')
      .select('mood, note, grateful_for, activities, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgo.toISOString())
      .order('logged_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('amount, categories(name)')
      .eq('user_id', user.id)
      .gte('transacted_at', sevenDaysAgo.toISOString()) as any,
  ])

  const moods = moodResult.data || []
  const tx = txResult.data || []

  if (moods.length === 0) {
    return NextResponse.json({ summary: null, source: 'no-data' })
  }

  const moodSummary = moods
    .map((e: any) => {
      const day = new Date(e.logged_at).toLocaleDateString('en-US', { weekday: 'short' })
      const acts = (e.activities || []).join(', ')
      return `${day}: ${moodLabels[e.mood]}${acts ? ' (' + acts + ')' : ''}${e.note ? ' — ' + e.note.slice(0, 80) : ''}`
    })
    .join('\n')

  const totalSpend = tx.filter((t: any) => t.amount < 0).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0)
  const catTotals = new Map<string, number>()
  tx.forEach((t: any) => {
    if (t.amount >= 0) return
    const cat = t.categories?.name || 'Uncategorized'
    catTotals.set(cat, (catTotals.get(cat) || 0) + Math.abs(Number(t.amount)))
  })
  const topCats = Array.from(catTotals.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} $${v.toFixed(0)}`)
    .join(', ')

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ summary: null, source: 'no-api-key' })
  }

  try {
    const groq = getGroq()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a thoughtful weekly reflection companion. Given the user\'s past 7 days of mood, activities, and spending, write a compact 2–3 sentence reflection. First sentence: a notable highlight or pattern. Second sentence: one observation that connects mood/activity/spending. Third sentence (optional): one gentle suggestion. Be warm but not saccharine. Plain text, no markdown headers.',
        },
        {
          role: 'user',
          content: `Mood entries (last 7 days):\n${moodSummary}\n\nSpending: $${totalSpend.toFixed(0)} total${topCats ? ' · top: ' + topCats : ''}.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    })

    const summary = completion.choices[0]?.message?.content?.trim() || null
    if (!summary) {
      return NextResponse.json({ summary: null, source: 'no-output' })
    }

    await supabase.from('weekly_summaries').insert({
      user_id: user.id,
      week_start: weekStart,
      summary,
    })

    return NextResponse.json({ summary, week_start: weekStart, source: 'fresh' })
  } catch (err) {
    return NextResponse.json({ summary: null, source: 'error', error: String(err) })
  }
}
