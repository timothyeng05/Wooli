'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { inputCls, labelCls } from '@/lib/trips/trip-utils'
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

  return (
    <div className="px-5 py-3 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🏨 Hotels</p>
        {!editing && (
          <button onClick={startAdd} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add</button>
        )}
      </div>

      {/* List */}
      {!editing && (
        <div className="mt-2 space-y-1.5">
          {hotels.length === 0 && (
            <p className="text-xs text-gray-400">No hotels yet — add your stays here.</p>
          )}
          {hotels.map(h => (
            <div key={h.id} className="flex items-center gap-2 rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">{h.name}</p>
                <p className="text-xs text-gray-400">{shortRange(h.check_in, h.check_out)}</p>
              </div>
              <button onClick={() => startEdit(h)} className="text-xs text-gray-400 hover:text-blue-600 flex-shrink-0">Edit</button>
              <button onClick={() => remove(h.id)} className="text-xs text-gray-300 hover:text-red-500 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit form */}
      {editing && (
        <div className="mt-2 space-y-2 rounded-lg bg-white border border-gray-200 p-2.5">
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
          <div>
            <label className={labelCls}>Location <span className="text-gray-400 font-normal">(optional)</span></label>
            <CoordsInput value={editing.coords} onChange={v => setEditing({ ...editing, coords: v })} />
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button onClick={save} disabled={saving || !editing.name.trim() || !editing.check_in || !editing.check_out}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
