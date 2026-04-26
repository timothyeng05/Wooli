import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getGroq, GROQ_MODEL } from '@/lib/groq'

const FALLBACK_PROMPTS = [
  'What stood out to you today?',
  "What's one thing you're grateful for?",
  'How is your body feeling right now?',
]

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ prompts: FALLBACK_PROMPTS, source: 'fallback' })
  }

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: entries } = await supabase
    .from('mood_entries')
    .select('mood, note, grateful_for, activities, logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', since.toISOString())
    .order('logged_at', { ascending: false })
    .limit(7)

  const moodLabels: Record<number, string> = { 1: 'bad', 2: 'stressed', 3: 'okay', 4: 'good', 5: 'great' }
  const summary =
    entries && entries.length > 0
      ? entries
          .map(e => {
            const date = new Date(e.logged_at).toLocaleDateString('en-US', { weekday: 'short' })
            const acts = (e.activities || []).join(', ')
            const noteSnippet = (e.note || '').slice(0, 60)
            return `${date}: ${moodLabels[e.mood]}${acts ? ' (' + acts + ')' : ''}${noteSnippet ? ' — ' + noteSnippet : ''}`
          })
          .join('\n')
      : 'no recent entries'

  const today = new Date()
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' })
  const timeOfDay = today.getHours() < 12 ? 'morning' : today.getHours() < 18 ? 'afternoon' : 'evening'

  try {
    const groq = getGroq()
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a thoughtful journal companion. Generate 3 short reflection questions (under 12 words each) that feel personal and specific based on the user\'s recent entries. Return ONLY a JSON object in the form {"questions": ["...", "...", "..."]}. Do not number or label them. Do not include any other text.',
        },
        {
          role: 'user',
          content: `Today is ${dayOfWeek} ${timeOfDay}.\n\nRecent entries (last 7 days):\n${summary}\n\nGenerate 3 reflection questions for tonight's journal.`,
        },
      ],
      temperature: 0.8,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(raw)
    const prompts: string[] = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : FALLBACK_PROMPTS
    return NextResponse.json({ prompts, source: 'groq' })
  } catch (err) {
    return NextResponse.json({ prompts: FALLBACK_PROMPTS, source: 'fallback', error: String(err) })
  }
}
