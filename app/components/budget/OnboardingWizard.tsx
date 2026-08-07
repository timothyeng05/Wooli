'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import SimplefinConnectButton from '@/app/components/budget/SimplefinConnectButton'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#64748b', '#374151',
]

const MEMBER_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280',
]

const ICON_SECTIONS = [
  { label: 'Food & Drink', icons: ['🍽️','🍕','🍔','🌮','🍜','🍱','🥗','🥐','🧁','🍰','☕','🧃','🍺','🍷','🥤','🛒'] },
  { label: 'Home',         icons: ['🏠','🏡','💡','📶','🔨','🪴','🧹','🔑','🛁','🧺','🪑','🖼️','🛏️','🪟'] },
  { label: 'Transport',    icons: ['🚗','🚇','🚌','✈️','🚂','🛵','🚲','🚢','🚕','⛽','🅿️','🛻','🏍️','🛺'] },
  { label: 'Health',       icons: ['🏥','💊','🩺','💪','🧘','🦷','👓','🩹','🏃','🧬','🩻'] },
  { label: 'Shopping',     icons: ['🛍️','👗','👠','👟','🎁','📦','💄','🧴','💍','⌚','🧢','👜','🕶️'] },
  { label: 'Entertainment',icons: ['🎬','🎮','🎵','🎶','🎨','🎭','🏋️','⛳','🎯','🎸','🎤','🏄','🎲','🎳','🎪'] },
  { label: 'Finance',      icons: ['💵','💳','💰','📈','🏦','💸','🪙','📊','🧾','↔️','⚖️','💹','📉'] },
  { label: 'Tech & Work',  icons: ['📱','💻','🖥️','📡','🔌','📷','📝','✏️','🎓','💼','📋','🔧','⚙️'] },
  { label: 'Travel',       icons: ['🌍','🗺️','🧳','🏨','🏖️','🏔️','🌅','🗽','🎡','🚡'] },
  { label: 'Other',        icons: ['🐾','📌','✂️','🎉','🌿','🌻','☀️','🌙','⚡','📁','🎂','🌈','❤️','🔔','📫'] },
]

const SECTION_META = {
  expense:  { label: 'Expenses',  singular: 'expense',  color: '#ef4444', description: 'Money going out — everyday spending, bills, and subscriptions.' },
  income:   { label: 'Income',    singular: 'income',   color: '#22c55e', description: 'Money coming in — salary, freelance work, investment returns.' },
  transfer: { label: 'Transfers', singular: 'transfer', color: '#6366f1', description: 'Moving money between your own accounts. These don\'t count as income or expenses in your reports.' },
}

const STEPS = ['Welcome', 'About you', 'Categories', 'Monthly budgets', 'Accounts', 'Done']
const CHEVRON_STEPS = [
  { step: 2, label: 'You' },
  { step: 3, label: 'Categories' },
  { step: 4, label: 'Budgets' },
  { step: 5, label: 'Accounts' },
]
const TOTAL_STEPS = STEPS.length

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'expense' | 'income' | 'transfer'

type CatRow = {
  id: string
  name: string
  originalName: string
  icon: string | null
  originalIcon: string | null
  color: string
  originalColor: string
  parent_id: string | null
  is_income: boolean
  is_transfer: boolean
  deleted: boolean
  budget_level?: 'parent' | 'sub' | null
}

type AddingState = {
  parentId: string | null
  section: Section
  name: string
  icon: string
  color: string
}

// ─── Icon & colour picker panel ───────────────────────────────────────────────

