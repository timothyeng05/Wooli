'use client'

import { useState } from 'react'
import CardTile, { type CardSummary } from './CardTile'

export default function CardListView({ cards }: { cards: CardSummary[] }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const filtered = cards.filter(card => {
    if (filter === 'active') return card.is_active
    if (filter === 'inactive') return !card.is_active
    return true
  })

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition capitalize ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(card => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No {filter !== 'all' ? filter : ''} cards found</p>
        </div>
      )}
    </div>
  )
}
