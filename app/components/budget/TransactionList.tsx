'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import { useConfirm } from '@/app/components/ui/ToastProvider'

const OWNERS = ['Timothy Eng', 'Jessica Li', 'Shared'] as const

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  is_transfer: boolean
  parent_id: string | null
}

interface Trip {
  id: string
  name: string
  start_date?: string
  end_date?: string
}

interface Transaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  transacted_at: string
  plaid_transaction_id: string | null
  is_transfer: boolean | null
  is_pending: boolean | null
  owner: string | null
  account_name: string | null
  trip_id: string | null
  categories: { id: string; name: string; color: string; icon?: string | null } | null
  trips: { id: string; name: string } | null
}

type SortOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

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

// ── Owner avatar ───────────────────────────────────────────────────────────────
function OwnerAvatar({ owner }: { owner: string | null }) {
  if (!owner) return null
  const initial = owner === 'Timothy Eng' ? 'T' : owner === 'Jessica Li' ? 'J' : 'S'
  const cls = owner === 'Timothy Eng'
    ? 'bg-blue-500' : owner === 'Jessica Li' ? 'bg-rose-400' : 'bg-gray-400'
  return (
    <div className={`w-7 h-7 rounded-full ${cls} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initial}
    </div>
  )
}

// ── Shared checkbox ────────────────────────────────────────────────────────────
function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
      checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
    }`}>
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )
}

