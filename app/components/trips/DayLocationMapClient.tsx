import dynamic from 'next/dynamic'

const DayLocationMap = dynamic(() => import('./DayLocationMap'), { ssr: false, loading: () => (
  <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">Loading map…</div>
)})

export default DayLocationMap
