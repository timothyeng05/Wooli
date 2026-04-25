import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RedemptionFormClient from '@/app/components/cards/RedemptionFormClient'

export default async function RedeemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify card ownership
  const { data: card } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!card) redirect('/cards')

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-400 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary-600 mb-2">Log Redemption</h1>
            <p className="text-gray-600">Record points/miles you've redeemed from {card.name}</p>
          </div>

          <RedemptionFormClient cardId={id} userId={user.id} />
        </div>
      </div>
    </div>
  )
}
