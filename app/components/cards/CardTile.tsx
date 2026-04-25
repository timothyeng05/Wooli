'use client'

import Link from 'next/link'

interface CardSummary {
  id: string
  name: string
  issuer: string | null
  network: string | null
  annual_fee: number | null
  is_active: boolean
  coreCount: number
  coreValue: number
  netValue: number
}

export type { CardSummary }

export default function CardTile({ card }: { card: CardSummary }) {
  const netPositive = card.netValue >= 0

  return (
    <Link href={`/cards/${card.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 cursor-pointer h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{card.name}</h3>
            <p className="text-sm text-gray-600">{card.issuer || 'Unknown Issuer'}</p>
          </div>
          {!card.is_active && (
            <span className="ml-2 inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs font-medium">
              Inactive
            </span>
          )}
        </div>

        <div className="space-y-2 mb-4">
          {card.network && (
            <div className="text-sm">
              <span className="text-gray-600">Network: </span>
              <span className="font-medium text-gray-900">{card.network}</span>
            </div>
          )}
          <div className="text-sm">
            <span className="text-gray-600">Annual Fee: </span>
            <span className="font-medium text-gray-900">
              {card.annual_fee !== null ? `$${card.annual_fee.toFixed(0)}` : 'None'}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Core Benefits: </span>
            <span className="font-medium text-gray-900">{card.coreCount}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Benefits Value</p>
            <p className="font-bold text-green-600">${card.coreValue.toFixed(0)}/yr</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Net Value</p>
            <p className={`font-bold ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
              {netPositive ? '+' : '-'}${Math.abs(card.netValue).toFixed(0)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
