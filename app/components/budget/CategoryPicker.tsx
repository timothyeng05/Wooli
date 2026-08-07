'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import type { Category } from './transaction-types'

/** A directly assignable option — flattened so search can rank across the tree. */
interface PickOption {
  id: string
  name: string
  emoji: string
  bg: string
  /** Group name, shown as context on search hits. Null for top-level options. */
  parentName: string | null
}

const CheckIcon = () => (
  <svg className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function CategoryPicker({
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

  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const q = query.trim().toLowerCase()

  // Focus the box on pointer devices only. Autofocusing on a phone throws up
  // the on-screen keyboard and covers the list the user came here to browse.
  useEffect(() => {
    if (window.matchMedia('(min-width: 640px)').matches) inputRef.current?.focus()
  }, [])

  // Only leaves are assignable: a parent that has sub-categories acts as a
  // heading in the browse view and can't hold a transaction, so it must not be
  // offered as a search hit either.
  const options: PickOption[] = useMemo(() => {
    const out: PickOption[] = [
      { id: '', name: 'Uncategorized', emoji: '?', bg: '#f3f4f6', parentName: null },
      { id: '__transfer__', name: 'Transfer', emoji: '↔️', bg: '#f3f4f6', parentName: null },
    ]
    for (const p of parents) {
      const subs = children.filter(c => c.parent_id === p.id)
      if (subs.length === 0) {
        out.push({ id: p.id, name: p.name, emoji: getCatEmoji(p.name, p.icon), bg: p.color ? `${p.color}22` : '#f3f4f6', parentName: null })
      } else {
        for (const c of subs) {
          out.push({
            id: c.id,
            name: c.name,
            emoji: getCatEmoji(c.name, c.icon),
            bg: c.color ? `${c.color}22` : p.color ? `${p.color}22` : '#f3f4f6',
            parentName: p.name,
          })
        }
      }
    }
    return out
  }, [parents, children])

  // Matching the group name too means "food" surfaces Groceries and Restaurants
  // even though neither contains the word.
  const results = useMemo(() => {
    if (!q) return []
    const starts = (s: string) => s.toLowerCase().startsWith(q)
    return options
      .filter(o => o.name.toLowerCase().includes(q) || (o.parentName?.toLowerCase().includes(q) ?? false))
      // Prefix matches first — typing "tra" should put Transfer above Transit.
      .sort((a, b) => Number(starts(b.name)) - Number(starts(a.name)))
  }, [q, options])

  useEffect(() => { setActiveIdx(0) }, [q])
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }) }, [activeIdx])

  const isSelected = (id: string) =>
    id === '__transfer__' ? isTransfer
    : id === '' ? !currentCatId && !isTransfer
    : currentCatId === id

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { onClose(); return }
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length) }
    else if (e.key === 'Enter') { e.preventDefault(); onPick(results[activeIdx].id) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85dvh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <span className="text-base font-semibold text-gray-900">Change Category</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 -mr-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search categories…"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {q ? (
            results.length === 0 ? (
              <p className="px-5 py-10 text-sm text-gray-400 text-center">
                No category matches “{query.trim()}”.
              </p>
            ) : (
              results.map((o, i) => (
                <button
                  key={o.id || 'uncategorized'}
                  ref={i === activeIdx ? activeRef : undefined}
                  onClick={() => onPick(o.id)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 transition ${
                    i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: o.bg }}>
                    {o.id === '' ? <span className="text-gray-400 text-xs font-bold">?</span> : o.emoji}
                  </div>
                  <span className="text-sm text-gray-700 flex-1 text-left">
                    {o.name}
                    {o.parentName && <span className="text-gray-400"> · {o.parentName}</span>}
                  </span>
                  {isSelected(o.id) && <CheckIcon />}
                </button>
              ))
            )
          ) : (
            <>
              <button
                onClick={() => onPick('')}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">
                  <span className="text-gray-400 text-xs font-bold">?</span>
                </div>
                <span className="text-sm text-gray-700 flex-1 text-left">Uncategorized</span>
                {!currentCatId && !isTransfer && <CheckIcon />}
              </button>

              <button
                onClick={() => onPick('__transfer__')}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">↔️</div>
                <span className="text-sm text-gray-700 flex-1 text-left">Transfer</span>
                {isTransfer && <CheckIcon />}
              </button>

              {parents.map(parent => {
                const subs = children.filter(c => c.parent_id === parent.id)
                const pEmoji = getCatEmoji(parent.name, parent.icon)

                if (subs.length === 0) {
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
                      {currentCatId === parent.id && <CheckIcon />}
                    </button>
                  )
                }

                return (
                  <div key={parent.id}>
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
                          {currentCatId === child.id && <CheckIcon />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
