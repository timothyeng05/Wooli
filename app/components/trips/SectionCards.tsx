'use client'
import { useState } from 'react'
import DayLocationMap, { type LocationPoint } from './DayLocationMapClient'
import type { SectionMeta } from '@/lib/trips/trip-sections'
import { ratingStyle, ACTIVITY_TYPES, MEAL_TYPES, parseCoords, parsePlaceId } from '@/lib/trips/trip-utils'

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

export function SectionCard({ meta, lines, onEdit, title, type, place, coords, expanded, onToggleExpand, rating, skipped }: {
  meta: SectionMeta; lines: string[]
  onEdit?: () => void
  title?: string; type?: string; place?: string
  coords?: string
  expanded: boolean; onToggleExpand: () => void
  rating?: number
  skipped?: boolean
}) {
  const latLng = parseCoords(coords)
  const allContent = lines.map(l => l.trim()).filter(Boolean)
  const t = type?.toUpperCase() ?? ''
  const isActivityOrMeal = ACTIVITY_TYPES.has(t) || MEAL_TYPES.has(t)

  let duration: string | null = null
  let content = allContent
  const dl = allContent.find(l => l.startsWith('~'))
  if (dl) {
    duration = dl.slice(1).trim()
    content = allContent.filter(l => !l.startsWith('~'))
  }

  // When an explicit title is set (e.g. from Mac app), use all lines as body.
  // Otherwise extract the first non-bullet line as the display name.
  let displayName: string | null = null
  let body = content
  if (isActivityOrMeal && !title) {
    const nameIdx = content.findIndex(l => !l.startsWith('-'))
    if (nameIdx >= 0) {
      displayName = content[nameIdx]
      body = content.filter((_, i) => i !== nameIdx)
    }
  }

  if (!content.length && !duration && !title && !place) {
    // Read-only contexts (e.g. share page) hide empty sections entirely.
    if (!onEdit) return null
    // In the editor, show a muted placeholder so the empty section stays
    // visible and editable/deletable instead of rendering a blank card.
    return (
      <div className={`rounded-xl border ${meta.bg} ${meta.border} ${skipped ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="flex-shrink-0 text-base opacity-50">{meta.icon}</span>
          <p className="flex-1 min-w-0 text-sm italic text-gray-400">
            Empty {meta.label.toLowerCase()} — tap Edit to add details
          </p>
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-xs text-gray-400 hover:text-blue-600 transition flex-shrink-0"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }
  const headerText = title || displayName || meta.label
  const hasBody = body.length > 0 || !!place || !!latLng

  return (
    <div className={`rounded-xl border overflow-hidden ${meta.bg} ${meta.border} ${skipped ? 'opacity-50' : ''}`}>
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none"
        onClick={onToggleExpand}
      >
        <span className="flex-shrink-0 text-base">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-semibold leading-snug ${meta.text} ${skipped ? 'line-through' : ''}`}>{headerText}</p>
          {duration && (
            <p className="text-xs text-teal-600 font-medium leading-none mt-0.5">⏱ {duration}</p>
          )}
        </div>
        {hasBody && (
          <span className={`text-gray-300 text-xs flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>▼</span>
        )}
        {rating != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ratingStyle(rating)}`}>
            {rating}/10
          </span>
        )}
        {skipped && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-gray-200 text-gray-500">
            Skipped
          </span>
        )}
        {onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-xs text-gray-400 hover:text-blue-600 transition flex-shrink-0"
          >
            Edit
          </button>
        )}
      </div>
      {expanded && hasBody && (
        <div className={`px-3 pb-2.5 pt-2 border-t ${meta.border}`}>
          {place && (
            <p className="text-sm text-gray-500 mb-1.5 flex items-center gap-1">
              <span className="text-xs">📍</span>{place}
            </p>
          )}
          {body.length > 0 && (
            <ul className="space-y-1">
              {body.map((line, i) => {
                const isBullet = line.startsWith('-')
                const text = isBullet ? line.slice(1).trim() : line
                return (
                  <li key={i} className={`text-base text-gray-700 flex gap-2 ${isBullet ? 'items-start' : 'items-center'}`}>
                    {isBullet && <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>}
                    <span>{text}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {latLng && (() => {
            const embed = mapEmbedUrl(coords, latLng)
            const link = mapLinkUrl(coords, latLng)
            return (
              <div className="mt-2 rounded-lg overflow-hidden border border-gray-100">
                {embed && (
                  <iframe
                    src={embed}
                    className="w-full"
                    style={{ height: 200, pointerEvents: 'none' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className={`block px-3 py-1.5 text-sm font-semibold ${meta.text} hover:underline ${meta.bg}`}
                  >
                    Open in Google Maps →
                  </a>
                )}
              </div>
            )
          })()}
        </div>
      )}
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
          <p className={`text-base font-semibold ${meta.text} ${skipped ? 'line-through' : ''}`}>{name}</p>
          {location && <p className="text-sm text-gray-500">{location}</p>}
        </div>
        {checkpoint && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${checkpoint === 'in' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {checkpoint === 'in' ? 'Check-in' : 'Check-out'}
          </span>
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
