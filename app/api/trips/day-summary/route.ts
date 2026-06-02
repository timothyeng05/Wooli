import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGroq, GROQ_MODEL } from '@/lib/groq'
import { findMeta, type SectionData } from '@/lib/trips/trip-sections'

const EXCLUDE = new Set(['MEAL', 'BREAKFAST', 'LUNCH', 'DINNER', 'HOTEL'])

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sections, isPast } = await request.json() as { sections: SectionData[]; isPast?: boolean }

  const relevant = sections.filter(s => !EXCLUDE.has(s.type.toUpperCase()))
  if (!relevant.length) return NextResponse.json({ summary: null })

  const activityLines = relevant.map(s => {
    const meta = findMeta(s.type)
    const label = meta?.label ?? s.type
    const content = s.lines
      .filter(Boolean)
      .map(l => l.replace(/^-\s*/, '').trim())
      .filter(Boolean)
      .join(', ')
    return content ? `${label}: ${content}` : label
  }).join('\n')

  const systemPrompt = isPast
    ? 'Write a vivid 2–3 sentence recap of what the traveler did that day, written in past tense as if looking back on the experience. Be specific and evocative — mention places, activities, and highlights. Skip meals and accommodation. Return only the prose, no quotes, no bullet points.'
    : 'Write a single-line preview of the day\'s activities in 15 words or fewer. Focus on what the traveler is doing — skip meals and accommodation. Return only the phrase, no quotes, no trailing punctuation.'

  const groq = getGroq()
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: activityLines },
    ],
    max_tokens: isPast ? 120 : 40,
    temperature: 0.4,
  })

  const summary = completion.choices[0]?.message?.content?.trim() ?? null
  return NextResponse.json({ summary })
}
