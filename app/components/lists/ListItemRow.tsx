'use client'

import { useState } from 'react'

export interface ListItemData {
  id: string
  title: string
  notes: string | null
  url: string | null
  is_done: boolean
  sort_order: number
  created_at: string
  due_date: string | null
  importance: number | null
}

const IMPORTANCE_LABELS: Record<number, string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
}

const IMPORTANCE_DOT_COLOR: Record<number, string> = {
  1: 'bg-gray-300',
  2: 'bg-amber-400',
  3: 'bg-red-500',
}

function formatDue(due: string): { label: string; overdue: boolean } {
  const today = new Date().toISOString().split('T')[0]
  const dueDate = new Date(due + 'T12:00:00')
  const overdue = due < today
  const sameYear = dueDate.getFullYear() === new Date().getFullYear()
  const label = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return { label, overdue }
}

export default function ListItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: ListItemData
  onToggle?: (id: string, isDone: boolean) => void
  onDelete?: (id: string) => void
  onEdit?: (id: string, patch: { title?: string; notes?: string | null; url?: string | null; due_date?: string | null; importance?: number | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.notes || '')
  const [url, setUrl] = useState(item.url || '')
  const [dueDate, setDueDate] = useState(item.due_date || '')
  const [importance, setImportance] = useState<number | null>(item.importance)

  const save = () => {
    if (!title.trim()) return
    onEdit?.(item.id, {
      title: title.trim(),
      notes: notes.trim() || null,
      url: url.trim() || null,
      due_date: dueDate || null,
      importance,
    })
    setEditing(false)
  }

  const cancel = () => {
    setTitle(item.title)
    setNotes(item.notes || '')
    setUrl(item.url || '')
    setDueDate(item.due_date || '')
    setImportance(item.importance)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3 space-y-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          autoFocus
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() }
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
        />
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="URL (optional)"
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-500 flex-shrink-0">Due</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {dueDate && (
            <button type="button" onClick={() => setDueDate('')} className="text-xs text-gray-500 hover:text-gray-900 px-1">
              Clear
            </button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-gray-500 flex-shrink-0">Priority</label>
          <div className="flex gap-1">
            {([1, 2, 3] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setImportance(importance === n ? null : n)}
                className={`px-2.5 py-1 rounded text-xs font-medium border transition flex items-center gap-1 ${
                  importance === n
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${importance === n ? 'bg-white' : IMPORTANCE_DOT_COLOR[n]}`} />
                {IMPORTANCE_LABELS[n]}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button onClick={save} className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
            Save
          </button>
          <button onClick={cancel} className="px-3 py-1 text-gray-600 rounded text-sm font-medium hover:bg-gray-100">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const due = item.due_date ? formatDue(item.due_date) : null

  return (
    <div className="group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition">
      <button
        type="button"
        onClick={() => onToggle?.(item.id, !item.is_done)}
        aria-label={item.is_done ? 'Mark not done' : 'Mark done'}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition ${
          item.is_done ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 hover:border-blue-400'
        }`}
      >
        {item.is_done && (
          <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {item.importance && !item.is_done && (
        <span
          className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${IMPORTANCE_DOT_COLOR[item.importance]}`}
          title={`${IMPORTANCE_LABELS[item.importance]} priority`}
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className={`text-sm break-words ${item.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {item.title}
          </p>
          {due && !item.is_done && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                due.overdue ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {due.overdue ? '⚠ ' : ''}{due.label}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs text-blue-600 hover:underline flex-shrink-0"
              aria-label="Open link"
            >
              ↗
            </a>
          )}
        </div>
        {item.notes && (
          <p className={`text-xs mt-0.5 ${item.is_done ? 'text-gray-300' : 'text-gray-500'}`}>{item.notes}</p>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        {onEdit && (
          <button onClick={() => setEditing(true)} aria-label="Edit" className="text-xs text-gray-500 hover:text-gray-900 px-1.5">
            Edit
          </button>
        )}
        {onDelete && (
          <button onClick={() => onDelete(item.id)} aria-label="Delete" className="text-xs text-red-500 hover:text-red-700 px-1.5">
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
