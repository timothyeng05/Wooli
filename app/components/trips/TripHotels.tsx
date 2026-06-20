'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { inputCls, labelCls, parseCoords } from '@/lib/trips/trip-utils'
import CoordsInput from './CoordsInput'

export type TripHotel = {
  id: string
  trip_id: string
  user_id: string
  name: string
  location: string | null
  coords: string | null
  check_in: string   // YYYY-MM-DD
  check_out: string  // YYYY-MM-DD
  notes: string | null
}

function shortRange(checkIn: string, checkOut: string): string {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(checkIn)} – ${fmt(checkOut)}`
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = new Date(checkOut + 'T00:00:00').getTime() - new Date(checkIn + 'T00:00:00').getTime()
  return Math.max(0, Math.round(ms / 86400000))
}

type Draft = { id?: string; name: string; location: string; coords?: string; check_in: string; check_out: string; notes: string }

const emptyDraft = (check_in = '', check_out = ''): Draft => ({ name: '', location: '', coords: undefined, check_in, check_out, notes: '' })

export default function TripHotels({ tripId, userId, hotels, defaultStart, defaultEnd, onChange }: {
  tripId: string
  userId: string
  hotels: TripHotel[]
  defaultStart: string
  defaultEnd: string
  onChange: () => void
}) {
  const [editing, setEditing] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const startAdd = () => setEditing(emptyDraft(defaultStart, defaultStart))
  const startEdit = (h: TripHotel) => setEditing({
    id: h.id, name: h.name, location: h.location ?? '', coords: h.coords ?? undefined,
    check_in: h.check_in, check_out: h.check_out, notes: h.notes ?? '',
  })

  const save = async () => {
    if (!editing || saving) return
    if (!editing.name.trim() || !editing.check_in || !editing.check_out) return
    if (editing.check_out < editing.check_in) return
    setSaving(true)
    const supabase = createClient()
    const row = {
      trip_id: tripId,
      user_id: userId,
      name: editing.name.trim(),
      location: editing.location.trim() || null,
      coords: editing.coords || null,
      check_in: editing.check_in,
      check_out: editing.check_out,
      notes: editing.notes.trim() || null,
    }
    if (editing.id) await supabase.from('trip_hotels').update(row).eq('id', editing.id)
    else await supabase.from('trip_hotels').insert(row)
    setSaving(false)
    setEditing(null)
    onChange()
  }

  const remove = async (id: string) => {
    const supabase = createClient()
    await supabase.from('trip_hotels').delete().eq('id', id)
    onChange()
  }

  // Add / edit form
  if (editing) {
    const valid = editing.name.trim() && editing.check_in && editing.check_out && editing.check_out >= editing.check_in
    return (
      <div className="space-y-3">
        <p className="text-base font-bold text-gray-900">{editing.id ? 'Edit hotel' : 'Add hotel'}</p>
        <div>
          <label className={labelCls}>Hotel name</label>
          <input className={inputCls} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Park Hyatt Tokyo" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Check-in</label>
            <input type="date" className={inputCls} value={editing.check_in} min={defaultStart} max={defaultEnd}
              onChange={e => setEditing({ ...editing, check_in: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Check-out</label>
            <input type="date" className={inputCls} value={editing.check_out} min={editing.check_in || defaultStart} max={defaultEnd}
              onChange={e => setEditing({ ...editing, check_out: e.target.value })} />
          </div>
        </div>
        {editing.check_in && editing.check_out && (
          <p className="text-xs text-gray-400">{nightsBetween(editing.check_in, editing.check_out)} night stay</p>
        )}
        <div>
          <label className={labelCls}>Location <span className="text-gray-400 font-normal">(optional)</span></label>
          <CoordsInput
            value={editing.coords}
            onChange={(v, placeName) => setEditing({ ...editing, coords: v, name: (placeName && !editing.name.trim()) ? placeName : editing.name })}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={save} disabled={saving || !valid}
            className="flex-1 bg-blue-600 text-white text-base font-semibold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-40">
            {saving ? 'Saving…' : 'Save hotel'}
          </button>
          <button onClick={() => setEditing(null)} className="text-sm font-medium text-gray-500 px-4 py-3 rounded-xl hover:bg-gray-100 transition">Cancel</button>
        </div>
      </div>
    )
  }

  // List
  return (
    <div className="space-y-3">
      {hotels.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-4xl mb-2">🏨</div>
          <p className="text-sm text-gray-500 font-medium">No hotels yet</p>
          <p className="text-xs text-gray-400 mt-0.5">Add your stays — they’ll show on every day you’re checked in.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hotels.map(h => {
            const pinned = !!parseCoords(h.coords ?? undefined)
            return (
              <div key={h.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-gray-900 leading-snug">{h.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {shortRange(h.check_in, h.check_out)} · {nightsBetween(h.check_in, h.check_out)} night{nightsBetween(h.check_in, h.check_out) !== 1 ? 's' : ''}
                    </p>
                    {h.location && <p className="text-xs text-gray-400 mt-0.5 truncate">{h.location}</p>}
                  </div>
                  {pinned && (
                    <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">📍 Pinned</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                  <button onClick={() => startEdit(h)} className="text-sm font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition">Edit</button>
                  <button onClick={() => remove(h.id)} className="text-sm font-medium text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition ml-auto">Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <button
        onClick={startAdd}
        className="w-full border border-dashed border-blue-300 text-blue-600 font-semibold rounded-xl py-3 hover:bg-blue-50 transition"
      >
        + Add hotel
      </button>
    </div>
  )
}
