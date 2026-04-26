'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import ListItemRow, { type ListItemData } from './ListItemRow'

export type ListItem = ListItemData

interface ListMeta {
  id: string
  name: string
  description: string | null
  is_archived: boolean
}

export default function ListDetailView({
  userId,
  list,
  initialItems,
}: {
  userId: string
  list: ListMeta
  initialItems: ListItem[]
}) {
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [name, setName] = useState(list.name)
  const [editingName, setEditingName] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [archived, setArchived] = useState(list.is_archived)

  const supabase = createClient()

  const visible = items.filter(i => !i.is_done)
  const done = items.filter(i => i.is_done)

  const addItem = async () => {
    const title = newTitle.trim()
    if (!title || adding) return
    setAdding(true)
    const { data, error } = await supabase
      .from('list_items')
      .insert({ list_id: list.id, user_id: userId, title })
      .select('id, title, notes, url, is_done, sort_order, created_at')
      .single()
    setAdding(false)
    if (error || !data) {
      alert('Failed to add item')
      return
    }
    setItems(prev => [...prev, data as ListItem])
    setNewTitle('')
  }

  const toggleItem = async (id: string, isDone: boolean) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, is_done: isDone } : i)))
    const { error } = await supabase.from('list_items').update({ is_done: isDone }).eq('id', id)
    if (error) {
      setItems(prev => prev.map(i => (i.id === id ? { ...i, is_done: !isDone } : i)))
    }
  }

  const deleteItem = async (id: string) => {
    const prev = items
    setItems(items.filter(i => i.id !== id))
    const { error } = await supabase.from('list_items').delete().eq('id', id)
    if (error) {
      setItems(prev)
      alert('Failed to delete')
    }
  }

  const editItem = async (id: string, patch: { title?: string; notes?: string | null; url?: string | null }) => {
    const prev = items
    setItems(items.map(i => (i.id === id ? { ...i, ...patch } : i)))
    const { error } = await supabase.from('list_items').update(patch).eq('id', id)
    if (error) {
      setItems(prev)
      alert('Failed to update')
    }
  }

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(list.name)
      setEditingName(false)
      return
    }
    setEditingName(false)
    const { error } = await supabase.from('lists').update({ name: trimmed }).eq('id', list.id)
    if (error) {
      alert('Failed to rename')
      setName(list.name)
    } else {
      router.refresh()
    }
  }

  const toggleArchive = async () => {
    const next = !archived
    setArchived(next)
    const { error } = await supabase.from('lists').update({ is_archived: next }).eq('id', list.id)
    if (error) {
      setArchived(!next)
      alert('Failed to update')
    } else {
      router.refresh()
    }
  }

  const deleteList = async () => {
    if (!confirm(`Delete "${list.name}" and all its items?`)) return
    const { error } = await supabase.from('lists').delete().eq('id', list.id)
    if (error) {
      alert('Failed to delete list')
      return
    }
    router.push('/lists')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') { setName(list.name); setEditingName(false) }
              }}
              autoFocus
              className="text-3xl font-bold text-gray-900 w-full border-b border-blue-300 bg-transparent focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="text-3xl font-bold text-gray-900 cursor-text hover:bg-gray-50 rounded px-1 -mx-1"
              title="Click to rename"
            >
              {name}
            </h1>
          )}
          {list.description && <p className="text-gray-500 mt-1">{list.description}</p>}
          {archived && (
            <span className="inline-block mt-2 text-xs uppercase tracking-wide font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              Archived
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-sm flex-shrink-0">
          <button
            onClick={toggleArchive}
            className="text-gray-500 hover:text-gray-900 text-right"
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={deleteList}
            className="text-red-500 hover:text-red-700 text-right"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Add item */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); addItem() }
          }}
          placeholder="Add an item and press Enter..."
          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addItem}
          disabled={!newTitle.trim() || adding}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          Add
        </button>
      </div>

      {/* Active items */}
      {visible.length > 0 && (
        <div className="space-y-1">
          {visible.map(i => (
            <ListItemRow
              key={i.id}
              item={i}
              onToggle={toggleItem}
              onDelete={deleteItem}
              onEdit={editItem}
            />
          ))}
        </div>
      )}

      {/* Done items */}
      {done.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Done · {done.length}
          </p>
          <div className="space-y-1">
            {done.map(i => (
              <ListItemRow
                key={i.id}
                item={i}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onEdit={editItem}
              />
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">No items yet — add one above</p>
      )}

      <Link href="/lists" className="block text-center text-sm text-gray-500 hover:text-gray-900 pt-4">
        ← All lists
      </Link>
    </div>
  )
}
