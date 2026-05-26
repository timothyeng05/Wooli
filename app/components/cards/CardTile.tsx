'use client'

import Link from 'next/link'

interface CardSummary {
  id: string
  name: string
  issuer: string | null
  network: string | null
  annual_fee: number | null
  is_active: boolean
  opened_at?: string | null
  coreCount: number
  coreValue: number
  netValue: number
}

export type { CardSummary }

function networkBadgeClass(network: string | null): string {
  const n = (network ?? '').toLowerCase()
  if (n === 'visa') return 'bg-blue-50 text-blue-700'
  if (n === 'mastercard') return 'bg-orange-50 text-orange-700'
  if (n === 'amex' || n === 'american express') return 'bg-green-50 text-green-700'
  if (n === 'discover') return 'bg-yellow-50 text-yellow-700'
  return 'bg-gray-50 text-gray-600'
}

export default function CardTile({ card }: { card: CardSummary }) {
  const netPositive = card.netValue >= 0

  return (
    <Link href={`/cards/${card.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition p-6 cursor-pointer h-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900">{card.name}</h3>
            <p className="text-sm text-gray-600">{card.issuer || 'Unknown Issuer'}</p>
          </div>
          <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
            {card.network && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${networkBadgeClass(card.network)}`}>
                {card.network}
              </span>
            )}
            {!card.is_active && (
              <span className="inline-block bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                Inactive
              </span>
            )}
            {(() => {
              if (!card.opened_at || !card.annual_fee) return null
              const today = new Date()
              const opened = new Date(card.opened_at)
              const renewal = new Date(today.getFullYear(), opened.getMonth(), opened.getDate())
              if (renewal < today) renewal.setFullYear(today.getFullYear() + 1)
              const daysUntil = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
              if (daysUntil > 60) return null
              return (
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${daysUntil <= 14 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  Renews in {daysUntil}d
                </span>
              )
            })()}
          </div>
        </div>

        <div className="space-y-1.5 mb-4">
          <div className="text-sm">
            {card.annual_fee && card.annual_fee > 0 ? (
              <span className="text-gray-500">${card.annual_fee.toFixed(0)}/yr fee</span>
            ) : (
              <span className="text-gray-400">No annual fee</span>
            )}
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
            <p className="text-xs text-gray-500">Net Annual Value</p>
            <p className={`font-bold ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
              {netPositive ? '+' : '-'}${Math.abs(card.netValue).toFixed(0)}/yr net
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
