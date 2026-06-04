'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { buildSelectableCategories } from '@/lib/budget/groq-categorize'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

interface Rule {
  id: string
  name: string | null
  priority: number
  match_normalized_merchant: string | null
  match_raw_merchant: string | null
  match_regex: string | null
  match_amount_min: number | null
  match_amount_max: number | null
  match_account_name: string | null
  match_mcc: string | null
  match_notes: string | null
  category_id: string | null
  is_transfer: boolean
}

interface CategoryRow { id: string; name: string; parent_id: string | null }

type Draft = {
  name: string
  priority: string
  match_normalized_merchant: string
  match_account_name: string
  match_amount_min: string
  match_amount_max: string
  match_regex: string
  match_notes: string
  category_id: string
  is_transfer: boolean
}

const EMPTY_DRAFT: Draft = {
  name: '', priority: '0', match_normalized_merchant: '', match_account_name: '',
  match_amount_min: '', match_amount_max: '', match_regex: '', match_notes: '',
  category_id: '', is_transfer: false,
}

export default function RulesManager({
  userId, rules: initialRules, categories,
}: { userId: string; rules: Rule[]; categories: CategoryRow[] }) {
  const supabase = createClient()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectable = useMemo(() => buildSelectableCategories(categories), [categories])
  const catName = useMemo(() => new Map(selectable.map(c => [c.id, c.name])), [selectable])

  const draftToRow = () => {
    const num = (s: string) => (s.trim() === '' ? null : Number(s))
    const txt = (s: string) => (s.trim() === '' ? null : s.trim())
    return {
      user_id: userId,
      name: txt(draft.name),
      priority: Number(draft.priority) || 0,
      match_normalized_merchant: txt(draft.match_normalized_merchant),
      match_account_name: txt(draft.match_account_name),
      match_amount_min: num(draft.match_amount_min),
      match_amount_max: num(draft.match_amount_max),
      match_regex: txt(draft.match_regex),
      match_notes: txt(draft.match_notes),
      category_id: draft.is_transfer ? null : (draft.category_id || null),
      is_transfer: draft.is_transfer,
    }
  }

  const hasCondition = () =>
    [draft.match_normalized_merchant, draft.match_account_name, draft.match_amount_min,
     draft.match_amount_max, draft.match_regex, draft.match_notes].some(v => v.trim() !== '')

  const save = async () => {
    if (!hasCondition()) { toast.error('Add at least one matching condition'); return }
    if (!draft.is_transfer && !draft.category_id) { toast.error('Pick a category (or mark as transfer)'); return }
    setSaving(true)
    const row = draftToRow()
    if (editingId) {
      const { error } = await supabase.from('categorization_rules').update(row).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setRules(prev => prev.map(r => r.id === editingId ? { ...r, ...row } as Rule : r)
        .sort((a, b) => a.priority - b.priority))
    } else {
      const { data, error } = await supabase.from('categorization_rules').insert(row).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setRules(prev => [...prev, data as Rule].sort((a, b) => a.priority - b.priority))
    }
    setDraft(EMPTY_DRAFT); setEditingId(null); setShowAdvanced(false); setSaving(false)
    toast.success(editingId ? 'Rule updated' : 'Rule added')
  }

  const edit = (r: Rule) => {
    setEditingId(r.id)
    setDraft({
      name: r.name ?? '', priority: String(r.priority),
      match_normalized_merchant: r.match_normalized_merchant ?? '',
      match_account_name: r.match_account_name ?? '',
      match_amount_min: r.match_amount_min?.toString() ?? '',
      match_amount_max: r.match_amount_max?.toString() ?? '',
      match_regex: r.match_regex ?? '', match_notes: r.match_notes ?? '',
      category_id: r.category_id ?? '', is_transfer: r.is_transfer,
    })
    setShowAdvanced(!!(r.match_regex || r.match_notes || r.match_amount_min != null || r.match_amount_max != null))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (r: Rule) => {
    if (!await confirm('Delete this rule?')) return
    const { error } = await supabase.from('categorization_rules').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    setRules(prev => prev.filter(x => x.id !== r.id))
  }

  const conditionSummary = (r: Rule): string => {
    const parts: string[] = []
    if (r.match_normalized_merchant) parts.push(`merchant ~ "${r.match_normalized_merchant}"`)
    if (r.match_account_name) parts.push(`account ~ "${r.match_account_name}"`)
    if (r.match_amount_min != null) parts.push(`≥ ${r.match_amount_min}`)
    if (r.match_amount_max != null) parts.push(`≤ ${r.match_amount_max}`)
    if (r.match_regex) parts.push(`regex /${r.match_regex}/`)
    if (r.match_notes) parts.push(`notes ~ "${r.match_notes}"`)
    return parts.join(' AND ') || 'no conditions'
  }

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-6">
      {/* Add / edit form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{editingId ? 'Edit rule' : 'New rule'}</h2>
          {editingId && (
            <button onClick={() => { setEditingId(null); setDraft(EMPTY_DRAFT); setShowAdvanced(false) }}
              className="text-xs text-gray-500 hover:text-gray-700">Cancel edit</button>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">When merchant contains</label>
          <input className={input} placeholder="e.g. starbucks"
            value={draft.match_normalized_merchant}
            onChange={e => setDraft({ ...draft, match_normalized_merchant: e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Then categorize as</label>
            <select className={input} value={draft.is_transfer ? '__transfer__' : draft.category_id}
              onChange={e => {
                const v = e.target.value
                if (v === '__transfer__') setDraft({ ...draft, is_transfer: true, category_id: '' })
                else setDraft({ ...draft, is_transfer: false, category_id: v })
              }}>
              <option value="">Select…</option>
              <option value="__transfer__">Transfer (exclude from spend)</option>
              {selectable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <input className={input} type="number" value={draft.priority}
              onChange={e => setDraft({ ...draft, priority: e.target.value })} />
          </div>
        </div>

        <button onClick={() => setShowAdvanced(s => !s)} className="text-xs text-blue-600 hover:underline">
          {showAdvanced ? '− Hide' : '+ More'} conditions
        </button>

        {showAdvanced && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Account name contains</label>
              <input className={input} value={draft.match_account_name}
                onChange={e => setDraft({ ...draft, match_account_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount ≥</label>
                <input className={input} type="number" value={draft.match_amount_min}
                  onChange={e => setDraft({ ...draft, match_amount_min: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount ≤</label>
                <input className={input} type="number" value={draft.match_amount_max}
                  onChange={e => setDraft({ ...draft, match_amount_max: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Regex (matches merchant)</label>
              <input className={input} placeholder="e.g. ^amzn" value={draft.match_regex}
                onChange={e => setDraft({ ...draft, match_regex: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes contains</label>
              <input className={input} value={draft.match_notes}
                onChange={e => setDraft({ ...draft, match_notes: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label (optional)</label>
              <input className={input} value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="w-full py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {saving ? 'Saving…' : editingId ? 'Update rule' : 'Add rule'}
        </button>
      </div>

      {/* Rule list */}
      <div className="space-y-2">
        {rules.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No rules yet. Add one above.</p>
        )}
        {rules.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-gray-400 shrink-0">#{r.priority}</span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {r.name || conditionSummary(r)}
                </span>
              </div>
              {r.name && <p className="text-xs text-gray-500 truncate mt-0.5">{conditionSummary(r)}</p>}
              <p className="text-xs text-blue-600 mt-0.5">
                → {r.is_transfer ? 'Transfer' : (r.category_id ? catName.get(r.category_id) ?? 'Unknown' : 'Uncategorized')}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => edit(r)} className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">Edit</button>
              <button onClick={() => remove(r)} className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
