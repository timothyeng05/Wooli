import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const CSR_BENEFITS = [
  // Travel
  {
    name: 'Travel Credit',
    category: 'Travel',
    amount: 300,
    amountUnit: '$',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Automatically credits $300 annually toward any travel purchase: flights, hotels, Uber, parking, tolls',
    isCore: true
  },
  {
    name: 'Priority Pass Lounge Access',
    category: 'Travel',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Unlimited access to 1,400+ airport lounges worldwide for you and guests',
    isCore: true
  },
  {
    name: 'Global Entry / TSA PreCheck Credit',
    category: 'Travel',
    amount: 100,
    amountUnit: '$',
    periodType: 'ad hoc',
    periodFrequency: 1,
    description: 'Statement credit for Global Entry ($100) or TSA PreCheck ($85) application fee',
    isCore: true
  },
  {
    name: 'Trip Cancellation Insurance',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'ad hoc',
    periodFrequency: 1,
    description: 'Up to $10,000 per trip for non-refundable travel expenses if you need to cancel',
    isCore: false
  },
  {
    name: 'Trip Delay Reimbursement',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'ad hoc',
    periodFrequency: 1,
    description: 'Up to $500 for meals and lodging if your trip is delayed 6+ hours',
    isCore: false
  },
  {
    name: 'Lost Luggage Reimbursement',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Up to $2,500 for contents of lost or damaged checked/carry-on bags',
    isCore: false
  },
  {
    name: 'Rental Car Damage Insurance',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'ad hoc',
    periodFrequency: 1,
    description: 'Primary coverage for damage or theft on rental cars when you pay with the card',
    isCore: false
  },
  // Dining
  {
    name: 'Dining Credit – Exclusive Tables',
    category: 'Dining',
    amount: 300,
    amountUnit: '$',
    periodType: 'annual',
    periodFrequency: 1,
    description: '$300 annual credit for reservations through Chase Sapphire Exclusive Tables (The Infatuation partners)',
    isCore: true
  },
  // Lifestyle
  {
    name: 'StubHub Credit',
    category: 'Lifestyle',
    amount: 150,
    amountUnit: '$',
    periodType: 'biannual',
    periodFrequency: 2,
    description: '$150 credit per half-year (Jan–Jun and Jul–Dec) on StubHub and Viagogo. Requires activation.',
    isCore: true
  },
  {
    name: 'The Edit Hotel Credit',
    category: 'Travel',
    amount: 250,
    amountUnit: '$',
    periodType: 'biannual',
    periodFrequency: 2,
    description: '$250 credit per half-year for prepaid stays of 2+ nights through The Edit by Chase Travel.',
    isCore: true
  },
  {
    name: 'Apple Music & TV+ Credit',
    category: 'Lifestyle',
    amount: 120,
    amountUnit: '$',
    periodType: 'annual',
    periodFrequency: 1,
    description: '$120 annual credit ($10/month) toward Apple Music, Apple TV+, or Apple One',
    isCore: true
  },
  {
    name: 'DoorDash Dining Credit',
    category: 'Dining',
    amount: 5,
    amountUnit: '$',
    periodType: 'monthly',
    periodFrequency: 12,
    description: '$5/month off one restaurant order on DoorDash (requires DashPass activation)',
    isCore: true
  },
  {
    name: 'DoorDash Grocery & Retail Credit',
    category: 'Dining',
    amount: 20,
    amountUnit: '$',
    periodType: 'monthly',
    periodFrequency: 12,
    description: 'Two $10/month discounts on non-restaurant DoorDash orders (grocery, convenience, retail)',
    isCore: true
  },
  // Insurance
  {
    name: 'Purchase Protection',
    category: 'Insurance',
    amount: 10000,
    amountUnit: 'max coverage',
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Covers new purchases against damage or theft for 120 days, up to $10,000 per claim',
    isCore: false
  },
  {
    name: 'Extended Warranty',
    category: 'Insurance',
    amount: null,
    amountUnit: null,
    periodType: 'annual',
    periodFrequency: 1,
    description: 'Extends US manufacturer warranty by 1 additional year on eligible items',
    isCore: false
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

    // Delete old data
    await supabase.from('card_templates').delete().neq('name', '')

    // Create categories
    const categories = new Set(CSR_BENEFITS.map(b => b.category))
    const categoryMap = new Map<string, string>()

    for (const cat of categories) {
      const { data: catData } = await supabase
        .from('benefit_categories')
        .upsert({ name: cat, description: `${cat} benefits` }, { onConflict: 'name' })
        .select()
        .single()
      if (catData) categoryMap.set(cat, catData.id)
    }

    // Create card template
    const { data: cardData } = await supabase
      .from('card_templates')
      .insert({ name: 'Chase Sapphire Reserve', issuer: 'Chase', network: 'Visa', annual_fee: 550 })
      .select()
      .single()

    if (!cardData) throw new Error('Failed to create card template')

    // Create benefits and links
    let created = 0
    for (const benefit of CSR_BENEFITS) {
      const catId = categoryMap.get(benefit.category)
      if (!catId) continue

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

      await supabase.from('template_benefits').insert({
        card_template_id: cardData.id,
        benefit_id: benefitData.id,
        is_core_default: benefit.isCore
      })

      created++
    }

    return NextResponse.json({
      success: true,
      message: `Seeded Chase Sapphire Reserve with ${created} benefits`
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    )
  }
}
