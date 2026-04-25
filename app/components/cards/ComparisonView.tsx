'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Benefit {
  id: string
  name: string
  amount: number | null
  amount_unit: string | null
  description: string
  benefit_notes: string | null
  benefit_categories: Array<{
    id: string
    name: string
  }> | null
}

interface TemplateBenefit {
  benefit_id: string
  is_core_default: boolean
  benefits: Benefit
}

interface CardTemplate {
  id: string
  name: string
  issuer: string
  network: string | null
  annual_fee: number | null
  template_benefits: TemplateBenefit[]
}

interface UserCard {
  id: string
  name: string
  issuer: string | null
  network: string | null
  annual_fee: number | null
}

export default function ComparisonView({
  templates,
  userCards
}: {
  templates: CardTemplate[]
  userCards: UserCard[]
}) {
  const [selectedCards, setSelectedCards] = useState<string[]>(templates.slice(0, 2).map(t => t.id))
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('overview')

  // Get unique categories
  const allCategories = new Set<string>()
  templates.forEach(t => {
    t.template_benefits.forEach(tb => {
      const cats = Array.isArray(tb.benefits.benefit_categories)
        ? tb.benefits.benefit_categories
        : tb.benefits.benefit_categories ? [tb.benefits.benefit_categories] : []
      cats.forEach(cat => allCategories.add(cat.name))
    })
  })
  const categories = Array.from(allCategories).sort()

  // Get benefits for selected cards, filtered by category
  const getCardBenefits = (cardId: string) => {
    const template = templates.find(t => t.id === cardId)
    if (!template) return []

    let benefits = template.template_benefits.map(tb => tb.benefits)
    if (filterCategory) {
      benefits = benefits.filter(b => {
        const cats = Array.isArray(b.benefit_categories)
          ? b.benefit_categories
          : b.benefit_categories ? [b.benefit_categories] : []
        return cats.some(cat => cat.name === filterCategory)
      })
    }
    return benefits.sort((a, b) => a.name.localeCompare(b.name))
  }

  const getEstimatedValue = (template: CardTemplate): string => {
    const benefitCount = template.template_benefits.length
    const feeValue = template.annual_fee || 0
    return `$${(benefitCount * 50 + feeValue).toLocaleString()}`
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`
        .card-csr { border-top: 4px solid #0066cc; }
        .card-amex { border-top: 4px solid #006fcf; }
        .comparison-row:nth-child(even) { background: #f9fafb; }
        .comparison-row:hover { background: #f3f4f6; transition: all 0.2s; }
      `}</style>

      {/* Card Selection Section */}
      <div className="mb-12">
        <p className="text-lg text-gray-600 mb-8">
          {selectedCards.length > 0
            ? `Comparing ${selectedCards.length} card${selectedCards.length !== 1 ? 's' : ''}`
            : 'Select cards below to compare benefits'}
        </p>

        {/* Card Selection Grid */}
        {templates.length === 0 ? (
          <p className="text-gray-600">No card templates available. Run "Sync Benefits" first.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedCards(prev =>
                    prev.includes(template.id)
                      ? prev.filter(id => id !== template.id)
                      : [...prev, template.id].slice(-3)
                  )
                }}
                className={`p-4 rounded-lg border-2 transition text-left cursor-pointer ${
                  selectedCards.includes(template.id)
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-blue-300'
                }`}
              >
                <div className="font-semibold text-gray-900 text-sm">{template.name}</div>
                <div className="text-xs text-gray-600 mt-1">{template.issuer}</div>
                <div className="text-xs text-gray-500 mt-1">
                  ${template.annual_fee || 0}/yr
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCards.length === 0 ? (
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-600 text-lg">Select at least one card above to begin comparing</p>
        </div>
      ) : (
        <>
          {/* Card Info Boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {selectedCards.map(cardId => {
              const template = templates.find(t => t.id === cardId)
              if (!template) return null
              return (
                <div
                  key={cardId}
                  className={`rounded-xl shadow-sm p-8 border border-gray-200 ${
                    template.issuer?.toLowerCase().includes('chase')
                      ? 'card-csr'
                      : 'card-amex'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">{template.name}</h2>
                      <p className="text-gray-600 text-sm mt-1">{template.issuer}</p>
                    </div>
                    <span className="bg-gradient-to-br from-blue-600 to-blue-800 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      ${template.annual_fee || 0}/yr
                    </span>
                  </div>
                  <p className="text-gray-600 mb-6">
                    {template.issuer?.toLowerCase().includes('chase')
                      ? 'Premium travel card with flexible credits'
                      : 'Premium travel card with elite benefits'}
                  </p>
                  <div className="pt-6 border-t border-gray-200">
                    <div className="text-sm text-gray-600">Est. Annual Value</div>
                    <div className="text-3xl font-bold text-green-600">
                      {getEstimatedValue(template)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Filter by Category</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filterCategory === null
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  All Benefits
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      filterCategory === cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div className="mb-12">
            <h3 id="benefits" className="text-2xl font-bold text-gray-900 mb-6">
              Benefit Comparison
            </h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Benefit</th>
                      {selectedCards.map(cardId => {
                        const template = templates.find(t => t.id === cardId)
                        return (
                          <th key={cardId} className="px-6 py-4 text-center text-sm font-bold text-gray-900">
                            <div>{template?.name}</div>
                            <div className="text-xs text-gray-600 font-normal">${template?.annual_fee}/yr</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const allBenefits = new Map<string, Benefit>()
                      selectedCards.forEach(cardId => {
                        const benefits = getCardBenefits(cardId)
                        benefits.forEach(b => allBenefits.set(b.id, b))
                      })
                      return Array.from(allBenefits.values())
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((benefit, idx) => (
                          <tr key={benefit.id} className="comparison-row">
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="font-semibold">{benefit.name}</div>
                              {benefit.description && (
                                <div className="text-xs text-gray-600 mt-1">{benefit.description}</div>
                              )}
                            </td>
                            {selectedCards.map(cardId => {
                              const cardBenefits = getCardBenefits(cardId)
                              const hasBenefit = cardBenefits.some(b => b.id === benefit.id)
                              return (
                                <td key={cardId} className="px-6 py-4 text-center">
                                  {hasBenefit ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="text-xl">✓</span>
                                      {benefit.amount && (
                                        <span className="text-xs text-gray-600">
                                          ${benefit.amount} {benefit.amount_unit}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* The Verdict */}
          <div id="verdict" className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-8 mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-8">The Verdict</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {selectedCards.map(cardId => {
                const template = templates.find(t => t.id === cardId)
                if (!template) return null
                const isChase = template.issuer?.toLowerCase().includes('chase')
                return (
                  <div key={cardId} className="bg-white rounded-lg p-8 shadow-sm border border-gray-200">
                    <h4 className="text-xl font-bold text-gray-900 mb-4">
                      Choose {template.name} if...
                    </h4>
                    <ul className="space-y-2 text-gray-700">
                      {isChase ? (
                        <>
                          <li>• You prioritize travel flexibility and transfers</li>
                          <li>• You value exceptional dining credit programs</li>
                          <li>• You need broad merchant acceptance (Visa)</li>
                          <li>• You prefer lower fees with premium benefits</li>
                        </>
                      ) : (
                        <>
                          <li>• You want the broadest set of elite benefits</li>
                          <li>• Amex's hotel and airline partnerships appeal to you</li>
                          <li>• You value concierge services and status</li>
                          <li>• You're willing to pay premium for luxury perks</li>
                        </>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
