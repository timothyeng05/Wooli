import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RewardRatesFormClient from '@/app/components/cards/RewardRatesFormClient'

export default async function EditRatesPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch existing reward rates
  const { data: rewards } = await supabase
    .from('card_rewards')
    .select('*')
    .eq('card_id', id)
    .order('created_at', { ascending: true })

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-400 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary-600 mb-2">Reward Rates for {card.name}</h1>
            <p className="text-gray-600">Set up earning rates for different spending categories</p>
          </div>

          <RewardRatesFormClient cardId={id} userId={user.id} initialRates={rewards || []} />
        </div>
      </div>
    </div>
  )
}
