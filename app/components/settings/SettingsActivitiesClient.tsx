'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const DEFAULT_ACTIVITIES = ['Exercised', 'Read', 'Good sleep', 'Meditated']

interface Props {
  savedActivities: string[] | null
  userId: string
}

export default function SettingsActivitiesClient({ savedActivities, userId }: Props) {
  const [activities, setActivities] = useState<string[]>(
    savedActivities && savedActivities.length > 0 ? savedActivities : DEFAULT_ACTIVITIES
  )
  const [newActivity, setNewActivity] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const supabase = createClient()

  const persist = async (list: string[]) => {
    setSaving(true)
    await supabase.from('profiles').update({ custom_activities: list }).eq('id', userId)
    setSaving(false)
    setSaved(true)
  }

  const addActivity = () => {
    const trimmed = newActivity.trim()
    if (!trimmed || activities.includes(trimmed)) return
    const next = [...activities, trimmed]
    setActivities(next)
    setNewActivity('')
    persist(next)
  }

  const removeActivity = (name: string) => {
    const next = activities.filter(a => a !== name)
    setActivities(next)
    persist(next)
  }

  const save = async () => persist(activities)

  const reset = () => {
    setActivities(DEFAULT_ACTIVITIES)
    setSaved(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Mood activities</h2>
          <p className="text-sm text-gray-500 mt-0.5">These appear as quick-tap options when logging your mood.</p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Reset to defaults
        </button>
      </div>

      {/* Activity chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {activities.map(activity => (
          <span
            key={activity}
            className="flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-full"
          >
            {activity}
            <button
              onClick={() => removeActivity(activity)}
              className="text-gray-400 hover:text-gray-700 transition leading-none"
              aria-label={`Remove ${activity}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Add new */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newActivity}
          onChange={e => setNewActivity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addActivity()}
          placeholder="Add an activity..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addActivity}
          disabled={!newActivity.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
        >
          Add
        </button>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
      </button>
    </div>
  )
}
