'use client'

export default function RewardRatesTable({
  rewards
}: {
  rewards: Array<{ id: string; category: string; rate: number; notes: string | null }>
}) {
  const sorted = [...rewards].sort((a, b) => b.rate - a.rate)

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Category</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Rate</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((reward) => (
            <tr key={reward.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-gray-900 font-medium">{reward.category}</td>
              <td className="py-3 px-4">
                <span className="inline-block bg-primary-100 text-primary-700 px-3 py-1 rounded-full font-semibold text-sm">
                  {reward.rate.toFixed(1)}x
                </span>
              </td>
              <td className="py-3 px-4 text-gray-600 text-sm">{reward.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
