'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'

const OWNERS = ['Timothy Eng', 'Jessica Li', 'Shared'] as const

interface Category {
  id: string
  name: string
  color: string
  is_income: boolean
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
  owner: string | null
  account_name: string | null
  categories: { id: string; name: string; color: string } | null
}

const OWNER_BADGE: Record<string, string> = {
  'Timothy Eng': 'bg-blue-100 text-blue-600',
  'Jessica Li':  'bg-rose-100 text-rose-600',
  'Shared':      'bg-gray-100 text-gray-500',
}
const OWNER_TABS = ['All', 'Timothy Eng', 'Jessica Li', 'Shared'] as const
type OwnerTab = typeof OWNER_TABS[number]

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
  const [items, setItems] = useState<Transaction[]>(transactions)
  const [search, setSearch] = useState('')
  const [ownerTab, setOwnerTab] = useState<OwnerTab>('All')
  const [accountFilter, setAccountFilter] = useState('')
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const justSaved = useRef(false)

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
    justSaved.current = true
    const supabase = createClient()
    const newCatId = catId || null
    await supabase.from('transactions').update({ category_id: newCatId }).eq('id', txId)
    const found = categories.find(c => c.id === newCatId) ?? null
    setItems(prev => prev.map(t =>
      t.id === txId
        ? { ...t, categories: found ? { id: found.id, name: found.name, color: found.color } : null }
        : t
    ))
    setEditingCatId(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
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
    if (!confirm(`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`)) return
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

  // ── Category select dropdown (shared) ─────────────────────────────────────
  const CategorySelect = ({ txId, currentCatId }: { txId: string; currentCatId?: string }) => (
    <select
      autoFocus
      defaultValue={currentCatId ?? ''}
      onChange={e => handleCategoryChange(txId, e.target.value)}
      onBlur={() => {
        if (!justSaved.current) setEditingCatId(null)
        justSaved.current = false
      }}
      onKeyDown={e => e.key === 'Escape' && setEditingCatId(null)}
      onClick={e => e.stopPropagation()}
      className="text-xs border border-blue-400 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px]"
    >
      <option value="">No category</option>
      {parents.map(parent => {
        const subs = children.filter(c => c.parent_id === parent.id)
        if (subs.length === 0) return <option key={parent.id} value={parent.id}>{parent.name}</option>
        return (
          <optgroup key={parent.id} label={parent.name}>
            {subs.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
          </optgroup>
        )
      })}
    </select>
  )

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
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
      <div className="space-y-4">
        {grouped.map(([date, txns]) => (
          <div key={date}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">
              {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="space-y-px">
              {txns.map(t => (
                <div
                  key={t.id}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg border transition ${
                    selectMode && selectedIds.has(t.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={selectMode ? () => toggleSelect(t.id) : undefined}
                >
                  {/* Checkbox or dot */}
                  {selectMode ? (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelect(t.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 flex-shrink-0 rounded border-gray-300 text-blue-600"
                    />
                  ) : (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.is_transfer ? '#9ca3af' : (t.categories?.color || '#d1d5db') }}
                    />
                  )}

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    {/* Description line */}
                    <p
                      className={`text-sm font-medium text-gray-900 truncate ${!selectMode ? 'cursor-pointer hover:text-blue-600 transition' : ''}`}
                      onClick={e => { e.stopPropagation(); if (!selectMode) openReview(t) }}
                    >
                      {t.description || t.merchant || 'No description'}
                    </p>

                    {/* Category row */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {t.is_transfer ? (
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Transfer</span>
                      ) : editingCatId === t.id ? (
                        <CategorySelect txId={t.id} currentCatId={t.categories?.id} />
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); if (!selectMode) setEditingCatId(t.id) }}
                          className={`text-xs text-left transition rounded px-1 -mx-1 py-0.5 ${
                            t.categories
                              ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                              : 'text-orange-400 hover:text-orange-600 hover:bg-orange-50'
                          } ${selectMode ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {t.categories?.name || 'Uncategorized'}
                        </button>
                      )}
                      {t.plaid_transaction_id && t.categories && !t.is_transfer && (
                        <span className="text-[10px] font-semibold bg-violet-100 text-violet-600 px-1 py-0.5 rounded">AI</span>
                      )}
                      {t.account_name && !accountFilter && (
                        <span className="text-[10px] text-gray-400 truncate max-w-[120px]" title={t.account_name}>
                          {t.account_name}
                        </span>
                      )}
                      {t.owner && ownerTab === 'All' && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${OWNER_BADGE[t.owner] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t.owner === 'Timothy Eng' ? 'Tim' : t.owner === 'Jessica Li' ? 'Jess' : t.owner}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount */}
                  <span className={`text-sm font-semibold flex-shrink-0 tabular-nums ${
                    t.is_transfer ? 'text-gray-400' : t.amount >= 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {t.is_transfer ? '' : t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </span>

                  {/* Delete */}
                  {!selectMode && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition flex-shrink-0"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
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
                    if (subs.length === 0) return <option key={parent.id} value={parent.id}>{parent.name}</option>
                    return (
                      <optgroup key={parent.id} label={parent.name}>
                        {subs.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
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
                if (subs.length === 0) return <option key={parent.id} value={parent.id}>{parent.name}</option>
                return (
                  <optgroup key={parent.id} label={parent.name}>
                    {subs.map(child => <option key={child.id} value={child.id}>{child.name}</option>)}
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
