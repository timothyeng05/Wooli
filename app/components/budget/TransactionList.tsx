'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

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
  categories: { id: string; name: string; color: string; icon?: string | null } | null
}

const OWNER_BADGE: Record<string, string> = {
  'Timothy Eng': 'bg-blue-100 text-blue-600',
  'Jessica Li':  'bg-rose-100 text-rose-600',
  'Shared':      'bg-gray-100 text-gray-500',
}
const OWNER_TABS = ['All', 'Timothy Eng', 'Jessica Li', 'Shared'] as const
type OwnerTab = typeof OWNER_TABS[number]


const ACCT_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#64748b']
function accountColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff
  return ACCT_COLORS[Math.abs(hash) % ACCT_COLORS.length]
}

function groupByDate(txns: Transaction[]) {
  const groups = new Map<string, Transaction[]>()
  txns.forEach(t => {
    const d = t.transacted_at.split('T')[0]
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(t)
  })
  return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a))
}

export default function TransactionList({
  transactions,
  categories = [],
}: {
  transactions: Transaction[]
  categories?: Category[]
}) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [items, setItems] = useState<Transaction[]>(transactions)
  const [search, setSearch] = useState('')
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('All')
  const [accountFilter, setAccountFilter] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  // Review panel
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null)
  const [reviewIsTransfer, setReviewIsTransfer] = useState(false)
  const [reviewCatId, setReviewCatId] = useState('')
  const [reviewOwner, setReviewOwner] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)

  const openReview = (t: Transaction) => {
    setReviewTxn(t)
    setReviewIsTransfer(!!t.is_transfer)
    setReviewCatId(t.categories?.id ?? '')
    setReviewOwner(t.owner ?? '')
  }

  const saveReview = async () => {
    if (!reviewTxn) return
    setReviewSaving(true)
    const supabase = createClient()
    const catId = reviewIsTransfer ? null : (reviewCatId || null)
    await supabase.from('transactions').update({
      is_transfer: reviewIsTransfer,
      category_id: catId,
      owner: reviewOwner || null,
    }).eq('id', reviewTxn.id)
    const found = catId ? (categories.find(c => c.id === catId) ?? null) : null
    setItems(prev => prev.map(t =>
      t.id === reviewTxn.id
        ? { ...t, is_transfer: reviewIsTransfer, categories: found ? { id: found.id, name: found.name, color: found.color } : null, owner: reviewOwner || null }
        : t
    ))
    setReviewSaving(false)
    setReviewTxn(null)
  }

  const parents = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  // ── Category inline edit ──────────────────────────────────────────────────
  const handleCategoryChange = async (txId: string, catId: string) => {
    const supabase = createClient()
    const newCatId = catId || null
    const found = categories.find(c => c.id === newCatId) ?? null
    const makeTransfer = found?.is_transfer ?? false
    const updates: Record<string, unknown> = makeTransfer
      ? { category_id: null, is_transfer: true }
      : { category_id: newCatId }
    await supabase.from('transactions').update(updates).eq('id', txId)
    setItems(prev => prev.map(t =>
      t.id === txId
        ? {
            ...t,
            is_transfer: makeTransfer ? true : t.is_transfer,
            categories: found && !makeTransfer ? { id: found.id, name: found.name, color: found.color, icon: found.icon } : null,
          }
        : t
    ))
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!await confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(t => t.id !== id))
  }

  // ── Bulk select ───────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)))
    }
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const bulkSetCategory = async (catId: string) => {
    if (!catId) return
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ category_id: catId }).in('id', ids)
    const found = categories.find(c => c.id === catId) ?? null
    setItems(prev => prev.map(t =>
      ids.includes(t.id)
        ? { ...t, categories: found ? { id: found.id, name: found.name, color: found.color } : null }
        : t
    ))
    setSelectedIds(new Set())
    setSelectMode(false)
    setBulkLoading(false)
  }

  const bulkMarkTransfer = async () => {
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').update({ is_transfer: true, category_id: null }).in('id', ids)
    setItems(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_transfer: true, categories: null } : t))
    setSelectedIds(new Set())
    setSelectMode(false)
    setBulkLoading(false)
  }

  const bulkDelete = async () => {
    if (!await confirm(`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`)) return
    setBulkLoading(true)
    const supabase = createClient()
    const ids = [...selectedIds]
    await supabase.from('transactions').delete().in('id', ids)
    setItems(prev => prev.filter(t => !ids.includes(t.id)))
    setSelectedIds(new Set())
    setSelectMode(false)
    setBulkLoading(false)
  }

  const cancelSelect = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const uniqueAccounts = [...new Set(items.map(t => t.account_name).filter(Boolean) as string[])].sort()

  const filtered = items.filter(t => {
    if (ownerTab !== 'All' && t.owner !== ownerTab) return false
    if (accountFilter && t.account_name !== accountFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.description?.toLowerCase().includes(q) ||
      t.merchant?.toLowerCase().includes(q) ||
      t.categories?.name.toLowerCase().includes(q) ||
      t.account_name?.toLowerCase().includes(q)
    )
  })

  const grouped = groupByDate(filtered)


  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No transactions this month</p>
        <Link href="/budget/new" className="text-blue-600 hover:underline text-sm">Add a transaction</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Sticky search bar */}
      <div className="sticky top-[calc(53px+44px)] md:top-0 z-20 bg-white border-b border-gray-100 -mx-6 px-6 py-2 mb-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        {search && (
          <p className="text-xs text-gray-400 mt-1 px-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {uniqueAccounts.length > 0 && (
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className={`px-2 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
              accountFilter ? 'border-blue-400 text-blue-700 font-medium' : 'border-gray-300 text-gray-600'
            }`}
          >
            <option value="">All accounts</option>
            {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <button
          onClick={() => selectMode ? cancelSelect() : setSelectMode(true)}
          className={`px-3 py-2 text-sm font-medium rounded-lg border transition whitespace-nowrap ${
            selectMode
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      {/* Owner filter tabs */}
      {items.some(t => t.owner) && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {OWNER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setOwnerTab(tab)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${
                ownerTab === tab
                  ? tab === 'Timothy Eng' ? 'bg-blue-600 text-white border-blue-600'
                  : tab === 'Jessica Li'  ? 'bg-rose-500 text-white border-rose-500'
                  : tab === 'Shared'      ? 'bg-gray-700 text-white border-gray-700'
                  :                         'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {tab === 'Timothy Eng' ? 'Tim' : tab === 'Jessica Li' ? 'Jess' : tab}
            </button>
          ))}
        </div>
      )}

      {/* Select-all row */}
      {selectMode && (
        <div className="flex items-center gap-2 px-4 py-2 mb-2 bg-gray-50 rounded-lg text-sm text-gray-600">
          <input
            type="checkbox"
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600"
          />
          <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
        </div>
      )}

      {/* Transaction rows */}
      <div>
        {grouped.map(([date, txns]) => {
          const transferCatIds = new Set(categories.filter(c => c.is_transfer).map(c => c.id))
          const dayTotal = txns.filter(t => !t.is_transfer && !t.is_pending && !transferCatIds.has(t.categories?.id ?? '') && t.amount < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
          return (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center justify-between py-2 px-1 border-b border-gray-100 mb-0.5">
                <span className="text-xs font-semibold text-gray-500">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                {dayTotal > 0 && <span className="text-xs font-semibold text-gray-400">${dayTotal.toFixed(2)}</span>}
              </div>

              {/* Rows */}
              <div className="mb-4">
                {txns.map(t => {
                  const name = t.description || t.merchant || 'No description'
                  const initial = name.trim()[0]?.toUpperCase() ?? '?'
                  const acctInitial = (t.account_name ?? '?')[0].toUpperCase()
                  const acctColor = accountColor(t.account_name ?? '')
                  const ownerInitial = t.owner === 'Timothy Eng' ? 'T' : t.owner === 'Jessica Li' ? 'J' : t.owner === 'Shared' ? 'S' : null

                  return (
                    <div
                      key={t.id}
                      className={`group flex items-center gap-3 px-2 py-2.5 rounded-lg transition cursor-pointer ${
                        selectMode && selectedIds.has(t.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={selectMode ? () => toggleSelect(t.id) : () => openReview(t)}
                    >
                      {/* Checkbox (select mode) */}
                      {selectMode && (
                        <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)}
                          onClick={e => e.stopPropagation()} className="w-4 h-4 flex-shrink-0 rounded border-gray-300 text-blue-600" />
                      )}

                      {/* Merchant name + pending badge */}
                      <div className="w-0 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                          {t.is_pending && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="hidden sm:flex items-center w-40 flex-shrink-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {t.is_transfer ? (
                          <span className="text-xs text-gray-400">↔️ Transfer</span>
                        ) : (
                          <select
                            value={t.categories?.id ?? ''}
                            onChange={e => !selectMode && handleCategoryChange(t.id, e.target.value)}
                            disabled={selectMode}
                            className={`w-full text-xs bg-transparent border-none outline-none cursor-pointer appearance-none p-0 ${
                              t.categories ? 'text-gray-600' : 'text-orange-400'
                            }`}
                          >
                            <option value="">Uncategorized</option>
                            {parents.map(parent => {
                              const subs = children.filter(c => c.parent_id === parent.id)
                              const pEmoji = getCatEmoji(parent.name, parent.icon)
                              if (subs.length === 0) return (
                                <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                              )
                              return (
                                <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                                  {subs.map(child => (
                                    <option key={child.id} value={child.id}>
                                      {getCatEmoji(child.name, child.icon)} {child.name}
                                    </option>
                                  ))}
                                </optgroup>
                              )
                            })}
                          </select>
                        )}
                      </div>

                      {/* Account */}
                      <div className="hidden md:flex items-center gap-1.5 w-48 flex-shrink-0 min-w-0">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: acctColor }}>
                          {acctInitial}
                        </div>
                        <span className="text-xs text-gray-500 truncate">{t.account_name ?? '—'}</span>
                      </div>

                      {/* Owner */}
                      <div className="hidden md:flex items-center justify-start w-16 flex-shrink-0">
                        {ownerInitial ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            t.owner === 'Timothy Eng' ? 'bg-blue-100 text-blue-600'
                            : t.owner === 'Jessica Li' ? 'bg-rose-100 text-rose-500'
                            : 'bg-gray-100 text-gray-500'
                          }`}>{ownerInitial === 'T' ? 'Tim' : ownerInitial === 'J' ? 'Jess' : 'Shared'}</span>
                        ) : <span className="w-10" />}
                      </div>

                      {/* Amount */}
                      <div className="w-24 flex-shrink-0 text-right">
                        <span className={`text-sm font-semibold tabular-nums ${
                          t.is_pending ? 'text-amber-600'
                          : t.is_transfer ? 'text-gray-400'
                          : t.amount >= 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {t.amount >= 0 && !t.is_transfer ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                        </span>
                      </div>

                      {/* Chevron */}
                      <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 group-hover:text-gray-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-center text-gray-500 py-8 text-sm">No transactions match &quot;{search}&quot;</p>
      )}

      {/* Review panel */}
      {reviewTxn && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setReviewTxn(null)}>
          <div className="absolute inset-0 bg-black/20" />
          <div
            className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div>
              <p className="font-semibold text-gray-900 truncate">{reviewTxn.description || reviewTxn.merchant || 'Transaction'}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {new Date(reviewTxn.transacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {reviewTxn.account_name && <> · {reviewTxn.account_name}</>}
              </p>
              <p className={`text-2xl font-bold mt-1 ${reviewTxn.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                {reviewTxn.amount >= 0 ? '+' : ''}${Math.abs(reviewTxn.amount).toFixed(2)}
              </p>
            </div>

            {/* Type toggle */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Type</p>
              <div className="flex gap-2">
                {(['income/expense', 'transfer'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setReviewIsTransfer(type === 'transfer')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                      (type === 'transfer') === reviewIsTransfer
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {type === 'transfer' ? 'Transfer' : 'Income / Expense'}
                  </button>
                ))}
              </div>
            </div>

            {/* Category — only shown for non-transfers */}
            {!reviewIsTransfer && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</p>
                <select
                  value={reviewCatId}
                  onChange={e => setReviewCatId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Uncategorized</option>
                  {parents.map(parent => {
                    const subs = children.filter(c => c.parent_id === parent.id)
                    const pEmoji = getCatEmoji(parent.name, parent.icon)
                    if (subs.length === 0) return (
                      <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                    )
                    return (
                      <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                        {subs.map(child => (
                          <option key={child.id} value={child.id}>
                            {getCatEmoji(child.name, child.icon)} {child.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            )}

            {/* Owner */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Owner</p>
              <div className="flex gap-2">
                {(['', ...OWNERS] as const).map(o => (
                  <button
                    key={o}
                    onClick={() => setReviewOwner(o)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${
                      reviewOwner === o
                        ? o === 'Timothy Eng' ? 'bg-blue-600 text-white border-blue-600'
                          : o === 'Jessica Li' ? 'bg-rose-500 text-white border-rose-500'
                          : o === 'Shared' ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {o === 'Timothy Eng' ? 'Tim' : o === 'Jessica Li' ? 'Jess' : o === 'Shared' ? 'Shared' : 'None'}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveReview}
                disabled={reviewSaving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {reviewSaving ? 'Saving…' : 'Save'}
              </button>
              <Link
                href={`/budget/${reviewTxn.id}`}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Full Edit
              </Link>
              <button
                onClick={() => setReviewTxn(null)}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700 mr-1">{selectedIds.size} selected</span>
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) bulkSetCategory(e.target.value) }}
              disabled={bulkLoading}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">Set category…</option>
              {parents.map(parent => {
                const subs = children.filter(c => c.parent_id === parent.id)
                const pEmoji = getCatEmoji(parent.name, parent.icon)
                if (subs.length === 0) return (
                  <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                )
                return (
                  <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                    {subs.map(child => (
                      <option key={child.id} value={child.id}>
                        {getCatEmoji(child.name, child.icon)} {child.name}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            <button
              onClick={bulkMarkTransfer}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Mark Transfer
            </button>
            <button
              onClick={bulkDelete}
              disabled={bulkLoading}
              className="px-3 py-1.5 text-sm border border-red-200 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
            >
              Delete
            </button>
            <button
              onClick={cancelSelect}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
