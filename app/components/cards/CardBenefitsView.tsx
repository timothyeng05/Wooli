'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { CATEGORY_ORDER, annualizedValue } from '@/lib/card-utils'

interface CardBenefit {
  id: string
  benefit_id: string
  is_core: boolean
  usage_data: Record<string, boolean> | null
  benefits: {
    name: string
    amount: number | null
    amount_unit: string | null
    period_type: string | null
    period_frequency: number | null
    description: string | null
    benefit_categories: { id: string; name: string } | null
  }
}

export default function CardBenefitsView({
  cardId,
  benefits,
  annualFee
}: {
  cardId: string
  benefits: CardBenefit[]
  annualFee: number | null
}) {
  const [expanding, setExpanding] = useState<string | null>(null)
  const [usageData, setUsageData] = useState<Record<string, Record<string, boolean>>>(() => {
    const data: Record<string, Record<string, boolean>> = {}
    benefits.forEach(b => { data[b.id] = b.usage_data || {} })
    return data
  })
  const [saving, setSaving] = useState(false)

  const handleToggleUsage = (benefitId: string, period: string) => {
    setUsageData(prev => ({
      ...prev,
      [benefitId]: { ...prev[benefitId], [period]: !prev[benefitId]?.[period] }
    }))
  }

  const handleSave = async (benefitId: string) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('card_benefits')
        .update({ usage_data: usageData[benefitId] })
        .eq('id', benefitId)
      if (error) throw error
      setExpanding(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save usage')
    } finally {
      setSaving(false)
    }
  }

  const renderPeriodTracker = (benefit: CardBenefit) => {
    const period = benefit.benefits.period_type

    if (period === 'quarterly') {
      return (
        <div className="flex gap-4 mt-3">
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <label key={q} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usageData[benefit.id]?.[q] || false}
                onChange={() => handleToggleUsage(benefit.id, q)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">{q}</span>
            </label>
          ))}
        </div>
      )
    }

    if (period === 'monthly') {
      return (
        <div className="grid grid-cols-6 gap-2 mt-3">
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={usageData[benefit.id]?.[m] || false}
                onChange={() => handleToggleUsage(benefit.id, m)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-xs text-gray-700">{m}</span>
            </label>
          ))}
        </div>
      )
    }

    if (period === 'biannual') {
      return (
        <div className="flex gap-4 mt-3">
          {['H1 (Jan–Jun)', 'H2 (Jul–Dec)'].map(h => (
            <label key={h} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={usageData[benefit.id]?.[h] || false}
                onChange={() => handleToggleUsage(benefit.id, h)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">{h}</span>
            </label>
          ))}
        </div>
      )
    }

    return (
      <label className="flex items-center gap-2 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={usageData[benefit.id]?.['used'] || false}
          onChange={() => handleToggleUsage(benefit.id, 'used')}
          className="w-4 h-4 text-blue-600 rounded"
        />
        <span className="text-sm text-gray-700">Used this year</span>
      </label>
    )
  }

  // Group all benefits by category
  const grouped = new Map<string, CardBenefit[]>()
  benefits.forEach(b => {
    const cat = b.benefits.benefit_categories?.name || 'Other'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(b)
  })

  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
    const ai = CATEGORY_ORDER.indexOf(a)
    const bi = CATEGORY_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const coreBenefits = benefits.filter(b => b.is_core)
  const totalCoreValue = coreBenefits
    .filter(b => b.benefits.amount_unit === '$' && b.benefits.amount != null)
    .reduce((sum, b) => sum + annualizedValue(b.benefits.amount!, b.benefits.period_type), 0)
  const netValue = totalCoreValue - (annualFee ?? 0)

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-8 text-sm">
        <div>
          <span className="text-gray-600">Core Benefits Value:</span>
          <span className="font-bold text-green-600 ml-2">${totalCoreValue.toFixed(0)}/yr</span>
        </div>
        <div>
          <span className="text-gray-600">Annual Fee:</span>
          <span className="font-semibold text-gray-900 ml-2">${(annualFee ?? 0).toFixed(0)}</span>
        </div>
        <div>
          <span className="text-gray-600">Net Value:</span>
          <span className={`font-bold ml-2 ${netValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {netValue >= 0 ? '+' : '-'}${Math.abs(netValue).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Benefits by category */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Benefits</h2>

        <div className="space-y-8">
          {sortedGroups.map(([catName, catBenefits]) => {
            const sorted = [...catBenefits].sort((a, b) => {
              if (a.is_core !== b.is_core) return a.is_core ? -1 : 1
              const aHas = a.benefits.amount != null && a.benefits.amount_unit === '$'
              const bHas = b.benefits.amount != null && b.benefits.amount_unit === '$'
              if (aHas !== bHas) return aHas ? -1 : 1
              return 0
            })

            return (
              <div key={catName}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{catName}</h3>
                <div className="space-y-2">
                  {sorted.map(benefit => {
                    const isMoney = benefit.benefits.amount_unit === '$'
                    const hasAmount = benefit.benefits.amount != null && isMoney
                    const annVal = hasAmount
                      ? annualizedValue(benefit.benefits.amount!, benefit.benefits.period_type)
                      : null
                    const isExpanded = expanding === benefit.id

                    return (
                      <div
                        key={benefit.id}
                        className={`rounded-lg border transition ${
                          benefit.is_core
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-white opacity-80'
                        }`}
                      >
                        <button
                          onClick={() => setExpanding(isExpanded ? null : benefit.id)}
                          className="w-full text-left p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900 text-sm">{benefit.benefits.name}</span>
                                {benefit.is_core && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Core</span>
                                )}
                              </div>
                              {benefit.benefits.description && (
                                <p className="text-xs text-gray-500 mt-0.5 leading-snug pr-4">{benefit.benefits.description}</p>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {annVal !== null && (
                                <div className="text-base font-bold text-green-600 leading-tight">
                                  ${annVal}{benefit.benefits.period_type === 'ad hoc' ? '' : '/yr'}
                                </div>
                              )}
                              <div className="text-xs text-gray-400 capitalize mt-0.5">
                                {benefit.benefits.period_type || 'annual'}
                              </div>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-blue-100">
                            <p className="text-sm font-medium text-gray-900 mt-3 mb-1">Track usage:</p>
                            {renderPeriodTracker(benefit)}
                            <button
                              onClick={() => handleSave(benefit.id)}
                              disabled={saving}
                              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
