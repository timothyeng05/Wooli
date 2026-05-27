'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import DayLocationMap, { type LocationPoint } from '@/app/components/trips/DayLocationMapClient'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  SECTIONS, SectionMeta, SectionData, ParsedSection,
  findMeta, sectionDataToDisplay, parseSectionsFromNotes, notesToSectionData,
} from '@/lib/trips/trip-sections'

type DayData = { title: string | null; notes: string | null; date: string; location: string | null }
type EditorSection = SectionData & { _id: string }

// ─── Display components (view mode) ────────────────────────────────────────

function SectionCard({ meta, lines, confirmed, onToggle, onEdit }: {
  meta: SectionMeta; lines: string[]
  confirmed: boolean; onToggle: () => void; onEdit?: () => void
}) {
  const allContent = lines.map(l => l.trim()).filter(Boolean)

  let duration: string | null = null
  let content = allContent
  const dl = allContent.find(l => l.startsWith('~'))
  if (dl) {
    duration = dl.slice(1).trim()
    content = allContent.filter(l => !l.startsWith('~'))
  }

  if (!content.length && !duration) return null
  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`flex items-center gap-2 font-semibold text-sm ${meta.text}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {duration && (
            <span className="text-xs font-semibold bg-teal-100 text-teal-700 rounded-full px-2.5 py-1 flex items-center gap-1">
              <span>⏱</span> {duration}
            </span>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={onToggle}
              className="w-4 h-4 rounded border-gray-300 accent-green-500 cursor-pointer"
            />
            <span className="text-xs text-gray-400">Planned</span>
          </label>
          {onEdit && (
            <button onClick={onEdit} className="text-xs font-medium text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-md px-2 py-0.5 transition">Edit</button>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {content.map((line, i) => {
          const isBullet = line.startsWith('-')
          const text = isBullet ? line.slice(1).trim() : line
          return (
            <li key={i} className={`text-sm text-gray-700 flex gap-2 ${isBullet ? 'items-start' : 'items-center'}`}>
              {isBullet && <span className="text-gray-300 mt-0.5 flex-shrink-0">•</span>}
              <span>{text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function HotelCard({ meta, lines, confirmed, onToggle, onEdit }: {
  meta: SectionMeta; lines: string[]
  confirmed: boolean; onToggle: () => void; onEdit?: () => void
}) {
  const [open, setOpen] = useState(false)
  const content = lines.map(l => l.trim()).filter(Boolean)
  const name = content[0]
  const location = content[1]
  if (!name) return null
  const query = encodeURIComponent([name, location].filter(Boolean).join(', '))
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`
  const embedUrl = `https://maps.google.com/maps?q=${query}&output=embed&z=15`
  return (
    <div
      className={`rounded-xl border ${meta.bg} ${meta.border} overflow-hidden select-none`}
      onDoubleClick={() => setOpen(o => !o)}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${meta.text}`}>{name}</p>
          {location && <p className="text-xs text-gray-500">{location}</p>}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={onToggle}
            className="w-4 h-4 rounded border-gray-300 accent-green-500 cursor-pointer"
          />
          <span className="text-xs text-gray-400">Planned</span>
        </label>
        <span className="text-xs text-gray-400 flex-shrink-0">{open ? 'double-tap to close' : 'double-tap for map'}</span>
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit() }} className="text-xs font-medium text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-md px-2 py-0.5 transition">Edit</button>
          )}
      </div>
      {open && (
        <>
          <iframe
            src={embedUrl}
            className="w-full border-t border-gray-100"
            style={{ height: 220 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className={`px-4 py-2.5 border-t border-gray-100 ${meta.bg}`}>
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

function TravelBanner({ sections }: { sections: ParsedSection[] }) {
  const travel = sections.filter(s => s.meta.banner)
  if (!travel.length) return null
  return (
    <div className="space-y-2">
      {travel.map((s, i) => {
        const lines = s.lines.map(l => l.trim()).filter(Boolean)
        const duration = lines.find(l => l.startsWith('~'))?.slice(1).trim()
        const content = lines.filter(l => !l.startsWith('~')).map(l => l.replace(/^-\s*/, ''))
        const route = content.find(l => l.includes('→'))
        const detail = content.find(l => l !== route)
        const time = s.timeOverride
        return (
          <div key={i} className={`rounded-xl border px-5 py-4 ${s.meta.bg} ${s.meta.border} flex items-center gap-4`}>
            <span className="text-2xl flex-shrink-0">{s.meta.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wide ${s.meta.text} mb-0.5`}>{s.meta.label}</p>
              {route && <p className="text-base font-bold text-gray-900 leading-snug">{route}</p>}
              {detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {time && <span className={`text-sm font-bold ${s.meta.text}`}>{time}</span>}
              {duration && <span className={`text-sm font-bold ${s.meta.text}`}>⏱ {duration}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Editor components ──────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'
const labelCls = 'block text-xs text-gray-500 mb-1'

function AutoTextarea({ value, onChange, className, placeholder }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  className?: string; placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={2}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  )
}

function TravelEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const routeLine = section.lines.find(l => l.includes('→')) ?? ''
  const detailLines = section.lines.filter(l => !l.includes('→')).join('\n')

  const setRoute = (val: string) => {
    const others = section.lines.filter(l => !l.includes('→'))
    onChange({ lines: val ? [val, ...others] : others })
  }
  const setDetails = (val: string) => {
    const rl = section.lines.find(l => l.includes('→'))
    const newDetails = val.split('\n').filter(Boolean)
    onChange({ lines: rl ? [rl, ...newDetails] : newDetails })
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Route</label>
        <input className={inputCls} value={routeLine} onChange={e => setRoute(e.target.value)} placeholder="SFO → NRT" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Departs</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="2:00 AM" />
        </div>
        <div>
          <label className={labelCls}>Duration</label>
          <input className={inputCls} value={section.duration ?? ''} onChange={e => onChange({ duration: e.target.value || undefined })} placeholder="14h 15m" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Details (flight #, airline, etc.)</label>
        <input className={inputCls} value={detailLines} onChange={e => setDetails(e.target.value)} placeholder="UA 7923, United Airlines" />
      </div>
    </div>
  )
}

function HotelEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const name = section.lines[0] ?? ''
  const location = section.lines[1] ?? ''

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Name</label>
        <input className={inputCls} value={name} onChange={e => onChange({ lines: [e.target.value, location].filter((v, i) => i === 0 || location) })} placeholder="Park Hyatt Tokyo" />
      </div>
      <div>
        <label className={labelCls}>Location</label>
        <input className={inputCls} value={location} onChange={e => onChange({ lines: name ? [name, e.target.value] : [e.target.value] })} placeholder="Shinjuku, Tokyo" />
      </div>
      <div>
        <label className={labelCls}>Coordinates <span className="text-gray-400 font-normal">(optional — right-click on Google Maps → copy)</span></label>
        <input className={inputCls} value={section.coords ?? ''} onChange={e => onChange({ coords: e.target.value || undefined })} placeholder="35.6896, 139.6917" />
      </div>
    </div>
  )
}

function DriveEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const routeIdx = section.lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('-'))
  const routeLine = routeIdx >= 0 ? section.lines[routeIdx] : ''
  const noteLines = section.lines.slice(routeIdx + 1).join('\n')

  const setRoute = (val: string) => {
    const bullets = section.lines.filter(l => l.trim().startsWith('-'))
    onChange({ lines: val ? [val, ...bullets] : bullets })
  }
  const setNotes = (val: string) => {
    onChange({ lines: routeLine ? [routeLine, ...val.split('\n')] : val.split('\n') })
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Route / description</label>
        <input className={inputCls} value={routeLine} onChange={e => setRoute(e.target.value)} placeholder="Kagoshima → Ebino Kogen" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Start time</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="9:00 AM" />
        </div>
        <div className="w-28 flex-shrink-0">
          <label className={labelCls}>Duration</label>
          <input className={inputCls} value={section.duration ?? ''} onChange={e => onChange({ duration: e.target.value || undefined })} placeholder="45 min" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <AutoTextarea className={inputCls} value={noteLines} onChange={e => setNotes(e.target.value)} placeholder="- Exit B2&#10;- Platform 3" />
      </div>
    </div>
  )
}

function CarEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const pickup = section.lines[0] ?? ''
  const returnLoc = section.lines[1] ?? ''

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Pickup</label>
        <input className={inputCls} value={pickup} onChange={e => onChange({ lines: [e.target.value, returnLoc].filter((v, i) => i === 0 || !!returnLoc) })} placeholder="Enterprise – Kagoshima Airport" />
      </div>
      <div>
        <label className={labelCls}>Return</label>
        <input className={inputCls} value={returnLoc} onChange={e => onChange({ lines: pickup ? [pickup, e.target.value] : [e.target.value] })} placeholder="Fukuoka Airport (or same location)" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Pickup time</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="10:00 AM" />
        </div>
        <div className="w-28 flex-shrink-0">
          <label className={labelCls}>Duration</label>
          <input className={inputCls} value={section.duration ?? ''} onChange={e => onChange({ duration: e.target.value || undefined })} placeholder="9 days" />
        </div>
      </div>
    </div>
  )
}

function ActivityEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const titleIdx = section.lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('-'))
  const titleLine = titleIdx >= 0 ? section.lines[titleIdx] : ''
  const noteLines = section.lines.slice(titleIdx + 1).join('\n')

  const setTitle = (val: string) => {
    const bullets = section.lines.filter(l => l.trim().startsWith('-'))
    onChange({ lines: val ? [val, ...bullets] : bullets })
  }
  const setNotes = (val: string) => {
    onChange({ lines: titleLine ? [titleLine, ...val.split('\n')] : val.split('\n') })
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Activity</label>
        <input className={inputCls} value={titleLine} onChange={e => setTitle(e.target.value)} placeholder="Sumo Tournament" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Time</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="11:00 AM" />
        </div>
        <div className="w-28 flex-shrink-0">
          <label className={labelCls}>Duration</label>
          <input className={inputCls} value={section.duration ?? ''} onChange={e => onChange({ duration: e.target.value || undefined })} placeholder="3h" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Coordinates <span className="text-gray-400 font-normal">(optional — right-click on Google Maps → copy)</span></label>
        <input className={inputCls} value={section.coords ?? ''} onChange={e => onChange({ coords: e.target.value || undefined })} placeholder="35.6896, 139.6917" />
      </div>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <AutoTextarea className={inputCls} value={noteLines} onChange={e => setNotes(e.target.value)} placeholder="- Bring camera&#10;- Book tickets in advance" />
      </div>
    </div>
  )
}

function MealEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const nameIdx = section.lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('-'))
  const nameLine = nameIdx >= 0 ? section.lines[nameIdx] : ''
  const optionLines = section.lines.slice(nameIdx + 1).join('\n')

  const setName = (val: string) => {
    const bullets = section.lines.filter(l => l.trim().startsWith('-'))
    onChange({ lines: val ? [val, ...bullets] : bullets })
  }
  const setOptions = (val: string) => {
    onChange({ lines: nameLine ? [nameLine, ...val.split('\n')] : val.split('\n') })
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Restaurant / meal</label>
        <input className={inputCls} value={nameLine} onChange={e => setName(e.target.value)} placeholder="Chanko Tomoegata" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Time</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="7:00 PM" />
        </div>
        <div className="w-28 flex-shrink-0">
          <label className={labelCls}>Duration (optional)</label>
          <input className={inputCls} value={section.duration ?? ''} onChange={e => onChange({ duration: e.target.value || undefined })} placeholder="1h 30m" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Coordinates <span className="text-gray-400 font-normal">(optional — right-click on Google Maps → copy)</span></label>
        <input className={inputCls} value={section.coords ?? ''} onChange={e => onChange({ coords: e.target.value || undefined })} placeholder="35.6896, 139.6917" />
      </div>
      <div>
        <label className={labelCls}>Options / notes</label>
        <AutoTextarea className={inputCls} value={optionLines} onChange={e => setOptions(e.target.value)} placeholder="- Option A&#10;- Option B" />
      </div>
    </div>
  )
}

function GeneralEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  return (
    <div>
      <label className={labelCls}>Notes (one per line)</label>
      <AutoTextarea
        className={`${inputCls} font-mono`}
        value={section.lines.join('\n')}
        onChange={e => onChange({ lines: e.target.value.split('\n') })}
        placeholder="- Item 1&#10;- Item 2"
      />
    </div>
  )
}

const ACTIVITY_TYPES = new Set(['MORNING', 'AFTERNOON', 'NIGHT', 'ACTIVITY'])
const MEAL_TYPES = new Set(['BREAKFAST', 'LUNCH', 'DINNER', 'MEAL'])

function SectionEditorCard({ section, onChange, onDelete, onMoveUp, onMoveDown, onDone }: {
  section: EditorSection
  onChange: (updates: Partial<SectionData>) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDone?: () => void
}) {
  const meta = findMeta(section.type)
  if (!meta) return null

  const t = section.type.toUpperCase()

  return (
    <div className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {(onMoveUp || onMoveDown) && (
            <div className="flex flex-col gap-0.5">
              <button onClick={onMoveUp} disabled={!onMoveUp}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default transition leading-none text-xs px-0.5" title="Move up">▲</button>
              <button onClick={onMoveDown} disabled={!onMoveDown}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default transition leading-none text-xs px-0.5" title="Move down">▼</button>
            </div>
          )}
          <select
            value={section.type}
            onChange={e => onChange({ type: e.target.value })}
            className={`text-sm font-semibold border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-300 rounded px-1 py-0.5 cursor-pointer ${meta.text}`}
          >
            {ALL_SECTION_TYPES.map(type => {
              const m = findMeta(type)
              return m ? <option key={type} value={type}>{m.icon} {m.label}</option> : null
            })}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Mark as must-do / appointment">
            <input type="checkbox" checked={!!section.pinned}
              onChange={e => onChange({ pinned: e.target.checked || undefined })}
              className="w-4 h-4 rounded border-gray-300 accent-amber-500 cursor-pointer" />
            <span className="text-xs text-gray-400">⭐ Important</span>
          </label>
        </div>
      </div>
      {(meta.banner || meta.travel) && !meta.car
        ? <TravelEditor section={section} onChange={onChange} />
        : meta.hotel
        ? <HotelEditor section={section} onChange={onChange} />
        : meta.car
        ? <CarEditor section={section} onChange={onChange} />
        : (meta.drive || meta.transit)
        ? <DriveEditor section={section} onChange={onChange} />
        : ACTIVITY_TYPES.has(t)
        ? <ActivityEditor section={section} onChange={onChange} />
        : MEAL_TYPES.has(t)
        ? <MealEditor section={section} onChange={onChange} />
        : <GeneralEditor section={section} onChange={onChange} />
      }
      {onDone && (
        <div className="mt-3 pt-3 border-t border-gray-200/60 flex items-center justify-between">
          <button onClick={onDelete} className="text-xs font-medium text-red-400 hover:text-red-600 transition">
            Delete
          </button>
          <button onClick={onDone} className="text-xs font-medium text-blue-600 hover:text-blue-700 transition">
            Done editing
          </button>
        </div>
      )}
    </div>
  )
}

// Groups for the Add Section picker
const ADD_SECTION_GROUPS = [
  { label: 'Travel', types: ['FLIGHT', 'TRAIN', 'DRIVE', 'RENTAL CAR', 'SUBWAY'] },
  { label: 'Plan',   types: ['ACTIVITY', 'MEAL'] },
  { label: 'Stay',   types: ['HOTEL'] },
]
const ALL_SECTION_TYPES = ADD_SECTION_GROUPS.flatMap(g => g.types)

