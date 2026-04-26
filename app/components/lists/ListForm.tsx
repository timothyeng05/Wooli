'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function ListForm({
  userId,
  list,
}: {
  userId: string
  list?: { id: string; name: string; description: string | null }
}) {
  const router = useRouter()
  const [name, setName] = useState(list?.name || '')
  const [description, setDescription] = useState(list?.description || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || loading) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      if (list) {
        const { error } = await supabase
          .from('lists')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', list.id)
        if (error) throw error
        router.push(`/lists/${list.id}`)
      } else {
        const { data, error } = await supabase
          .from('lists')
          .insert({ user_id: userId, name: name.trim(), description: description.trim() || null })
          .select('id')
          .single()
        if (error) throw error
        router.push(`/lists/${data.id}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Wish list, Costco run, Books to read"
          required
          autoFocus
          maxLength={120}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1.5">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What's this list for?"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {loading ? 'Saving...' : list ? 'Save' : 'Create List'}
      </button>
    </form>
  )
}
