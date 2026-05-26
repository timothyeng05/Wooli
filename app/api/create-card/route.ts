import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const userSupabase = await createServerSupabaseClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { templateId, coreBenefits, removedBenefits, periodOverrides, templateData, openedAt } = await request.json()

    // Use service role to bypass RLS for admin operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Create card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .insert({
        user_id: user.id,
        name: templateData.name,
        issuer: templateData.issuer || null,
        network: templateData.network || null,
        has_annual_fee: !!templateData.annual_fee,
        annual_fee: templateData.annual_fee || null,
        is_active: true,
        opened_at: openedAt || null
      })
      .select()
      .single()

    if (cardError) {
      console.error('Card insert error:', cardError)
      return NextResponse.json({ error: cardError.message || JSON.stringify(cardError) }, { status: 500 })
    }

    // Create card benefits
    const benefitsToInsert = templateData.template_benefits
      .filter((tb: any) => !removedBenefits.includes(tb.benefit_id))
      .map((tb: any) => ({
        user_id: user.id,
        card_id: card.id,
        benefit_id: tb.benefit_id,
        is_core: coreBenefits.includes(tb.benefit_id),
        usage_data: null
      }))

    const { error: benefitsError } = await supabase
      .from('card_benefits')
      .insert(benefitsToInsert)

    if (benefitsError) {
      console.error('Benefits insert error:', benefitsError)
      return NextResponse.json({ error: benefitsError.message || JSON.stringify(benefitsError) }, { status: 500 })
    }

    return NextResponse.json({ cardId: card.id })
  } catch (error: any) {
    console.error('Create card error:', error)
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 })
  }
}
