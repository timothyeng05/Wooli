'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ListItemRow from './ListItemRow'
import { addItem, toggleItem, deleteItem } from '@/app/lists/[id]/actions'

type ListItem = {
  id: string
  title: string
  notes: string | null
  url: string | null
  is_done: boolean
  sort_order: number
  due_date: string | null
  importance: number | null
  created_at: string
}

type List = {
  id: string
  name: string
  description: string | null
  created_at: string
}

type Props = {
  list: List
  initialItems: ListItem[]
}

function sortActiveItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    // importance DESC NULLS LAST
    const aImp = a.importance ?? 0
    const bImp = b.importance ?? 0
    if (bImp !== aImp) return bImp - aImp

    // due_date ASC NULLS LAST
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date < b.due_date ? -1 : 1
    }

    // created_at ASC
    return a.created_at < b.created_at ? -1 : 1
  })
}

// Stable optimistic ID
let optimisticCounter = 0

export default function ListDetailView({ list, initialItems }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ListItem[]>(initialItems)
  const [showDone, setShowDone] = useState(false)
  const [addText, setAddText] = useState('')
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const storageKey = `wooli_list_${list.id}_show_done`

  // Load show_done preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored === 'true') setShowDone(true)
    } catch {
      // ignore
    }
  }, [storageKey])

  const toggleShowDone = () => {
    const next = !showDone
    setShowDone(next)
    try {
      localStorage.setItem(storageKey, String(next))
    } catch {
      // ignore
    }
  }

  const activeItems = sortActiveItems(items.filter(i => !i.is_done))
  const doneItems = items.filter(i => i.is_done)

  const handleAddItem = async () => {
    const title = addText.trim()
    if (!title) return

    // Optimistic UI
    const optimisticId = `optimistic-${++optimisticCounter}`
    const optimisticItem: ListItem = {
      id: optimisticId,
      title,
      notes: null,
      url: null,
      is_done: false,
      sort_order: 0,
      due_date: null,
      importance: null,
      created_at: new Date().toISOString(),
    }
    setItems(prev => [...prev, optimisticItem])
    setAddText('')

    const result = await addItem(list.id, title)

    if (result) {
      // Replace optimistic item with real one
      setItems(prev => prev.map(i => i.id === optimisticId ? { ...optimisticItem, id: result.id } : i))
      startTransition(() => router.refresh())
    } else {
      // Rollback
      setItems(prev => prev.filter(i => i.id !== optimisticId))
      setAddText(title)
    }
  }

  const handleToggle = async (itemId: string, isDone: boolean) => {
    // Optimistic
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_done: isDone } : i))
    setLoadingIds(prev => new Set(prev).add(itemId))

    const ok = await toggleItem(itemId, isDone)
    setLoadingIds(prev => { const s = new Set(prev); s.delete(itemId); return s })

    if (!ok) {
      // Rollback
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, is_done: !isDone } : i))
    } else {
      startTransition(() => router.refresh())
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Delete this item?')) return

    // Optimistic
    const removed = items.find(i => i.id === itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))

    const ok = await deleteItem(itemId)
    if (!ok && removed) {
      // Rollback
      setItems(prev => [...prev, removed])
    } else if (ok) {
      startTransition(() => router.refresh())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddItem()
    }
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {activeItems.length} remaining
          {doneItems.length > 0 && ` · ${doneItems.length} done`}
        </p>
        {doneItems.length > 0 && activeItems.length === 0 && (
          <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
            All done!
          </span>
        )}
      </div>

      {/* Active items */}
      {activeItems.length === 0 && doneItems.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No items yet — add one below</p>
        </div>
      )}

      {activeItems.length > 0 && (
        <div className="mb-4">
          {activeItems.map(item => (
            <ListItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              isLoading={loadingIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Done items (collapsible) */}
      {doneItems.length > 0 && (
        <div className="mb-4">
          <button
            onClick={toggleShowDone}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition mb-1 px-3"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showDone ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {doneItems.length} completed
          </button>

          {showDone && (
            <div className="opacity-60">
              {doneItems.map(item => (
                <ListItemRow
                  key={item.id}
                  item={item}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  isLoading={loadingIds.has(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add item input */}
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 mt-4 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition bg-white">
        <span className="text-gray-300 flex-shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="text"
          value={addText}
          onChange={e => setAddText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item…"
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
          disabled={isPending}
        />
        {addText.trim() && (
          <button
            onClick={handleAddItem}
            disabled={isPending}
            className="text-blue-600 text-sm font-medium hover:text-blue-700 transition flex-shrink-0"
          >
            Add
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1.5 px-1">Press Enter to add</p>
    </div>
  )
}
