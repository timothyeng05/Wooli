'use client'

import { useState } from 'react'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import type { Category, Trip, SortOrder, HouseholdMember } from './transaction-types'

type FilterScreen = 'main' | 'sort' | 'accounts' | 'categories' | 'owners' | 'trips'

const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'date-desc',   label: 'Date (new to old)' },
  { value: 'date-asc',    label: 'Date (old to new)' },
  { value: 'amount-desc', label: 'Amount (high to low)' },
  { value: 'amount-asc',  label: 'Amount (low to high)' },
]

const SORT_LABEL: Record<SortOrder, string> = Object.fromEntries(SORTS.map(s => [s.value, s.label])) as Record<SortOrder, string>

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

export default function FilterPanel({
  onClose, sortOrder, onSort,
  accounts, selectedAccounts, onAccountsChange,
  categories, selectedCatIds, onCatsChange,
  members, selectedOwners, onOwnersChange,
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
  members: HouseholdMember[]
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
        {/* Header */}
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

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 130px)' }}>
          {screen === 'main' && (
            <>
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

              <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Filter By</p>
              </div>

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

          {screen === 'categories' && <>
            <button onClick={() => toggleCat('__uncategorized__')}
              className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition">
              <Checkbox checked={selectedCatIds.has('__uncategorized__')} />
              <span className="text-sm text-gray-800">Uncategorized</span>
            </button>
          </>}
          {screen === 'categories' && topCats.map(cat => {
            const subs = categories.filter(c => c.parent_id === cat.id)
            if (subs.length === 0) {
              return (
                <button key={cat.id} onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition">
                  <Checkbox checked={selectedCatIds.has(cat.id)} />
                  <span className="text-sm text-gray-800">{getCatEmoji(cat.name, cat.icon)} {cat.name}</span>
                </button>
              )
            }
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

          {screen === 'owners' && members.map(m => (
            <button
              key={m.id}
              onClick={() => toggleOwner(m.full_name)}
              className="w-full flex items-center gap-3 px-5 py-4 border-b border-gray-100 hover:bg-gray-50 transition"
            >
              <Checkbox checked={selectedOwners.has(m.full_name)} />
              <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
              <span className="text-sm text-gray-800">{m.display_name}</span>
            </button>
          ))}

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

        {/* Footer */}
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
