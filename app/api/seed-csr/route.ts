import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const CSR_BENEFITS = [
  {
    name: 'Travel Credit',
    category: 'Credits',
    amount: 300,
    amountUnit: '$',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Automatically credits $300 annually toward any travel purchase',
    isCore: true
  },
  {
    name: 'Dining Credit',
    category: 'Credits',
    amount: 300,
    amountUnit: '$',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Exclusive access to dining experiences and restaurants',
    isCore: true
  },
  {
    name: 'Trip Cancellation Insurance',
    category: 'Insurance',
    amount: 10000,
    amountUnit: 'max coverage',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Covers non-refundable prepaid trip costs if you need to cancel',
    isCore: false
  },
  {
    name: 'Trip Delay Reimbursement',
    category: 'Insurance',
    amount: 500,
    amountUnit: 'max coverage',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Reimburses meals and lodging if travel is delayed 12+ hours',
    isCore: false
  },
  {
    name: 'Lost Luggage Reimbursement',
    category: 'Insurance',
    amount: 2500,
    amountUnit: 'max coverage',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Covers contents of lost or delayed baggage',
    isCore: false
  },
  {
    name: 'Priority Pass',
    category: 'Travel Benefits',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Access to 1,400+ airport lounges worldwide',
    isCore: true
  },
  {
    name: 'Global Entry Credit',
    category: 'Travel Benefits',
    amount: 100,
    amountUnit: '$',
    periodType: 'every 4 years',
    periodFrequency: 1,
    description: 'Covers Global Entry, TSA PreCheck, or similar trusted traveler program',
    isCore: true
  },
  {
    name: 'Rental Car Damage Insurance',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Primary coverage for rental car damage when paying with the card',
    isCore: false
  },
  {
    name: 'Purchase Protection',
    category: 'Purchase Protection',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Extends manufacturer warranty and protects against accidental damage',
    isCore: false
  },
  {
    name: '5x Points on Travel',
    category: 'Rewards',
    amount: null,
    amountUnit: 'points per $1',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Earn 5x points on flights, hotels, rental cars, and more',
    isCore: true
  }
]

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {}
        }
      }
    )

    // Create category if needed
    const { data: categoryData } = await supabase
      .from('benefit_categories')
      .upsert(
        {
          name: 'Credits',
          description: 'Direct statement credits'
        },
        { onConflict: 'name' }
      )
      .select()
      .single()

    if (!categoryData) throw new Error('Failed to create category')

    // Create card template
    const { data: cardData } = await supabase
      .from('card_templates')
      .upsert(
        {
          name: 'Chase Sapphire Reserve',
          issuer: 'Chase',
          network: 'Visa',
          annual_fee: 550
        },
        { onConflict: 'name' }
      )
      .select()
      .single()

    if (!cardData) throw new Error('Failed to create card template')

    // Create all categories
    const categories = new Set(CSR_BENEFITS.map(b => b.category))
    const categoryMap = new Map<string, string>()

    for (const cat of categories) {
      const { data: catData } = await supabase
        .from('benefit_categories')
        .upsert(
          {
            name: cat,
            description: `${cat} benefits`
          },
          { onConflict: 'name' }
        )
        .select()
        .single()
      if (catData) categoryMap.set(cat, catData.id)
    }

    // Create benefits and links
    let created = 0
    for (const benefit of CSR_BENEFITS) {
      const catId = categoryMap.get(benefit.category)
      if (!catId) continue

      // Create benefit
      const { data: benefitData } = await supabase
        .from('benefits')
        .upsert(
          {
            name: benefit.name,
            category_id: catId,
            amount: benefit.amount,
            amount_unit: benefit.amountUnit,
            period_type: benefit.periodType,
            period_frequency: benefit.periodFrequency,
            description: benefit.description
          },
          { onConflict: 'name' }
        )
        .select()
        .single()

      if (!benefitData) continue

      // Link to card template
      await supabase.from('template_benefits').upsert(
        {
          card_template_id: cardData.id,
          benefit_id: benefitData.id,
          is_core_default: benefit.isCore
        },
        { onConflict: 'card_template_id,benefit_id' }
      )

      created++
    }

    return NextResponse.json({
      success: true,
      message: `Seeded Chase Sapphire Reserve with ${created} benefits`,
      card: cardData,
      benefitsCreated: created
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    )
  }
}
