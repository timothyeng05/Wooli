'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import { useConfirm } from '@/app/components/ui/ToastProvider'
import { type Transaction, type Category, type Trip, type SortOrder, type HouseholdMember } from './transaction-types'
import CategoryPicker from './CategoryPicker'
import FilterPanel from './FilterPanel'
import TransactionReviewSheet from './TransactionReviewSheet'

// Render rows in windows so the full (possibly 1000+ row) dataset isn't all
// committed to the DOM at once — the entire set still lives in memory for
// instant client-side search/filter; we just cap what's painted.
const WINDOW_INITIAL = 150
const WINDOW_STEP = 150

// Fires whenever a transaction's reviewed state changes, so the sidebar count
// badge (and any other listener) can refresh without prop-drilling.
export const REVIEW_CHANGED_EVENT = 'budget:review-changed'
function emitReviewChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REVIEW_CHANGED_EVENT))
}

const REVIEW_SELECT = `
  id, amount, description, merchant, transacted_at, plaid_transaction_id,
  is_transfer, is_reimbursement, is_pending, needs_review, owner, account_name, trip_id,
  categories ( id, name, color, icon, is_income ),
  trips ( id, name )
`

// The review queue is global (all time), not month-scoped like the page's main
// query — so it can be cleared to zero the way Monarch's queue works.
async function fetchUnreviewed(supabase: SupabaseClient): Promise<Transaction[]> {
  const PAGE = 1000
  let all: Transaction[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('transactions')
      .select(REVIEW_SELECT)
      .eq('needs_review', true)
      .order('transacted_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (!data || data.length === 0) break
    all = all.concat(data as unknown as Transaction[])
    if (data.length < PAGE) break
  }
  return all
}

function groupByDate(txns: Transaction[], asc = false) {
  const groups = new Map<string, Transaction[]>()
  txns.forEach(t => {
    const d = t.transacted_at.split('T')[0]
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(t)
  })
  return Array.from(groups.entries()).sort(([a], [b]) =>
    asc ? a.localeCompare(b) : b.localeCompare(a)
  )
}

function OwnerAvatar({ owner, members }: { owner: string | null; members: HouseholdMember[] }) {
  if (!owner) return null
  const member = members.find(m => m.full_name === owner)
  const initial = (member?.display_name ?? owner)[0].toUpperCase()
  const color = member?.color ?? '#6b7280'
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color }}>
      {initial}
    </div>
  )
}

