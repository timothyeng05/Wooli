'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CardTemplate {
  id: string
  name: string
  issuer: string | null
  network: string | null
  annual_fee: number | null
  template_benefits: Array<{
    benefit_id: string
    is_core_default: boolean
    benefits: {
      id: string
      name: string
      category_id: string
      amount: number | null
      amount_unit: string | null
      period_type: string | null
      period_frequency: number | null
      description: string | null
      benefit_categories: {
        id: string
        name: string
      } | null
    }
  }>
}

export default function CardTemplateSelector({
  templates,
  userId
}: {
  templates: CardTemplate[]
  userId: string
}) {
  const router = useRouter()
  const [step, setStep] = useState<'search' | 'benefits' | 'loading'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<CardTemplate | null>(null)
  const [coreBenefits, setCoreBenefits] = useState<Set<string>>(new Set())
  const [removedBenefits, setRemovedBenefits] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [periodOverrides, setPeriodOverrides] = useState<Record<string, string>>({})
  const [openedAt, setOpenedAt] = useState('')

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.issuer?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  )

  const handleSelectTemplate = (template: CardTemplate) => {
    setSelectedTemplate(template)
    setCoreBenefits(new Set(template.template_benefits.filter(tb => tb.is_core_default).map(tb => tb.benefit_id)))
    setRemovedBenefits(new Set())
    setPeriodOverrides({})
    setStep('benefits')
  }

  const toggleBenefit = (benefitId: string) => {
    const newCore = new Set(coreBenefits)
    if (newCore.has(benefitId)) {
      newCore.delete(benefitId)
    } else {
      newCore.add(benefitId)
    }
    setCoreBenefits(newCore)
  }

  const handleCreateCard = async () => {
    if (!selectedTemplate) return

    setLoading(true)
    setStep('loading')

    try {
      const res = await fetch('/api/create-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          coreBenefits: Array.from(coreBenefits),
          removedBenefits: Array.from(removedBenefits),
          periodOverrides,
          templateData: selectedTemplate,
          openedAt: openedAt || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create card')
      }

      router.push(`/cards/${data.cardId}`)
    } catch (err: any) {
      console.error('Full error:', err)
      setCreateError(err.message || JSON.stringify(err))
      setStep('benefits')
      setLoading(false)
    }
  }

  if (step === 'search') {
    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Search Card Template
          </label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Chase Sapphire Reserve, Amex Platinum..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="p-4 rounded-lg border-2 border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 transition text-left"
              >
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{template.issuer}</p>
                {template.annual_fee && (
                  <p className="text-sm text-gray-500 mt-1">${template.annual_fee}/year</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {template.template_benefits.length} benefits
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No templates found</p>
        )}
      </div>
    )
  }

  if (step === 'benefits' && selectedTemplate) {
    const periodMultiplier = (period: string) =>
      period === 'monthly' ? 12 : period === 'quarterly' ? 4 : period === 'biannual' ? 2 : 1

    const coreValue = selectedTemplate.template_benefits
      .filter(tb => coreBenefits.has(tb.benefit_id) && tb.benefits.amount_unit === '$')
      .reduce((sum, tb) => {
        const period = periodOverrides[tb.benefit_id] || tb.benefits.period_type || 'annual'
        return sum + (tb.benefits.amount || 0) * periodMultiplier(period)
      }, 0)

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="text-lg font-bold text-gray-900">{selectedTemplate.name}</h2>
          <p className="text-gray-600 text-sm mt-1">{selectedTemplate.issuer}</p>
          <div className="mt-4 flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Annual Fee:</span>
              <span className="font-semibold text-gray-900 ml-2">${selectedTemplate.annual_fee || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Core Benefits Value:</span>
              <span className="font-semibold text-green-600 ml-2">${coreValue}</span>
            </div>
            <div>
              <span className="text-gray-600">Net Value:</span>
              <span className={`font-semibold ml-2 ${coreValue >= (selectedTemplate.annual_fee || 0) ? 'text-green-600' : 'text-red-600'}`}>
                ${coreValue - (selectedTemplate.annual_fee || 0)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-600 whitespace-nowrap">Date opened:</label>
            <input
              type="date"
              value={openedAt}
              onChange={e => setOpenedAt(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">Used to track annual fee renewal</span>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Select Core Benefits</h3>
          <p className="text-sm text-gray-600 mb-4">Mark benefits you actually use. Core benefits are measured against your annual fee.</p>

          {(() => {
            // Group by category, sort benefits: dollar value first
            const grouped = new Map<string, typeof selectedTemplate.template_benefits>()
            selectedTemplate.template_benefits
              .filter(tb => !removedBenefits.has(tb.benefit_id))
              .forEach(tb => {
                const cat = tb.benefits.benefit_categories?.name || 'Other'
                if (!grouped.has(cat)) grouped.set(cat, [])
                grouped.get(cat)!.push(tb)
              })

            const PERIOD_OPTIONS = ['annual', 'biannual', 'monthly', 'quarterly', 'card anniversary', 'ad hoc']

            const annualValue = (amount: number, period: string) => {
              if (period === 'monthly') return amount * 12
              if (period === 'quarterly') return amount * 4
              if (period === 'biannual') return amount * 2
              return amount // annual, card anniversary, ad hoc
            }

            const CATEGORY_ORDER = ['Travel', 'Dining', 'Lifestyle', 'Insurance']
            const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
              const ai = CATEGORY_ORDER.indexOf(a)
              const bi = CATEGORY_ORDER.indexOf(b)
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            })

            return (
              <div className="space-y-6">
                {sortedGroups.map(([catName, benefits]) => {
                  const sorted = [...benefits].sort((a, b) => {
                    const aHas = a.benefits.amount != null
                    const bHas = b.benefits.amount != null
                    if (aHas !== bHas) return aHas ? -1 : 1
                    if (coreBenefits.has(a.benefit_id) !== coreBenefits.has(b.benefit_id))
                      return coreBenefits.has(a.benefit_id) ? -1 : 1
                    return 0
                  })

                  return (
                    <div key={catName}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{catName}</h4>
                      <div className="space-y-2">
                        {sorted.map(tb => {
                          const isMoney = tb.benefits.amount_unit === '$'
                          const hasAmount = tb.benefits.amount != null && isMoney
                          const period = periodOverrides[tb.benefit_id] || tb.benefits.period_type || 'annual'
                          const isCore = coreBenefits.has(tb.benefit_id)

                          return (
                            <div key={tb.benefit_id} className={`p-3 rounded-lg border transition ${isCore ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isCore}
                                  onChange={() => toggleBenefit(tb.benefit_id)}
                                  className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                                />

                                {/* Left: name + description */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-gray-900 text-sm leading-snug">{tb.benefits.name}</span>
                                    <button
                                      onClick={e => { e.preventDefault(); setRemovedBenefits(prev => new Set([...prev, tb.benefit_id])) }}
                                      className="ml-1 text-gray-300 hover:text-red-400 transition text-xs leading-none flex-shrink-0"
                                      title="Remove this benefit"
                                    >✕</button>
                                  </div>
                                  {tb.benefits.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{tb.benefits.description}</p>
                                  )}
                                </div>

                                {/* Right: value + period */}
                                <div className="flex-shrink-0 w-24 text-right">
                                  {hasAmount && (
                                    <div className="text-base font-bold text-green-600 leading-tight mb-1">
                                      ${annualValue(tb.benefits.amount!, period)}{period === 'ad hoc' ? '' : '/yr'}
                                    </div>
                                  )}
                                  <select
                                    value={period}
                                    onChange={e => setPeriodOverrides(prev => ({ ...prev, [tb.benefit_id]: e.target.value }))}
                                    className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {PERIOD_OPTIONS.map(p => (
                                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {createError && (
          <pre className="text-xs bg-red-50 border border-red-200 rounded p-3 text-red-800 overflow-auto">{createError}</pre>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setStep('search')
              setSelectedTemplate(null)
              setSearchQuery('')
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition text-sm font-medium"
          >
            Back
          </button>
          <button
            onClick={handleCreateCard}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? 'Creating...' : 'Create Card'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <p className="text-gray-600">Creating card...</p>
    </div>
  )
}
