import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Groq from 'groq-sdk'

const PROTECTED_HEADERS = new Set(['FLIGHT', 'FAMILY FLIGHT', 'TRANSPORT', 'TRANSPORTATION', 'HOTEL', 'RENTAL CAR'])
const EDITABLE_HEADERS = new Set(['MORNING', 'AFTERNOON', 'NIGHT', 'LUNCH OPTIONS', 'LUNCH', 'DINNER OPTIONS', 'DINNER'])

interface NoteBlock { header: string; lines: string[]; isProtected: boolean }

function parseBlocks(notes: string): NoteBlock[] {
  const result: NoteBlock[] = []
  let current: NoteBlock | null = null
  for (const line of notes.split('\n')) {
    const key = line.trim().toUpperCase()
    if (PROTECTED_HEADERS.has(key) || EDITABLE_HEADERS.has(key)) {
      if (current) result.push(current)
      current = { header: line.trim(), lines: [], isProtected: PROTECTED_HEADERS.has(key) }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) result.push(current)
  return result
}

function blockToStr(b: NoteBlock) { return [b.header, ...b.lines].join('\n') }

// Returns only the editable sections for the AI to work with
function extractEditable(notes: string): string {
  return parseBlocks(notes).filter(b => !b.isProtected).map(blockToStr).join('\n\n').trim()
}

// Stitches AI-updated editable sections back with the original protected sections
function mergeWithProtected(original: string, aiOutput: string): string {
  const origBlocks = parseBlocks(original)
  const aiBlocks = parseBlocks(aiOutput)
  const aiMap = new Map(aiBlocks.filter(b => !b.isProtected).map(b => [b.header.toUpperCase(), b]))
  const origEditableKeys = new Set(origBlocks.filter(b => !b.isProtected).map(b => b.header.toUpperCase()))
  const newAiBlocks = aiBlocks.filter(b => !b.isProtected && !origEditableKeys.has(b.header.toUpperCase()))

  const parts = origBlocks.map(b =>
    b.isProtected ? blockToStr(b) : blockToStr(aiMap.get(b.header.toUpperCase()) ?? b)
  )
  for (const b of newAiBlocks) parts.push(blockToStr(b))
  return parts.join('\n\n').trim()
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { instruction, currentTitle, currentNotes, currentLat, currentLng, date, tripId } = await req.json()

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  const editableNotes = currentNotes ? extractEditable(currentNotes) : ''

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      {
        role: 'system',
        content: `You are a travel itinerary assistant. You update day-by-day activity and dining plans based on user instructions.
Always return ONLY valid JSON — no markdown fences, no explanation, nothing else.

How to handle instructions:
- "add X" → append X to the relevant section
- "remove X" → delete X from the notes
- "change X to Y" / "replace X with Y" / "swap X for Y" → find X in the notes and replace it with Y
- "move X to [section]" → remove X from its current section and add it to the target section
- Any other instruction → apply the most sensible edit to the notes

Notes format rules:
- Section headers in ALL CAPS on their own line: MORNING, AFTERNOON, NIGHT, LUNCH OPTIONS, DINNER OPTIONS
- Bullet points with "- " prefix`,
      },
      {
        role: 'user',
        content: `Date: ${date}
Current title: ${currentTitle || 'none'}
Current location: lat ${currentLat ?? 'unknown'}, lng ${currentLng ?? 'unknown'}
Current notes (activities and dining only):
${editableNotes || 'none'}

User instruction: "${instruction}"

Return this exact JSON shape:
{
  "title": "string — updated day title",
  "notes": "string — updated activity/dining notes only, with section headers",
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

    // Restore protected sections (hotel, flights, transport) from original notes
    if (currentNotes && result.notes) {
      result.notes = mergeWithProtected(currentNotes, result.notes)
    }

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
