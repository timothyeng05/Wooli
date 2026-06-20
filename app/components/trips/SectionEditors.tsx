'use client'
import { useState, useLayoutEffect, useRef } from 'react'
import type { SectionData } from '@/lib/trips/trip-sections'
import type { EditorSection } from '@/lib/trips/trip-utils'
import { inputCls, labelCls, parseDuration, formatDuration, ratingStyle } from '@/lib/trips/trip-utils'
import CoordsInput from './CoordsInput'

function DurationInput({ value, onChange }: { value?: string; onChange: (val: string | undefined) => void }) {
  const init = value ? parseDuration(value) : { hours: 0, minutes: 0 }
  const [h, setH] = useState(init.hours)
  const [m, setM] = useState(init.minutes)
  const emit = (nh: number, nm: number) => { const s = formatDuration(nh, nm); onChange(s || undefined) }
  return (
    <div className="flex items-center gap-1.5">
      <input type="number" inputMode="numeric" min={0} max={99} value={h || ''} placeholder="0"
        onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setH(v); emit(v, m) }}
        className="w-14 border border-gray-200 rounded-lg px-2 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-center" />
      <span className="text-xs text-gray-400 font-medium">h</span>
      <input type="number" inputMode="numeric" min={0} max={59} value={m || ''} placeholder="0"
        onChange={e => { const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); setM(v); emit(h, v) }}
        className="w-14 border border-gray-200 rounded-lg px-2 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-center" />
      <span className="text-xs text-gray-400 font-medium">m</span>
    </div>
  )
}

function AutoTextarea({ value, onChange, onBlur, className, placeholder }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  className?: string; placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
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
      onBlur={onBlur}
      placeholder={placeholder}
      className={className}
      style={{ overflow: 'hidden', resize: 'none' }}
    />
  )
}


export function TravelEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
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
          <DurationInput value={section.duration} onChange={v => onChange({ duration: v })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Details (flight #, airline, etc.)</label>
        <input className={inputCls} value={detailLines} onChange={e => setDetails(e.target.value)} placeholder="UA 7923, United Airlines" />
      </div>
    </div>
  )
}

export function HotelEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
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
        <label className={labelCls}>Location <span className="text-gray-400 font-normal">(optional — search a place or paste a link)</span></label>
        <CoordsInput value={section.coords} onChange={v => onChange({ coords: v })} />
      </div>
    </div>
  )
}

export function DriveEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
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
        <div className="flex-shrink-0">
          <label className={labelCls}>Duration</label>
          <DurationInput value={section.duration} onChange={v => onChange({ duration: v })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <AutoTextarea className={inputCls} value={noteLines} onChange={e => setNotes(e.target.value)} placeholder="- Exit B2&#10;- Platform 3" />
      </div>
    </div>
  )
}

export function CarEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
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

export function ActivityEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const titleIdx = section.lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('-'))
  const titleLine = titleIdx >= 0 ? section.lines[titleIdx] : ''
  const noteLines = section.lines.filter(l => l.trim().startsWith('-') || l !== titleLine).join('\n')

  const setTitle = (val: string) => {
    const rest = titleIdx >= 0 ? section.lines.filter((_, i) => i !== titleIdx) : section.lines
    onChange({ lines: val ? [val, ...rest] : rest })
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
        <div className="flex-shrink-0">
          <label className={labelCls}>Duration</label>
          <DurationInput value={section.duration} onChange={v => onChange({ duration: v })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Location <span className="text-gray-400 font-normal">(optional — search a place or paste a link)</span></label>
        <CoordsInput value={section.coords} onChange={v => onChange({ coords: v })} />
      </div>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <AutoTextarea className={inputCls} value={noteLines} onChange={e => setNotes(e.target.value)} placeholder="- Bring camera&#10;- Book tickets in advance" />
      </div>
    </div>
  )
}

export function MealEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
  const nameIdx = section.lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('-'))
  const nameLine = nameIdx >= 0 ? section.lines[nameIdx] : ''
  const bulletLines = nameIdx >= 0 ? section.lines.slice(nameIdx + 1) : section.lines

  // Strip '- ' prefix for display so users type items plainly.
  // Preserve inner/trailing whitespace so spaces can be typed.
  const foodDisplay = bulletLines
    .map(l => l.replace(/^- /, ''))
    .join('\n')

  const setName = (val: string) => {
    const rest = nameIdx >= 0 ? section.lines.filter((_, i) => i !== nameIdx) : section.lines
    onChange({ lines: val ? [val, ...rest] : rest })
  }
  // Picking a Google place sets the location and, when the name is blank, uses
  // the place name as the meal title.
  const setLocation = (v: string | undefined, placeName?: string) => {
    const updates: Partial<SectionData> = { coords: v }
    if (placeName && !nameLine.trim()) {
      const rest = nameIdx >= 0 ? section.lines.filter((_, i) => i !== nameIdx) : section.lines
      updates.lines = [placeName, ...rest]
    }
    onChange(updates)
  }
  const setFood = (val: string) => {
    // Don't trim each line while typing — that strips the trailing space
    // mid-keystroke and makes spaces impossible to enter.
    const items = val.split('\n').map(l => l.trim() ? `- ${l}` : '')
    onChange({ lines: nameLine ? [nameLine, ...items] : items })
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className={labelCls}>Restaurant / place</label>
        <input className={inputCls} value={nameLine} onChange={e => setName(e.target.value)} placeholder="Chanko Tomoegata" />
      </div>
      <div>
        <label className={labelCls}>Food items <span className="text-gray-400 font-normal">(one per line)</span></label>
        <AutoTextarea className={inputCls} value={foodDisplay} onChange={e => setFood(e.target.value)} placeholder="Chanko nabe&#10;Sake" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Time</label>
          <input className={inputCls} value={section.timeOverride ?? ''} onChange={e => onChange({ timeOverride: e.target.value || undefined })} placeholder="7:00 PM" />
        </div>
        <div className="flex-shrink-0">
          <label className={labelCls}>Duration (optional)</label>
          <DurationInput value={section.duration} onChange={v => onChange({ duration: v })} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Rating <span className="text-gray-400 font-normal">(optional)</span></label>
        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
            const active = section.rating === n
            const style = active ? ratingStyle(n) : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ rating: active ? undefined : n })}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${style}`}
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className={labelCls}>Location <span className="text-gray-400 font-normal">(optional — search a place or paste a link)</span></label>
        <CoordsInput value={section.coords} onChange={setLocation} />
      </div>
    </div>
  )
}

export function GeneralEditor({ section, onChange }: { section: EditorSection; onChange: (u: Partial<SectionData>) => void }) {
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
