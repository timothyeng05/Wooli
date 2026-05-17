import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Groq from 'groq-sdk'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { instruction, currentTitle, currentNotes, currentLat, currentLng, date, tripId } = await req.json()

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `You are a travel itinerary assistant. You update day-by-day travel plans based on user instructions.
Always return ONLY valid JSON — no markdown fences, no explanation, nothing else.

Notes format rules:
- Section headers in ALL CAPS on their own line: MORNING, AFTERNOON, NIGHT, LUNCH OPTIONS, DINNER OPTIONS, TRANSPORT, FLIGHT
- Bullet points with "- " prefix
- For TRANSPORT and FLIGHT sections only: include a travel duration on its own line starting with "~" (e.g. "~2h 30min" or "~45min"). Put it as the first line of that section.`,
      },
      {
        role: 'user',
        content: `Date: ${date}
Current title: ${currentTitle || 'none'}
Current location: lat ${currentLat ?? 'unknown'}, lng ${currentLng ?? 'unknown'}
Current notes:
${currentNotes || 'none'}

User instruction: "${instruction}"

Return this exact JSON shape:
{
  "title": "string — updated day title",
  "notes": "string — full updated notes with section headers",
  "lat": number or null — only if PRIMARY location changed, otherwise null,
  "lng": number or null — only if PRIMARY location changed, otherwise null
}`,
      },
    ],
  })

  const raw = (completion.choices[0].message.content ?? '').trim()
  const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const result = JSON.parse(clean)

    // Persist to database
    await supabase.from('trip_days').upsert(
      {
        trip_id: tripId,
        user_id: user.id,
        date,
        title: result.title || null,
        notes: result.notes || null,
        ...(result.lat != null && result.lng != null ? { lat: result.lat, lng: result.lng } : {}),
      },
      { onConflict: 'trip_id,date' }
    )

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 })
  }
}
