'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  is_transfer: boolean
  parent_id: string | null
  sort_order: number
  keywords: string | null
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#3b82f6', '#06b6d4',
  '#22c55e', '#84cc16', '#f97316', '#64748b',
]

const PRESET_EMOJIS = [
  '🍽️','🛒','🛍️','🎬','🚗','✈️','💊','💡','🏠','📱',
  '💅','📚','🎁','🐾','🛡️','💰','💵','💸','💳','↔️',
  '⛽','🏋️','🏥','📺','☕','🎵','🍺','🏨','💄','🎮',
  '🐕','🧴','🎯','🚌','💻','📶','💧','🍕','🎪','👶',
]

function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 px-0.5"
      aria-label="Drag to reorder"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
        <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
        <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
      </svg>
    </button>
  )
}

function CatIcon({ icon, color, size = 'sm' }: { icon: string | null; color: string; size?: 'sm' | 'md' }) {
  if (icon) {
    return <span className={size === 'md' ? 'text-base flex-shrink-0' : 'text-sm flex-shrink-0 w-4 text-center'}>{icon}</span>
  }
  return (
    <div
      className={size === 'md' ? 'w-3 h-3 rounded-full flex-shrink-0' : 'w-2 h-2 rounded-full flex-shrink-0'}
      style={{ backgroundColor: color }}
    />
  )
}

function SortableChildRow({
  child,
  editing,
  deletingId,
  onEdit,
  onDelete,
  editForm,
}: {
  child: Category
  editing: string | null
  deletingId: string | null
  onEdit: (cat: Category) => void
  onDelete: (id: string) => void
  editForm: (id: string) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 px-3 py-2 pl-6 bg-gray-50">
        <DragHandle {...attributes} {...listeners} />
        <CatIcon icon={child.icon} color={child.color} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-gray-700">{child.name}</span>
          {child.keywords && (
            <p className="text-[11px] text-gray-400 truncate">{child.keywords}</p>
          )}
        </div>
        <button onClick={() => onEdit(child)} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</button>
        <button
          onClick={() => onDelete(child.id)}
          disabled={deletingId === child.id}
          className="text-xs text-gray-400 hover:text-red-500 transition ml-1"
        >✕</button>
      </div>
      {editing === child.id && editForm(child.id)}
    </div>
  )
}

