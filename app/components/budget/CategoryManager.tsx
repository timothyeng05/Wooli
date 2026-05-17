'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

interface Category {
  id: string
  name: string
  color: string
  is_income: boolean
  parent_id: string | null
  sort_order: number
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
  '#22c55e', '#84cc16', '#f97316', '#64748b',
]

export default function CategoryManager({
  userId,
  categories: initial
}: {
  userId: string
  categories: Category[]
}) {
  const [categories, setCategories] = useState(initial)
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newIsIncome, setNewIsIncome] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const parents = categories.filter(c => !c.parent_id)
  const children = (parentId: string) => categories.filter(c => c.parent_id === parentId)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: newName.trim(),
          color: newColor,
          is_income: adding?.parentId
            ? (categories.find(c => c.id === adding.parentId)?.is_income ?? newIsIncome)
            : newIsIncome,
          parent_id: adding?.parentId || null,
          sort_order: categories.length,
        })
        .select()
        .single()
      if (error) throw error
      setCategories(prev => [...prev, data])
      setAdding(null)
      setNewName('')
      setNewColor('#6366f1')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async (id: string) => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('categories')
        .update({ name: newName.trim(), color: newColor })
        .eq('id', id)
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name: newName.trim(), color: newColor } : c))
      setEditing(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this category? Transactions using it will become uncategorized.')) return
    setDeletingId(id)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id && c.parent_id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (cat: Category) => {
    setEditing(cat.id)
    setNewName(cat.name)
    setNewColor(cat.color)
    setAdding(null)
  }

  const renderEditForm = (id: string) => (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border-t border-blue-100">
      <input
        type="text"
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleEdit(id)}
        autoFocus
        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-1 flex-wrap max-w-[120px]">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setNewColor(c)}
            style={{ backgroundColor: c }}
            className={`w-4 h-4 rounded-full transition ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
          />
        ))}
      </div>
      <button
        onClick={() => handleEdit(id)}
        disabled={saving || !newName.trim()}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(null)}
        className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  )

  const renderAddForm = (parentId: string | null) => (
    <div className="flex items-center gap-2 mt-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <input
        type="text"
        value={newName}
        onChange={e => setNewName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Category name"
        autoFocus
        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-1 flex-wrap max-w-[120px]">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setNewColor(c)}
            style={{ backgroundColor: c }}
            className={`w-4 h-4 rounded-full transition ${newColor === c ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
          />
        ))}
      </div>
      {!parentId && (
        <select
          value={newIsIncome ? 'income' : 'expense'}
          onChange={e => setNewIsIncome(e.target.value === 'income')}
          className="text-xs border border-gray-300 rounded px-1.5 py-1.5 bg-white"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      )}
      <button
        onClick={handleAdd}
        disabled={saving || !newName.trim()}
        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition"
      >
        Add
      </button>
      <button
        onClick={() => { setAdding(null); setNewName('') }}
        className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  )

  const expenseParents = parents.filter(c => !c.is_income)
  const incomeParents = parents.filter(c => c.is_income)

  return (
    <div className="space-y-8">
      {[
        { label: 'Expense Categories', list: expenseParents, income: false },
        { label: 'Income Categories', list: incomeParents, income: true },
      ].map(({ label, list, income }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{label}</h3>
            <button
              onClick={() => { setAdding({ parentId: null }); setEditing(null); setNewIsIncome(income); setNewName('') }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add Category
            </button>
          </div>

          <div className="space-y-3">
            {list.map(parent => (
              <div key={parent.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Parent row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: parent.color }} />
                  <span className="font-medium text-gray-900 flex-1">{parent.name}</span>
                  <button
                    onClick={() => { startEdit(parent) }}
                    className="text-xs text-gray-400 hover:text-blue-600 transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setAdding({ parentId: parent.id }); setEditing(null); setNewName('') }}
                    className="text-xs text-blue-600 hover:text-blue-700 ml-1"
                  >
                    + Sub
                  </button>
                  <button
                    onClick={() => handleDelete(parent.id)}
                    disabled={deletingId === parent.id}
                    className="text-xs text-gray-400 hover:text-red-500 transition ml-1"
                  >
                    ✕
                  </button>
                </div>

                {editing === parent.id && renderEditForm(parent.id)}

                {/* Children */}
                {children(parent.id).length > 0 && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100 bg-gray-50">
                    {children(parent.id).map(child => (
                      <div key={child.id}>
                        <div className="flex items-center gap-3 px-4 py-2 pl-8">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                          <span className="text-sm text-gray-700 flex-1">{child.name}</span>
                          <button
                            onClick={() => startEdit(child)}
                            className="text-xs text-gray-400 hover:text-blue-600 transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(child.id)}
                            disabled={deletingId === child.id}
                            className="text-xs text-gray-400 hover:text-red-500 transition ml-1"
                          >
                            ✕
                          </button>
                        </div>
                        {editing === child.id && renderEditForm(child.id)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add sub-category form */}
                {adding?.parentId === parent.id && (
                  <div className="border-t border-gray-100 px-4 py-2">
                    {renderAddForm(parent.id)}
                  </div>
                )}
              </div>
            ))}

            {adding?.parentId === null && newIsIncome === income
              ? renderAddForm(null)
              : null}

            {list.length === 0 && adding?.parentId !== null && (
              <p className="text-sm text-gray-500 text-center py-4">No {label.toLowerCase()} yet</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
