'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'
import type { UnifiedAccount } from './AccountsPageClient'

export interface Goal {
  id: string
  name: string
  icon: string | null
  color: string
  target_amount: number
  target_date: string | null
  current_amount: number
  linked_account_ids: string[]
  notes: string | null
  sort_order: number
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
  '#22c55e', '#84cc16', '#f97316', '#64748b',
]

const PRESET_EMOJIS = [
  '✈️','🏠','🚗','🎓','💍','🏖️','💻','🏋️','🐾','🎁',
  '🛍️','🏥','🌍','⛵','🎸','🍽️','📱','🏔️','🎬','💰',
]

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function monthsUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()))
}

function resolvedCurrent(goal: Goal, accounts: UnifiedAccount[]): number {
  if (goal.linked_account_ids.length === 0) return goal.current_amount
  return goal.linked_account_ids.reduce((s, id) => {
    const acct = accounts.find(a => a.id === id)
    return s + (acct?.balance ?? 0)
  }, 0)
}

// Returns a map of goalId → dollars already earmarked by earlier (sooner deadline) goals
// that share the same linked accounts. Soonest deadline = highest priority.
function computeEarmarked(goals: Goal[], accounts: UnifiedAccount[]): Map<string, number> {
  const sorted = [...goals].sort((a, b) => {
    if (!a.target_date && !b.target_date) return 0
    if (!a.target_date) return 1
    if (!b.target_date) return -1
    return a.target_date.localeCompare(b.target_date)
  })

  // Remaining unclaimed balance per account
  const remaining = new Map<string, number>()
  for (const a of accounts) remaining.set(a.id, Math.max(0, a.balance))

  const result = new Map<string, number>()
  for (const goal of sorted) {
    if (goal.linked_account_ids.length === 0) { result.set(goal.id, 0); continue }

    const totalLinked = goal.linked_account_ids.reduce((s, id) => s + (accounts.find(a => a.id === id)?.balance ?? 0), 0)
    const available = goal.linked_account_ids.reduce((s, id) => s + (remaining.get(id) ?? 0), 0)
    result.set(goal.id, Math.max(0, totalLinked - available))

    // This goal claims up to its target from the remaining balance, proportionally
    const toClaim = Math.min(goal.target_amount, available)
    if (toClaim > 0 && available > 0) {
      for (const id of goal.linked_account_ids) {
        const rem = remaining.get(id) ?? 0
        remaining.set(id, rem - toClaim * (rem / available))
      }
    }
  }
  return result
}

