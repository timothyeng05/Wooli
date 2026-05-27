import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGroq, GROQ_MODEL } from '@/lib/groq'

type SectionInput = { type: string; lines: string[]; timeOverride?: string; duration?: string }

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sections: SectionInput[] = await request.json()
  if (!sections.length) return NextResponse.json({ titles: [] })

  const list = sections.map((s, i) => {
    const content = s.lines
      .filter(Boolean)
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .join(' · ')
    const parts = [content, s.timeOverride && `at ${s.timeOverride}`, s.duration && `(${s.duration})`]
      .filter(Boolean).join(' ')
    return `${i + 1}. ${s.type}${parts ? `: ${parts}` : ''}`
  }).join('\n')

  const groq = getGroq()
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate a short title (5 words max) for each travel itinerary card. Reply ONLY with a JSON array of strings, one per input, in the same order. Be specific — use names, places, routes from the content, not generic words like "Activity" or "Flight".',
      },
      { role: 'user', content: list },
    ],
    max_tokens: 200,
    temperature: 0.2,
  })

  let titles: string[] = []
  try {
    const text = completion.choices[0]?.message?.content?.trim() ?? '[]'
    const match = text.match(/\[[\s\S]*\]/)
    titles = JSON.parse(match ? match[0] : text)
  } catch { titles = [] }

  return NextResponse.json({ titles })
}
