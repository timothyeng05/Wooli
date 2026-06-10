'use client'

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

type Props = {
  item: ListItem
  onToggle: (itemId: string, isDone: boolean) => void
  onDelete: (itemId: string) => void
  isLoading?: boolean
}

function ImportanceDots({ importance }: { importance: number | null }) {
  if (!importance) return null
  const dots = [1, 2, 3]
  return (
    <span className="flex items-center gap-0.5 flex-shrink-0">
      {dots.map(dot => {
        let color = 'bg-gray-300'
        if (dot <= importance) {
          if (importance === 1) color = 'bg-gray-400'
          else if (importance === 2) color = 'bg-amber-400'
          else color = 'bg-red-500'
        }
        return (
          <span
            key={dot}
            className={`w-1.5 h-1.5 rounded-full ${dot <= importance ? color : 'bg-gray-200'}`}
          />
        )
      })}
    </span>
  )
}

function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const isOverdue = due < today

  const formatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
        isOverdue
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {formatted}
    </span>
  )
}

export default function ListItemRow({ item, onToggle, onDelete, isLoading }: Props) {
  const titleContent = item.url ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-sm text-blue-600 hover:underline ${item.is_done ? 'line-through text-gray-400' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      {item.title}
    </a>
  ) : (
    <span className={`text-sm text-gray-800 ${item.is_done ? 'line-through text-gray-400' : ''}`}>
      {item.title}
    </span>
  )

  return (
    <div className={`group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition ${isLoading ? 'opacity-50' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id, !item.is_done)}
        disabled={isLoading}
        className="flex-shrink-0 focus:outline-none"
        aria-label={item.is_done ? 'Mark as not done' : 'Mark as done'}
      >
        <span
          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            item.is_done
              ? 'bg-green-500 border-green-500'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {item.is_done && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      </button>

      {/* Title */}
      <div className="flex-1 min-w-0">
        {titleContent}
        {item.notes && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.notes}</p>
        )}
      </div>

      {/* Right side: importance, due date, delete */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <ImportanceDots importance={item.importance} />
        {!item.is_done && <DueDateBadge dueDate={item.due_date} />}
        <button
          onClick={() => onDelete(item.id)}
          disabled={isLoading}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 focus:opacity-100 focus:outline-none p-0.5"
          aria-label="Delete item"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
