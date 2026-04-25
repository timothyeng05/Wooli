import Link from 'next/link'

export default function MoodEntryCard({ entry }: {
  entry: { id: string; mood: number; note: string; logged_at: string }
}) {
  const moodEmojis = { 1: '😢', 2: '😕', 3: '😐', 4: '😊', 5: '😄' }
  const moodColors = {
    1: 'bg-red-100 text-red-800',
    2: 'bg-orange-100 text-orange-800',
    3: 'bg-yellow-100 text-yellow-800',
    4: 'bg-lime-100 text-lime-800',
    5: 'bg-green-100 text-green-800',
  }

  const date = new Date(entry.logged_at).toLocaleDateString()

  return (
    <Link href={`/mood/${entry.id}`}>
      <div className="p-4 border rounded-lg hover:shadow-lg transition cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <span className={`text-3xl ${moodColors[entry.mood as keyof typeof moodColors]}`}>
            {moodEmojis[entry.mood as keyof typeof moodEmojis]}
          </span>
          <span className="text-sm text-gray-500">{date}</span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">{entry.note || 'No notes'}</p>
      </div>
    </Link>
  )
}
