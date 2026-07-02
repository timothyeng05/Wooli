'use client'
import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, closestCenter,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { type ParsedSection, sectionDataToDisplay, parseSectionsFromNotes, notesToSectionData } from '@/lib/trips/trip-sections'
import { type EditorSection, ACTIVITY_TYPES, MEAL_TYPES, ADD_SECTION_GROUPS, parseCoords, ratingStyle, ratingLabel, RATING_SCALE } from '@/lib/trips/trip-utils'
import { SectionCard, HotelCard, DayMapCollapsible, LocationPreview } from '@/app/components/trips/SectionCards'
import { SectionEditorCard, AddSectionPicker } from '@/app/components/trips/SectionEditorCard'
import DayLocationMap, { type LocationPoint } from '@/app/components/trips/DayLocationMapClient'
import TripHotels, { type TripHotel } from '@/app/components/trips/TripHotels'
import TripSidebar, { type SidePanel } from '@/app/components/trips/TripSidebar'
import EditPanel from '@/app/components/trips/EditPanel'
import { findMeta } from '@/lib/trips/trip-sections'

type DayData = { title: string | null; notes: string | null; date: string }

let _idCounter = 0
function newId() { return `s${++_idCounter}` }

function fmtDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// A timeline card you can drag (by its grip) onto another day in the sidebar.
function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { type: 'card' } })
  return (
    <div ref={setNodeRef} className={`flex items-stretch gap-0 lg:gap-1 ${isDragging ? 'opacity-50' : ''}`}>
      {/* Grip is desktop-only — moving a card to another day on mobile uses the
          "Move to day" control in the edit sheet (the day list lives in a drawer). */}
      <button {...attributes} {...listeners} title="Drag onto a day in the sidebar to move"
        className="hidden lg:flex px-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing items-center flex-shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">⠿</button>
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showAddSheet, setShowAddSheet] = useState(false)
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
  const [toast, setToast] = useState<string | null>(null)
  const [showDayPicker, setShowDayPicker] = useState(false)
  const router = useRouter()
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dayPickerScroll = useRef<HTMLDivElement>(null)
  // True while an editor/sheet/drawer is open. The visibility re-fetch must not
  // fire then — it reassigns section _ids and would orphan the open editor
  // (blank panel) and clobber whatever the user is typing.
  const busyRef = useRef(false)
  const showToast = (msg: string) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

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
        setSectionItems(items)
        if (window.innerWidth >= 1024) {
          setExpandedSections(new Set(items.map(s => s._id)))
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
        visibilityTimer = setTimeout(() => { if (!busyRef.current) load() }, 1500)
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

  // Reset scroll and close the mobile drawer after navigating to a day.
  useEffect(() => { setSidebarOpen(false); window.scrollTo(0, 0) }, [params.date])

  // Lock background scroll while any sheet / drawer / panel is open (mobile).
  useEffect(() => {
    const open = !!editingId || !!sidePanel || sidebarOpen || showAddSheet || showDayPicker
    busyRef.current = open
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [editingId, sidePanel, sidebarOpen, showAddSheet, showDayPicker])

  // Center the current day when the day picker opens.
  useEffect(() => {
    if (!showDayPicker) return
    const c = dayPickerScroll.current
    const el = c?.querySelector(`[data-pd="${params.date}"]`) as HTMLElement | null
    if (c && el) { const er = el.getBoundingClientRect(), cr = c.getBoundingClientRect(); c.scrollTop += (er.top - cr.top) - 140 }
  }, [showDayPicker, params.date])

  // xl-and-up flag for the right rail. Leaflet sizes itself once at mount, so the
  // rail map must never mount inside a display:none container (gray tiles when it
  // becomes visible) — mount it only when the rail is actually shown.
  const [railXl, setRailXl] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const update = () => setRailXl(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Desktop: ←/→ arrow keys page between days (the keyboard twin of swipe nav).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (editingId || sidePanel || sidebarOpen || showAddSheet || showDayPicker || insertAt !== null || showAddPicker) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key === 'ArrowLeft' && prevDate) router.push(`/trips/${params.id}/${prevDate}`)
      else if (e.key === 'ArrowRight' && nextDate) router.push(`/trips/${params.id}/${nextDate}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevDate, nextDate, editingId, sidePanel, sidebarOpen, showAddSheet, showDayPicker, insertAt, showAddPicker, params.id, router])

  // Swipe left/right on the day's content to move to the next / previous day.
  const swipeNav = {
    onTouchStart: (e: React.TouchEvent) => {
      if (editingId || sidePanel || sidebarOpen || showAddSheet) { touchStart.current = null; return }
      const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = touchStart.current; touchStart.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x, dy = t.clientY - s.y
      if (Math.abs(dx) < 64 || Math.abs(dy) > Math.abs(dx) * 0.8) return
      if (dx < 0 && nextDate) router.push(`/trips/${params.id}/${nextDate}`)
      else if (dx > 0 && prevDate) router.push(`/trips/${params.id}/${prevDate}`)
    },
  }

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
      await save()
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
    showToast(`Moved to Day ${allDates.indexOf(targetDate) + 1}`)
    setTimeout(() => setSaved(false), 2000)
  }

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
    showToast('Days swapped')
  }

  // Save + close the edit panel (used by the panel's ✕/backdrop and Done).
  const commitEdit = async () => {
    setEditSnapshot(null)
    await save() // save() clears editingId
  }

  // Drag-and-drop: swap days, or drop a section card onto another day.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragType, setDragType] = useState<'day' | 'card' | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [overDate, setOverDate] = useState<string | null>(null)       // card → day target (highlight)
  const [overDayDate, setOverDayDate] = useState<string | null>(null) // day → day target (blue line)
  const onDragStart = (e: DragStartEvent) => {
    setDragType((e.active.data.current?.type as 'day' | 'card') ?? null)
    setActiveDragId(String(e.active.id))
  }
  const onDragOver = (e: DragOverEvent) => {
    const t = e.active.data.current?.type
    const overType = e.over?.data.current?.type
    if (t === 'card') {
      setOverDate(overType === 'day' ? String(e.over!.id) : null)
    } else if (t === 'day') {
      setOverDayDate(overType === 'day' && e.over && e.over.id !== e.active.id ? String(e.over.id) : null)
    }
  }
  const clearDrag = () => { setDragType(null); setActiveDragId(null); setOverDate(null); setOverDayDate(null) }
  const onDragEnd = async (e: DragEndEvent) => {
    const t = e.active.data.current?.type
    const overType = e.over?.data.current?.type
    clearDrag()
    if (t === 'day' && overType === 'day' && e.over && e.active.id !== e.over.id) {
      await swapDays(String(e.active.id), String(e.over.id))
    } else if (t === 'card' && overType === 'day' && e.over && String(e.over.id) !== params.date) {
      await handleMoveToDay(String(e.active.id), String(e.over.id), sectionItems)
    }
  }

  // The card preview shown floating under the cursor while dragging.
  const activeDragItem = activeDragId ? sectionItems.find(s => s._id === activeDragId) : null
  const activeDragDisplay = activeDragItem ? sectionDataToDisplay(activeDragItem) : null

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
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse lg:hidden" />
          <div className="h-6 w-14 rounded-full bg-gray-100 animate-pulse" />
          <div className="h-5 w-40 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
          <div className="h-11 w-full rounded-lg bg-gray-100 animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-12 h-4 rounded bg-gray-100 animate-pulse mt-2.5 flex-shrink-0" />
              <div className="flex-1 h-16 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const dayTitleMap = new Map(days.map(d => [d.date, d.title]))

  const todayLocal = (() => {
    const t = new Date()
    const y = t.getFullYear()
    const m = String(t.getMonth() + 1).padStart(2, '0')
    const d = String(t.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })()
  const todayInRange = allDates.includes(todayLocal)

  return (
   <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={clearDrag}>
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
          onOpenPanel={(p) => { setSidePanel(p); setSidebarOpen(false) }}
          dragType={dragType}
          overDate={overDate}
          overDayDate={overDayDate}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 min-w-0 lg:ml-72 transition-[margin] duration-300 ${editingId ? 'xl:mr-[460px]' : ''}`}>

        {/* Sticky header */}
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[49px] z-10">
          <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex-shrink-0 -ml-1 p-1.5 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
                aria-label="Open trip menu"
              >
                <span className="block w-5 h-5 text-lg leading-none">☰</span>
              </button>
              <button
                onClick={() => setShowDayPicker(true)}
                aria-label="Jump to day"
                className="lg:pointer-events-none flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold bg-blue-600 text-white rounded-full pl-2.5 pr-2 py-1 whitespace-nowrap active:scale-95 transition"
              >
                Day {dayNumber}<span className="text-blue-200 font-semibold">/{allDates.length}</span><span className="lg:hidden text-blue-200 font-semibold"> ▾</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-base font-bold text-gray-900 leading-tight truncate">
                  {title || 'Untitled day'}
                </h1>
                <p className="text-xs sm:text-xs text-gray-500 truncate">
                  {dateLabel}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {saving && <span className="text-xs text-gray-400">Saving…</span>}
              {saved && !saving && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
              {prevDate && (
                <Link href={`/trips/${params.id}/${prevDate}`} aria-label="Previous day" title="Previous day (←)" className="hidden sm:inline-block border border-gray-200 text-gray-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition text-xs">
                  ← Prev
                </Link>
              )}
              {nextDate && (
                <Link href={`/trips/${params.id}/${nextDate}`} aria-label="Next day" title="Next day (→)" className="hidden sm:inline-block border border-gray-200 text-gray-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition text-xs">
                  Next →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* At xl the wrapper becomes a two-column grid (timeline + right rail). While the
            edit drawer pushes the layout (xl:mr-[460px]) the grid must go too — a hidden
            aside still reserves its ≥300px track and would crush the timeline. */}
        <div {...swipeNav} className={`max-w-2xl mx-auto px-5 sm:px-6 pt-4 sm:pt-6 pb-28 md:pb-10 ${editingId ? '' : 'xl:max-w-[1160px] xl:grid xl:grid-cols-[minmax(0,42rem)_minmax(300px,380px)] xl:gap-8'}`}>
         <div className="space-y-3 sm:space-y-4 min-w-0">

          {/* Always-visible title edit */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => save()}
            autoCapitalize="sentences"
            enterKeyHint="done"
            placeholder="Day title, e.g. Arrival in Tokyo"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 sm:py-2 text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* Hotels covering this day (managed in the sidebar) — moves to the right rail at xl.
              While editing the rail is gone (layout falls back to the centered column), so show them here. */}
          {hotelMeta && dayHotels.length > 0 && (
            <div className={`space-y-2 ${editingId ? '' : 'xl:hidden'}`}>
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

          {/* Collapsible day map — the rail shows it always-open at xl (except while editing, when the rail is gone) */}
          {dayLocations.length > 0 && <div className={editingId ? '' : 'xl:hidden'}><DayMapCollapsible locations={dayLocations} /></div>}

          {/* Sections */}
          {displaySections.length > 0 ? (
            <>
              <div>
                {sectionItems.map((item, i) => {
                  const s = displaySectionsRaw[i]
                  if (!s) return null
                  const isLast = i === sectionItems.length - 1
                  return (
                    <div key={item._id} className="group">
                      <div className="flex gap-3 sm:gap-2">
                        {/* Time rail — desktop only; on mobile it wastes width, so
                            the time/⭐ move inline into the card instead. */}
                        <div className="hidden sm:flex flex-col items-end flex-shrink-0 w-16 pt-3">
                          <div className="flex items-center justify-end gap-1">
                            {s.pinned && <span className="text-[11px] leading-none">⭐</span>}
                            <span className="text-xs font-semibold text-gray-400 leading-none whitespace-nowrap">{s.timeOverride ?? s.meta.time}</span>
                          </div>
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
                              ? <HotelCard meta={s.meta} lines={s.lines} skipped={item.skipped} pinned={s.pinned} onEdit={() => startEdit(item._id)} />
                              : <SectionCard meta={s.meta} lines={s.lines} title={item.title} type={item.type} place={item.place} coords={item.coords} rating={item.rating} skipped={item.skipped} pinned={s.pinned} onOpen={() => startEdit(item._id)} />
                            }
                          </DraggableCard>
                        </div>
                      </div>
                      {i < sectionItems.length - 1 && (
                        insertAt === i ? (
                          <div className="my-1.5 ml-[22px] sm:ml-[4.5rem]">
                            <AddSectionPicker onAdd={type => addSection(type, i)} onCancel={() => setInsertAt(null)} />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 ml-[22px] sm:ml-[4.5rem] py-0.5">
                            <div className="flex-1 h-px bg-gray-100" />
                            <button onClick={() => setInsertAt(i)} aria-label="Insert section here" title="Insert section here"
                              className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 text-base sm:text-xs text-gray-300 hover:text-blue-500 rounded-full hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition leading-none">
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
          ) : (
            <div className="text-center py-10 cursor-pointer" onClick={() => setShowAddPicker(true)}>
              <div className="text-4xl mb-2">🗺️</div>
              <p className="text-sm text-gray-500 font-medium">No plans yet for this day</p>
              <p className="text-xs text-gray-400 mt-0.5">
                <span className="lg:hidden">Tap the ＋ button to add transit, an activity, or a meal.</span>
                <span className="hidden lg:inline">Use “+ Add section” below to add transit, an activity, or a meal.</span>
              </p>
            </div>
          )}

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

         {/* Right rail (xl) — day map always open + hotels; hidden while the edit drawer pushes the layout */}
         <aside className={`hidden ${editingId ? '' : 'xl:block'}`}>
           <div className="sticky top-[110px] space-y-3">
             {railXl && !editingId && dayLocations.length > 0 && (
               <div className="rounded-xl border border-gray-100 overflow-hidden">
                 <DayLocationMap locations={dayLocations} />
               </div>
             )}
             {hotelMeta && dayHotels.map(({ hotel, checkpoint }) => (
               <HotelCard
                 key={hotel.id}
                 meta={hotelMeta}
                 lines={[hotel.name, hotel.location ?? ''].filter(Boolean)}
                 coords={hotel.coords ?? undefined}
                 checkpoint={checkpoint}
               />
             ))}
           </div>
         </aside>

        </div>
      </div>

      {/* Hotels / What-we-ate detail — fills the area to the right of the sidebar */}
      {sidePanel && (
        <div className="fixed top-[49px] left-0 lg:left-72 right-0 bottom-0 bg-white z-30 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="text-base font-bold text-gray-900">{sidePanel === 'hotels' ? '🏨 Hotels' : '🍴 What we ate'}</h2>
            <button onClick={() => setSidePanel(null)} className="text-sm text-gray-400 hover:text-gray-700">✕ Close</button>
          </div>
          <div className="max-w-2xl mx-auto p-4 pb-28 md:pb-8">
            {sidePanel === 'hotels' && trip && (
              <TripHotels tripId={params.id} userId={userId} hotels={hotels} defaultStart={trip.start_date} defaultEnd={trip.end_date} onChange={reloadHotels} />
            )}
            {sidePanel === 'ate' && (
              <>
                {/* Rating scale legend */}
                <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Rating scale</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {RATING_SCALE.map(({ score, label }) => (
                      <div key={score} className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${ratingStyle(score)}`}>{score}</span>
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
                  {ate.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">No meals logged yet.</p>}
                  {ate.map((m, i) => (
                    <Link key={i} href={`/trips/${params.id}/${m.date}`} onClick={() => setSidePanel(null)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{m.name}</p>
                        {m.rating != null && ratingLabel(m.rating) && (
                          <p className="text-[11px] text-gray-400">{ratingLabel(m.rating)}</p>
                        )}
                      </div>
                      {m.rating != null && <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${ratingStyle(m.rating)}`}>{m.rating}/10</span>}
                      <span className="text-xs text-gray-400 flex-shrink-0">{new Date(m.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile day picker — jump to any of the trip's days */}
      {showDayPicker && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setShowDayPicker(false)} />
          <div className="lg:hidden fixed inset-x-0 bottom-0 top-[16vh] z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1.5 rounded-full bg-gray-300" /></div>
            <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-700">Jump to day</p>
              <div className="flex items-center gap-4">
                {todayInRange && (
                  <button onClick={() => { router.push(`/trips/${params.id}/${todayLocal}`); setShowDayPicker(false) }} className="text-xs font-semibold text-blue-600">Today</button>
                )}
                <button onClick={() => setShowDayPicker(false)} className="text-xs font-medium text-gray-400">Close</button>
              </div>
            </div>
            <div ref={dayPickerScroll} className="flex-1 overflow-y-auto p-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {allDates.map((d, i) => {
                const active = d === params.date
                const today = d === todayLocal
                const t = dayTitleMap.get(d)
                return (
                  <button
                    key={d}
                    data-pd={d}
                    onClick={() => { router.push(`/trips/${params.id}/${d}`); setShowDayPicker(false) }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? 'bg-blue-600' : today ? 'bg-blue-50' : 'active:bg-gray-100'}`}
                  >
                    <span className={`text-xs font-bold w-12 flex-shrink-0 ${active ? 'text-blue-200' : today ? 'text-blue-500' : 'text-gray-400'}`}>Day {i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] ${active ? 'text-blue-200' : 'text-gray-400'}`}>{fmtDay(d)}{today && !active ? ' · today' : ''}</p>
                      <p className={`text-sm font-medium truncate ${active ? 'text-white' : t ? 'text-gray-800' : 'text-gray-400'}`}>{t ?? '—'}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Transient toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 z-[60] bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none">
          {toast}
        </div>
      )}

      {/* Mobile FAB — add a section without scrolling to the bottom */}
      {!editingId && !sidePanel && !sidebarOpen && !showAddSheet && !showDayPicker && (
        <button
          onClick={() => setShowAddSheet(true)}
          aria-label="Add section"
          className="lg:hidden fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-95 transition"
        >
          <span className="text-3xl leading-none -mt-0.5">+</span>
        </button>
      )}
      {showAddSheet && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/30 z-40" onClick={() => setShowAddSheet(false)} />
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex justify-center pt-2.5 pb-1"><div className="w-10 h-1.5 rounded-full bg-gray-300" /></div>
            <p className="px-5 pb-1 text-sm font-semibold text-gray-700">Add to this day</p>
            <div className="px-3 py-2 space-y-1.5">
              {ADD_SECTION_GROUPS.flatMap(g => g.types).map(type => {
                const m = findMeta(type)
                if (!m) return null
                return (
                  <button
                    key={type}
                    onClick={() => { addSection(type); setShowAddSheet(false) }}
                    className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left active:scale-[0.99] transition ${m.bg} ${m.border}`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <span className={`text-base font-semibold ${m.text}`}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Slide-out edit panel */}
      <EditPanel
        open={!!editingId}
        onSave={commitEdit}
        onCancel={cancelEdit}
        title={(() => {
          const it = sectionItems.find(s => s._id === editingId)
          return it ? (it.lines.find(l => l.trim() && !l.trim().startsWith('-')) || findMeta(it.type)?.label || 'Edit') : 'Edit'
        })()}
      >
        {(() => {
          const it = sectionItems.find(s => s._id === editingId)
          if (!it) return null
          const idx = sectionItems.findIndex(s => s._id === it._id)
          const name = it.lines.find(l => l.trim() && !l.trim().startsWith('-')) || undefined
          return (
            <div className="space-y-3">
              <SectionEditorCard
                section={it}
                onChange={updates => updateSection(it._id, updates)}
                onMoveUp={idx > 0 ? () => moveSection(idx, -1) : undefined}
                onMoveDown={idx < sectionItems.length - 1 ? () => moveSection(idx, 1) : undefined}
              />
              {/* Map preview lives at the bottom of the sheet */}
              <LocationPreview coords={it.coords} name={name} />
              <button
                onClick={async () => { if (!confirm('Delete this section?')) return; const next = sectionItems.filter(s => s._id !== it._id); setSectionItems(next); setEditingId(null); setEditSnapshot(null); await save(next); showToast('Section deleted') }}
                className="w-full text-sm font-medium text-red-500 border border-red-200 rounded-lg py-2.5 hover:bg-red-50 active:bg-red-100 transition"
              >
                Delete section
              </button>
            </div>
          )
        })()}
      </EditPanel>
    </div>

    {/* Floating preview of the card being dragged */}
    <DragOverlay dropAnimation={null}>
      {dragType === 'card' && activeDragItem && activeDragDisplay ? (
        <div className="w-[320px] max-w-[80vw] rotate-1 cursor-grabbing shadow-2xl rounded-xl ring-2 ring-blue-400">
          {(activeDragDisplay.meta.hotel || activeDragDisplay.meta.car)
            ? <HotelCard meta={activeDragDisplay.meta} lines={activeDragDisplay.lines} skipped={activeDragItem.skipped} />
            : <SectionCard meta={activeDragDisplay.meta} lines={activeDragDisplay.lines} title={activeDragItem.title} type={activeDragItem.type} place={activeDragItem.place} coords={activeDragItem.coords} rating={activeDragItem.rating} skipped={activeDragItem.skipped} />
          }
        </div>
      ) : null}
    </DragOverlay>
   </DndContext>
  )
}
