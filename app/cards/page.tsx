import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeCardStats } from '@/lib/card-utils'
import CardListView from '@/app/components/cards/CardListView'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default async function CardsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawCards } = await supabase
    .from('cards')
    .select(`
      id, name, issuer, network, annual_fee, is_active, opened_at,
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

  const today = new Date()
  const renewingSoon = (cards ?? []).filter((card: any) => {
    if (!card.opened_at || !card.annual_fee) return false
    const opened = new Date(card.opened_at)
    const renewal = new Date(today.getFullYear(), opened.getMonth(), opened.getDate())
    if (renewal < today) renewal.setFullYear(today.getFullYear() + 1)
    const daysUntil = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 60
  })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: 'Cards' }]} />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">My Cards</h1>
              <p className="text-gray-600">Track your credit card benefits and annual fee value</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/cards/which"
                className="border border-blue-600 text-blue-600 font-medium px-5 py-2.5 rounded-lg hover:bg-blue-50 transition"
              >
                Which card?
              </Link>
              <Link
                href="/cards/new"
                className="bg-blue-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-blue-700 transition"
              >
                + Add Card
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {renewingSoon.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Annual fee{renewingSoon.length > 1 ? 's' : ''} coming up</p>
              <div className="mt-1 space-y-0.5">
                {renewingSoon.map((card: any) => {
                  const opened = new Date(card.opened_at)
                  const renewal = new Date(today.getFullYear(), opened.getMonth(), opened.getDate())
                  if (renewal < today) renewal.setFullYear(today.getFullYear() + 1)
                  const daysUntil = Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <p key={card.id} className="text-sm text-amber-700">
                      {card.name} · ${card.annual_fee}/yr · due {renewal.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ({daysUntil}d)
                    </p>
                  )
                })}
              </div>
            </div>
          </div>
        )}
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
