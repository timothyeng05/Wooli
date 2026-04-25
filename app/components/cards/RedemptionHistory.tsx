'use client'

export default function RedemptionHistory({
  redemptions
}: {
  redemptions: Array<{
    id: string
    amount: number
    value: number | null
    description: string | null
    redeemed_at: string
  }>
}) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Amount</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Value</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Description</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((redemption) => (
            <tr key={redemption.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-4 text-gray-900 font-medium">{formatDate(redemption.redeemed_at)}</td>
              <td className="py-3 px-4 text-gray-900 font-semibold">{redemption.amount.toLocaleString()}</td>
              <td className="py-3 px-4">
                {redemption.value !== null ? (
                  <span className="text-green-700 font-semibold">${redemption.value.toFixed(2)}</span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-gray-600 text-sm">{redemption.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
