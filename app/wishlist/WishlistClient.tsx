'use client'
import { useState, useMemo } from 'react'
import { ALL_COUNTRIES, flagEmoji, type Country } from '@/lib/countries'
import { addCountry, removeCountry, toggleVisited, updateNote } from './actions'

export type WishItem = { id: string; code: string; name: string; note: string | null; visited: boolean }

export default function WishlistClient({ initialItems }: { initialItems: WishItem[] }) {
  const [items, setItems] = useState<WishItem[]>(initialItems)
  const [query, setQuery] = useState('')

  const have = useMemo(() => new Set(items.map(i => i.code.toUpperCase())), [items])
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL_COUNTRIES.filter(c => !have.has(c.code) && c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, have])

  const want = items.filter(i => !i.visited)
  const visited = items.filter(i => i.visited)

  const add = async (c: Country) => {
    setQuery('')
    const tempId = `temp-${c.code}`
    setItems(prev => [{ id: tempId, code: c.code, name: c.name, note: null, visited: false }, ...prev])
    const res = await addCountry(c.code, c.name)
    if (res) setItems(prev => prev.map(i => (i.id === tempId ? { ...i, id: res.id } : i)))
    else setItems(prev => prev.filter(i => i.id !== tempId))
  }

  const remove = async (id: string) => {
    const snapshot = items
    setItems(items.filter(i => i.id !== id))
    const ok = await removeCountry(id)
    if (!ok) setItems(snapshot)
  }

  const toggle = async (id: string, v: boolean) => {
    setItems(items.map(i => (i.id === id ? { ...i, visited: v } : i)))
    await toggleVisited(id, v)
  }

  const saveNote = async (id: string, note: string) => {
    setItems(items.map(i => (i.id === id ? { ...i, note } : i)))
    await updateNote(id, note)
  }

  return (
    <div>
      {/* Add a country */}
      <div className="relative">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search a country to add…"
          autoCapitalize="off"
          autoCorrect="off"
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 sm:py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map(c => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => add(c)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition"
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-sm text-gray-800">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Stats */}
      {items.length > 0 && (
        <div className="flex items-center gap-4 mt-4 text-sm">
          <span className="text-gray-600"><span className="font-bold text-gray-900">{want.length}</span> to go</span>
          <span className="text-gray-600"><span className="font-bold text-gray-900">{visited.length}</span> visited</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-5xl mb-3">🌍</p>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Where to next?</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Search above to add countries you dream of visiting. Mark them visited as you tick them off.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {want.length > 0 && (
            <Section title="Want to go">
              {want.map(item => (
                <WishCard key={item.id} item={item} onToggle={toggle} onRemove={remove} onSaveNote={saveNote} />
              ))}
            </Section>
          )}
          {visited.length > 0 && (
            <Section title="Visited">
              {visited.map(item => (
                <WishCard key={item.id} item={item} onToggle={toggle} onRemove={remove} onSaveNote={saveNote} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function WishCard({
  item, onToggle, onRemove, onSaveNote,
}: {
  item: WishItem
  onToggle: (id: string, v: boolean) => void
  onRemove: (id: string) => void
  onSaveNote: (id: string, note: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(item.note ?? '')

  return (
    <div className={`rounded-xl border p-3 flex gap-3 ${item.visited ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <span className="text-2xl leading-none flex-shrink-0 mt-0.5">{flagEmoji(item.code)}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-semibold leading-snug ${item.visited ? 'text-gray-500' : 'text-gray-900'}`}>{item.name}</p>
        {editing ? (
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={() => { setEditing(false); onSaveNote(item.id, note) }}
            autoFocus
            placeholder="What do you want to do there?"
            className="mt-1 w-full border border-gray-200 rounded-md px-2 py-1.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        ) : item.note ? (
          <p onClick={() => setEditing(true)} className="text-sm text-gray-500 mt-0.5 cursor-text break-words">{item.note}</p>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-blue-500 mt-0.5">+ Add note</button>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <button
          onClick={() => onToggle(item.id, !item.visited)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full transition ${
            item.visited ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {item.visited ? '✓ Visited' : 'Visited?'}
        </button>
        <button onClick={() => onRemove(item.id)} className="text-xs text-gray-300 hover:text-red-500 transition">Remove</button>
      </div>
    </div>
  )
}
