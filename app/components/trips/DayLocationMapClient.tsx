import dynamic from 'next/dynamic'
export type { LocationPoint } from './DayLocationMap'

const DayLocationMap = dynamic(() => import('./DayLocationMap'), { ssr: false, loading: () => (
  <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">Loading map…</div>
)})

export default DayLocationMap
