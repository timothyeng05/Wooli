'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import ListItemRow, { type ListItemData } from './ListItemRow'
import ListSharePanel from './ListSharePanel'

export type ListItem = ListItemData

function sortActiveItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    const impA = a.importance ?? 0
    const impB = b.importance ?? 0
    if (impA !== impB) return impB - impA
    const dueA = a.due_date || '9999-12-31'
    const dueB = b.due_date || '9999-12-31'
    if (dueA !== dueB) return dueA.localeCompare(dueB)
    return a.created_at.localeCompare(b.created_at)
  })
}

interface ListMeta {
  id: string
  name: string
  description: string | null
  is_archived: boolean
}

interface Friend {
  id: string
  full_name: string | null
  email: string | null
}

interface Share {
  id: string
  shared_with_user_id: string
  can_edit: boolean
  friend_name: string | null
  friend_email: string | null
}

export default function ListDetailView({
  userId,
  list,
  initialItems,
  isOwner = true,
  canEdit = true,
  friends = [],
  shares = [],
}: {
  userId: string
  list: ListMeta
  initialItems: ListItem[]
  isOwner?: boolean
  canEdit?: boolean
  friends?: Friend[]
  shares?: Share[]
}) {
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [name, setName] = useState(list.name)
  const [editingName, setEditingName] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [archived, setArchived] = useState(list.is_archived)

  const supabase = createClient()

  const [showDone, setShowDone] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`wooli_list_${list.id}_show_done`)
    if (stored === '1') setShowDone(true)
  }, [list.id])
  const toggleShowDone = () => {
    setShowDone(prev => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem(`wooli_list_${list.id}_show_done`, next ? '1' : '0')
      }
      return next
    })
  }

  const visible = useMemo(() => sortActiveItems(items.filter(i => !i.is_done)), [items])
  const done = useMemo(
    () => items.filter(i => i.is_done).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [items]
  )

  const addItem = async () => {
    const title = newTitle.trim()
    if (!title || adding) return
    setAdding(true)
    const { data, error } = await supabase
      .from('list_items')
      .insert({ list_id: list.id, user_id: userId, title })
      .select('id, title, notes, url, is_done, sort_order, created_at, due_date, importance')
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
          {isOwner && editingName ? (
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
              onClick={() => isOwner && setEditingName(true)}
              className={`text-3xl font-bold text-gray-900 rounded px-1 -mx-1 ${isOwner ? 'cursor-text hover:bg-gray-50' : ''}`}
              title={isOwner ? 'Click to rename' : undefined}
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
          {!isOwner && (
            <span className="inline-block mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {canEdit ? 'Shared with you · can edit' : 'Shared with you · view only'}
            </span>
          )}
        </div>
        {isOwner && (
          <div className="flex flex-col gap-1.5 text-sm flex-shrink-0">
            <button onClick={toggleArchive} className="text-gray-500 hover:text-gray-900 text-right">
              {archived ? 'Unarchive' : 'Archive'}
            </button>
            <button onClick={deleteList} className="text-red-500 hover:text-red-700 text-right">
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Add item — only for editors */}
      {canEdit && (
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
      )}

      {/* Active items */}
      {visible.length > 0 && (
        <div className="space-y-1">
          {visible.map(i => (
            <ListItemRow
              key={i.id}
              item={i}
              onToggle={canEdit ? toggleItem : undefined}
              onDelete={canEdit ? deleteItem : undefined}
              onEdit={canEdit ? editItem : undefined}
            />
          ))}
        </div>
      )}

      {/* Done items */}
      {done.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={toggleShowDone}
            className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-700 transition flex items-center gap-1"
          >
            <span>{showDone ? '▾' : '▸'}</span>
            Done · {done.length}
            <span className="text-gray-300 normal-case font-normal tracking-normal ml-1">
              {showDone ? '(hide)' : '(show)'}
            </span>
          </button>
          {showDone && (
            <div className="space-y-1">
              {done.map(i => (
                <ListItemRow
                  key={i.id}
                  item={i}
                  onToggle={canEdit ? toggleItem : undefined}
                  onDelete={canEdit ? deleteItem : undefined}
                  onEdit={canEdit ? editItem : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">No items yet{canEdit ? ' — add one above' : ''}</p>
      )}

      {/* Share panel — owner only */}
      {isOwner && (
        <ListSharePanel listId={list.id} friends={friends} shares={shares} />
      )}

      <Link href="/lists" className="block text-center text-sm text-gray-500 hover:text-gray-900 pt-4">
        ← All lists
      </Link>
    </div>
  )
}
