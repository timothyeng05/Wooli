'use client'
import { useState, useRef } from 'react'
import { inputCls, parseCoords } from '@/lib/trips/trip-utils'

type Suggestion = { placeId: string; main: string; secondary: string }
const newSession = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// Location field: type a place name for live Google Places suggestions, OR
// paste a Google Maps link (short or long). Either way the stored value is a
// coords-bearing Maps URL; the map derives the pin from it via parseCoords().
export default function CoordsInput({ value, onChange }: { value?: string; onChange: (v: string | undefined, name?: string) => void }) {
  const [raw, setRaw] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'fail'>('idle')
  const sessionRef = useRef(newSession())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const looksLikeUrl = (s: string) => /https?:\/\//i.test(s)

  // A location is already saved → show a compact "pinned" chip.
  if (value) {
    const latLng = parseCoords(value)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
        <span className="flex-1 text-sm text-green-700">✓ Location pinned</span>
        {latLng && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-green-700 hover:underline"
          >
            Open
          </a>
        )}
        <button
          type="button"
          onClick={() => { onChange(undefined); setRaw(''); setSuggestions([]) }}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Change
        </button>
      </div>
    )
  }

  async function runAutocomplete(input: string) {
    setStatus('loading')
    try {
      const res = await fetch(`/api/trips/places?q=${encodeURIComponent(input)}&session=${sessionRef.current}`)
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch { /* ignore */ }
    setStatus('idle')
  }

  function onInput(v: string) {
    setRaw(v)
    setStatus('idle')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (looksLikeUrl(v) || v.trim().length < 3) { setSuggestions([]); return }
    debounceRef.current = setTimeout(() => runAutocomplete(v.trim()), 250)
  }

  async function pickSuggestion(s: Suggestion) {
    setSuggestions([])
    setStatus('loading')
    try {
      const res = await fetch(`/api/trips/places?placeId=${encodeURIComponent(s.placeId)}&session=${sessionRef.current}`)
      const data = await res.json()
      if (data.url && data.lat != null) onChange(data.url, data.name || s.main)
      else setStatus('fail')
    } catch { setStatus('fail') }
    sessionRef.current = newSession() // fresh session after a selection
  }

  async function resolveUrl(input: string) {
    setStatus('loading')
    try {
      const res = await fetch(`/api/trips/geocode?url=${encodeURIComponent(input)}`)
      const data = await res.json()
      if (data.url && data.lat != null) onChange(data.url)
      else setStatus('fail')
    } catch { setStatus('fail') }
  }

  return (
    <div className="relative">
      <input
        className={inputCls}
        value={raw}
        onChange={e => onInput(e.target.value)}
        onBlur={() => { if (looksLikeUrl(raw)) resolveUrl(raw.trim()) }}
        onPaste={e => {
          const t = e.clipboardData.getData('text')
          if (looksLikeUrl(t)) setTimeout(() => resolveUrl(t.trim()), 0)
        }}
        placeholder="Search a place or paste a Google Maps link"
      />
      {status === 'loading' && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
      {status === 'fail' && <p className="text-xs text-amber-600 mt-1">Couldn’t find that — try again or paste a Maps link</p>}
      {suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map(s => (
            <li key={s.placeId}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pickSuggestion(s)}
                className="w-full px-3 py-2 text-left transition hover:bg-blue-50"
              >
                <span className="block text-sm text-gray-800">{s.main}</span>
                {s.secondary && <span className="block text-xs text-gray-400">{s.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
