'use client'

import Link from 'next/link'

export default function CardWidget({
  cards
}: {
  cards: Array<{
    id: string
    name: string
    annual_fee: number | null
    is_active: boolean
  }>
}) {
  const activeCards = cards.filter((c) => c.is_active)

  return (
    <Link href="/cards">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 hover:shadow-md transition cursor-pointer h-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Cards</h2>
          <span className="text-2xl">💳</span>
        </div>

        {activeCards.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Your cards</p>
            <div className="space-y-2">
              {activeCards.slice(0, 3).map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm"
                >
                  <span className="font-medium text-gray-900">{card.name}</span>
                  {card.annual_fee && <span className="text-gray-600">${card.annual_fee.toFixed(0)}</span>}
                </div>
              ))}
            </div>
            {activeCards.length > 3 && (
              <p className="text-xs text-gray-500">+{activeCards.length - 3} more</p>
            )}
            <p className="text-xs text-blue-600 font-medium mt-3">View all →</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-3">Track your credit card rewards</p>
            <p className="text-xs text-blue-600 font-medium">Get started →</p>
          </div>
        )}
      </div>
    </Link>
  )
}
