'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { resolveLegs, type Leg } from '@/lib/trips/trip-legs'
import { inputCls, labelCls } from '@/lib/trips/trip-utils'

const emptyLeg = (): Leg => ({ name: '', emoji: '', from: '', to: '' })

export default function TripSettingsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [form, setForm] = useState({ name: '', destination: '', start_date: '', end_date: '', description: '' })
  const [legs, setLegs] = useState<Leg[]>([])

  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')
      // select('*') so trips.legs (migration 038) rides along once it exists.
      const { data: trip } = await supabase.from('trips').select('*')
        .eq('id', params.id).eq('user_id', user.id).single()
      if (!trip) return router.push('/trips')
      setForm({
        name: trip.name ?? '',
        destination: trip.destination ?? '',
        start_date: trip.start_date ?? '',
        end_date: trip.end_date ?? '',
        description: trip.description ?? '',
      })
      // Prefill from resolveLegs so a hardcoded-fallback trip adopts its legs
      // into the DB with a single Save.
      setLegs(resolveLegs(params.id, trip))
      setLoading(false)
    }
    load()
  }, [params.id, router])

  const updateLeg = (i: number, updates: Partial<Leg>) => {
    setLegs(ls => ls.map((l, li) => li === i ? { ...l, ...updates } : l))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    const supabase = createClient()
    const base = {
      name: form.name,
      destination: form.destination || null,
      start_date: form.start_date,
      end_date: form.end_date,
      description: form.description || null,
    }
    const cleanLegs = legs
      .filter(l => l.name.trim() && l.from && l.to)
      .map(l => ({ name: l.name.trim(), emoji: l.emoji.trim(), from: l.from, to: l.to }))
    const { error } = await supabase.from('trips').update({ ...base, legs: cleanLegs }).eq('id', params.id)
    if (error) {
      // trips.legs doesn't exist until migration 038 — save everything else.
      const { error: retryError } = await supabase.from('trips').update(base).eq('id', params.id)
      setSaving(false)
      if (retryError) return showToast('Could not save changes')
      return showToast('Legs need migration 038 — saved everything else')
    }
    router.push(`/trips/${params.id}`)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${form.name}"? This permanently removes the trip and all of its days.`)) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await supabase.from('trips').delete().eq('id', params.id).eq('user_id', user.id)
    if (error) { setSaving(false); return showToast('Could not delete trip') }
    router.push('/trips')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-6 py-10 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 w-full rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <nav className="text-sm text-gray-500 mb-6">
            <ol className="flex items-center gap-1.5">
              <li><Link href="/" className="hover:text-blue-600">Dashboard</Link></li>
              <li className="text-gray-300">/</li>
              <li><Link href="/trips" className="hover:text-blue-600">Trips</Link></li>
              <li className="text-gray-300">/</li>
              <li><Link href={`/trips/${params.id}`} className="hover:text-blue-600">{form.name || 'Trip'}</Link></li>
              <li className="text-gray-300">/</li>
              <li className="text-gray-900 font-medium">Settings</li>
            </ol>
          </nav>
          <h1 className="text-4xl font-bold text-gray-900">Trip Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className={labelCls}>Trip name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Destination</label>
            <input
              type="text"
              value={form.destination}
              onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
              placeholder="e.g. Tokyo, Japan"
              className={inputCls}
            />
          </div>
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Start date *</label>
                <input
                  required
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>End date *</label>
                <input
                  required
                  type="date"
                  value={form.end_date}
                  min={form.start_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Days outside the new range are hidden, not deleted.</p>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What's this trip about?"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Legs — group the trip's days into named stretches in the sidebar */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Legs</label>
              <button
                type="button"
                onClick={() => setLegs(ls => [...ls, { ...emptyLeg(), from: ls[ls.length - 1]?.to || form.start_date, to: form.end_date }])}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Add leg
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2.5">Split the trip into stretches (e.g. Tokyo → Kyoto → Seoul). Each leg groups its days in the sidebar.</p>
            {legs.length === 0 && (
              <p className="text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-3 text-center">No legs — days show as one flat list.</p>
            )}
            <div className="space-y-2">
              {legs.map((leg, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-2.5 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={leg.emoji}
                      onChange={e => updateLeg(i, { emoji: e.target.value })}
                      placeholder="🗼"
                      aria-label="Leg emoji"
                      className={`${inputCls} !w-14 text-center`}
                    />
                    <input
                      type="text"
                      value={leg.name}
                      onChange={e => updateLeg(i, { name: e.target.value })}
                      placeholder="Leg name, e.g. Tokyo"
                      aria-label="Leg name"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setLegs(ls => ls.filter((_, li) => li !== i))}
                      aria-label="Remove leg"
                      className="flex-shrink-0 px-2 text-gray-300 hover:text-red-500 transition"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={leg.from}
                      min={form.start_date}
                      max={form.end_date}
                      onChange={e => updateLeg(i, { from: e.target.value })}
                      aria-label="Leg start date"
                      className={inputCls}
                    />
                    <input
                      type="date"
                      value={leg.to}
                      min={leg.from || form.start_date}
                      max={form.end_date}
                      onChange={e => updateLeg(i, { to: e.target.value })}
                      aria-label="Leg end date"
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href={`/trips/${params.id}`}
              className="flex-1 text-center border border-gray-300 text-gray-700 font-medium px-5 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>

        {/* Danger zone */}
        <div className="mt-10 rounded-xl border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-600 mb-1">Danger zone</p>
          <p className="text-xs text-gray-500 mb-3">Deleting a trip removes all of its days. This cannot be undone.</p>
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-sm font-medium text-red-500 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 active:bg-red-100 transition disabled:opacity-50"
          >
            Delete trip
          </button>
        </div>
      </div>

      {/* Transient toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[60] bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  )
}
