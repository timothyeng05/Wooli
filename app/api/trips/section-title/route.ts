import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGroq, GROQ_MODEL } from '@/lib/groq'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, lines, timeOverride, duration } = await request.json()

  const content = (lines as string[])
    .filter(Boolean)
    .map((l: string) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean)
    .join(' · ')

  const context = [content, timeOverride && `at ${timeOverride}`, duration && `(${duration})`]
    .filter(Boolean).join(' ')

  const groq = getGroq()
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You write short, specific titles for travel itinerary cards. Reply with 5 words or fewer. No quotes, no punctuation at the end. Be specific — use names, places, routes from the content rather than generic words.',
      },
      {
        role: 'user',
        content: `Type: ${type}\nContent: ${context}`,
      },
    ],
    max_tokens: 20,
    temperature: 0.2,
  })

  const title = completion.choices[0]?.message?.content?.trim() ?? ''
  return NextResponse.json({ title })
}