function AddSectionPicker({ onAdd, onCancel }: { onAdd: (type: string) => void; onCancel?: () => void }) {
  return (
    <div className="border border-dashed border-gray-300 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add section</p>
        {onCancel && <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600 transition">Cancel</button>}
      </div>
      {ADD_SECTION_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-xs text-gray-400 mb-1.5">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.types.map(type => {
              const meta = findMeta(type)
              if (!meta) return null
              return (
                <button
                  key={type}
                  onClick={() => onAdd(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition hover:shadow-sm ${meta.bg} ${meta.border} ${meta.text}`}
                >
                  {meta.icon} {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DayMapCollapsible({ locations }: { locations: LocationPoint[] }) {
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

// ─── Main page ──────────────────────────────────────────────────────────────

function parseCoords(raw: string | undefined): { lat: number; lng: number } | null {
  if (!raw) return null
  const parts = raw.split(',').map(s => parseFloat(s.trim()))
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] }
  return null
}

let _idCounter = 0
function newId() { return `s${++_idCounter}` }

export default function TripDayPage() {
  const params = useParams<{ id: string; date: string }>()
  const [trip, setTrip] = useState<{ name: string; start_date: string; end_date: string } | null>(null)
  const [days, setDays] = useState<DayData[]>([])
  const [allDates, setAllDates] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [sectionItems, setSectionItems] = useState<EditorSection[]>([])
  const [prevDate, setPrevDate] = useState<string | null>(null)
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmedSections, setConfirmedSections] = useState<string[]>([])
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: tripData }, { data: allDays }] = await Promise.all([
        supabase.from('trips').select('name, start_date, end_date').eq('id', params.id).single(),
        supabase.from('trip_days').select('date, title, notes, confirmed_sections, location').eq('trip_id', params.id).order('date'),
      ])

      setTrip(tripData)
      setDays(allDays ?? [])

      const generated: string[] = []
      if (tripData) {
        const cur = new Date(tripData.start_date + 'T00:00:00')
        const end = new Date(tripData.end_date + 'T00:00:00')
        while (cur <= end) {
          generated.push(cur.toISOString().split('T')[0])
          cur.setDate(cur.getDate() + 1)
        }
      }
      setAllDates(generated)

      const currentIdx = generated.indexOf(params.date)
      setPrevDate(currentIdx > 0 ? generated[currentIdx - 1] : null)
      setNextDate(currentIdx < generated.length - 1 ? generated[currentIdx + 1] : null)

      const current = allDays?.find(d => d.date === params.date)
      if (current) {
        setTitle(current.title ?? '')
        setLocation((current as any).location ?? '')
        const sectionData = notesToSectionData(current.notes)
        const items = sectionData.map(s => ({ ...s, _id: newId() }))
        setSectionItems(items)

        if (current.confirmed_sections === null) {
          const autoPlanned = sectionData
            .map((s, idx) => ({ s, idx }))
            .filter(({ s }) => { const m = findMeta(s.type); return !!(m?.hotel || m?.banner) })
            .map(({ idx }) => String(idx))
          setConfirmedSections(autoPlanned)
        } else {
          setConfirmedSections(current.confirmed_sections)
        }

        fetchSummary(items)
      }
      setLoading(false)
    }
    load()
  }, [params.id, params.date])

  const save = async () => {
    if (saving) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const notesJson = sectionItems.length > 0
      ? JSON.stringify(sectionItems.map(({ _id, ...s }) => s))
      : null
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: params.date, title: title || null, notes: notesJson, location: location || null },
      { onConflict: 'trip_id,date' }
    )
    setSaving(false)
    setSaved(true)
    setEditingId(null)
    setTimeout(() => setSaved(false), 2000)
    fetchSummary(sectionItems)
  }

  const toggleConfirmed = async (label: string) => {
    const next = confirmedSections.includes(label)
      ? confirmedSections.filter(s => s !== label)
      : [...confirmedSections, label]
    setConfirmedSections(next)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: params.date, confirmed_sections: next },
      { onConflict: 'trip_id,date' }
    )
  }

  const fetchSummary = async (sections: EditorSection[]) => {
    if (!sections.length) return
    try {
      const res = await fetch('/api/trips/day-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: sections.map(({ _id, ...s }) => s) }),
      })
      const { summary } = await res.json()
      setAiSummary(summary ?? null)
    } catch {}
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    setSectionItems(items => {
      const next = [...items]
      const target = index + direction
      if (target < 0 || target >= next.length) return items
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const addSection = (type: string, afterIndex?: number) => {
    setSectionItems(s => {
      const newSection = { _id: newId(), type, lines: [] }
      if (afterIndex === undefined) return [...s, newSection]
      const next = [...s]
      next.splice(afterIndex + 1, 0, newSection)
      return next
    })
    setInsertAt(null)
  }

  const updateSection = (id: string, updates: Partial<SectionData>) => {
    setSectionItems(s => s.map(item => item._id === id ? { ...item, ...updates } : item))
  }

  const removeSection = (id: string) => {
    setSectionItems(s => s.filter(item => item._id !== id))
  }

  // Indexed 1:1 with sectionItems (may contain nulls); TravelBanner uses the filtered version
  const displaySectionsRaw = sectionItems.map(item => sectionDataToDisplay(item))
  const displaySections = displaySectionsRaw.filter((x): x is ParsedSection => x !== null)

  const dayLocations = useMemo((): LocationPoint[] => {
    const locs: LocationPoint[] = []
    for (const item of sectionItems) {
      const meta = findMeta(item.type)
      if (!meta) continue
      const t = item.type.toUpperCase()
      const lines = item.lines.map(l => l.trim()).filter(Boolean)
      const parsedCoords = parseCoords(item.coords)
      if (!parsedCoords) continue
      if (meta.hotel && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#8b5cf6', coords: parsedCoords })
      } else if (ACTIVITY_TYPES.has(t) && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#3b82f6', coords: parsedCoords })
      } else if (MEAL_TYPES.has(t) && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#f59e0b', coords: parsedCoords })
      }
    }
    return locs
  }, [sectionItems, location])

  const dayNumber = trip
    ? Math.round((new Date(params.date + 'T00:00:00').getTime() - new Date(trip.start_date + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  const dateLabel = new Date(params.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading...</div>
  }

  const dayTitleMap = new Map(days.map(d => [d.date, d.title]))

  return (
    <div className="min-h-screen bg-white flex">

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r border-gray-100 bg-gray-50 fixed top-[49px] left-0 h-[calc(100vh-49px)] z-20">
        <div className="px-5 py-4 border-b border-gray-200">
          <Link href={`/trips/${params.id}`} className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition flex items-center gap-1">
            ← {trip?.name ?? 'Trip'}
          </Link>
          <p className="text-xs text-gray-400 mt-0.5">{allDates.length} days</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-1">
          {allDates.map((date, i) => {
            const isActive = date === params.date
            const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            const dayTitle = dayTitleMap.get(date) ?? null
            return (
              <Link
                key={date}
                href={`/trips/${params.id}/${date}`}
                className={`flex items-center gap-3 px-5 py-3 transition ${isActive ? 'bg-blue-600' : 'hover:bg-gray-100'}`}
              >
                <span className={`text-xs font-bold flex-shrink-0 w-12 ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>
                  Day {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs ${isActive ? 'text-blue-200' : 'text-gray-400'}`}>{label}</p>
                  <p className={`text-sm font-medium leading-snug truncate ${isActive ? 'text-white' : dayTitle ? 'text-gray-800' : 'text-gray-400'}`}>
                    {dayTitle ?? '—'}
                  </p>
                </div>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">

        {/* Sticky header */}
        <div className="bg-white border-b border-gray-200 sticky top-[49px] z-10">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 text-xs font-bold bg-blue-600 text-white rounded-full px-3 py-1 whitespace-nowrap">
                Day {dayNumber}
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
                  {title || 'Untitled day'}
                </h1>
                <p className="text-xs text-gray-400 truncate">{dateLabel}</p>
                {aiSummary && (
                  <p className="text-xs text-blue-500 truncate mt-0.5 italic">{aiSummary}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {prevDate && (
                <Link href={`/trips/${params.id}/${prevDate}`} className="border border-gray-200 text-gray-500 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm">
                  ← Prev
                </Link>
              )}
              {nextDate && (
                <Link href={`/trips/${params.id}/${nextDate}`} className="border border-gray-200 text-gray-500 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50 transition text-sm">
                  Next →
                </Link>
              )}
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
              {saved && !saving && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

          {/* Always-visible title + location edit */}
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={save}
              placeholder="Day title, e.g. Arrival in Tokyo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">📍</span>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onBlur={save}
                placeholder="Day location (e.g. Tokyo, Japan)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Collapsible day map */}
          {dayLocations.length > 0 && <DayMapCollapsible locations={dayLocations} />}

          {/* Sections */}
          {displaySections.length > 0 ? (
            <>
              <TravelBanner sections={displaySections} />
              <div>
                {sectionItems.map((item, i) => {
                  const s = displaySectionsRaw[i]
                  if (!s) return null
                  const isLast = i === sectionItems.length - 1
                  return (
                    <div key={item._id}>
                      <div className="flex gap-3">
                        <div className="flex flex-col items-end flex-shrink-0 w-14 pt-3.5">
                          {s.pinned && <span className="text-xs leading-none mb-0.5">⭐</span>}
                          <span className="text-xs font-semibold text-gray-400 leading-none">{s.timeOverride ?? s.meta.time}</span>
                        </div>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-3 h-3 rounded-full mt-3 flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: s.meta.dotColor }} />
                          {!isLast && (
                            <div className="flex-1 mt-1" style={{
                              width: '2px', minHeight: '24px',
                              background: s.meta.travel
                                ? `repeating-linear-gradient(to bottom, ${s.meta.dotColor} 0, ${s.meta.dotColor} 5px, transparent 5px, transparent 10px)`
                                : s.meta.transit
                                ? 'repeating-linear-gradient(to bottom, #818cf8 0, #818cf8 5px, transparent 5px, transparent 10px)'
                                : s.meta.drive
                                ? 'repeating-linear-gradient(to bottom, #fb923c 0, #fb923c 5px, transparent 5px, transparent 10px)'
                                : '#e2e8f0',
                            }} />
                          )}
                        </div>
                        <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
                          {editingId === item._id ? (
                            <SectionEditorCard
                              section={item}
                              onChange={updates => updateSection(item._id, updates)}
                              onDelete={() => { removeSection(item._id); setEditingId(null) }}
                              onMoveUp={i > 0 ? () => moveSection(i, -1) : undefined}
                              onMoveDown={i < sectionItems.length - 1 ? () => moveSection(i, 1) : undefined}
                              onDone={() => { setEditingId(null); save() }}
                            />
                          ) : (s.meta.hotel || s.meta.car)
                            ? <HotelCard meta={s.meta} lines={s.lines} confirmed={confirmedSections.includes(String(i))} onToggle={() => toggleConfirmed(String(i))} onEdit={() => setEditingId(item._id)} />
                            : <SectionCard meta={s.meta} lines={s.lines} confirmed={confirmedSections.includes(String(i))} onToggle={() => toggleConfirmed(String(i))} onEdit={() => setEditingId(item._id)} />
                          }
                        </div>
                      </div>
                      {i < sectionItems.length - 1 && (
                        insertAt === i ? (
                          <div className="my-2 ml-[4.25rem]">
                            <AddSectionPicker onAdd={type => addSection(type, i)} onCancel={() => setInsertAt(null)} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 my-1 ml-[4.25rem]">
                            <div className="flex-1 h-px bg-gray-100" />
                            <button onClick={() => setInsertAt(i)} className="text-xs text-gray-300 hover:text-blue-500 transition px-2 py-0.5 rounded-full hover:bg-blue-50">
                              + insert
                            </button>
                            <div className="flex-1 h-px bg-gray-100" />
                          </div>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}

          {/* Add section */}
          {showAddPicker
            ? <AddSectionPicker onAdd={type => { addSection(type); setShowAddPicker(false) }} onCancel={() => setShowAddPicker(false)} />
            : <button
                onClick={() => setShowAddPicker(true)}
                className="w-full border border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:text-blue-500 hover:border-blue-300 transition"
              >
                + Add section
              </button>
          }

        </div>
      </div>
    </div>
  )
}