function StylePanel({ icon, color, onIcon, onColor, showColor = true }: {
  icon: string | null
  color: string
  onIcon: (i: string) => void
  onColor: (c: string) => void
  showColor?: boolean
}) {
  return (
    <div className="border-t border-gray-100 px-3 py-3 bg-white space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Icon</p>
        <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
          <button
            onClick={() => onIcon('')}
            className={`w-8 h-8 flex items-center justify-center rounded text-xs text-gray-400 hover:bg-gray-100 border border-dashed border-gray-200 transition ${!icon ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
            title="No icon (use default)"
          >
            ✕
          </button>
          {ICON_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="text-[10px] text-gray-400 mb-1">{section.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {section.icons.map(em => (
                  <button
                    key={em}
                    onClick={() => onIcon(em)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-base hover:bg-gray-100 transition ${icon === em ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {showColor && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Colour</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => onColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition ${color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => onColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingWizard({ userId, hasExistingSetup = false }: { userId: string; hasExistingSetup?: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 2
  const [members, setMembers] = useState<{ id: string; name: string; color: string }[]>([{ id: crypto.randomUUID(), name: '', color: MEMBER_COLORS[0] }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 3
  const [cats, setCats] = useState<CatRow[]>([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [savingCats, setSavingCats] = useState(false)
  const [openStyleId, setOpenStyleId] = useState<string | null>(null)
  const [adding, setAdding] = useState<AddingState | null>(null)
  const [addingLoading, setAddingLoading] = useState(false)
  const [saveCatsError, setSaveCatsError] = useState('')

  // Step 4 — budget targets
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, string>>({})
  const [budgetLevels, setBudgetLevels] = useState<Record<string, 'parent' | 'sub'>>({})
  const [savingBudgets, setSavingBudgets] = useState(false)

  // Step 5 — SimpleFin
  const [connectError, setConnectError] = useState('')

  const supabase = createClient()

  // Start seeding on mount — ref guard prevents React StrictMode double-fire
  const seedFired = useRef(false)
  useEffect(() => {
    if (seedFired.current) return
    seedFired.current = true
    fetch('/api/setup-budget', { method: 'POST' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 3) return
    if (cats.length > 0) return  // already loaded — don't clobber in-progress edits
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const load = async (attempt = 0) => {
      if (cancelled) return
      setLoadingCats(true)
      const { data } = await supabase
        .from('categories')
        .select('id, name, icon, color, parent_id, is_income, is_transfer, budget_level')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if ((!data || data.length === 0) && attempt < 5) {
        // Seed still running — retry after a short wait
        retryTimer = setTimeout(() => load(attempt + 1), 1000)
        return
      }
      if (data) {
        setCats(data.map(c => ({ ...c, originalName: c.name, originalIcon: c.icon, originalColor: c.color, deleted: false })))
        setBudgetLevels(
          data.reduce<Record<string, 'parent' | 'sub'>>((acc, c) => {
            if (c.budget_level != null) acc[c.id] = c.budget_level
            return acc
          }, {})
        )
      }
      setLoadingCats(false)
    }

    load()
    return () => {
      cancelled = true
      if (retryTimer != null) clearTimeout(retryTimer)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2 handlers ────────────────────────────────────────────────────────

  const handleAddMembers = async () => {
    const valid = members.filter(m => m.name.trim())
    if (!valid.length) return
    setLoading(true)
    setError('')
    // Clear any existing members first so repeated wizard runs don't accumulate
    const { error: delErr } = await supabase.from('household_members').delete().eq('user_id', userId)
    if (delErr) { setError(delErr.message); setLoading(false); return }
    const { error: err } = await supabase.from('household_members').insert(
      valid.map((m, i) => ({
        user_id: userId,
        full_name: m.name.trim(),
        display_name: m.name.trim(),
        color: m.color,
        sort_order: i,
        is_shared: false,
      }))
    )
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    setStep(3) // → categories intro
  }

  const updateMember = (id: string, patch: Partial<{ name: string; color: string }>) =>
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))

  const addMemberRow = () =>
    setMembers(prev => [...prev, { id: crypto.randomUUID(), name: '', color: MEMBER_COLORS[prev.length % MEMBER_COLORS.length] }])

  const removeMemberRow = (id: string) =>
    setMembers(prev => prev.filter(m => m.id !== id))

  // ── Step 3 handlers ────────────────────────────────────────────────────────

  const updateCat = (id: string, patch: Partial<CatRow>) =>
    setCats(prev => {
      const target = prev.find(c => c.id === id)
      const isParent = !target?.parent_id
      return prev.map(c => {
        if (c.id === id) return { ...c, ...patch }
        // Cascade parent colour changes to all its children
        if (isParent && 'color' in patch && c.parent_id === id) return { ...c, color: patch.color! }
        return c
      })
    })

  const deleteCategory = (id: string, isParent: boolean) =>
    setCats(prev => prev.map(c =>
      c.id === id || (isParent && c.parent_id === id) ? { ...c, deleted: true } : c
    ))

  const handleConfirmAdd = async () => {
    if (!adding || !adding.name.trim()) return
    setAddingLoading(true)
    const { data, error: err } = await supabase.from('categories').insert({
      user_id: userId,
      name: adding.name.trim(),
      icon: adding.icon,
      color: adding.color,
      is_income: adding.section === 'income',
      is_transfer: adding.section === 'transfer',
      parent_id: adding.parentId,
      sort_order: cats.length,
    }).select().single()
    if (!err && data) {
      setCats(prev => [...prev, {
        id: data.id, name: data.name, originalName: data.name,
        icon: data.icon, originalIcon: data.icon,
        color: data.color, originalColor: data.color,
        parent_id: data.parent_id,
        is_income: data.is_income, is_transfer: data.is_transfer,
        deleted: false,
      }])
    }
    setAdding(null)
    setAddingLoading(false)
  }

  const handleSaveCategories = async (backNav?: boolean) => {
    setSavingCats(true)
    setSaveCatsError('')
    const toDelete = cats.filter(c => c.deleted).map(c => c.id)
    const toUpdate = cats.filter(c => !c.deleted && (
      c.name !== c.originalName || c.icon !== c.originalIcon || c.color !== c.originalColor
    ))
    if (toDelete.length) {
      const { error: delError } = await supabase.from('categories').delete().in('id', toDelete)
      if (delError) { setSavingCats(false); setSaveCatsError(delError.message); return }
    }
    for (const c of toUpdate) {
      await supabase.from('categories').update({ name: c.name, icon: c.icon, color: c.color }).eq('id', c.id)
    }
    setSavingCats(false)
    setStep(backNav ? 2 : 4)
  }

  const handleSaveBudgets = async () => {
    setSavingBudgets(true)
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    // Save budget_level per parent category
    const levelUpdates = Object.entries(budgetLevels)
    for (const [catId, level] of levelUpdates) {
      await supabase.from('categories').update({ budget_level: level }).eq('id', catId)
    }

    // Save budget amounts
    const entries = Object.entries(budgetAmounts).filter(([, v]) => v && Number(v) > 0)
    if (entries.length > 0) {
      await supabase.from('budgets').upsert(
        entries.map(([category_id, target_amount]) => ({
          user_id: userId,
          category_id,
          month,
          target_amount: Number(target_amount),
        })),
        { onConflict: 'user_id,category_id,month' }
      )
    }
    setSavingBudgets(false)
    setStep(5) // → accounts
  }

  const getLevel = (parentId: string): 'parent' | 'sub' =>
    budgetLevels[parentId] ?? 'parent'

  const toggleLevel = (parentId: string) =>
    setBudgetLevels(prev => ({
      ...prev,
      [parentId]: getLevel(parentId) === 'parent' ? 'sub' : 'parent',
    }))

  const markComplete = async () => {
    await supabase.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', userId)
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const sectionOf = (c: CatRow): Section => c.is_transfer ? 'transfer' : c.is_income ? 'income' : 'expense'
  const parents = cats.filter(c => !c.deleted && !c.parent_id)
  const childrenOf = (pid: string) => cats.filter(c => !c.deleted && c.parent_id === pid)

  const renderStylePanel = (cat: CatRow) => (
    <StylePanel
      icon={cat.icon}
      color={cat.color}
      onIcon={i => updateCat(cat.id, { icon: i })}
      onColor={c => updateCat(cat.id, { color: c })}
    />
  )

  const renderAddRow = (parentId: string | null, section: Section, parentColor = '#64748b') => {
    const isOpen = adding?.parentId === parentId && adding?.section === section
    if (!isOpen) return null
    return (
      <div className={`flex items-center gap-2 px-3 py-2 border-t border-gray-100 ${parentId ? 'pl-10' : 'bg-gray-50'}`}>
        <button
          onClick={() => setOpenStyleId(openStyleId === '__new__' ? null : '__new__')}
          className="text-base flex-shrink-0"
        >
          {adding!.icon}
        </button>
        {openStyleId === '__new__' && (
          <StylePanel
            icon={adding!.icon}
            color={adding!.color}
            onIcon={i => setAdding(prev => prev ? { ...prev, icon: i } : null)}
            onColor={c => setAdding(prev => prev ? { ...prev, color: c } : null)}
          />
        )}
        <input
          value={adding!.name}
          onChange={e => setAdding(prev => prev ? { ...prev, name: e.target.value } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleConfirmAdd()
            if (e.key === 'Escape') { setAdding(null); setOpenStyleId(null) }
          }}
          placeholder="Name…"
          autoFocus
          className="flex-1 text-sm text-gray-700 bg-transparent outline-none border-b border-gray-300 focus:border-blue-400"
        />
        <button
          onClick={handleConfirmAdd}
          disabled={addingLoading || !adding?.name.trim()}
          className="text-blue-600 text-xs font-semibold disabled:opacity-40"
        >
          {addingLoading ? '…' : 'Add'}
        </button>
        <button onClick={() => { setAdding(null); setOpenStyleId(null) }} className="text-gray-400 text-xs">✕</button>
      </div>
    )
  }

  const renderSection = (section: Section) => {
    const meta = SECTION_META[section]
    const sectionParents = parents.filter(p => sectionOf(p) === section)

    return (
      <div key={section} className="mb-6">
        {/* Section header */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
            <h3 className="text-sm font-bold text-gray-800">{meta.label}</h3>
          </div>
          <p className="text-xs text-gray-400 pl-4">{meta.description}</p>
        </div>

        <div className="space-y-2">
          {sectionParents.map(parent => (
            <div key={parent.id} className="rounded-xl border border-gray-200 overflow-hidden">
              {/* Parent row */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50">
                <button
                  onClick={() => setOpenStyleId(openStyleId === parent.id ? null : parent.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
                  style={{ backgroundColor: parent.color + '33' }}
                  title="Edit icon & colour"
                >
                  {parent.icon || '📁'}
                </button>
                <input
                  value={parent.name}
                  onChange={e => updateCat(parent.id, { name: e.target.value })}
                  className="flex-1 text-sm font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-gray-300"
                />
                <button
                  onClick={() => deleteCategory(parent.id, true)}
                  className="text-gray-300 hover:text-red-400 transition text-xl leading-none flex-shrink-0"
                  title="Remove category and subcategories"
                >×</button>
              </div>

              {/* Style panel for parent */}
              {openStyleId === parent.id && renderStylePanel(parent)}

              {/* Children */}
              {childrenOf(parent.id).map((child, i, arr) => (
                <div key={child.id}>
                  <div className={`flex items-center gap-2.5 px-3 py-2 pl-10 ${i < arr.length - 1 || adding?.parentId === parent.id ? 'border-b border-gray-100' : ''}`}>
                    <button
                      onClick={() => setOpenStyleId(openStyleId === child.id ? null : child.id)}
                      className="w-6 h-6 rounded flex items-center justify-center text-sm flex-shrink-0 hover:ring-2 hover:ring-blue-300 transition"
                      style={{ backgroundColor: parent.color + '22' }}
                      title="Edit icon"
                    >
                      {child.icon || '•'}
                    </button>
                    <input
                      value={child.name}
                      onChange={e => updateCat(child.id, { name: e.target.value })}
                      className="flex-1 text-sm text-gray-700 bg-transparent outline-none border-b border-transparent focus:border-gray-300"
                    />
                    <button
                      onClick={() => deleteCategory(child.id, false)}
                      className="text-gray-300 hover:text-red-400 transition text-xl leading-none flex-shrink-0"
                    >×</button>
                  </div>
                  {/* Icon-only style panel for children — colour follows parent */}
                  {openStyleId === child.id && (
                    <StylePanel
                      icon={child.icon}
                      color={parent.color}
                      onIcon={i => updateCat(child.id, { icon: i })}
                      onColor={() => {}}
                      showColor={false}
                    />
                  )}
                </div>
              ))}

              {/* Add subcategory row */}
              {renderAddRow(parent.id, section, parent.color)}

              {/* Add subcategory trigger */}
              {adding?.parentId !== parent.id && (
                <button
                  onClick={() => {
                    setAdding({ parentId: parent.id, section, name: '', icon: '📌', color: parent.color })
                    setOpenStyleId(null)
                  }}
                  className="w-full text-left px-3 py-2 pl-10 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 transition"
                >
                  + Add subcategory
                </button>
              )}
            </div>
          ))}

          {/* New parent row */}
          {adding?.parentId === null && adding?.section === section && (
            <div className="rounded-xl border border-dashed border-blue-300 overflow-hidden">
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50">
                <button
                  onClick={() => setOpenStyleId(openStyleId === '__new__' ? null : '__new__')}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ backgroundColor: adding.color + '33' }}
                >
                  {adding.icon}
                </button>
                <input
                  value={adding.name}
                  onChange={e => setAdding(prev => prev ? { ...prev, name: e.target.value } : null)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirmAdd()
                    if (e.key === 'Escape') { setAdding(null); setOpenStyleId(null) }
                  }}
                  placeholder="Category name…"
                  autoFocus
                  className="flex-1 text-sm font-semibold text-gray-800 bg-transparent outline-none border-b border-transparent focus:border-gray-300"
                />
                <button
                  onClick={handleConfirmAdd}
                  disabled={addingLoading || !adding.name.trim()}
                  className="text-blue-600 text-xs font-semibold disabled:opacity-40"
                >
                  {addingLoading ? '…' : 'Add'}
                </button>
                <button onClick={() => { setAdding(null); setOpenStyleId(null) }} className="text-gray-400 text-lg leading-none">×</button>
              </div>
              {openStyleId === '__new__' && (
                <StylePanel
                  icon={adding.icon}
                  color={adding.color}
                  onIcon={i => setAdding(prev => prev ? { ...prev, icon: i } : null)}
                  onColor={c => setAdding(prev => prev ? { ...prev, color: c } : null)}
                />
              )}
            </div>
          )}

          {/* Add parent category button */}
          {(!adding || adding.parentId !== null || adding.section !== section) ? (
            <button
              onClick={() => {
                setAdding({ parentId: null, section, name: '', icon: section === 'income' ? '💵' : section === 'transfer' ? '↔️' : '📁', color: meta.color })
                setOpenStyleId(null)
              }}
              className="text-xs font-medium transition"
              style={{ color: meta.color }}
            >
              + Add {meta.singular} category
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const isCatsDirty = cats.some(c => c.deleted || c.name !== c.originalName || c.icon !== c.originalIcon || c.color !== c.originalColor)

  const progress = Math.min(((step - 1) / (TOTAL_STEPS - 2)) * 100, 100)

  return (
    <div className="flex-1 flex flex-col bg-white">

      {/* Progress bar */}
      <div className="border-b border-gray-100 px-6 pt-4 pb-3 flex-shrink-0">
        <div className="max-w-lg mx-auto">
          {/* Chevron step indicator */}
          {step >= 2 && step <= 5 && (
            <div className="flex items-center gap-1.5 mb-3">
              {step > 1 && (
                <button
                  onClick={async () => {
                    if (step === 3 && isCatsDirty) {
                      await handleSaveCategories(true)
                    } else {
                      setStep(s => s - 1)
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 transition mr-1 flex-shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
              )}
              {CHEVRON_STEPS.map(({ step: s, label }, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-gray-300 text-xs">›</span>}
                  <span className={`text-xs font-semibold transition-colors ${
                    step === s ? 'text-blue-600' :
                    step > s  ? 'text-gray-500' :
                                'text-gray-300'
                  }`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex items-start justify-center px-6 py-10">
          <div className="w-full max-w-lg">

            {/* Step 1 — Welcome */}
            {step === 1 && (
              <div>
                <div className="text-4xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{hasExistingSetup ? 'Reset your budget setup' : 'Welcome to Wooli Budget'}</h1>
                <p className="text-gray-500 mb-8">{hasExistingSetup ? 'Your existing setup will be updated.' : '5 steps — takes about 3 minutes.'}</p>
                <ul className="space-y-3 mb-10">
                  {[
                    ['👤', 'Add your household members'],
                    ['🗂️', hasExistingSetup ? 'Set up your categories (will be updated)' : 'Set up your categories'],
                    ['💰', 'Set monthly spending targets'],
                    ['🏦', 'Link a bank account (optional)'],
                  ].map(([icon, text]) => (
                    <li key={text as string} className="flex items-center gap-3 text-sm text-gray-700">
                      <span className="text-xl">{icon}</span>{text}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setStep(2)}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  Get started
                </button>
              </div>
            )}

            {/* Step 2 — Household members */}
            {step === 2 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Who's in your household?</h1>
                <p className="text-gray-500 text-sm mb-2">
                  Add everyone you want to track spending for. You'll be able to tag accounts and transactions to each person.
                </p>
                <p className="text-xs text-gray-400 mb-6">Start with yourself — add others if you share finances with a partner, housemate, or family member.</p>

                <div className="space-y-3 mb-4">
                  {members.map((m, i) => (
                    <div key={m.id} className="rounded-xl border border-gray-200 px-3 py-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: m.color }}
                        >
                          {m.name.trim() ? m.name.trim()[0].toUpperCase() : (i === 0 ? 'Me' : '?')}
                        </div>
                        <input
                          value={m.name}
                          onChange={e => updateMember(m.id, { name: e.target.value })}
                          placeholder={i === 0 ? 'Your name' : 'Their name'}
                          autoFocus={i === 0}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {members.length > 1 && (
                          <button onClick={() => removeMemberRow(m.id)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">×</button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 pl-10">
                        {MEMBER_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => updateMember(m.id, { color: c })}
                            className={`w-5 h-5 rounded-full border-2 transition ${m.color === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input
                          type="color"
                          value={m.color}
                          onChange={e => updateMember(m.id, { color: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addMemberRow}
                  className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-2 border border-dashed border-blue-200 rounded-lg hover:border-blue-400 transition mb-6"
                >
                  + Add another person
                </button>

                {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                <button
                  onClick={handleAddMembers}
                  disabled={loading || !members.some(m => m.name.trim())}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {loading ? 'Setting up…' : 'Continue'}
                </button>
                <a
                  href="#"
                  onClick={async (e) => {
                    e.preventDefault()
                    await supabase.from('household_members').delete().eq('user_id', userId)
                    await supabase.from('household_members').insert({
                      user_id: userId, full_name: 'Me', display_name: 'Me',
                      color: MEMBER_COLORS[0], sort_order: 0, is_shared: false,
                    })
                    setStep(3)
                  }}
                  className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition mt-2 block"
                >
                  Skip — just me
                </a>
              </div>
            )}

            {/* Step 3 — Categories (merged) */}
            {step === 3 && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Set up categories</h1>
                <p className="text-gray-500 text-sm mb-1">
                  Categories organise every transaction into <span className="font-medium text-green-600">income</span>, <span className="font-medium text-red-500">spending</span>, and <span className="font-medium text-indigo-500">transfers</span>. Edit names, remove what you don't need, or add your own.
                </p>
                <p className="text-xs text-gray-400 mb-5">You can always change these later in <strong>Categories</strong>.</p>

                {loadingCats ? (
                  <div className="py-20 text-center text-sm text-gray-400">
                    <div className="animate-pulse mb-2">⚙️</div>
                    Setting up your categories — just a moment…
                  </div>
                ) : (
                  <>
                    {renderSection('income')}
                    {renderSection('expense')}
                    {renderSection('transfer')}
                  </>
                )}

                <button
                  onClick={() => handleSaveCategories()}
                  disabled={savingCats || loadingCats}
                  className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {savingCats ? 'Saving…' : 'Looks good →'}
                </button>
                {saveCatsError && <p className="text-xs text-red-500 mt-2">{saveCatsError}</p>}
              </div>
            )}

            {/* Step 4 — Monthly budgets */}
            {step === 4 && (() => {
              const expenseParents = cats.filter(c => !c.deleted && !c.parent_id && !c.is_income && !c.is_transfer)
              const incomeParents  = cats.filter(c => !c.deleted && !c.parent_id &&  c.is_income && !c.is_transfer)

              const renderCatGroup = (cat: CatRow) => {
                const children = cats.filter(c => !c.deleted && c.parent_id === cat.id)
                const level = getLevel(cat.id)
                const hasSubs = children.length > 0
                return (
                  <div key={cat.id} className="rounded-xl border border-gray-200 overflow-hidden">
                    {/* Parent row */}
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: cat.color + '33' }}
                      >
                        {cat.icon || '📁'}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{cat.name}</span>

                      {hasSubs && (
                        <button
                          onClick={() => toggleLevel(cat.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                        >
                          {level === 'parent' ? 'Split by sub' : 'Group together'}
                        </button>
                      )}

                      {/* Parent-level input — shown when no subs or budgeting by group */}
                      {(!hasSubs || level === 'parent') && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className="text-sm text-gray-400">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="—"
                            value={budgetAmounts[cat.id] ?? ''}
                            onChange={e => setBudgetAmounts(prev => ({ ...prev, [cat.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                            className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-400">{cat.is_income ? '/mo expected' : '/mo'}</span>
                        </div>
                      )}
                    </div>

                    {/* Sub-categories — always shown when they exist */}
                    {hasSubs && (
                      <div className="divide-y divide-gray-100">
                        {children.map(child => (
                          <div key={child.id} className="flex items-center gap-2.5 px-3 py-2 pl-10">
                            <span className={`text-sm flex-shrink-0 ${level === 'parent' ? 'opacity-40' : ''}`}>
                              {child.icon || '•'}
                            </span>
                            <span className={`flex-1 text-sm truncate ${level === 'parent' ? 'text-gray-400' : 'text-gray-700'}`}>
                              {child.name}
                            </span>
                            {level === 'sub' ? (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-sm text-gray-400">$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="—"
                                  value={budgetAmounts[child.id] ?? ''}
                                  onChange={e => setBudgetAmounts(prev => ({ ...prev, [child.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                                  className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-xs text-gray-400">{child.is_income ? '/mo expected' : '/mo'}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300 flex-shrink-0">included</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Set monthly budgets</h1>
                  <p className="text-gray-500 text-sm mb-1">
                    Set spending and income targets per month. Use <strong>Group together</strong> for one combined limit, or <strong>Split by sub</strong> to budget each subcategory individually.
                  </p>
                  <p className="text-xs text-gray-400 mb-6">Leave blank to track without a limit. Adjust anytime in <strong>Budget → Targets</strong>.</p>

                  {incomeParents.length > 0 && (
                    <div className="space-y-3 mb-5">
                      <div className="flex items-center gap-2 pb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Expected income</p>
                      </div>
                      {incomeParents.map(renderCatGroup)}
                    </div>
                  )}

                  <div className="space-y-3 mb-2">
                    {expenseParents.length > 0 && (
                      <div className="flex items-center gap-2 pb-1">
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Spending</p>
                      </div>
                    )}
                    {expenseParents.map(renderCatGroup)}
                  </div>

                  <div className="mt-6">
                    <button
                      onClick={handleSaveBudgets}
                      disabled={savingBudgets}
                      className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition mb-3"
                    >
                      {savingBudgets ? 'Saving…' : 'Continue'}
                    </button>
                    <button
                      onClick={() => setStep(5)}
                      className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              )
            })()}

            {/* Step 5 — Link accounts */}
            {step === 5 && (
              <div>
                <div className="text-4xl mb-4">🏦</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Link a bank account</h1>
                <p className="text-gray-500 text-sm mb-5">
                  Sync transactions and account balances automatically via <strong>SimpleFin</strong> — paste a setup token from your bank's SimpleFin bridge to connect.
                </p>

                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-3">
                  <p className="text-sm font-semibold text-green-800 mb-2">🔒 How you're protected</p>
                  <div className="space-y-1 text-sm text-green-700">
                    <p>• We never see your bank password — the setup token comes from your bank's own SimpleFin bridge</p>
                    <p>• We can only view your transactions — no ability to move or access your money</p>
                    <p>• Changed your mind? Remove the connection anytime from the Accounts page</p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
                  <p className="text-sm font-semibold text-amber-800 mb-2">ℹ️ Good to know</p>
                  <div className="space-y-1 text-sm text-amber-700">
                    <p>• All accounts within a bank count as one institution</p>
                    <p>• Newly-synced accounts default to "Cash" until you set their type on the Accounts page</p>
                  </div>
                </div>

                <div className="mb-3">
                  <SimplefinConnectButton
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    onComplete={async () => {
                      await markComplete()
                      router.push('/budget')
                    }}
                    onError={msg => setConnectError(msg)}
                  />
                  {connectError && (
                    <p className="text-xs text-red-500 mt-2">Could not connect via SimpleFin. You can skip for now and connect later from the Accounts page.</p>
                  )}
                </div>

                <button
                  onClick={async () => { await markComplete(); setStep(6) }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Skip for now
                </button>
              </div>
            )}

            {/* Step 6 — Done */}
            {step === 6 && (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
                <p className="text-gray-500 text-sm mb-10">
                  Your budget is ready. Head to the overview to see everything in one place.
                </p>
                <button
                  onClick={async () => { await markComplete(); router.push('/budget') }}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition"
                >
                  Go to budget overview
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
