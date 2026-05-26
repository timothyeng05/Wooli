import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { computeCardStats } from '@/lib/card-utils'
import CardDetailView from '@/app/components/cards/CardDetailView'
import CardBenefitsView from '@/app/components/cards/CardBenefitsView'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: card } = await supabase
    .from('cards')
    .select('id, name, issuer, network, annual_fee, is_active, opened_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!card) redirect('/cards')

  const { data: cardBenefits } = await supabase
    .from('card_benefits')
    .select(`
      id,
      benefit_id,
      is_core,
      usage_data,
      benefits (
        name,
        amount,
        amount_unit,
        period_type,
        period_frequency,
        description,
        benefit_categories (
          id,
          name
        )
      )
    `)
    .eq('card_id', id) as any

  const { coreValue, netValue } = computeCardStats(card.annual_fee, cardBenefits || [])

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Cards', href: '/cards' },
            { label: card.name },
          ]} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <CardDetailView
          card={card}
          coreValue={coreValue}
          netValue={netValue}
        />

        {cardBenefits && cardBenefits.length > 0 && (
          <div className="mt-8">
            <CardBenefitsView cardId={id} benefits={cardBenefits} annualFee={card.annual_fee} />
          </div>
        )}
      </div>
    </div>
  )
}
