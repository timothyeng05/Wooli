'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'

const DEFAULT_ACTIVITIES = ['Exercised', 'Read', 'Good sleep', 'Meditated']

const PROMPT_CACHE_KEY = 'wooli_journal_prompts'

function getCachedPrompts(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PROMPT_CACHE_KEY)
    if (!raw) return null
    const { date, prompts } = JSON.parse(raw)
    if (date !== new Date().toISOString().split('T')[0]) return null
    return prompts
  } catch {
    return null
  }
}

function setCachedPrompts(prompts: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    PROMPT_CACHE_KEY,
    JSON.stringify({ date: new Date().toISOString().split('T')[0], prompts })
  )
}

export default function MoodFormClient({ userId, entry, initialDate, onDelete, customActivities }: {
  userId: string
  entry?: { id: string; mood: number; note: string; logged_at: string; grateful_for?: string | null; activities?: string[] | null } | null
  initialDate?: string
  onDelete?: () => void
  customActivities?: string[] | null
}) {
  const activities_list = customActivities && customActivities.length > 0
    ? customActivities
    : DEFAULT_ACTIVITIES
  const router = useRouter()
  const { toast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [mood, setMood] = useState(entry?.mood || 3)
  const [note, setNote] = useState(entry?.note || '')
  const [gratefulFor, setGratefulFor] = useState(entry?.grateful_for || '')
  const [activities, setActivities] = useState<string[]>(entry?.activities || [])
  const [loggedAt, setLoggedAt] = useState(
    entry?.logged_at?.split('T')[0] || initialDate || new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(false)
  const [prompts, setPrompts] = useState<string[]>([])
  const noteRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (entry) return
    const cached = getCachedPrompts()
    if (cached) {
      setPrompts(cached)
      return
    }
    fetch('/api/journal-prompts')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.prompts)) {
          setPrompts(d.prompts)
          setCachedPrompts(d.prompts)
        }
      })
      .catch(() => {})
  }, [entry])

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = 'auto'
      noteRef.current.style.height = noteRef.current.scrollHeight + 'px'
    }
  }, [note])

  const insertPrompt = (p: string) => {
    setNote(prev => (prev ? `${prev}\n\n${p} ` : `${p} `))
    setTimeout(() => {
      noteRef.current?.focus()
      const len = noteRef.current?.value.length || 0
      noteRef.current?.setSelectionRange(len, len)
    }, 0)
  }

  const toggleActivity = (activity: string) => {
    setActivities(prev =>
      prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      const supabase = createClient()
      const loggedAtIso = new Date(loggedAt + 'T12:00:00').toISOString()
      const payload = { mood, note, logged_at: loggedAtIso, grateful_for: gratefulFor, activities }

      if (entry) {
        const { error } = await supabase.from('mood_entries').update(payload).eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('mood_entries').insert([{ user_id: userId, ...payload }])
        if (error) throw error
      }

      router.push('/mood')
    } catch (error) {
      toast.error('Error saving entry')
      console.error(error)
      setLoading(false)
    }
  }

  const moodLabels: Record<number, string> = {
    1: 'Bad 😢',
    2: 'Stressed 😰',
    3: 'Okay 😐',
    4: 'Good 😊',
    5: 'Great 😄',
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-md bg-white p-6 rounded-lg">
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Date</label>
        <input
          type="date"
          value={loggedAt}
          onChange={(e) => setLoggedAt(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-4">How are you feeling?</label>
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              type="button"
              onClick={() => setMood(score)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                mood === score
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">{moodLabels[mood]}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">One thing you're grateful for</label>
        <textarea
          value={gratefulFor}
          onChange={(e) => setGratefulFor(e.target.value)}
          placeholder="What are you grateful for today?"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">Notable events</label>
        {prompts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {prompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => insertPrompt(p)}
                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-100"
              >
                ✨ {p}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened today?"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 overflow-hidden resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-3">Activities</label>
        <div className="flex flex-wrap gap-2">
          {activities_list.map(activity => (
            <button
              key={activity}
              type="button"
              onClick={() => toggleActivity(activity)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                activities.includes(activity)
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {activity}
            </button>
          ))}
        </div>
        <a href="/settings" className="text-xs text-gray-400 hover:text-gray-600 transition mt-2 inline-block">
          Customize activities →
        </a>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-500 text-white py-2 rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : entry ? 'Update' : 'Save'}
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full py-2 text-red-500 hover:text-red-600 text-sm font-medium transition"
        >
          Delete Entry
        </button>
      )}
    </form>
  )
}
