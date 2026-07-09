export type Leg = { name: string; emoji: string; from: string; to: string }

// Hardcoded fallback for trips created before per-trip legs (migration 038 adds
// trips.legs jsonb). Until that column exists — or for trips that never saved
// legs — resolveLegs() falls back to this map, so the original trip keeps its
// grouping with zero behavior change.
export const TRIP_LEGS: Record<string, Leg[]> = {
  '0ae7f6e3-c901-4b25-97d5-0eb4ffb851c5': [
    { name: 'Tokyo',                  emoji: '🗼', from: '2026-05-30', to: '2026-06-01' },
    { name: 'Kyushu',                 emoji: '🌋', from: '2026-06-02', to: '2026-06-11' },
    { name: 'Seoul',                  emoji: '🇰🇷', from: '2026-06-12', to: '2026-06-16' },
    { name: 'Osaka · Kyoto · Hakone', emoji: '🏯', from: '2026-06-17', to: '2026-06-23' },
    { name: 'Hokkaido',               emoji: '❄️',  from: '2026-06-24', to: '2026-06-30' },
    { name: 'Tokyo',                  emoji: '🗼', from: '2026-07-01', to: '2026-07-03' },
  ],
}

export const LEG_COLORS = [
  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-600' },
  { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-800',   badge: 'bg-teal-600' },
  { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-800',   badge: 'bg-rose-600' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-800', badge: 'bg-violet-600' },
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', badge: 'bg-indigo-600' },
  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   badge: 'bg-blue-600' },
]

// Legs for a trip: the trip row's `legs` jsonb when present (fetch the trip with
// select('*') so this stays optional pre-migration), otherwise the hardcoded
// fallback. An explicit [] in the DB means "no legs" — the fallback only applies
// when the column is missing or null.
export function resolveLegs(tripId: string, tripRow: Record<string, unknown> | null | undefined): Leg[] {
  const raw = tripRow?.legs
  if (Array.isArray(raw)) {
    return raw.filter((l): l is Leg =>
      !!l && typeof l === 'object' &&
      typeof (l as Leg).name === 'string' && (l as Leg).name.trim() !== '' &&
      typeof (l as Leg).from === 'string' && (l as Leg).from !== '' &&
      typeof (l as Leg).to === 'string' && (l as Leg).to !== ''
    ).map(l => ({ name: l.name, emoji: typeof l.emoji === 'string' ? l.emoji : '', from: l.from, to: l.to }))
  }
  return TRIP_LEGS[tripId] ?? []
}
