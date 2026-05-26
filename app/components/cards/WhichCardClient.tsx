'use client'

import { useState } from 'react'

type CardReward = { category: string; rate: number; notes: string | null }
type CardWithRates = {
  id: string
  name: string
  issuer: string | null
  rewards: CardReward[]
}

interface Props {
  cards: CardWithRates[]
  allCategories: string[]
}

const SAMPLE_AMOUNT = 100

export default function WhichCardClient({ cards, allCategories }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string>(allCategories[0] ?? '')

  if (allCategories.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg font-medium text-gray-700 mb-2">No reward rates set yet</p>
        <p className="text-sm">Add reward rates on each card&apos;s detail page to use this tool.</p>
      </div>
    )
  }

  const ranked = cards
    .map(card => {
      const reward = card.rewards.find(
        r => r.category.toLowerCase() === selectedCategory.toLowerCase()
      )
      return { card, rate: reward?.rate ?? null, notes: reward?.notes ?? null }
    })
    .sort((a, b) => {
      if (a.rate === null && b.rate === null) return 0
      if (a.rate === null) return 1
      if (b.rate === null) return -1
      return b.rate - a.rate
    })

  const withRate = ranked.filter(r => r.rate !== null)
  const withoutRate = ranked.filter(r => r.rate === null)

  return (
    <div>
      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Ranked results */}
      {withRate.length === 0 ? (
        <p className="text-gray-500 text-sm">No cards have a reward rate set for {selectedCategory}.</p>
      ) : (
        <div className="space-y-3 mb-8">
          {withRate.map(({ card, rate, notes }, i) => (
            <div
              key={card.id}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                i === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                i === 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{card.name}</p>
                {notes && <p className="text-xs text-gray-500 mt-0.5">{notes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-bold text-gray-900">{rate}x</p>
                <p className="text-xs text-gray-500">
                  ${SAMPLE_AMOUNT} &rarr; {Math.round(SAMPLE_AMOUNT * (rate ?? 0))} pts
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cards with no rate — greyed out */}
      {withoutRate.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">No rate set for {selectedCategory}</p>
          <div className="space-y-2">
            {withoutRate.map(({ card }) => (
              <div key={card.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-300 text-lg">—</span>
                </span>
                <p className="text-sm text-gray-400 font-medium">{card.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