// ── Goal card ─────────────────────────────────────────────────────────────────
function GoalCard({
  goal,
  accounts,
  earmarked,
  onEdit,
  onDelete,
  onUpdateAmount,
}: {
  goal: Goal
  accounts: UnifiedAccount[]
  earmarked: number
  onEdit: (g: Goal) => void
  onDelete: (id: string) => void
  onUpdateAmount: (id: string, amount: number) => Promise<void>
}) {
  const [editingAmount, setEditingAmount] = useState(false)
  const [quickAmount, setQuickAmount] = useState(String(goal.current_amount))
  const [saving, setSaving] = useState(false)

  const totalLinked = resolvedCurrent(goal, accounts)
  const currentRaw = Math.max(0, totalLinked - earmarked)
  const reached = currentRaw >= goal.target_amount
  const current = reached ? goal.target_amount : currentRaw
  const pct = Math.min(100, goal.target_amount > 0 ? (current / goal.target_amount) * 100 : 0)
  const earmarkedPct = reached ? 0 : Math.min(100 - pct, goal.target_amount > 0 ? (earmarked / goal.target_amount) * 100 : 0)
  const remaining = Math.max(0, goal.target_amount - current)

  const months = goal.target_date ? monthsUntil(goal.target_date) : null
  const monthlyNeeded = months && months > 0 && !reached ? remaining / months : null

  const linkedAccounts = goal.linked_account_ids.map(id => accounts.find(a => a.id === id)).filter(Boolean) as UnifiedAccount[]
  const isLinked = linkedAccounts.length > 0

  const saveAmount = async () => {
    setSaving(true)
    try {
      await onUpdateAmount(goal.id, parseFloat(quickAmount) || 0)
      setEditingAmount(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: goal.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {goal.icon ? (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: `${goal.color}18` }}>
                {goal.icon}
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl flex-shrink-0" style={{ backgroundColor: `${goal.color}18` }}>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: goal.color }} />
                </div>
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{goal.name}</p>
              {goal.target_date && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(goal.target_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  {months !== null && months > 0 && <span className="ml-1">· {months} mo away</span>}
                  {months === 0 && <span className="ml-1 text-amber-500">· This month</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(goal)} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</button>
            <button onClick={() => onDelete(goal.id)} className="text-xs text-gray-400 hover:text-red-500 transition">✕</button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-1.5">
              {isLinked ? (
                <p className="text-2xl font-bold text-gray-900">${fmt(current)}</p>
              ) : editingAmount ? (
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <span className="text-lg font-bold text-gray-400">$</span>
                  <input
                    type="number"
                    step="1"
                    value={quickAmount}
                    onChange={e => setQuickAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
                    autoFocus
                    className="w-32 px-2 py-1 border border-blue-400 rounded text-lg font-bold text-gray-900 bg-white"
                  />
                  <button onClick={saveAmount} disabled={saving}
                    className="text-green-600 hover:text-green-700 disabled:opacity-50">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <button onClick={() => setEditingAmount(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setQuickAmount(String(goal.current_amount)); setEditingAmount(true) }}
                  className="group flex items-baseline gap-1.5 hover:opacity-80 transition"
                  title="Update saved amount"
                >
                  <p className="text-2xl font-bold text-gray-900">${fmt(current)}</p>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 mb-0.5 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              <span className="text-sm text-gray-400">of ${fmt(goal.target_amount)}</span>
            </div>
            {reached ? (
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Reached!</span>
            ) : (
              <span className="text-sm font-semibold text-gray-500">{pct.toFixed(0)}%</span>
            )}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
            <div className="h-2.5 rounded-l-full transition-all duration-500 flex-shrink-0"
              style={{ width: `${pct}%`, backgroundColor: goal.color }} />
            {earmarkedPct > 0 && (
              <div className="h-2.5 transition-all duration-500 flex-shrink-0"
                style={{ width: `${earmarkedPct}%`, backgroundColor: `${goal.color}55` }} />
            )}
          </div>
          {earmarked > 0 && (
            <p className="text-[11px] text-amber-600 mt-1">
              +${fmt(earmarked)} in this account is earmarked by an earlier goal
            </p>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
          <div className="flex items-center gap-3">
            {monthlyNeeded !== null && (
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">${fmt(monthlyNeeded)}/mo</span> needed
              </p>
            )}
            {!reached && remaining > 0 && (
              <p className="text-xs text-gray-400">${fmt(remaining)} to go</p>
            )}
          </div>
          {isLinked && (
            <div className="flex items-center gap-1 flex-wrap">
              {linkedAccounts.map(a => (
                <span key={a.id} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {a.name}
                </span>
              ))}
            </div>
          )}
          {!isLinked && goal.notes && (
            <p className="text-xs text-gray-400 truncate max-w-[200px]">{goal.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Goal form ─────────────────────────────────────────────────────────────────
function GoalForm({
  initial,
  accounts,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<Goal>
  accounts: UnifiedAccount[]
  onSave: (data: Partial<Goal>) => void
  onCancel: () => void
  saving: boolean
}) {
  const thisYear = new Date().getFullYear()
  const initDate = initial.target_date ? new Date(initial.target_date + 'T12:00:00') : null

  const [name, setName] = useState(initial.name ?? '')
  const [icon, setIcon] = useState(initial.icon ?? '')
  const [color, setColor] = useState(initial.color ?? '#6366f1')
  const [targetAmount, setTargetAmount] = useState(String(initial.target_amount ?? ''))
  const [targetMonth, setTargetMonth] = useState<string>(initDate ? String(initDate.getMonth() + 1) : '')
  const [targetYear, setTargetYear] = useState<string>(initDate ? String(initDate.getFullYear()) : '')
  const [currentAmount, setCurrentAmount] = useState(String(initial.current_amount ?? '0'))
  const [linkedIds, setLinkedIds] = useState<string[]>(initial.linked_account_ids ?? [])
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [showEmojis, setShowEmojis] = useState(false)

  const targetDate = targetMonth && targetYear
    ? `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    : null

  const toggleAccount = (id: string) =>
    setLinkedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      {/* Name + icon + color */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowEmojis(v => !v)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border border-gray-200 hover:border-gray-300 transition"
          style={{ backgroundColor: `${color}18` }}
        >
          {icon || <span className="text-gray-300 text-sm">+</span>}
        </button>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Goal name (e.g. Japan Trip)"
          autoFocus
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {showEmojis && (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-lg">
          {PRESET_EMOJIS.map(e => (
            <button key={e} type="button"
              onClick={() => { setIcon(e); setShowEmojis(false) }}
              className={`w-8 h-8 text-lg rounded hover:bg-gray-200 flex items-center justify-center transition ${icon === e ? 'bg-blue-100 ring-1 ring-blue-400' : ''}`}>
              {e}
            </button>
          ))}
          {icon && (
            <button type="button" onClick={() => { setIcon(''); setShowEmojis(false) }}
              className="w-8 h-8 text-xs text-gray-400 hover:text-red-500 rounded hover:bg-gray-200 flex items-center justify-center">
              ✕
            </button>
          )}
        </div>
      )}

      {/* Color */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1.5">Color</p>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`w-5 h-5 rounded-full transition ${color === c ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`} />
          ))}
        </div>
      </div>

      {/* Target amount + date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Target amount *</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="1" value={targetAmount} onChange={e => setTargetAmount(e.target.value)}
              placeholder="10000"
              className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Target date <span className="text-gray-400">(optional)</span></label>
          <div className="flex gap-1.5">
            <select value={targetMonth} onChange={e => setTargetMonth(e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Month</option>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={i} value={String(i + 1)}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              value={targetYear}
              onChange={e => setTargetYear(e.target.value)}
              placeholder="Year"
              min={thisYear}
              className="w-20 px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Link accounts OR manual amount */}
      <div>
        <p className="text-[11px] text-gray-500 mb-1.5">Link accounts <span className="text-gray-400">(optional — balance auto-tracks progress)</span></p>
        <div className="flex flex-wrap gap-2">
          {accounts.filter(a => a.type === 'cash' || a.type === 'investment').map(a => (
            <button key={a.id} type="button" onClick={() => toggleAccount(a.id)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition text-left ${
                linkedIds.includes(a.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}>
              <span className="font-medium">{a.name}</span>
              {a.institution && <span className={`ml-1 ${linkedIds.includes(a.id) ? 'text-blue-200' : 'text-gray-400'}`}>· {a.institution}</span>}
            </button>
          ))}
          {accounts.filter(a => a.type === 'cash' || a.type === 'investment').length === 0 && (
            <p className="text-xs text-gray-400">No cash or investment accounts found — add them in the Accounts tab first.</p>
          )}
        </div>
      </div>

      {linkedIds.length === 0 && (
        <div>
          <label className="text-[11px] text-gray-500 mb-1 block">Amount saved so far</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input type="number" step="1" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)}
              className="w-full pl-6 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
      )}

      <div>
        <label className="text-[11px] text-gray-500 mb-1 block">Notes</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Optional"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ name: name.trim(), icon: icon || null, color, target_amount: parseFloat(targetAmount) || 0, target_date: targetDate, current_amount: parseFloat(currentAmount) || 0, linked_account_ids: linkedIds, notes: notes.trim() || null })}
          disabled={saving || !name.trim() || !targetAmount}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : 'Save goal'}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-gray-500 text-sm hover:bg-gray-100 rounded-lg transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function GoalsPageClient({
  goals: initial,
  accounts,
  userId,
}: {
  goals: Goal[]
  accounts: UnifiedAccount[]
  userId: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [goals, setGoals] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [saving, setSaving] = useState(false)

  const handleAdd = async (data: Partial<Goal>) => {
    setSaving(true)
    try {
      const { data: row, error } = await supabase
        .from('budget_goals')
        .insert({ user_id: userId, sort_order: goals.length, ...data })
        .select()
        .single()
      if (error) throw error
      setGoals(prev => [...prev, row as Goal])
      setAdding(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add goal')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (data: Partial<Goal>) => {
    if (!editingGoal) return
    setSaving(true)
    try {
      const { error } = await supabase.from('budget_goals').update(data).eq('id', editingGoal.id)
      if (error) throw error
      setGoals(prev => prev.map(g => g.id === editingGoal.id ? { ...g, ...data } as Goal : g))
      setEditingGoal(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update goal')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('budget_goals').update({ is_active: false }).eq('id', id)
      setGoals(prev => prev.filter(g => g.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete goal')
    }
  }

  const handleUpdateAmount = async (id: string, amount: number) => {
    const { error } = await supabase.from('budget_goals').update({ current_amount: amount }).eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current_amount: amount } : g))
  }

  const earmarkedMap = computeEarmarked(goals, accounts)
  const totalSaved = goals.reduce((s, g) => s + Math.max(0, resolvedCurrent(g, accounts) - (earmarkedMap.get(g.id) ?? 0)), 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)
  const reached = goals.filter(g => Math.max(0, resolvedCurrent(g, accounts) - (earmarkedMap.get(g.id) ?? 0)) >= g.target_amount).length

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      {goals.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total saved</p>
            <p className="text-xl font-bold text-gray-900">${fmt(totalSaved)}</p>
          </div>
          <div className="text-gray-200">|</div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total target</p>
            <p className="text-xl font-bold text-gray-900">${fmt(totalTarget)}</p>
          </div>
          <div className="text-gray-200">|</div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Goals reached</p>
            <p className="text-xl font-bold text-gray-900">{reached} / {goals.length}</p>
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.map(goal =>
        editingGoal?.id === goal.id ? (
          <GoalForm
            key={goal.id}
            initial={editingGoal}
            accounts={accounts}
            onSave={handleEdit}
            onCancel={() => setEditingGoal(null)}
            saving={saving}
          />
        ) : (
          <GoalCard
            key={goal.id}
            goal={goal}
            accounts={accounts}
            earmarked={earmarkedMap.get(goal.id) ?? 0}
            onEdit={g => { setEditingGoal(g); setAdding(false) }}
            onDelete={handleDelete}
            onUpdateAmount={handleUpdateAmount}
          />
        )
      )}

      {/* Add form or button */}
      {adding ? (
        <GoalForm
          initial={{}}
          accounts={accounts}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          saving={saving}
        />
      ) : (
        <button
          onClick={() => { setAdding(true); setEditingGoal(null) }}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-blue-300 hover:text-blue-500 transition"
        >
          + Add goal
        </button>
      )}

      {goals.length === 0 && !adding && (
        <p className="text-center text-sm text-gray-400 py-6">
          Set a spending goal — a trip, a car, a home renovation — and track your progress here.
        </p>
      )}
    </div>
  )
}
