export type ActivityName = 'Exercised' | 'Read' | 'Good sleep' | 'Meditated'

export const ACTIVITIES: ActivityName[] = ['Exercised', 'Read', 'Good sleep', 'Meditated']

export const ACTIVITY_CONFIG: Record<ActivityName, { color: string; emoji: string }> = {
  Exercised:    { color: '#10b981', emoji: '🏃' },
  Read:         { color: '#8b5cf6', emoji: '📖' },
  'Good sleep': { color: '#3b82f6', emoji: '😴' },
  Meditated:    { color: '#f59e0b', emoji: '🧘' },
}
