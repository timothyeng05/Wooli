'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from '@/app/components/budget/catEmoji'

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  is_transfer: boolean
  parent_id: string | null
  sort_order: number
  budget_level: string | null
}

interface ParentGroup extends Category {
  children: Category[]
}

interface Props {
  categories: Category[]
  actuals: Record<string, number>
  budgets: Record<string, number>
  userId: string
  month: string
  uncategorizedIncome: number
  uncategorizedExpenses: number
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Remaining pill badge ──────────────────────────────────────────────────────
function RemainingPill({ remaining, isOver, isIncome, hasPlanned }: {
  remaining: number
  isOver: boolean
  isIncome: boolean
  hasPlanned: boolean
}) {
  if (!hasPlanned) return <span className="text-sm text-gray-300 w-20 md:w-28 text-right block">—</span>

  const met = isIncome && remaining <= 0
  const bg = isOver ? 'bg-red-100 text-red-600' : met ? 'bg-green-100 text-green-700' : remaining > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums min-w-[64px] ${bg}`}>
      {remaining < 0 ? '-' : ''}${fmt(Math.abs(remaining))}
    </span>
  )
}

// ── Inline planned amount input ───────────────────────────────────────────────
function PlannedCell({ value, onSave, compact }: { value: number; onSave: (v: number) => void; compact?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="1"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { onSave(parseFloat(draft) || 0); setEditing(false) }}
        onKeyDown={e => {
          if (e.key === 'Enter') { onSave(parseFloat(draft) || 0); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`${compact ? 'w-20' : 'w-24'} px-2 py-0.5 text-sm border border-blue-400 rounded-lg bg-white tabular-nums text-right focus:outline-none focus:ring-1 focus:ring-blue-500`}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value > 0 ? String(value) : ''); setEditing(true) }}
      className={`${compact ? 'w-20' : 'w-24'} px-2 py-0.5 text-sm tabular-nums text-right rounded-lg border transition ${
        value > 0
          ? 'border-gray-200 hover:border-blue-300 text-gray-700 bg-white'
          : 'border-dashed border-gray-200 hover:border-blue-300 text-gray-300 bg-white'
      }`}
    >
      {value > 0 ? `$${fmt(value)}` : '$0'}
    </button>
  )
}

// ── Budget level toggle icon ──────────────────────────────────────────────────
function BudgetLevelIcon({ level }: { level: 'parent' | 'sub' }) {
  if (level === 'sub') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
        <rect x="1" y="2.5" width="14" height="2" rx="1" />
        <rect x="1" y="7" width="10" height="2" rx="1" />
        <rect x="1" y="11.5" width="7" height="2" rx="1" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="3" width="14" height="3" rx="1" />
      <rect x="1" y="10" width="9" height="2" rx="1" opacity="0.35" />
    </svg>
  )
}

export default function BudgetTargetsClient({ categories, actuals, budgets: initialBudgets, userId, month, uncategorizedIncome, uncategorizedExpenses }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [localBudgets, setLocalBudgets] = useState<Record<string, number>>(initialBudgets)
  const [localLevels, setLocalLevels] = useState<Record<string, 'parent' | 'sub'>>(() => {
    const out: Record<string, 'parent' | 'sub'> = {}
    for (const c of categories) {
      if (!c.parent_id) out[c.id] = (c.budget_level as 'parent' | 'sub') ?? 'parent'
    }
    return out
  })
  const [openGroups, setOpenGroups] = useState<Set<string>>(() =>
    new Set(categories.filter(c => !c.parent_id).map(c => c.id))
  )

  const [yearN, monN] = month.split('-').map(Number)
  const monthLabel = new Date(yearN, monN - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goMonth = (offset: number) => {
    const d = new Date(yearN, monN - 1 + offset, 1)
    router.push(`/budget/targets?month=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const goToday = () => {
    const now = new Date()
    router.push(`/budget/targets?month=${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  }

  const saveBudget = async (categoryId: string, amount: number) => {
    setLocalBudgets(prev => ({ ...prev, [categoryId]: amount }))
    await supabase.from('budgets').upsert(
      { user_id: userId, category_id: categoryId, month: `${month}-01`, target_amount: amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id,month' }
    )
  }

  const toggleLevel = async (categoryId: string) => {
    const next: 'parent' | 'sub' = (localLevels[categoryId] ?? 'parent') === 'parent' ? 'sub' : 'parent'
    setLocalLevels(prev => ({ ...prev, [categoryId]: next }))
    await supabase.from('categories').update({ budget_level: next }).eq('id', categoryId)
  }

  const { incomeGroups, expenseGroups } = useMemo(() => {
    const childrenOf = (pid: string) =>
      categories.filter(c => c.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order)
    const parents = categories
      .filter(c => !c.parent_id && !c.is_transfer)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(p => ({ ...p, children: childrenOf(p.id) }))
    return {
      incomeGroups: parents.filter(p => p.is_income),
      expenseGroups: parents.filter(p => !p.is_income),
    }
  }, [categories])

  const getGroup = (parent: ParentGroup, isIncome: boolean) => {
    const level = localLevels[parent.id] ?? 'parent'
    const hasChildren = parent.children.length > 0
    const rawActual = (actuals[parent.id] ?? 0) + parent.children.reduce((s, c) => s + (actuals[c.id] ?? 0), 0)
    // Expense actuals are already signed (negative = net gain from a reimbursement) —
    // only income actuals need abs() since raw signed income is already positive.
    const displayActual = isIncome ? Math.abs(rawActual) : rawActual
    const planned = !hasChildren || level === 'parent'
      ? localBudgets[parent.id] ?? 0
      : parent.children.reduce((s, c) => s + (localBudgets[c.id] ?? 0), 0)
    const remaining = planned - displayActual
    const pct = planned > 0 ? Math.max(0, Math.min(100, (displayActual / planned) * 100)) : 0
    const isOver = !isIncome && displayActual > planned && planned > 0
    return { level, hasChildren, displayActual, planned, remaining, pct, isOver }
  }

  const totals = useMemo(() => {
    let incomePlanned = 0, incomeActual = 0, expensePlanned = 0, expenseActual = 0
    for (const g of incomeGroups) {
      const level = localLevels[g.id] ?? 'parent'
      const rawActual = (actuals[g.id] ?? 0) + g.children.reduce((s, c) => s + (actuals[c.id] ?? 0), 0)
      const planned = g.children.length === 0 || level === 'parent'
        ? localBudgets[g.id] ?? 0
        : g.children.reduce((s, c) => s + (localBudgets[c.id] ?? 0), 0)
      incomePlanned += planned
      incomeActual += Math.abs(rawActual)
    }
    for (const g of expenseGroups) {
      const level = localLevels[g.id] ?? 'parent'
      const rawActual = (actuals[g.id] ?? 0) + g.children.reduce((s, c) => s + (actuals[c.id] ?? 0), 0)
      const planned = g.children.length === 0 || level === 'parent'
        ? localBudgets[g.id] ?? 0
        : g.children.reduce((s, c) => s + (localBudgets[c.id] ?? 0), 0)
      expensePlanned += planned
      expenseActual += rawActual   // already signed — negative means net gain from a reimbursement
    }
    return { incomePlanned, incomeActual, expensePlanned, expenseActual }
  }, [incomeGroups, expenseGroups, localBudgets, localLevels, actuals])

  const leftToBudget = totals.incomePlanned - totals.expensePlanned
  const isOver = leftToBudget < 0

  const renderGroup = (parent: ParentGroup, isIncome: boolean) => {
    const { level, hasChildren, displayActual, planned, remaining, pct, isOver: groupOver } = getGroup(parent, isIncome)
    const isOpen = openGroups.has(parent.id)
    const barColor = groupOver ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-green-500'

    return (
      <div key={parent.id} className="border border-gray-200 rounded-xl overflow-hidden mb-2 bg-white shadow-sm">
        {/* Parent row */}
        <div className="flex items-center gap-2 px-3 py-3">
          {hasChildren ? (
            <button
              onClick={() => setOpenGroups(prev => {
                const next = new Set(prev)
                next.has(parent.id) ? next.delete(parent.id) : next.add(parent.id)
                return next
              })}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 w-5 h-5 flex items-center justify-center"
            >
              <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <div className="w-5 flex-shrink-0" />
          )}

          <span className="text-lg flex-shrink-0">{getCatEmoji(parent.name, parent.icon)}</span>
          <Link href={`/budget/categories/${parent.id}`} className="flex-1 text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
            {parent.name}
          </Link>

          {hasChildren && (
            <button
              onClick={() => toggleLevel(parent.id)}
              title={level === 'parent' ? 'Budget group total — tap to budget per sub-category' : 'Budget per sub-category — tap to budget group total'}
              className={`flex-shrink-0 transition ${level === 'sub' ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500'}`}
            >
              <BudgetLevelIcon level={level} />
            </button>
          )}

          {/* Planned */}
          <div className="flex-shrink-0">
            {!hasChildren || level === 'parent' ? (
              <PlannedCell value={localBudgets[parent.id] ?? 0} onSave={v => saveBudget(parent.id, v)} compact />
            ) : (
              <span className="text-sm text-gray-500 tabular-nums w-20 text-right block">
                {planned > 0 ? `$${fmt(planned)}` : '—'}
              </span>
            )}
          </div>

          {/* Actual — hidden on mobile */}
          <div className="hidden md:block flex-shrink-0 w-20 text-right">
            <span className="text-sm text-gray-600 tabular-nums">${fmt(displayActual)}</span>
          </div>

          {/* Remaining pill */}
          <div className="flex-shrink-0 flex justify-end w-20 md:w-24">
            <RemainingPill
              remaining={remaining}
              isOver={groupOver}
              isIncome={isIncome}
              hasPlanned={planned > 0}
            />
          </div>
        </div>

        {/* Progress bar */}
        {planned > 0 && (
          <div className="h-1 bg-gray-100 mx-3 mb-2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
        )}

        {/* Children */}
        {isOpen && hasChildren && (
          <div className="border-t border-gray-100 divide-y divide-gray-50">
            {parent.children.map(child => {
              const childActual = Math.abs(actuals[child.id] ?? 0)
              const childPlanned = localBudgets[child.id] ?? 0
              const childRemaining = childPlanned - childActual
              const childIsOver = childActual > childPlanned && childPlanned > 0
              const childPct = childPlanned > 0 ? Math.min(100, (childActual / childPlanned) * 100) : 0

              return (
                <div key={child.id} className="bg-gray-50/50">
                  <div className="flex items-center gap-2 px-3 py-2.5 pl-8">
                    <span className="text-base flex-shrink-0">{getCatEmoji(child.name, child.icon)}</span>
                    <Link href={`/budget/categories/${child.id}`} className="flex-1 text-sm text-gray-700 truncate hover:text-blue-600 transition-colors">
                      {child.name}
                    </Link>

                    <div className="flex-shrink-0">
                      {level === 'sub' ? (
                        <PlannedCell value={childPlanned} onSave={v => saveBudget(child.id, v)} compact />
                      ) : (
                        <span className="text-sm text-gray-300 w-20 text-right block">—</span>
                      )}
                    </div>

                    {/* Actual hidden on mobile */}
                    <div className="hidden md:block flex-shrink-0 w-20 text-right">
                      <span className="text-sm text-gray-400 tabular-nums">${fmt(childActual)}</span>
                    </div>

                    <div className="flex-shrink-0 flex justify-end w-20 md:w-24">
                      {level === 'sub' ? (
                        <RemainingPill
                          remaining={childRemaining}
                          isOver={childIsOver}
                          isIncome={isIncome}
                          hasPlanned={childPlanned > 0}
                        />
                      ) : (
                        <span className="text-sm text-gray-400 tabular-nums w-20 text-right block">
                          {childActual > 0 ? `$${fmt(childActual)}` : '$0'}
                        </span>
                      )}
                    </div>
                  </div>

                  {level === 'sub' && childPlanned > 0 && (
                    <div className="h-0.5 bg-gray-100 mx-3 mb-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${childIsOver ? 'bg-red-500' : childPct > 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                        style={{ width: `${childPct}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile: sticky "Left to budget" banner */}
      <div className={`md:hidden sticky top-[53px] z-30 px-4 py-3 flex items-center justify-between ${
        isOver ? 'bg-red-500' : 'bg-green-500'
      }`}>
        <span className="text-sm font-semibold text-white">Left to budget</span>
        <span className="text-lg font-bold text-white">
          {leftToBudget < 0 ? '-' : ''}${fmt(Math.abs(leftToBudget))}
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 md:py-6">
        {/* Month header */}
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center gap-1">
            <button onClick={() => goMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button onClick={() => goMonth(1)}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition text-gray-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 ml-1">{monthLabel}</h1>
          </div>
          <button onClick={goToday}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">
            Today
          </button>
        </div>

        <div className="flex gap-6 items-start">
          {/* Main table */}
          <div className="flex-1 min-w-0">
            {/* Column headers */}
            <div className="flex items-center px-3 pb-1 mb-1">
              <div className="flex-1" />
              <div className="w-20 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Planned</div>
              <div className="hidden md:block w-20 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider ml-2">Actual</div>
              <div className="w-20 md:w-24 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wider ml-2">Remaining</div>
            </div>

            {/* Income */}
            <div className="mb-5">
              <div className="flex items-center px-1 py-1 mb-2">
                <span className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-widest">Income</span>
              </div>
              {incomeGroups.map(g => renderGroup(g, true))}
              <div className="flex items-center px-3 py-2.5 bg-white rounded-xl border border-gray-200 mt-1 shadow-sm">
                <span className="flex-1 text-sm font-bold text-gray-900">Total Income</span>
                <div className="w-20 text-right text-sm font-bold text-gray-700 tabular-nums">
                  {totals.incomePlanned > 0 ? `$${fmt(totals.incomePlanned)}` : '—'}
                </div>
                <div className="hidden md:block w-20 text-right text-sm font-semibold text-gray-600 tabular-nums ml-2">
                  ${fmt(totals.incomeActual)}
                </div>
                <div className="w-20 md:w-24 flex justify-end ml-2">
                  <RemainingPill
                    remaining={totals.incomePlanned - totals.incomeActual}
                    isOver={false}
                    isIncome={true}
                    hasPlanned={totals.incomePlanned > 0}
                  />
                </div>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center px-1 py-1 mb-2">
                <span className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-widest">Expenses</span>
              </div>
              {expenseGroups.map(g => renderGroup(g, false))}
              <div className="flex items-center px-3 py-2.5 bg-white rounded-xl border border-gray-200 mt-1 shadow-sm">
                <span className="flex-1 text-sm font-bold text-gray-900">Total Expenses</span>
                <div className="w-20 text-right text-sm font-bold text-gray-700 tabular-nums">
                  {totals.expensePlanned > 0 ? `$${fmt(totals.expensePlanned)}` : '—'}
                </div>
                <div className="hidden md:block w-20 text-right text-sm font-semibold text-gray-600 tabular-nums ml-2">
                  ${fmt(totals.expenseActual)}
                </div>
                <div className="w-20 md:w-24 flex justify-end ml-2">
                  <RemainingPill
                    remaining={totals.expensePlanned - totals.expenseActual}
                    isOver={totals.expenseActual > totals.expensePlanned && totals.expensePlanned > 0}
                    isIncome={false}
                    hasPlanned={totals.expensePlanned > 0}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop sidebar */}
          <div className="hidden md:block w-64 flex-shrink-0 space-y-4 sticky top-20">
            <div className={`rounded-xl border p-5 text-center ${isOver ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className={`text-3xl font-bold mb-1 ${isOver ? 'text-red-600' : 'text-green-700'}`}>
                {leftToBudget < 0 ? '-' : ''}${fmt(Math.abs(leftToBudget))}
              </p>
              <p className={`text-sm font-medium ${isOver ? 'text-red-500' : 'text-green-600'}`}>Left to budget</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-semibold text-gray-700">Income</span>
                  <span className="text-xs text-gray-400">
                    {totals.incomePlanned > 0 ? `$${fmt(totals.incomePlanned)} planned` : 'no budget set'}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-green-500 rounded-full"
                    style={{ width: `${totals.incomePlanned > 0 ? Math.min(100, (totals.incomeActual / totals.incomePlanned) * 100) : 0}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>${fmt(totals.incomeActual)} earned</span>
                  <span className={totals.incomeActual >= totals.incomePlanned && totals.incomePlanned > 0 ? 'text-green-600 font-medium' : ''}>
                    ${fmt(Math.abs(totals.incomePlanned - totals.incomeActual))} remaining
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm font-semibold text-gray-700">Expenses</span>
                  <span className="text-xs text-gray-400">
                    {totals.expensePlanned > 0 ? `$${fmt(totals.expensePlanned)} planned` : 'no budget set'}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${totals.expenseActual > totals.expensePlanned && totals.expensePlanned > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${totals.expensePlanned > 0 ? Math.min(100, (totals.expenseActual / totals.expensePlanned) * 100) : 0}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>${fmt(totals.expenseActual)} spent</span>
                  {totals.expensePlanned > 0 && (
                    <span className={totals.expenseActual > totals.expensePlanned ? 'text-red-500 font-medium' : ''}>
                      {totals.expenseActual > totals.expensePlanned ? '-' : ''}${fmt(Math.abs(totals.expensePlanned - totals.expenseActual))} remaining
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(uncategorizedIncome > 0 || uncategorizedExpenses > 0) && (
              <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Uncategorized</p>
                {uncategorizedIncome > 0 && (
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>Income</span>
                    <span className="tabular-nums font-medium">${fmt(uncategorizedIncome)}</span>
                  </div>
                )}
                {uncategorizedExpenses > 0 && (
                  <div className="flex justify-between text-xs text-amber-700">
                    <span>Expenses</span>
                    <span className="tabular-nums font-medium">${fmt(uncategorizedExpenses)}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-gray-400 text-center px-1">
              Tap any planned amount to edit. Use the icon next to the category name to toggle between group and sub-category budgeting.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
