'use client'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  DndContext, PointerSensor, useSensor, useSensors, useDraggable, closestCenter,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { type ParsedSection, sectionDataToDisplay, parseSectionsFromNotes, notesToSectionData } from '@/lib/trips/trip-sections'
import { type EditorSection, ACTIVITY_TYPES, MEAL_TYPES, HIDE_TITLE_TYPES, parseCoords } from '@/lib/trips/trip-utils'
import { SectionCard, HotelCard, DayMapCollapsible, LocationPreview } from '@/app/components/trips/SectionCards'
import { SectionEditorCard, AddSectionPicker } from '@/app/components/trips/SectionEditorCard'
import type { LocationPoint } from '@/app/components/trips/DayLocationMapClient'
import TripHotels, { type TripHotel } from '@/app/components/trips/TripHotels'
import TripSidebar, { type SidePanel } from '@/app/components/trips/TripSidebar'
import EditPanel from '@/app/components/trips/EditPanel'
import { findMeta } from '@/lib/trips/trip-sections'

type DayData = { title: string | null; notes: string | null; date: string }

let _idCounter = 0
function newId() { return `s${++_idCounter}` }

async function generateMissingTitles(items: EditorSection[]): Promise<EditorSection[]> {
  const candidates = items.filter(s => {
    const t = s.type.toUpperCase()
    return !HIDE_TITLE_TYPES.has(t) && !s.title && s.lines.filter(Boolean).some(l => l.trim())
  })
  if (!candidates.length) return items
  try {
    const res = await fetch('/api/trips/section-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidates.map(s => ({ type: s.type, lines: s.lines, timeOverride: s.timeOverride, duration: s.duration }))),
    })
    const { titles }: { titles: string[] } = await res.json()
    if (!Array.isArray(titles)) return items
    const titleMap = new Map(candidates.map((c, i) => [c._id, titles[i] || undefined]))
    return items.map(item => titleMap.has(item._id) ? { ...item, title: titleMap.get(item._id) } : item)
  } catch { return items }
}