export default function TransactionList({
  transactions,
  categories = [],
  trips = [],
  members = [],
  initialOwner,
  initialType,
}: {
  transactions: Transaction[]
  categories?: Category[]
  trips?: Trip[]
  members?: HouseholdMember[]
  initialOwner?: string
  initialType?: 'income' | 'expense'
}) {
  const confirm = useConfirm()
  const [items, setItems] = useState<Transaction[]>(transactions)

  // ── Filter / sort state ───────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc')
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set())
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(initialOwner ? new Set([initialOwner]) : new Set())
  const [selectedTripIds, setSelectedTripIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<'income' | 'expense' | null>(initialType ?? null)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  // ── Select mode ───────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // ── Category picker + review sheet ────────────────────────────────────────
  const [catPickerTx, setCatPickerTx] = useState<Transaction | null>(null)
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null)

  // ── Review queue (global, all-time) ───────────────────────────────────────
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewItems, setReviewItems] = useState<Transaction[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [unreviewedCount, setUnreviewedCount] = useState<number | null>(null)

  const refreshUnreviewedCount = useCallback(async () => {
    const supabase = createClient()
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('needs_review', true)
    setUnreviewedCount(count ?? 0)
  }, [])

  useEffect(() => { refreshUnreviewedCount() }, [refreshUnreviewedCount])

  const enterReviewMode = async () => {
    setReviewMode(true)
    setReviewLoading(true)
    const supabase = createClient()
    const rows = await fetchUnreviewed(supabase)
    setReviewItems(rows)
    setUnreviewedCount(rows.length)
    setReviewLoading(false)
  }

  const exitReviewMode = () => { setReviewMode(false); setReviewItems([]) }

  // Drop rows from the queue after they've been reviewed and keep the month
  // list in sync. DB writes are done by the caller; count is re-read from the
  // source of truth so re-confirming an already-reviewed row can't miscount.
  const dropFromQueue = (ids: string[]) => {
    const idSet = new Set(ids)
    setReviewItems(prev => prev.filter(t => !idSet.has(t.id)))
    setItems(prev => prev.map(t => (idSet.has(t.id) ? { ...t, needs_review: false } : t)))
    emitReviewChanged()
    refreshUnreviewedCount()
  }

  // One-click "accept as-is": confirm the current categorization without opening
  // the sheet. Seeds merchant memory via the user_confirmed trigger.
  const markReviewed = async (id: string) => {
    const supabase = createClient()
    await supabase.from('transactions').update({
      needs_review: false,
      categorization_source: 'user_confirmed',
      categorization_confidence: 1,
    }).eq('id', id)
    dropFromQueue([id])
  }

  const markAllReviewed = async () => {
    const ids = filtered.map(t => t.id)
    if (ids.length === 0) return
    if (!await confirm(`Mark ${ids.length} transaction${ids.length > 1 ? 's' : ''} as reviewed?`)) return
    setReviewLoading(true)
    const supabase = createClient()
    // Chunk to stay well under URL/statement limits on large queues.
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500)
      await supabase.from('transactions').update({
        needs_review: false,
        categorization_source: 'user_confirmed',
        categorization_confidence: 1,
      }).in('id', slice)
    }
    dropFromQueue(ids)
    setReviewLoading(false)
  }

  // ── Category inline change ────────────────────────────────────────────────
  const handleCategoryChange = async (txId: string, catId: string) => {
    const supabase = createClient()
    const newCatId = catId || null
    const found = categories.find(c => c.id === newCatId) ?? null
    const makeTransfer = found?.is_transfer ?? false
    const updates: Record<string, unknown> = makeTransfer
      ? { category_id: null, is_transfer: true }
      : { category_id: newCatId, is_transfer: false }
    // Tag as a user confirmation so the DB trigger records merchant memory.
    updates.categorization_source = 'user_confirmed'
    updates.categorization_confidence = 1
    updates.needs_review = false
    await supabase.from('transactions').update(updates).eq('id', txId)
    setItems(prev => prev.map(t =>
      t.id === txId
        ? { ...t, is_transfer: makeTransfer, categories: found && !makeTransfer ? { id: found.id, name: found.name, color: found.color, icon: found.icon } : null }
        : t
    ))
    dropFromQueue([txId])
  }

  const handleCatPick = async (catId: string) => {
    if (!catPickerTx) return
    const txId = catPickerTx.id
    setCatPickerTx(null)
    if (catId === '__transfer__') {
      const supabase = createClient()
      await supabase.from('transactions').update({ is_transfer: true, category_id: null, categorization_source: 'user_confirmed', categorization_confidence: 1, needs_review: false }).eq('id', txId)
      setItems(prev => prev.map(t => t.id === txId ? { ...t, is_transfer: true, categories: null } : t))
      dropFromQueue([txId])
    } else {
      await handleCategoryChange(txId, catId)
    }
  }

  // Toggles is_reimbursement without touching category_id/is_transfer — keeps
  // the transaction tied to its current category so it nets against that
  // category's spend instead of being excluded or added like a transfer.
  const toggleReimbursement = async (txId: string) => {
    const t = items.find(x => x.id === txId)
    if (!t) return
    const next = !t.is_reimbursement
    setItems(prev => prev.map(x => x.id === txId ? { ...x, is_reimbursement: next } : x))
    await createClient().from('transactions').update({ is_reimbursement: next }).eq('id', txId)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!await confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(t => t.id !== id))
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(t => t.id)))
  }
  const cancelSelect = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const bulkSetCategory = async (catId: string) => {
    if (!catId) return
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ category_id: catId, is_transfer: false, categorization_source: 'user_confirmed', categorization_confidence: 1, needs_review: false }).in('id', ids)
    const found = categories.find(c => c.id === catId) ?? null
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, categories: found ? { id: found.id, name: found.name, color: found.color } : null } : t))
    dropFromQueue(ids)
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }
  const bulkMarkTransfer = async () => {
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ is_transfer: true, category_id: null, categorization_source: 'user_confirmed', categorization_confidence: 1, needs_review: false }).in('id', ids)
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_transfer: true, categories: null } : t))
    dropFromQueue(ids)
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }
  const bulkMarkReimbursement = async () => {
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ is_reimbursement: true }).in('id', ids)
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_reimbursement: true } : t))
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }
  const bulkDelete = async () => {
    if (!await confirm(`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`)) return
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').delete().in('id', ids)
    setItems(prev => prev.filter(t => !ids.includes(t.id)))
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }
  const bulkTagTrip = async (tripId: string) => {
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    const newTripId = tripId === '__none__' ? null : tripId
    await supabase.from('transactions').update({ trip_id: newTripId }).in('id', ids)
    const foundTrip = newTripId ? (trips.find(tp => tp.id === newTripId) ?? null) : null
    setItems(prev => prev.map(t =>
      ids.includes(t.id)
        ? { ...t, trip_id: newTripId, trips: foundTrip ? { id: foundTrip.id, name: foundTrip.name } : null }
        : t
    ))
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  // In review mode the list is driven by the global unreviewed queue rather than
  // the month the page loaded; all search/filter/sort logic runs on top of it.
  const base = reviewMode ? reviewItems : items

  const uniqueAccounts = useMemo(
    () => [...new Set(base.map(t => t.account_name).filter(Boolean) as string[])].sort(),
    [base]
  )
  const activeFilterCount = selectedAccounts.size + selectedCatIds.size + selectedOwners.size + selectedTripIds.size + (typeFilter ? 1 : 0) + (dateStart ? 1 : 0) + (dateEnd ? 1 : 0)

  const filtered = useMemo(() => {
    const result = base.filter(t => {
      if (selectedAccounts.size > 0 && !selectedAccounts.has(t.account_name ?? '')) return false
      if (selectedCatIds.size > 0) {
        const isUncategorized = !t.categories && !t.is_transfer
        if (isUncategorized) {
          if (!selectedCatIds.has('__uncategorized__')) return false
        } else {
          const txCatId = t.categories?.id ?? ''
          const txCat = categories.find(c => c.id === txCatId)
          const txParentId = txCat?.parent_id ?? ''
          if (!selectedCatIds.has(txCatId) && !selectedCatIds.has(txParentId)) return false
        }
      }
      if (selectedOwners.size > 0 && !selectedOwners.has(t.owner ?? '')) return false
      if (selectedTripIds.size > 0 && !selectedTripIds.has(t.trip_id ?? '')) return false
      if (typeFilter === 'income' && t.amount < 0) return false
      if (typeFilter === 'expense' && t.amount >= 0) return false
      if (dateStart && t.transacted_at < dateStart) return false
      if (dateEnd && t.transacted_at > dateEnd + 'T23:59:59') return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.description?.toLowerCase().includes(q) ||
        t.merchant?.toLowerCase().includes(q) ||
        t.categories?.name.toLowerCase().includes(q) ||
        t.account_name?.toLowerCase().includes(q)
      )
    })
    if (sortOrder === 'amount-desc') return [...result].sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)))
    if (sortOrder === 'amount-asc')  return [...result].sort((a, b) => Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)))
    return result
  }, [base, search, selectedAccounts, selectedCatIds, selectedOwners, selectedTripIds, typeFilter, dateStart, dateEnd, sortOrder])

  // ── Render windowing ────────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(WINDOW_INITIAL)

  // Whenever the result set changes (search / filters / sort), jump back to the
  // top window so we don't render thousands of now-irrelevant rows.
  useEffect(() => {
    setVisibleCount(WINDOW_INITIAL)
  }, [search, selectedAccounts, selectedCatIds, selectedOwners, selectedTripIds, typeFilter, dateStart, dateEnd, sortOrder, reviewMode])

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount])
  const hasMore = filtered.length > visible.length

  // Auto-load the next window when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) setVisibleCount(c => c + WINDOW_STEP) },
      { rootMargin: '600px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

  const grouped = useMemo(
    () => groupByDate(visible, sortOrder === 'date-asc'),
    [visible, sortOrder]
  )

  const clearFilters = () => {
    setSelectedAccounts(new Set())
    setSelectedCatIds(new Set())
    setSelectedOwners(new Set())
    setSelectedTripIds(new Set())
    setTypeFilter(null)
    setDateStart('')
    setDateEnd('')
  }

  const removeAccountFilter = (a: string) => { const n = new Set(selectedAccounts); n.delete(a); setSelectedAccounts(n) }
  const removeCatFilter    = (id: string) => { const n = new Set(selectedCatIds);    n.delete(id); setSelectedCatIds(n) }
  const removeOwnerFilter  = (o: string)  => { const n = new Set(selectedOwners);    n.delete(o);  setSelectedOwners(n) }
  const removeTripFilter   = (id: string) => { const n = new Set(selectedTripIds);   n.delete(id); setSelectedTripIds(n) }

  if (!reviewMode && items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-3">No transactions this month</p>
        <Link href="/budget/new" className="text-blue-600 hover:underline text-sm">+ Add a transaction</Link>
      </div>
    )
  }

  const transferCatIds = new Set(categories.filter(c => c.is_transfer).map(c => c.id))
  const parents  = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  return (
    <div className={selectMode && selectedIds.size > 0 ? 'pb-24 md:pb-16' : ''}>
      {/* ── Search + filter bar ────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-4 pb-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <button
          onClick={() => reviewMode ? exitReviewMode() : enterReviewMode()}
          className={`relative px-3 py-2.5 border rounded-xl transition flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${
            reviewMode
              ? 'border-violet-400 bg-violet-50 text-violet-700'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          <span className="hidden sm:inline">{reviewMode ? 'Reviewing' : 'Review'}</span>
          {unreviewedCount !== null && unreviewedCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] px-1 bg-violet-600 text-white text-[10px] font-bold rounded-full inline-flex items-center justify-center">
              {unreviewedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilterOpen(true)}
          className={`relative px-3 py-2.5 border rounded-xl transition flex items-center gap-1.5 text-sm font-medium ${
            activeFilterCount > 0
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          onClick={() => selectMode ? cancelSelect() : setSelectMode(true)}
          className={`px-3 py-2.5 border rounded-xl text-sm font-medium transition ${
            selectMode
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* ── Active filter chips ────────────────────────────────────────────── */}
      {(activeFilterCount > 0 || search) && (
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          {typeFilter && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              {typeFilter === 'income' ? 'Income only' : 'Expenses only'}
              <button onClick={() => setTypeFilter(null)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          )}
          {dateStart && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              From {dateStart}
              <button onClick={() => setDateStart('')} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          )}
          {dateEnd && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              To {dateEnd}
              <button onClick={() => setDateEnd('')} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          )}
          {[...selectedAccounts].map(a => (
            <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              {a}
              <button onClick={() => removeAccountFilter(a)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          ))}
          {[...selectedCatIds].map(id => {
            if (id === '__uncategorized__') return (
              <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
                Uncategorized
                <button onClick={() => removeCatFilter(id)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
              </span>
            )
            const cat = categories.find(c => c.id === id)
            return cat ? (
              <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
                {getCatEmoji(cat.name, cat.icon)} {cat.name}
                <button onClick={() => removeCatFilter(id)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
              </span>
            ) : null
          })}
          {[...selectedOwners].map(o => (
            <span key={o} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              {members.find(m => m.full_name === o)?.display_name ?? o}
              <button onClick={() => removeOwnerFilter(o)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          ))}
          {[...selectedTripIds].map(id => {
            const tp = trips.find(t => t.id === id)
            return tp ? (
              <span key={id} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
                ✈ {tp.name}
                <button onClick={() => removeTripFilter(id)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
              </span>
            ) : null
          })}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-gray-600 px-1 transition">
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── Filter summary bar ─────────────────────────────────────────────── */}
      {filtered.length > 0 && (() => {
        const nonTransfer = filtered.filter(t => !t.is_transfer)
        const reimbursed = nonTransfer.filter(t => t.is_reimbursement)
          .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        const spent = nonTransfer.filter(t => t.amount < 0 && !t.is_reimbursement)
          .reduce((s, t) => s + Math.abs(Number(t.amount)), 0) - reimbursed
        const income = nonTransfer.filter(t => t.amount > 0 && !t.is_reimbursement)
          .reduce((s, t) => s + Number(t.amount), 0)
        return (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 pb-2 text-xs text-gray-500">
            <span className="font-semibold text-gray-700">
              {filtered.length.toLocaleString()} transaction{filtered.length !== 1 ? 's' : ''}
            </span>
            {spent > 0 && (
              <span>· <span className="text-gray-600">${spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent</span></span>
            )}
            {income > 0 && (
              <span>· <span className="text-green-600">${income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} income</span></span>
            )}
          </div>
        )
      })()}

      {/* ── Review queue banner ────────────────────────────────────────────── */}
      {reviewMode && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 mb-2 bg-violet-50 border border-violet-200 rounded-xl">
          <div className="text-sm text-violet-800">
            {reviewLoading ? 'Loading review queue…'
              : filtered.length === 0 ? 'All caught up — nothing to review 🎉'
              : <><span className="font-semibold">{filtered.length.toLocaleString()}</span> to review{activeFilterCount > 0 ? ' (filtered)' : ''}</>}
          </div>
          {!reviewLoading && filtered.length > 0 && (
            <button onClick={markAllReviewed} disabled={reviewLoading}
              className="px-3 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition disabled:opacity-50 whitespace-nowrap">
              Mark all {filtered.length.toLocaleString()} reviewed
            </button>
          )}
        </div>
      )}

      {/* ── Select-all row ─────────────────────────────────────────────────── */}
      {selectMode && (
        <div className="flex items-center gap-3 px-2 py-2 mb-1 bg-gray-50 rounded-lg text-sm text-gray-600">
          <input type="checkbox"
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
        </div>
      )}

      {/* ── Transaction groups ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        reviewMode && !search ? null : (
          <p className="text-center text-gray-400 py-12 text-sm">
            {search ? `No results for "${search}"` : 'No transactions match your filters'}
          </p>
        )
      ) : (
        (sortOrder === 'amount-desc' || sortOrder === 'amount-asc' ? [['', visible] as [string, Transaction[]]] : grouped).map(([date, txns]) => {
          const dayTotal = (txns as Transaction[])
            .filter(t => !t.is_transfer && !t.is_pending && !transferCatIds.has(t.categories?.id ?? ''))
            .reduce((s, t) => s + (t.is_reimbursement
              ? -Math.abs(Number(t.amount))
              : (t.amount < 0 ? Math.abs(Number(t.amount)) : 0)), 0)

          return (
            <div key={date || 'flat'}>
              {date && (
                <div className="flex items-center justify-between py-2.5 mt-2">
                  <span className="text-sm font-semibold text-gray-500">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                  {dayTotal !== 0 && (
                    <span className="text-sm text-gray-400">
                      {dayTotal < 0 ? '−' : ''}${Math.abs(dayTotal).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              <div className="divide-y divide-gray-50">
                {(txns as Transaction[]).map(t => {
                  const name = t.merchant || t.description || 'Unknown'
                  const catName = t.categories?.name ?? null
                  const emoji = t.is_transfer
                    ? '↔️'
                    : getCatEmoji(catName ?? '', t.categories?.icon ?? null)
                  const catBg = t.is_transfer
                    ? '#f3f4f6'
                    : t.categories?.color ? `${t.categories.color}22` : '#f3f4f6'

                  return (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-3 py-3 cursor-pointer rounded-lg px-2 transition ${
                        selectMode && selectedIds.has(t.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={selectMode ? () => toggleSelect(t.id) : () => setReviewTxn(t)}
                    >
                      {selectMode && (
                        <input type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 flex-shrink-0 rounded border-gray-300 text-blue-600" />
                      )}

                      {reviewMode && !selectMode && (
                        <button
                          onClick={e => { e.stopPropagation(); markReviewed(t.id) }}
                          className="w-7 h-7 flex-shrink-0 rounded-full border-2 border-violet-300 text-violet-500 flex items-center justify-center hover:bg-violet-600 hover:border-violet-600 hover:text-white transition"
                          title="Mark reviewed"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      )}

                      {!selectMode && (
                        <button
                          onClick={e => { e.stopPropagation(); setCatPickerTx(t) }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg hover:ring-2 hover:ring-blue-300 transition-shadow"
                          style={{ backgroundColor: catBg }}
                          title="Change category"
                        >
                          {catName === null && !t.is_transfer
                            ? <span className="text-gray-400 text-xs font-bold">?</span>
                            : <span>{emoji}</span>
                          }
                        </button>
                      )}

                      {!selectMode && !t.is_transfer && t.categories && t.categories.is_income === false && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleReimbursement(t.id) }}
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition ${
                            t.is_reimbursement
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-500'
                          }`}
                          title={t.is_reimbursement ? 'Unmark as reimbursed' : 'Mark as reimbursed'}
                        >
                          ↩
                        </button>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {t.is_pending && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                              Pending
                            </span>
                          )}
                          {t.needs_review && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 flex-shrink-0">
                              Review
                            </span>
                          )}
                          {t.is_reimbursement && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex-shrink-0">
                              ↩ Reimbursed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {catName && !t.is_transfer && (
                            <p className="text-xs text-gray-400 truncate">{catName}</p>
                          )}
                          {t.is_transfer && (
                            <p className="text-xs text-gray-400">Transfer</p>
                          )}
                          {t.account_name && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <p className="text-xs text-gray-400 truncate">{t.account_name}</p>
                            </>
                          )}
                          {t.trips && (
                            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              ✈ {t.trips.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                        t.is_pending ? 'text-amber-500'
                        : t.is_transfer ? 'text-gray-400'
                        : t.amount >= 0 ? 'text-green-600'
                        : 'text-gray-900'
                      }`}>
                        {t.amount >= 0 && !t.is_transfer ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                      </span>

                      <OwnerAvatar owner={t.owner} members={members} />
                      {!selectMode && (
                        <svg
                          className="w-4 h-4 text-gray-300 flex-shrink-0 opacity-30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* ── Infinite-scroll sentinel + manual fallback ─────────────────────── */}
      {hasMore && (
        <div ref={sentinelRef} className="pt-4 text-center">
          <button
            onClick={() => setVisibleCount(c => c + WINDOW_STEP)}
            className="text-sm text-blue-600 hover:underline"
          >
            Show more ({(filtered.length - visible.length).toLocaleString()} more)
          </button>
        </div>
      )}

      {/* ── Category picker ────────────────────────────────────────────────── */}
      {catPickerTx && (
        <CategoryPicker
          categories={categories}
          currentCatId={catPickerTx.categories?.id ?? null}
          isTransfer={!!catPickerTx.is_transfer}
          onPick={handleCatPick}
          onClose={() => setCatPickerTx(null)}
        />
      )}

      {/* ── Filter panel ───────────────────────────────────────────────────── */}
      {filterOpen && (
        <FilterPanel
          onClose={() => setFilterOpen(false)}
          sortOrder={sortOrder}
          onSort={setSortOrder}
          accounts={uniqueAccounts}
          selectedAccounts={selectedAccounts}
          onAccountsChange={setSelectedAccounts}
          categories={categories}
          selectedCatIds={selectedCatIds}
          onCatsChange={setSelectedCatIds}
          members={members}
          selectedOwners={selectedOwners}
          onOwnersChange={setSelectedOwners}
          trips={trips}
          selectedTripIds={selectedTripIds}
          onTripsChange={setSelectedTripIds}
          dateStart={dateStart}
          dateEnd={dateEnd}
          onDateStartChange={setDateStart}
          onDateEndChange={setDateEnd}
          onClear={clearFilters}
        />
      )}

      {/* ── Review sheet ───────────────────────────────────────────────────── */}
      {reviewTxn && (
        <TransactionReviewSheet
          transaction={reviewTxn}
          categories={categories}
          trips={trips}
          members={members}
          onClose={() => setReviewTxn(null)}
          onSaved={(txId, updates) => {
            setItems(prev => prev.map(t => t.id === txId ? { ...t, ...updates } : t))
            dropFromQueue([txId])
            setReviewTxn(null)
          }}
          onDelete={handleDelete}
        />
      )}

      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-1">{selectedIds.size} selected</span>
            <select defaultValue="" onChange={e => { if (e.target.value) bulkSetCategory(e.target.value) }}
              disabled={bulkLoading}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
              <option value="">Set category…</option>
              {parents.map(parent => {
                const subs = children.filter(c => c.parent_id === parent.id)
                const pEmoji = getCatEmoji(parent.name, parent.icon)
                if (subs.length === 0) return <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                return (
                  <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                    {subs.map(child => <option key={child.id} value={child.id}>{getCatEmoji(child.name, child.icon)} {child.name}</option>)}
                  </optgroup>
                )
              })}
            </select>
            <button onClick={bulkMarkTransfer} disabled={bulkLoading}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
              Mark Transfer
            </button>
            <button onClick={bulkMarkReimbursement} disabled={bulkLoading}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition">
              Mark Reimbursed
            </button>
            {trips.length > 0 && (
              <select
                value=""
                onChange={e => { if (e.target.value) { bulkTagTrip(e.target.value) } }}
                disabled={bulkLoading}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="" disabled>Tag trip…</option>
                {trips.map(tp => (
                  <option key={tp.id} value={tp.id}>✈ {tp.name}</option>
                ))}
                <option value="__none__">Remove trip tag</option>
              </select>
            )}
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="px-3 py-1.5 text-sm border border-red-200 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
              Delete
            </button>
            <button onClick={cancelSelect} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
