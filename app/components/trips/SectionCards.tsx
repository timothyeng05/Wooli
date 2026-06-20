'use client'
import { useState } from 'react'
import DayLocationMap, { type LocationPoint } from './DayLocationMapClient'
import type { SectionMeta } from '@/lib/trips/trip-sections'
import { ratingStyle, parseCoords, parsePlaceId } from '@/lib/trips/trip-utils'

// Maps Embed API (place card with the real listing) only works when the
// "Maps Embed API" is enabled on the key. Opt in by setting this flag once it is.
const USE_EMBED_API = process.env.NEXT_PUBLIC_MAPS_EMBED_API === '1'
const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Build the embed URL. Default to the keyless classic embed (always works);
// use the richer Maps Embed API place card only when explicitly enabled.
function mapEmbedUrl(coords: string | undefined, latLng: { lat: number; lng: number } | null): string | null {
  const placeId = parsePlaceId(coords)
  if (USE_EMBED_API && placeId && GMAPS_KEY) return `https://www.google.com/maps/embed/v1/place?key=${GMAPS_KEY}&q=place_id:${placeId}`
  if (latLng) return `https://maps.google.com/maps?q=${latLng.lat},${latLng.lng}&z=16&output=embed`
  return null
}

// Link that opens the real listing when we have a stored Maps URL, else a pin search.
function mapLinkUrl(coords: string | undefined, latLng: { lat: number; lng: number } | null): string | null {
  if (coords && /^https?:\/\//i.test(coords)) return coords
  if (latLng) return `https://www.google.com/maps/search/?api=1&query=${latLng.lat},${latLng.lng}`
  return null
}

// Map preview with the location name as a caption (F1). Used in the edit panel.
export function LocationPreview({ coords, name }: { coords?: string; name?: string }) {
  const latLng = parseCoords(coords)
  if (!latLng) return null
  const embed = mapEmbedUrl(coords, latLng)
  const link = mapLinkUrl(coords, latLng)
  return (
    <div className="rounded-lg overflow-hidden border border-gray-100">
      {name && (
        <div className="px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-100 flex items-center gap-1">
          <span className="text-xs">📍</span><span className="truncate">{name}</span>
        </div>
      )}
      {embed && (
        <iframe src={embed} className="w-full" style={{ height: 180, pointerEvents: 'none' }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
      )}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="block px-3 py-1.5 text-sm font-semibold text-blue-600 hover:underline bg-white">
          Open in Google Maps →
        </a>
      )}
    </div>
  )
}

