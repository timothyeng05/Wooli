import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeCardStats } from '@/lib/card-utils'
import CardListView from '@/app/components/cards/CardListView'

export default async function CardsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawCards } = await supabase
    .from('cards')
    .select(`
      id, name, issuer, network, annual_fee, is_active,
      card_benefits (
        id,
        is_core,
        benefits (
          amount,
          amount_unit,
          period_type
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as any

  const cards = (rawCards || []).map((card: any) => ({
    ...card,
    ...computeCardStats(card.annual_fee, card.card_benefits || [])
  }))

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">My Cards</h1>
              <p className="text-gray-600">Track your credit card benefits and annual fee value</p>
            </div>
            <Link
              href="/cards/new"
              className="bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              + Add Card
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {cards.length > 0 ? (
          <CardListView cards={cards} />
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No cards yet</h2>
            <p className="text-gray-600 mb-6">Start tracking your benefits by adding your first card</p>
            <Link
              href="/cards/new"
              className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Add Your First Card
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
