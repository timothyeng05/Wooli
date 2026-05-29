'use client'

import { useState, useRef } from 'react'

type Store = { id: string; name: string }

export default function ShoppingStoreList({ initialStores }: { initialStores: Store[] }) {
  const [stores, setStores] = useState<Store[]>(initialStores)
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addStore = async () => {
    const name = input.trim()
    if (!name) return
    setInput('')
    const res = await fetch('/api/trips/shopping-stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      const store = await res.json()
      setStores(prev => [...prev, store])
    }
  }

  const deleteStore = async (id: string) => {
    setStores(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/trips/shopping-stores/${id}`, { method: 'DELETE' })
  }

  const startEdit = (store: Store) => {
    setEditingId(store.id)
    setEditValue(store.name)
  }

  const commitEdit = async (id: string) => {
    const name = editValue.trim()
    setEditingId(null)
    if (!name) return
    setStores(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    await fetch(`/api/trips/shopping-stores/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
        Shopping
      </h2>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {stores.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No stores added yet</p>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {stores.map(store => (
            <div key={store.id} className="group flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              {editingId === store.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(store.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit(store.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="text-sm text-gray-800 bg-transparent outline-none w-24 min-w-0"
                />
              ) : (
                <button
                  onClick={() => startEdit(store)}
                  className="text-sm text-gray-800 hover:text-gray-600"
                >
                  {store.name}
                </button>
              )}
              <button
                onClick={() => deleteStore(store.id)}
                className="text-gray-300 hover:text-red-400 transition ml-1 text-xs leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStore()}
            placeholder="Add a store or brand..."
            className="flex-1 text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            onClick={addStore}
            disabled={!input.trim()}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Add
          </button>
        </div>
      </div>
    </section>
  )
}