// Compact, clickable card. Tapping opens the edit panel; details + map live there.
export function SectionCard({ meta, lines, onOpen, title, type, place, coords, rating, skipped }: {
  meta: SectionMeta; lines: string[]
  onOpen?: () => void
  title?: string; type?: string; place?: string
  coords?: string
  rating?: number
  skipped?: boolean
}) {
  const allContent = lines.map(l => l.trim()).filter(Boolean)

  let duration: string | null = null
  let content = allContent
  const dl = allContent.find(l => l.startsWith('~'))
  if (dl) { duration = dl.slice(1).trim(); content = allContent.filter(l => !l.startsWith('~')) }

  // The card title is always the real content name (restaurant / activity /
  // route) — no AI-generated titles. Falls back to the section label.
  let displayName: string | null = null
  let body = content
  const nameIdx = content.findIndex(l => !l.startsWith('-'))
  if (nameIdx >= 0) { displayName = content[nameIdx]; body = content.filter((_, i) => i !== nameIdx) }

  const headerText = displayName || title || meta.label
  const bodyPreview = body.map(l => l.replace(/^-\s*/, '')).filter(Boolean).join(' · ')
  const hasPin = !!parseCoords(coords)

  if (!content.length && !duration && !title && !place) {
    if (!onOpen) return null
    return (
      <div onClick={onOpen} className={`rounded-xl border ${meta.bg} ${meta.border} ${skipped ? 'opacity-50' : ''} cursor-pointer`}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex-shrink-0 text-base opacity-50">{meta.icon}</span>
          <p className="flex-1 min-w-0 text-sm italic text-gray-400">Empty {meta.label.toLowerCase()} — tap to add details</p>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onOpen}
      className={`rounded-xl border ${meta.bg} ${meta.border} ${skipped ? 'opacity-50' : ''} ${onOpen ? 'cursor-pointer hover:brightness-[0.98] active:scale-[0.99] transition' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex-shrink-0 text-base">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[17px] sm:text-base font-semibold leading-snug break-words ${meta.text} ${skipped ? 'line-through' : ''}`}>{headerText}</p>
          {(place || bodyPreview) && (
            <p className="text-sm text-gray-500 truncate mt-0.5">{place ? `📍 ${place}` : bodyPreview}</p>
          )}
          {duration && <p className="text-sm text-teal-600 font-medium leading-none mt-1">⏱ {duration}</p>}
        </div>
        {hasPin && (
          <span title="Location pinned — map available" className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">📍 Map</span>
        )}
        {rating != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ratingStyle(rating)}`}>{rating}/10</span>
        )}
        {skipped && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-200 text-gray-500">Skipped</span>
        )}
      </div>
    </div>
  )
}

export function HotelCard({ meta, lines, onEdit, skipped, coords, checkpoint, editLabel }: {
  meta: SectionMeta; lines: string[]
  onEdit?: () => void
  skipped?: boolean
  coords?: string
  checkpoint?: 'in' | 'out' | null
  editLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const content = lines.map(l => l.trim()).filter(Boolean)
  const name = content[0]
  const location = content[1]
  if (!name) return null
  const latLng = parseCoords(coords)
  // Prefer the real listing (place ID) / precise coords; else fall back to a text query.
  const query = encodeURIComponent([name, location].filter(Boolean).join(', '))
  const mapsUrl = mapLinkUrl(coords, latLng) ?? `https://www.google.com/maps/search/?api=1&query=${query}`
  const embedUrl = mapEmbedUrl(coords, latLng) ?? `https://maps.google.com/maps?q=${query}&output=embed&z=15`
  return (
    <div className={`rounded-xl border ${meta.bg} ${meta.border} overflow-hidden ${skipped ? 'opacity-50' : ''}`}>
      <div
        className="px-3 py-2.5 flex items-center gap-2 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-base flex-shrink-0">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[17px] sm:text-base font-semibold break-words ${meta.text} ${skipped ? 'line-through' : ''}`}>{name}</p>
          {location && <p className="text-sm text-gray-500 break-words">{location}</p>}
        </div>
        {checkpoint && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${checkpoint === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {checkpoint === 'in' ? 'Check-in' : 'Check-out'}
          </span>
        )}
        {latLng && (
          <span title="Location pinned — exact map" className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">📍 Pinned</span>
        )}
        <span className={`text-gray-300 text-xs flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        {skipped && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-200 text-gray-500">Skipped</span>
        )}
        {onEdit && (
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="text-xs text-gray-400 hover:text-blue-600 transition flex-shrink-0">{editLabel ?? 'Edit'}</button>
        )}
      </div>
      {open && (
        <>
          <iframe
            src={embedUrl}
            className="w-full border-t border-gray-100"
            style={{ height: 220, pointerEvents: 'none' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={`px-3 py-2 border-t border-gray-100 ${meta.bg}`}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-semibold ${meta.text} hover:underline`}
              onClick={e => e.stopPropagation()}
            >
              Open in Google Maps →
            </a>
          </div>
        </>
      )}
    </div>
  )
}

export function DayMapCollapsible({ locations }: { locations: LocationPoint[] }) {
  const [open, setOpen] = useState(false)
  if (!locations.length) return null
  const label = locations.length === 1 ? locations[0].label : `${locations.length} locations today`
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm font-medium text-gray-600"
      >
        <span className="flex items-center gap-2">
          <span>🗺</span>
          <span>{label}</span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲ Hide map' : '▼ Show map'}</span>
      </button>
      {open && <DayLocationMap locations={locations} />}
    </div>
  )
}
