'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import type { HouseholdMember } from '@/app/components/budget/transaction-types'

const PRESET_COLORS = [
  '#3b82f6', '#f43f5e', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280',
]

export default function HouseholdMembersClient({
  initialMembers,
  userId,
}: {
  initialMembers: HouseholdMember[]
  userId: string
}) {
  const [members, setMembers] = useState<HouseholdMember[]>(initialMembers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ full_name: '', display_name: '', color: '' })
  const [addForm, setAddForm] = useState({ full_name: '', display_name: '', color: PRESET_COLORS[2] })
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const startEdit = (m: HouseholdMember) => {
    setEditingId(m.id)
    setEditForm({ full_name: m.full_name, display_name: m.display_name, color: m.color })
  }

  const saveEdit = async (id: string) => {
    if (!editForm.full_name.trim() || !editForm.display_name.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('household_members')
      .update({
        full_name: editForm.full_name.trim(),
        display_name: editForm.display_name.trim(),
        color: editForm.color,
      })
      .eq('id', id)
    if (!error) {
      setMembers(prev => prev.map(m =>
        m.id === id ? { ...m, ...editForm, full_name: editForm.full_name.trim(), display_name: editForm.display_name.trim() } : m
      ))
      setEditingId(null)
    }
    setSaving(false)
  }

  const deleteMember = async (id: string) => {
    const nonShared = members.filter(m => !m.is_shared)
    if (nonShared.length <= 1 && !members.find(m => m.id === id)?.is_shared) {
      alert('You must keep at least one non-shared member.')
      return
    }
    if (!confirm('Delete this household member?')) return
    setSaving(true)
    const { error } = await supabase.from('household_members').delete().eq('id', id)
    if (!error) setMembers(prev => prev.filter(m => m.id !== id))
    setSaving(false)
  }

  const addMember = async () => {
    if (!addForm.full_name.trim() || !addForm.display_name.trim()) return
    setSaving(true)
    const nextOrder = Math.max(...members.map(m => m.sort_order), -1) + 1
    const { data, error } = await supabase
      .from('household_members')
      .insert({
        user_id: userId,
        full_name: addForm.full_name.trim(),
        display_name: addForm.display_name.trim(),
        color: addForm.color,
        sort_order: nextOrder,
        is_shared: false,
      })
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .single()
    if (!error && data) {
      setMembers(prev => [...prev, data])
      setAddForm({ full_name: '', display_name: '', color: PRESET_COLORS[2] })
      setShowAdd(false)
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Household members</h2>
          <p className="text-sm text-gray-500 mt-0.5">People whose transactions and accounts you track together.</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {members.map(m => (
          <div key={m.id} className="border border-gray-200 rounded-xl p-3">
            {editingId === m.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Full name (stored on transactions)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    value={editForm.display_name}
                    onChange={e => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                    placeholder="Short name"
                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => setEditForm(f => ({ ...f, color: c }))}
                        className={`w-6 h-6 rounded-full border-2 transition ${editForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input type="color" value={editForm.color}
                    onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => saveEdit(m.id)} disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: m.color }}>
                  {m.display_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.full_name}</p>
                  <p className="text-xs text-gray-400">shown as "{m.display_name}"</p>
                </div>
                {m.is_shared && (
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-2">shared</span>
                )}
                <button onClick={() => startEdit(m)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium transition">
                  Edit
                </button>
                <button onClick={() => deleteMember(m.id)} disabled={saving}
                  className="text-xs text-red-400 hover:text-red-600 font-medium transition disabled:opacity-40">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd ? (
        <div className="border border-gray-200 rounded-xl p-3 space-y-2 mb-4">
          <div className="flex gap-2">
            <input
              value={addForm.full_name}
              onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Full name (e.g. Alex Smith)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={addForm.display_name}
              onChange={e => setAddForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Short (e.g. Alex)"
              className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setAddForm(f => ({ ...f, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition ${addForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <input type="color" value={addForm.color}
              onChange={e => setAddForm(f => ({ ...f, color: e.target.value }))}
              className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={addMember} disabled={saving || !addForm.full_name.trim() || !addForm.display_name.trim()}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              Add member
            </button>
            <button onClick={() => { setShowAdd(false); setAddForm({ full_name: '', display_name: '', color: PRESET_COLORS[2] }) }}
              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition"
        >
          <span className="text-lg leading-none">+</span> Add member
        </button>
      )}
    </div>
  )
}