// A timeline card you can drag (by its grip) onto another day in the sidebar.
function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { type: 'card' } })
  return (
    <div ref={setNodeRef} className={`flex items-stretch gap-1 ${isDragging ? 'opacity-50' : ''}`}>
      <button {...attributes} {...listeners} title="Drag to another day"
        className="px-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex items-center flex-shrink-0">⠿</button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export default function TripDayPage() {
  const params = useParams<{ id: string; date: string }>()
  const [trip, setTrip] = useState<{ name: string; start_date: string; end_date: string } | null>(null)
  const [days, setDays] = useState<DayData[]>([])
  const [allDates, setAllDates] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [sectionItems, setSectionItems] = useState<EditorSection[]>([])
  const [hotels, setHotels] = useState<TripHotel[]>([])
  const [userId, setUserId] = useState<string>('')
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  const [prevDate, setPrevDate] = useState<string | null>(null)
  const [nextDate, setNextDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<EditorSection | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [showAddPicker, setShowAddPicker] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const [{ data: tripData }, { data: allDays }, { data: hotelData }] = await Promise.all([
        supabase.from('trips').select('name, start_date, end_date').eq('id', params.id).single(),
        supabase.from('trip_days').select('date, title, notes').eq('trip_id', params.id).order('date'),
        supabase.from('trip_hotels').select('*').eq('trip_id', params.id).order('check_in'),
      ])

      setTrip(tripData)
      setDays(allDays ?? [])
      setHotels(hotelData ?? [])

      const generated: string[] = []
      if (tripData) {
        const cur = new Date(tripData.start_date + 'T00:00:00')
        const end = new Date(tripData.end_date + 'T00:00:00')
        while (cur <= end) {
          const y = cur.getFullYear()
          const m = String(cur.getMonth() + 1).padStart(2, '0')
          const d = String(cur.getDate()).padStart(2, '0')
          generated.push(`${y}-${m}-${d}`)
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
        const sectionData = notesToSectionData(current.notes)
        const items = sectionData.map(s => ({ ...s, _id: newId() }))
        const itemsWithTitles = await generateMissingTitles(items)
        setSectionItems(itemsWithTitles)
        if (window.innerWidth >= 1024) {
          setExpandedSections(new Set(itemsWithTitles.map(s => s._id)))
        }

        if (itemsWithTitles !== items) {
          const notesJson = JSON.stringify(itemsWithTitles.map(({ _id, ...s }) => s))
          await supabase.from('trip_days').upsert(
            { trip_id: params.id, user_id: user.id, date: params.date,
              title: current.title || null, notes: notesJson },
            { onConflict: 'trip_id,date' }
          )
        }
      }
      setLoading(false)
    }
    load()

    // Re-fetch when the tab becomes visible again (e.g. after editing on iOS).
    // 1.5 s delay lets any in-flight web saves complete before we overwrite state.
    let visibilityTimer: ReturnType<typeof setTimeout>
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        visibilityTimer = setTimeout(load, 1500)
      } else {
        clearTimeout(visibilityTimer)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(visibilityTimer)
    }
  }, [params.id, params.date])

  const save = async (overrideItems?: EditorSection[]) => {
    if (saving) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const items = overrideItems ?? sectionItems
    const notesJson = items.length > 0 ? JSON.stringify(items.map(({ _id, ...s }) => s)) : null
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: params.date, title: title || null, notes: notesJson },
      { onConflict: 'trip_id,date' }
    )
    setSaving(false)
    setSaved(true)
    setEditingId(null)
    setTimeout(() => setSaved(false), 2000)
  }

  const startEdit = async (itemId: string) => {
    if (editingId && editingId !== itemId) {
      setEditSnapshot(null)
      const withTitles = await generateMissingTitles(sectionItems)
      setSectionItems(withTitles)
      await save(withTitles)
    }
    const item = sectionItems.find(s => s._id === itemId)
    if (item) setEditSnapshot({ ...item, lines: [...item.lines] })
    setEditingId(itemId)
  }

  const cancelEdit = () => {
    if (editSnapshot) {
      setSectionItems(s => s.map(item => item._id === editSnapshot._id ? editSnapshot : item))
      setEditSnapshot(null)
    }
    setEditingId(null)
  }

  const toggleSectionExpanded = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allExpanded = sectionItems.length > 0 && sectionItems.every(s => expandedSections.has(s._id))
  const toggleAllExpanded = () => {
    setExpandedSections(allExpanded ? new Set() : new Set(sectionItems.map(s => s._id)))
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
    const id = newId()
    const newSection: EditorSection = { _id: id, type, lines: [] }
    setSectionItems(s => {
      if (afterIndex === undefined) return [...s, newSection]
      const next = [...s]
      next.splice(afterIndex + 1, 0, newSection)
      return next
    })
    setInsertAt(null)
    setShowAddPicker(false)
    setEditingId(id)
  }

  const updateSection = (id: string, updates: Partial<EditorSection>) => {
    setSectionItems(s => s.map(item => item._id === id ? { ...item, ...updates } : item))
  }

  const handleMoveToDay = async (sectionId: string, targetDate: string, currentItems: EditorSection[]) => {
    const section = currentItems.find(s => s._id === sectionId)
    if (!section) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const newItems = currentItems.filter(s => s._id !== sectionId)
    const notesJson = newItems.length > 0 ? JSON.stringify(newItems.map(({ _id, ...s }) => s)) : null
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: params.date, title: title || null, notes: notesJson },
      { onConflict: 'trip_id,date' }
    )
    setSectionItems(newItems)
    setEditingId(null)
    setEditSnapshot(null)

    const { data: targetDay } = await supabase.from('trip_days')
      .select('notes, title')
      .eq('trip_id', params.id)
      .eq('date', targetDate)
      .maybeSingle()
    const targetSections = targetDay ? notesToSectionData(targetDay.notes) : []
    const { _id, ...sectionData } = section
    const newTargetNotes = JSON.stringify([...targetSections, sectionData])
    await supabase.from('trip_days').upsert(
      { trip_id: params.id, user_id: user.id, date: targetDate,
        title: (targetDay as any)?.title || null, notes: newTargetNotes },
      { onConflict: 'trip_id,date' }
    )

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const dayOptions = allDates.map((date, i) => {
    const t = days.find(d => d.date === date)?.title
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return { date, label: `Day ${i + 1} — ${dateLabel}${t ? ` · ${t}` : ''}` }
  })

  const displaySectionsRaw = sectionItems.map(item => sectionDataToDisplay(item))
  const displaySections = displaySectionsRaw.filter((x): x is ParsedSection => x !== null)

  const dayLocations = useMemo((): LocationPoint[] => {
    const locs: LocationPoint[] = []
    for (const item of sectionItems) {
      const t = item.type.toUpperCase()
      const lines = item.lines.map(l => l.trim()).filter(Boolean)
      const coords = parseCoords(item.coords)
      if (!coords) continue
      if (t === 'HOTEL' && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#8b5cf6', coords })
      } else if (ACTIVITY_TYPES.has(t) && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#3b82f6', coords })
      } else if (MEAL_TYPES.has(t) && lines[0]) {
        locs.push({ label: lines[0], query: '', color: '#f59e0b', coords })
      }
    }
    return locs
  }, [sectionItems])

  const reloadHotels = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('trip_hotels').select('*').eq('trip_id', params.id).order('check_in')
    setHotels(data ?? [])
  }

  // Swap two days' entire itinerary content (hotels are date-pinned, untouched).
  const swapDays = async (dateA: string, dateB: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: rows } = await supabase.from('trip_days')
      .select('date, title, notes, confirmed_sections, location')
      .eq('trip_id', params.id).in('date', [dateA, dateB])
    const content = (d: string) => {
      const r = rows?.find((x: any) => x.date === d) as any
      return { title: r?.title ?? null, notes: r?.notes ?? null, confirmed_sections: r?.confirmed_sections ?? null, location: r?.location ?? null }
    }
    const cA = content(dateA), cB = content(dateB)
    await supabase.from('trip_days').upsert([
      { trip_id: params.id, user_id: user.id, date: dateA, ...cB },
      { trip_id: params.id, user_id: user.id, date: dateB, ...cA },
    ], { onConflict: 'trip_id,date' })
    setDays(ds => ds.map(d =>
      d.date === dateA ? { ...d, title: cB.title, notes: cB.notes } :
      d.date === dateB ? { ...d, title: cA.title, notes: cA.notes } : d))
    if (dateA === params.date || dateB === params.date) {
      const nc = dateA === params.date ? cB : cA
      setTitle(nc.title ?? '')
      setSectionItems(notesToSectionData(nc.notes).map(s => ({ ...s, _id: newId() })))
    }
  }

  // Save + close the edit panel (used by the panel's ✕/backdrop and Done).
  const commitEdit = async () => {
    setEditSnapshot(null)
    const withTitles = await generateMissingTitles(sectionItems)
    setSectionItems(withTitles)
    await save(withTitles) // save() clears editingId
  }

  // Drag-and-drop: swap days, or drop a section card onto another day.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragType, setDragType] = useState<'day' | 'card' | null>(null)
  const [overDate, setOverDate] = useState<string | null>(null)
  const onDragStart = (e: DragStartEvent) => setDragType((e.active.data.current?.type as 'day' | 'card') ?? null)
  const onDragOver = (e: DragOverEvent) => {
    if (e.active.data.current?.type === 'card') {
      setOverDate(e.over?.data.current?.type === 'day' ? String(e.over.id) : null)
    }
  }
  const onDragEnd = async (e: DragEndEvent) => {
    const t = e.active.data.current?.type
    const overType = e.over?.data.current?.type
    setDragType(null); setOverDate(null)
    if (t === 'day' && overType === 'day' && e.over && e.active.id !== e.over.id) {
      await swapDays(String(e.active.id), String(e.over.id))
    } else if (t === 'card' && overType === 'day' && e.over && String(e.over.id) !== params.date) {
      await handleMoveToDay(String(e.active.id), String(e.over.id), sectionItems)
    }
  }

  // Hotels covering the current day, with a check-in/check-out badge on boundaries.
  const dayHotels = useMemo(() => {
    return hotels
      .filter(h => h.check_in <= params.date && params.date <= h.check_out)
      .map(h => ({
        hotel: h,
        checkpoint: (params.date === h.check_in ? 'in' : params.date === h.check_out ? 'out' : null) as 'in' | 'out' | null,
      }))
  }, [hotels, params.date])

  const hotelMeta = findMeta('HOTEL')

  // Past meals, ranked (for the "What we ate" panel)
  const ate = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const out: { date: string; name: string; rating?: number }[] = []
    for (const d of days) {
      if (new Date(d.date + 'T00:00:00') >= today || !d.notes) continue
      for (const s of notesToSectionData(d.notes)) {
        if (!MEAL_TYPES.has(s.type.toUpperCase())) continue
        const name = s.lines.find(l => l.trim() && !l.trim().startsWith('-'))?.trim()
        if (name) out.push({ date: d.date, name, rating: s.rating })
      }
    }
    return out.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.date.localeCompare(b.date))
  }, [days])

  const syncCalendar = async () => {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/trips/sync-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: params.date }),
      })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
        return
      }
      if (data.sections && data.sections.length > 0) {
        const newItems = data.sections.map((s: any) => ({ ...s, _id: newId() }))
        const updated = [...sectionItems, ...newItems]
        setSectionItems(updated)
        await save(updated)
      } else {
        alert('No events found for this day in Google Calendar.')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const dayNumber = trip
    ? Math.round((new Date(params.date + 'T00:00:00').getTime() - new Date(trip.start_date + 'T00:00:00').getTime()) / 86400000) + 1
    : null

  const dateLabel = new Date(params.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading...</div>
  }

  const dayTitleMap = new Map(days.map(d => [d.date, d.title]))

  const todayLocal = (() => {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()

  return (
   <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setDragType(null); setOverDate(null) }}>
    <div className="min-h-screen bg-white flex">

      {/* Sidebar */}
      {trip && (
        <TripSidebar
          tripId={params.id}
          tripName={trip.name}
          startDate={trip.start_date}
          endDate={trip.end_date}
          allDates={allDates}
          days={days}
          activeDate={params.date}
          todayLocal={todayLocal}
          shareUrl={`${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/share/${params.id}`}
          hotelCount={hotels.length}
          ateCount={ate.length}
          activePanel={sidePanel}
          onOpenPanel={setSidePanel}
          dragType={dragType}
          overDate={overDate}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 lg:ml-72 transition-[margin] duration-300 ${editingId ? 'lg:mr-[460px]' : ''}`}>

        {/* Sticky header */}
        <div className="bg-white border-b border-gray-200 sticky top-[49px] z-10">
          <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex-shrink-0 text-xs font-bold bg-blue-600 text-white rounded-full px-2.5 py-1 whitespace-nowrap">
                Day {dayNumber}
              </span>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 leading-tight truncate">
                  {title || 'Untitled day'}
                </h1>
                <p className="text-xs text-gray-400 truncate">
                  {dateLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {prevDate && (
                <Link href={`/trips/${params.id}/${prevDate}`} className="border border-gray-200 text-gray-500 font-medium px-2.5 py-1 rounded-lg hover:bg-gray-50 transition text-xs">
                  ← Prev
                </Link>
              )}
              {nextDate && (
                <Link href={`/trips/${params.id}/${nextDate}`} className="border border-gray-200 text-gray-500 font-medium px-2.5 py-1 rounded-lg hover:bg-gray-50 transition text-xs">
                  Next →
                </Link>
              )}
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
              {saved && !saving && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">

          {/* Always-visible title edit */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => save()}
            placeholder="Day title, e.g. Arrival in Tokyo"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* Hotels covering this day (managed in the sidebar) */}
          {hotelMeta && dayHotels.length > 0 && (
            <div className="space-y-2">
              {dayHotels.map(({ hotel, checkpoint }) => (
                <HotelCard
                  key={hotel.id}
                  meta={hotelMeta}
                  lines={[hotel.name, hotel.location ?? ''].filter(Boolean)}
                  coords={hotel.coords ?? undefined}
                  checkpoint={checkpoint}
                />
              ))}
            </div>
          )}

          {/* Collapsible day map */}
          {dayLocations.length > 0 && <DayMapCollapsible locations={dayLocations} />}

          {/* Sections */}
          {displaySections.length > 0 ? (
            <>
              <div>
                {sectionItems.map((item, i) => {
                  const s = displaySectionsRaw[i]
                  if (!s) return null
                  const isLast = i === sectionItems.length - 1
                  return (
                    <div key={item._id}>
                      <div className="flex gap-2">
                        <div className="flex flex-col items-end flex-shrink-0 w-14 pt-3">
                          {s.pinned && <span className="text-xs leading-none mb-0.5">⭐</span>}
                          <span className="text-[11px] font-semibold text-gray-400 leading-none whitespace-nowrap">{s.timeOverride ?? s.meta.time}</span>
                        </div>
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full mt-3 flex-shrink-0 ring-2 ring-white shadow-sm" style={{ backgroundColor: s.meta.dotColor }} />
                          {!isLast && (
                            <div className="flex-1 mt-1" style={{
                              width: '2px', minHeight: '16px',
                              background: s.meta.travel
                                ? `repeating-linear-gradient(to bottom, ${s.meta.dotColor} 0, ${s.meta.dotColor} 4px, transparent 4px, transparent 8px)`
                                : s.meta.transit
                                ? 'repeating-linear-gradient(to bottom, #818cf8 0, #818cf8 4px, transparent 4px, transparent 8px)'
                                : s.meta.drive
                                ? 'repeating-linear-gradient(to bottom, #fb923c 0, #fb923c 4px, transparent 4px, transparent 8px)'
                                : '#e2e8f0',
                            }} />
                          )}
                        </div>
                        <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-2'}`}>
                          <DraggableCard id={item._id}>
                            {(s.meta.hotel || s.meta.car)
                              ? <HotelCard meta={s.meta} lines={s.lines} skipped={item.skipped} onEdit={() => startEdit(item._id)} />
                              : <SectionCard meta={s.meta} lines={s.lines} title={item.title} type={item.type} place={item.place} coords={item.coords} rating={item.rating} skipped={item.skipped} onOpen={() => startEdit(item._id)} />
                            }
                          </DraggableCard>
                        </div>
                      </div>
                      {i < sectionItems.length - 1 && (
                        insertAt === i ? (
                          <div className="my-1.5 ml-16">
                            <AddSectionPicker onAdd={type => addSection(type, i)} onCancel={() => setInsertAt(null)} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 ml-16" style={{ height: '16px' }}>
                            <div className="flex-1 h-px bg-gray-100" />
                            <button onClick={() => setInsertAt(i)} className="text-xs text-gray-300 hover:text-blue-500 transition px-1.5 rounded-full hover:bg-blue-50 leading-none">
                              +
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
            : (
              <button
                onClick={() => setShowAddPicker(true)}
                className="w-full border border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:text-blue-500 hover:border-blue-300 transition"
              >
                + Add section
              </button>
            )
          }

        </div>
      </div>

      {/* Hotels / What-we-ate detail — fills the area to the right of the sidebar */}
      {sidePanel && (
        <div className="fixed top-[49px] left-0 lg:left-72 right-0 bottom-0 bg-white z-30 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="text-base font-bold text-gray-900">{sidePanel === 'hotels' ? '🏨 Hotels' : '🍴 What we ate'}</h2>
            <button onClick={() => setSidePanel(null)} className="text-sm text-gray-400 hover:text-gray-700">✕ Close</button>
          </div>
          <div className="max-w-2xl mx-auto p-4">
            {sidePanel === 'hotels' && trip && (
              <TripHotels tripId={params.id} userId={userId} hotels={hotels} defaultStart={trip.start_date} defaultEnd={trip.end_date} onChange={reloadHotels} />
            )}
            {sidePanel === 'ate' && (
              <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                {ate.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">No meals logged yet.</p>}
                {ate.map((m, i) => {
                  const rc = m.rating == null ? '' : m.rating >= 8 ? 'bg-green-500 text-white' : m.rating >= 5 ? 'bg-amber-400 text-white' : 'bg-red-400 text-white'
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm text-gray-800 font-medium flex-1 min-w-0 truncate">{m.name}</span>
                      {m.rating != null && <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${rc}`}>{m.rating}/10</span>}
                      <span className="text-xs text-gray-400 flex-shrink-0">{new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-out edit panel */}
      <EditPanel
        open={!!editingId}
        onClose={commitEdit}
        title={(() => {
          const it = sectionItems.find(s => s._id === editingId)
          return it ? (it.title || it.lines.find(l => l.trim() && !l.trim().startsWith('-')) || findMeta(it.type)?.label || 'Edit') : 'Edit'
        })()}
      >
        {(() => {
          const it = sectionItems.find(s => s._id === editingId)
          if (!it) return null
          const idx = sectionItems.findIndex(s => s._id === it._id)
          const name = it.title || it.lines.find(l => l.trim() && !l.trim().startsWith('-')) || undefined
          return (
            <div className="space-y-3">
              <LocationPreview coords={it.coords} name={name} />
              <SectionEditorCard
                section={it}
                onChange={updates => updateSection(it._id, updates)}
                onDelete={async () => { const next = sectionItems.filter(s => s._id !== it._id); setSectionItems(next); setEditingId(null); setEditSnapshot(null); await save(next) }}
                onMoveUp={idx > 0 ? () => moveSection(idx, -1) : undefined}
                onMoveDown={idx < sectionItems.length - 1 ? () => moveSection(idx, 1) : undefined}
                onCancel={cancelEdit}
                onDone={commitEdit}
                dayOptions={dayOptions}
                currentDate={params.date}
                onMoveToDay={async (targetDate) => {
                  setEditSnapshot(null)
                  const withTitles = await generateMissingTitles(sectionItems)
                  setSectionItems(withTitles)
                  await handleMoveToDay(it._id, targetDate, withTitles)
                }}
              />
            </div>
          )
        })()}
      </EditPanel>
    </div>
   </DndContext>
  )
}