// ── Category picker ────────────────────────────────────────────────────────────
function CategoryPicker({
  categories,
  currentCatId,
  isTransfer,
  onPick,
  onClose,
}: {
  categories: Category[]
  currentCatId: string | null
  isTransfer: boolean
  onPick: (catId: string) => void
  onClose: () => void
}) {
  const parents  = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-base font-semibold text-gray-900">Change Category</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 -mr-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 73px)' }}>
          {/* Uncategorized */}
          <button
            onClick={() => onPick('')}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
              <span className="text-gray-400 text-xs font-bold">?</span>
            </div>
            <span className="text-sm text-gray-700 flex-1 text-left">Uncategorized</span>
            {!currentCatId && !isTransfer && (
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Transfer */}
          <button
            onClick={() => onPick('__transfer__')}
            className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
          >
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">↔️</div>
            <span className="text-sm text-gray-700 flex-1 text-left">Transfer</span>
            {isTransfer && (
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Categories grouped by parent */}
          {parents.map(parent => {
            const subs = children.filter(c => c.parent_id === parent.id)
            const pEmoji = getCatEmoji(parent.name, parent.icon)

            if (subs.length === 0) {
              // Parent with no children — show as selectable
              return (
                <button
                  key={parent.id}
                  onClick={() => onPick(parent.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: parent.color ? `${parent.color}22` : '#f3f4f6' }}>
                    {pEmoji}
                  </div>
                  <span className="text-sm text-gray-700 flex-1 text-left">{parent.name}</span>
                  {currentCatId === parent.id && (
                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            }

            return (
              <div key={parent.id}>
                {/* Section header (non-selectable parent) */}
                <div className="flex items-center gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm">{pEmoji}</span>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{parent.name}</span>
                </div>
                {subs.map(child => {
                  const cEmoji = getCatEmoji(child.name, child.icon)
                  return (
                    <button
                      key={child.id}
                      onClick={() => onPick(child.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: child.color ? `${child.color}22` : parent.color ? `${parent.color}22` : '#f3f4f6' }}>
                        {cEmoji}
                      </div>
                      <span className="text-sm text-gray-700 flex-1 text-left">{child.name}</span>
                      {currentCatId === child.id && (
                        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Filter panel ───────────────────────────────────────────────────────────────
type FilterScreen = 'main' | 'sort' | 'accounts' | 'categories' | 'owners' | 'trips'

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'date-desc',   label: 'Date (new to old)' },
  { value: 'date-asc',    label: 'Date (old to new)' },
  { value: 'amount-desc', label: 'Amount (high to low)' },
  { value: 'amount-asc',  label: 'Amount (low to high)' },
]

const SORT_LABEL: Record<SortOrder, string> = Object.fromEntries(SORTS.map(s => [s.value, s.label])) as Record<SortOrder, string>

function FilterPanel({
  onClose, sortOrder, onSort,
  accounts, selectedAccounts, onAccountsChange,
  categories, selectedCatIds, onCatsChange,
  selectedOwners, onOwnersChange,
  trips, selectedTripIds, onTripsChange,
  onClear,
}: {
  onClose: () => void
  sortOrder: SortOrder
  onSort: (s: SortOrder) => void
  accounts: string[]
  selectedAccounts: Set<string>
  onAccountsChange: (s: Set<string>) => void
  categories: Category[]
  selectedCatIds: Set<string>
  onCatsChange: (s: Set<string>) => void
  selectedOwners: Set<string>
  onOwnersChange: (s: Set<string>) => void
  trips: Trip[]
  selectedTripIds: Set<string>
  onTripsChange: (s: Set<string>) => void
  onClear: () => void
}) {
  const [screen, setScreen] = useState<FilterScreen>('main')

  const toggleAccount = (a: string) => {
    const next = new Set(selectedAccounts); next.has(a) ? next.delete(a) : next.add(a); onAccountsChange(next)
  }
  const toggleCat = (id: string) => {
    const next = new Set(selectedCatIds); next.has(id) ? next.delete(id) : next.add(id); onCatsChange(next)
  }
  const toggleOwner = (o: string) => {
    const next = new Set(selectedOwners); next.has(o) ? next.delete(o) : next.add(o); onOwnersChange(next)
  }
  const toggleTrip = (id: string) => {
    const next = new Set(selectedTripIds); next.has(id) ? next.delete(id) : next.add(id); onTripsChange(next)
  }

  const topCats = categories.filter(c => !c.parent_id)

  const SCREEN_TITLE: Record<FilterScreen, string> = {
    main: 'Filters', sort: 'Sort By',
    accounts: 'Accounts', categories: 'Categories', owners: 'Owners', trips: 'Trips',
  }

  // Rows shown on the main screen
  const mainRows: { key: FilterScreen; label: string; count: number; hidden?: boolean }[] = [
    { key: 'accounts',   label: 'Accounts',   count: selectedAccounts.size, hidden: accounts.length === 0 },
    { key: 'categories', label: 'Categories', count: selectedCatIds.size },
    { key: 'owners',     label: 'Owners',     count: selectedOwners.size },
    { key: 'trips',      label: 'Trips',      count: selectedTripIds.size, hidden: trips.length === 0 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85dvh' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          {screen !== 'main' ? (
            <button onClick={() => setScreen('main')}
              className="text-blue-600 hover:text-blue-700 transition -ml-1 p-1">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          ) : null}
          <span className="text-base font-semibold text-gray-900 flex-1">{SCREEN_TITLE[screen]}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 -mr-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 130px)' }}>

          {/* Main screen */}
          {screen === 'main' && (
            <>
              {/* Sort By — single drill-down row */}
              <button
                onClick={() => setScreen('sort')}
                className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <div className="text-left">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Sort By</p>
                  <p className="text-sm text-gray-800">{SORT_LABEL[sortOrder]}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Filter By header */}
              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Filter By</p>
              </div>

              {/* Filter rows */}
              {mainRows.filter(r => !r.hidden).map(row => (
                <button
                  key={row.key}
                  onClick={() => setScreen(row.key)}
                  className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
                >
                  <span className="text-sm text-gray-800">{row.label}</span>
                  <div className="flex items-center gap-2">
                    {row.count > 0 && (
                      <span className="text-xs font-semibold text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center">
                        {row.count}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Sort sub-screen */}
          {screen === 'sort' && SORTS.map(s => (
            <button
              key={s.value}
              onClick={() => { onSort(s.value); setScreen('main') }}
              className="w-full flex items-center justify-between px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
            >
              <span className={`text-sm ${sortOrder === s.value ? 'font-semibold text-blue-600' : 'text-gray-800'}`}>
                {s.label}
              </span>
              {sortOrder === s.value && (
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}

          {/* Accounts sub-screen */}
          {screen === 'accounts' && accounts.map(a => (
            <button
              key={a}
              onClick={() => toggleAccount(a)}
              className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
            >
              <Checkbox checked={selectedAccounts.has(a)} />
              <span className="text-sm text-gray-800">{a}</span>
            </button>
          ))}

          {/* Categories sub-screen */}
          {screen === 'categories' && topCats.map(cat => {
            const subs = categories.filter(c => c.parent_id === cat.id)
            if (subs.length === 0) {
              // No children — show as a plain selectable row
              return (
                <button key={cat.id} onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition">
                  <Checkbox checked={selectedCatIds.has(cat.id)} />
                  <span className="text-sm text-gray-800">{getCatEmoji(cat.name, cat.icon)} {cat.name}</span>
                </button>
              )
            }
            // Has children — section header + sub-category rows
            return (
              <div key={cat.id}>
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {getCatEmoji(cat.name, cat.icon)} {cat.name}
                  </span>
                </div>
                {subs.map(sub => (
                  <button key={sub.id} onClick={() => toggleCat(sub.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition">
                    <Checkbox checked={selectedCatIds.has(sub.id)} />
                    <span className="text-sm text-gray-800">{getCatEmoji(sub.name, sub.icon)} {sub.name}</span>
                  </button>
                ))}
              </div>
            )
          })}

          {/* Owners sub-screen */}
          {screen === 'owners' && OWNERS.map(o => {
            const label = o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : 'Shared'
            return (
              <button
                key={o}
                onClick={() => toggleOwner(o)}
                className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <Checkbox checked={selectedOwners.has(o)} />
                <span className="text-sm text-gray-800">{label}</span>
              </button>
            )
          })}

          {/* Trips sub-screen */}
          {screen === 'trips' && trips.map(tp => (
            <button
              key={tp.id}
              onClick={() => toggleTrip(tp.id)}
              className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
            >
              <Checkbox checked={selectedTripIds.has(tp.id)} />
              <span className="text-sm text-gray-800">✈ {tp.name}</span>
            </button>
          ))}

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={() => { onClear(); setScreen('main') }}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            Clear all
          </button>
          <button
            onClick={screen === 'main' ? onClose : () => setScreen('main')}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            {screen === 'main' ? 'Apply' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function TransactionList({
  transactions,
  categories = [],
  trips = [],
  initialOwner,
  initialType,
}: {
  transactions: Transaction[]
  categories?: Category[]
  trips?: Trip[]
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

  // ── Select mode ───────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // ── Category picker ───────────────────────────────────────────────────────
  const [catPickerTx, setCatPickerTx] = useState<Transaction | null>(null)

  // ── Review panel ──────────────────────────────────────────────────────────
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null)
  const [reviewIsTransfer, setReviewIsTransfer] = useState(false)
  const [reviewCatId, setReviewCatId] = useState('')
  const [reviewOwner, setReviewOwner] = useState('')
  const [reviewTripId, setReviewTripId] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)

  const openReview = (t: Transaction) => {
    setReviewTxn(t)
    setReviewIsTransfer(!!t.is_transfer)
    setReviewCatId(t.categories?.id ?? '')
    setReviewOwner(t.owner ?? '')
    setReviewTripId(t.trip_id ?? '')
  }

  const saveReview = async () => {
    if (!reviewTxn) return
    setReviewSaving(true)
    const supabase = createClient()
    const catId = reviewIsTransfer ? null : (reviewCatId || null)
    const tripId = reviewTripId || null
    await supabase.from('transactions').update({
      is_transfer: reviewIsTransfer,
      category_id: catId,
      owner: reviewOwner || null,
      trip_id: tripId,
    }).eq('id', reviewTxn.id)
    const found = catId ? (categories.find(c => c.id === catId) ?? null) : null
    const foundTrip = tripId ? (trips.find(tp => tp.id === tripId) ?? null) : null
    setItems(prev => prev.map(t =>
      t.id === reviewTxn.id
        ? { ...t, is_transfer: reviewIsTransfer, categories: found ? { id: found.id, name: found.name, color: found.color } : null, owner: reviewOwner || null, trip_id: tripId, trips: foundTrip ? { id: foundTrip.id, name: foundTrip.name } : null }
        : t
    ))
    setReviewSaving(false)
    setReviewTxn(null)
  }

  const parents = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  // ── Category inline change (from review panel) ────────────────────────────
  const handleCategoryChange = async (txId: string, catId: string) => {
    const supabase = createClient()
    const newCatId = catId || null
    const found = categories.find(c => c.id === newCatId) ?? null
    const makeTransfer = found?.is_transfer ?? false
    const updates: Record<string, unknown> = makeTransfer
      ? { category_id: null, is_transfer: true }
      : { category_id: newCatId, is_transfer: false }
    await supabase.from('transactions').update(updates).eq('id', txId)
    setItems(prev => prev.map(t =>
      t.id === txId
        ? { ...t, is_transfer: makeTransfer, categories: found && !makeTransfer ? { id: found.id, name: found.name, color: found.color, icon: found.icon } : null }
        : t
    ))
  }

  // ── Category picker handler ───────────────────────────────────────────────
  const handleCatPick = async (catId: string) => {
    if (!catPickerTx) return
    const txId = catPickerTx.id
    setCatPickerTx(null)
    if (catId === '__transfer__') {
      const supabase = createClient()
      await supabase.from('transactions').update({ is_transfer: true, category_id: null }).eq('id', txId)
      setItems(prev => prev.map(t => t.id === txId ? { ...t, is_transfer: true, categories: null } : t))
    } else {
      await handleCategoryChange(txId, catId)
    }
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
    await supabase.from('transactions').update({ category_id: catId }).in('id', ids)
    const found = categories.find(c => c.id === catId) ?? null
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, categories: found ? { id: found.id, name: found.name, color: found.color } : null } : t))
    setSelectedIds(new Set()); setSelectMode(false); setBulkLoading(false)
  }
  const bulkMarkTransfer = async () => {
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ is_transfer: true, category_id: null }).in('id', ids)
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_transfer: true, categories: null } : t))
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
  const uniqueAccounts = useMemo(
    () => [...new Set(items.map(t => t.account_name).filter(Boolean) as string[])].sort(),
    [items]
  )
  const activeFilterCount = selectedAccounts.size + selectedCatIds.size + selectedOwners.size + selectedTripIds.size + (typeFilter ? 1 : 0)

  const filtered = useMemo(() => {
    const result = items.filter(t => {
      if (selectedAccounts.size > 0 && !selectedAccounts.has(t.account_name ?? '')) return false
      if (selectedCatIds.size > 0) {
        const txCatId = t.categories?.id ?? ''
        const txCat = categories.find(c => c.id === txCatId)
        const txParentId = txCat?.parent_id ?? ''
        // Match exact sub-category, OR its parent if parent is selected (catches leaf categories with no sub-categories selected)
        if (!selectedCatIds.has(txCatId) && !selectedCatIds.has(txParentId)) return false
      }
      if (selectedOwners.size > 0 && !selectedOwners.has(t.owner ?? '')) return false
      if (selectedTripIds.size > 0 && !selectedTripIds.has(t.trip_id ?? '')) return false
      if (typeFilter === 'income' && t.amount < 0) return false
      if (typeFilter === 'expense' && t.amount >= 0) return false
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
  }, [items, search, selectedAccounts, selectedCatIds, selectedOwners, selectedTripIds, sortOrder])

  const grouped = useMemo(
    () => groupByDate(filtered, sortOrder === 'date-asc'),
    [filtered, sortOrder]
  )

  const clearFilters = () => {
    setSelectedAccounts(new Set())
    setSelectedCatIds(new Set())
    setSelectedOwners(new Set())
    setSelectedTripIds(new Set())
    setTypeFilter(null)
  }

  const removeAccountFilter = (a: string) => {
    const n = new Set(selectedAccounts); n.delete(a); setSelectedAccounts(n)
  }
  const removeCatFilter = (id: string) => {
    const n = new Set(selectedCatIds); n.delete(id); setSelectedCatIds(n)
  }
  const removeOwnerFilter = (o: string) => {
    const n = new Set(selectedOwners); n.delete(o); setSelectedOwners(n)
  }
  const removeTripFilter = (id: string) => {
    const n = new Set(selectedTripIds); n.delete(id); setSelectedTripIds(n)
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-3">No transactions this month</p>
        <Link href="/budget/new" className="text-blue-600 hover:underline text-sm">+ Add a transaction</Link>
      </div>
    )
  }

  const transferCatIds = new Set(categories.filter(c => c.is_transfer).map(c => c.id))

  return (
    <div>
      {/* ── Search + filter bar ────────────────────────────────────────────── */}
      <div className="flex gap-2 pt-4 pb-2">
        {/* Search */}
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

        {/* Filter button */}
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

        {/* Select button */}
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
          {[...selectedAccounts].map(a => (
            <span key={a} className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
              {a}
              <button onClick={() => removeAccountFilter(a)} className="text-blue-400 hover:text-blue-600 leading-none">×</button>
            </span>
          ))}
          {[...selectedCatIds].map(id => {
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
              {o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : 'Shared'}
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
      {(activeFilterCount > 0 || search) && filtered.length > 0 && (() => {
        const nonTransfer = filtered.filter(t => !t.is_transfer)
        const spent  = nonTransfer.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
        const income = nonTransfer.filter(t => t.amount > 0).reduce((s, t) => s + Number(t.amount), 0)
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
        <p className="text-center text-gray-400 py-12 text-sm">
          {search ? `No results for "${search}"` : 'No transactions match your filters'}
        </p>
      ) : (
        (sortOrder === 'amount-desc' || sortOrder === 'amount-asc' ? [['', filtered] as [string, Transaction[]]] : grouped).map(([date, txns]) => {
          const dayTotal = (txns as Transaction[])
            .filter(t => !t.is_transfer && !t.is_pending && !transferCatIds.has(t.categories?.id ?? '') && t.amount < 0)
            .reduce((s, t) => s + Math.abs(Number(t.amount)), 0)

          return (
            <div key={date || 'flat'}>
              {/* Date header */}
              {date && (
                <div className="flex items-center justify-between py-2.5 mt-2">
                  <span className="text-sm font-semibold text-gray-500">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric'
                    })}
                  </span>
                  {dayTotal > 0 && (
                    <span className="text-sm text-gray-400">${dayTotal.toFixed(2)}</span>
                  )}
                </div>
              )}

              {/* Rows */}
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
                      className={`flex items-center gap-3 py-3 cursor-pointer rounded-lg px-2 transition ${
                        selectMode && selectedIds.has(t.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={selectMode ? () => toggleSelect(t.id) : () => openReview(t)}
                    >
                      {/* Checkbox */}
                      {selectMode && (
                        <input type="checkbox"
                          checked={selectedIds.has(t.id)}
                          onChange={() => toggleSelect(t.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 flex-shrink-0 rounded border-gray-300 text-blue-600" />
                      )}

                      {/* Category icon — tap to change category */}
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

                      {/* Name + pending */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {t.is_pending && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                              P
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
                          {t.trips && (
                            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              ✈ {t.trips.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                        t.is_pending ? 'text-amber-500'
                        : t.is_transfer ? 'text-gray-400'
                        : t.amount >= 0 ? 'text-green-600'
                        : 'text-gray-900'
                      }`}>
                        {t.amount >= 0 && !t.is_transfer ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                      </span>

                      {/* Owner avatar */}
                      <OwnerAvatar owner={t.owner} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
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
          selectedOwners={selectedOwners}
          onOwnersChange={setSelectedOwners}
          trips={trips}
          selectedTripIds={selectedTripIds}
          onTripsChange={setSelectedTripIds}
          onClear={clearFilters}
        />
      )}

      {/* ── Review panel ───────────────────────────────────────────────────── */}
      {reviewTxn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setReviewTxn(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 space-y-5"
            onClick={e => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-gray-900 truncate">{reviewTxn.merchant || reviewTxn.description || 'Transaction'}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {new Date(reviewTxn.transacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {reviewTxn.account_name && <> · {reviewTxn.account_name}</>}
              </p>
              <p className={`text-2xl font-bold mt-1 ${reviewTxn.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {reviewTxn.amount >= 0 ? '+' : ''}${Math.abs(reviewTxn.amount).toFixed(2)}
              </p>
            </div>

            {/* Type */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</p>
              <div className="flex gap-2">
                {(['income/expense', 'transfer'] as const).map(type => (
                  <button key={type} onClick={() => setReviewIsTransfer(type === 'transfer')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      (type === 'transfer') === reviewIsTransfer
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}>
                    {type === 'transfer' ? 'Transfer' : 'Income / Expense'}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            {!reviewIsTransfer && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</p>
                <select value={reviewCatId} onChange={e => setReviewCatId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Uncategorized</option>
                  {parents.map(parent => {
                    const subs = children.filter(c => c.parent_id === parent.id)
                    const pEmoji = getCatEmoji(parent.name, parent.icon)
                    if (subs.length === 0) return <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                    return (
                      <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                        {subs.map(child => (
                          <option key={child.id} value={child.id}>{getCatEmoji(child.name, child.icon)} {child.name}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Trip */}
            {trips.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trip</p>
                <select value={reviewTripId} onChange={e => setReviewTripId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">None</option>
                  {trips.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Owner */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Owner</p>
              <div className="flex gap-2">
                {(['', ...OWNERS] as const).map(o => (
                  <button key={o} onClick={() => setReviewOwner(o)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                      reviewOwner === o
                        ? o === 'Timothy Eng' ? 'bg-blue-600 text-white border-blue-600'
                          : o === 'Jessica Li' ? 'bg-rose-500 text-white border-rose-500'
                          : o === 'Shared' ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>
                    {o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : o === 'Shared' ? 'Shared' : 'None'}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button onClick={saveReview} disabled={reviewSaving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50">
                {reviewSaving ? 'Saving…' : 'Save'}
              </button>
              <Link href={`/budget/${reviewTxn.id}`}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
                Edit
              </Link>
              <button onClick={() => { handleDelete(reviewTxn.id); setReviewTxn(null) }}
                className="px-4 py-2.5 border border-red-100 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 transition">
                Delete
              </button>
            </div>
          </div>
        </div>
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