export default function CategoryManager({
  userId,
  categories: initial,
}: {
  userId: string
  categories: Category[]
}) {
  const [categories, setCategories] = useState(initial)
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366f1')
  const [newIcon, setNewIcon] = useState('')
  const [newIsIncome, setNewIsIncome] = useState(false)
  const [newIsTransfer, setNewIsTransfer] = useState(false)
  const [newKeywords, setNewKeywords] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const parents = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order)
  const childrenOf = (parentId: string) =>
    categories.filter(c => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

  // ── Drag end ──────────────────────────────────────────────────────────────
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeItem = categories.find(c => c.id === active.id)
    const overItem = categories.find(c => c.id === over.id)
    if (!activeItem || !overItem || activeItem.parent_id !== overItem.parent_id) return

    const parentId = activeItem.parent_id!
    const subs = childrenOf(parentId)
    const oldIdx = subs.findIndex(c => c.id === active.id)
    const newIdx = subs.findIndex(c => c.id === over.id)
    const reordered = arrayMove(subs, oldIdx, newIdx)

    const updated = categories.map(c => {
      const idx = reordered.findIndex(r => r.id === c.id)
      return idx !== -1 ? { ...c, sort_order: idx } : c
    })
    setCategories(updated)

    const supabase = createClient()
    for (let i = 0; i < reordered.length; i++) {
      await supabase.from('categories').update({ sort_order: i }).eq('id', reordered[i].id)
    }
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const parent = adding?.parentId ? categories.find(c => c.id === adding.parentId) : null
      const siblingCount = adding?.parentId ? childrenOf(adding.parentId).length : parents.length
      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: newName.trim(),
          color: newColor,
          icon: newIcon.trim() || null,
          is_income: parent ? parent.is_income : newIsIncome,
          is_transfer: parent ? parent.is_transfer : newIsTransfer,
          parent_id: adding?.parentId || null,
          sort_order: siblingCount,
        })
        .select()
        .single()
      if (error) throw error
      setCategories(prev => [...prev, data])
      setAdding(null)
      setNewName('')
      setNewColor('#6366f1')
      setNewIcon('')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleEdit = async (id: string) => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const supabase = createClient()
      const keywords = newKeywords.trim() || null
      const icon = newIcon.trim() || null
      const cat = categories.find(c => c.id === id)!
      const isParent = !cat.parent_id

      const update: Record<string, unknown> = { name: newName.trim(), color: newColor, icon, keywords }
      if (isParent) {
        update.is_income = newIsIncome
        update.is_transfer = newIsTransfer
      }

      const { error } = await supabase.from('categories').update(update).eq('id', id)
      if (error) throw error

      let updated = categories.map(c => c.id === id ? { ...c, ...update } as Category : c)

      // Cascade type change to children
      if (isParent && (cat.is_income !== newIsIncome || cat.is_transfer !== newIsTransfer)) {
        await supabase
          .from('categories')
          .update({ is_income: newIsIncome, is_transfer: newIsTransfer })
          .eq('parent_id', id)
        updated = updated.map(c =>
          c.parent_id === id ? { ...c, is_income: newIsIncome, is_transfer: newIsTransfer } : c
        )
      }

      setCategories(updated)
      setEditing(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
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
    setNewIcon(cat.icon || '')
    setNewKeywords(cat.keywords || '')
    setNewIsIncome(cat.is_income)
    setNewIsTransfer(cat.is_transfer)
    setAdding(null)
  }

  // ── Emoji picker ──────────────────────────────────────────────────────────
  const renderEmojiPicker = () => (
    <div>
      <p className="text-[11px] text-gray-500 mb-1">Icon</p>
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={newIcon}
          onChange={e => setNewIcon(e.target.value)}
          placeholder="?"
          className="w-10 h-10 text-xl text-center border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
        />
        <div className="flex flex-wrap gap-0.5">
          {PRESET_EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setNewIcon(e)}
              className={`w-7 h-7 text-sm rounded transition hover:bg-gray-100 flex items-center justify-center ${
                newIcon === e ? 'bg-blue-100 ring-1 ring-blue-400' : ''
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Forms ─────────────────────────────────────────────────────────────────
  const renderEditForm = (id: string) => {
    const cat = categories.find(c => c.id === id)
    const isParent = cat && !cat.parent_id
    return (
      <div className="p-3 bg-blue-50 border-t border-blue-100 space-y-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
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
        </div>
        {renderEmojiPicker()}
        <input
          type="text"
          value={newKeywords}
          onChange={e => setNewKeywords(e.target.value)}
          placeholder="AI hints: mta, subway, njtransit (comma-separated)"
          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
        />
        {isParent && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500">Type:</span>
            <select
              value={newIsTransfer ? 'transfer' : newIsIncome ? 'income' : 'expense'}
              onChange={e => {
                setNewIsTransfer(e.target.value === 'transfer')
                setNewIsIncome(e.target.value === 'income')
              }}
              className="text-xs border border-gray-300 rounded px-1.5 py-1.5 bg-white"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
            </select>
            {newIsTransfer && (
              <span className="text-[10px] text-amber-600">Transactions assigned here are excluded from income/expense totals</span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => handleEdit(id)}
            disabled={saving || !newName.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >Save</button>
          <button onClick={() => setEditing(null)} className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const renderAddForm = (parentId: string | null) => (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300 space-y-2.5">
      <div className="flex items-center gap-2">
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
        {!parentId && !newIsTransfer && (
          <select
            value={newIsIncome ? 'income' : 'expense'}
            onChange={e => setNewIsIncome(e.target.value === 'income')}
            className="text-xs border border-gray-300 rounded px-1.5 py-1.5 bg-white"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        )}
      </div>
      {renderEmojiPicker()}
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >Add</button>
        <button
          onClick={() => { setAdding(null); setNewName(''); setNewIcon('') }}
          className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >Cancel</button>
      </div>
    </div>
  )

  const expenseParents = parents.filter(c => !c.is_income && !c.is_transfer)
  const incomeParents  = parents.filter(c =>  c.is_income && !c.is_transfer)
  const transferParents = parents.filter(c => c.is_transfer)

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-8">
        {[
          { label: 'Expense Categories', list: expenseParents, income: false, isTransfer: false },
          { label: 'Income Categories',  list: incomeParents,  income: true,  isTransfer: false },
          { label: 'Transfer Categories', list: transferParents, income: false, isTransfer: true },
        ].map(({ label, list, income, isTransfer }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="font-semibold text-gray-900">{label}</h3>
                {isTransfer && (
                  <p className="text-xs text-gray-400 mt-0.5">Assigning these auto-marks transactions as transfers</p>
                )}
              </div>
              <button
                onClick={() => {
                  setAdding({ parentId: null })
                  setEditing(null)
                  setNewIsIncome(income)
                  setNewIsTransfer(isTransfer)
                  setNewName('')
                  setNewIcon('')
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add
              </button>
            </div>

            <div className="space-y-3 mt-3">
              {list.map(parent => {
                const subs = childrenOf(parent.id)
                return (
                  <div key={parent.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Parent row */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-white">
                      <CatIcon icon={parent.icon} color={parent.color} size="md" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-900">{parent.name}</span>
                        {parent.keywords && (
                          <p className="text-[11px] text-gray-400 truncate">{parent.keywords}</p>
                        )}
                      </div>
                      <button onClick={() => startEdit(parent)} className="text-xs text-gray-400 hover:text-blue-600 transition">Edit</button>
                      <button
                        onClick={() => { setAdding({ parentId: parent.id }); setEditing(null); setNewName(''); setNewIcon('') }}
                        className="text-xs text-blue-600 hover:text-blue-700 ml-1"
                      >+ Sub</button>
                      <button
                        onClick={() => handleDelete(parent.id)}
                        disabled={deletingId === parent.id}
                        className="text-xs text-gray-400 hover:text-red-500 transition ml-1"
                      >✕</button>
                    </div>

                    {editing === parent.id && renderEditForm(parent.id)}

                    {/* Sortable children */}
                    {subs.length > 0 && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        <SortableContext items={subs.map(c => c.id)} strategy={verticalListSortingStrategy}>
                          {subs.map(child => (
                            <SortableChildRow
                              key={child.id}
                              child={child}
                              editing={editing}
                              deletingId={deletingId}
                              onEdit={startEdit}
                              onDelete={handleDelete}
                              editForm={renderEditForm}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    )}

                    {adding?.parentId === parent.id && (
                      <div className="border-t border-gray-100 px-4 py-2">
                        {renderAddForm(parent.id)}
                      </div>
                    )}
                  </div>
                )
              })}

              {adding?.parentId === null && newIsIncome === income && newIsTransfer === isTransfer
                ? renderAddForm(null)
                : null}

              {list.length === 0 && !adding && (
                <p className="text-sm text-gray-500 text-center py-4">
                  {isTransfer
                    ? 'Add categories like "Credit Card Payment" here to auto-mark transactions as transfers'
                    : `No ${label.toLowerCase()} yet`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  )
}
