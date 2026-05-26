import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import WhichCardClient from '@/app/components/cards/WhichCardClient'

export default async function WhichCardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: cards } = await supabase
    .from('cards')
    .select('id, name, issuer, network, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const { data: rewards } = await supabase
    .from('card_rewards')
    .select('card_id, category, rate, notes')
    .in('card_id', (cards ?? []).map((c: any) => c.id))

  const cardsWithRates = (cards ?? []).map((card: any) => ({
    ...card,
    rewards: (rewards ?? []).filter((r: any) => r.card_id === card.id),
  }))

  const allCategories = Array.from(
    new Set((rewards ?? []).map((r: any) => r.category as string))
  ).sort()

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Cards', href: '/cards' }, { label: 'Which card?' }]} />
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">Which card?</h1>
            <p className="text-gray-500 mt-1">Pick a category to see your best earners.</p>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-10">
        <WhichCardClient cards={cardsWithRates} allCategories={allCategories} />
      </div>
    </div>
  )
}
