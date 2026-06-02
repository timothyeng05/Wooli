'use client'

import { getCatEmoji } from '@/app/components/budget/catEmoji'
import type { Category } from './transaction-types'

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '85dvh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-base font-semibold text-gray-900">Change Category</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 -mr-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85dvh - 73px)' }}>
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
