import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ComparisonView from '@/app/components/cards/ComparisonView'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

async function syncBenefitsIfNeeded(supabase: any) {
  // Check if templates exist
  const { count } = await supabase
    .from('card_templates')
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) > 0) return // Already synced

  // Create service client for syncing
  const serviceClient = supabase

  try {
    const excelPath = path.join(process.cwd(), 'public', 'data', 'benefits.xlsx')
    if (!fs.existsSync(excelPath)) return

    const fileBuffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const worksheet = workbook.Sheets['Benefits']
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

    if (data.length < 2) return

    const headers = data[0]
    const rows = data.slice(1)

    const getColumn = (colName: string) => headers.indexOf(colName)
    const colCard = getColumn('Card')
    const colBenefitName = getColumn('Benefit Name')
    const colCategory = getColumn('Category')
    const colAmount = getColumn('Amount')
    const colAmountUnit = getColumn('Amount Unit')
    const colCoreAncillary = getColumn('Core/Ancillary')
    const colDescription = getColumn('Description')

    // Sync card templates
    const cardSet = new Set(rows.map((row) => row[colCard]).filter(Boolean))
    for (const cardName of cardSet) {
      const [issuer] = cardName.split(' - ')
      await serviceClient
        .from('card_templates')
        .upsert(
          {
            name: cardName,
            issuer: issuer.trim(),
            network: cardName.includes('Amex') ? 'Amex' : 'Visa',
            annual_fee: 0
          },
          { onConflict: 'name' }
        )
    }

    // Sync categories
    const categorySet = new Set(rows.map((row) => row[colCategory]).filter(Boolean))
    for (const categoryName of categorySet) {
      await serviceClient
        .from('benefit_categories')
        .upsert(
          {
            name: categoryName,
            description: `${categoryName} benefits`
          },
          { onConflict: 'name' }
        )
    }

    // Sync benefits
    for (const row of rows) {
      const benefitName = row[colBenefitName]
      const categoryName = row[colCategory]
      const amount = row[colAmount] ? parseFloat(String(row[colAmount])) : null
      const amountUnit = row[colAmountUnit]
      const isCore = row[colCoreAncillary] === 'Core'
      const description = row[colDescription]

      if (!benefitName || !categoryName) continue

      const { data: categoryData } = await serviceClient
        .from('benefit_categories')
        .select('id')
        .eq('name', categoryName)
        .single()

      if (!categoryData) continue

      const { data: benefitData } = await serviceClient
        .from('benefits')
        .upsert(
          {
            name: benefitName,
            category_id: categoryData.id,
            amount: amount,
            amount_unit: amountUnit,
            description: description
          },
          { onConflict: 'name' }
        )
        .select()
        .single()

      if (!benefitData) continue

      const cardName = row[colCard]
      const { data: cardData } = await serviceClient
        .from('card_templates')
        .select('id')
        .eq('name', cardName)
        .single()

      if (!cardData) continue

      await serviceClient
        .from('template_benefits')
        .upsert(
          {
            card_template_id: cardData.id,
            benefit_id: benefitData.id,
            is_core_default: isCore
          },
          { onConflict: 'card_template_id,benefit_id' }
        )
    }
  } catch (err) {
    console.error('Auto-sync error:', err)
  }
}

export default async function ComparePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Auto-sync benefits if needed
  await syncBenefitsIfNeeded(supabase)

  // Fetch all card templates and their benefits
  const { data: templates } = await supabase
    .from('card_templates')
    .select(`
      id,
      name,
      issuer,
      network,
      annual_fee,
      template_benefits (
        benefit_id,
        is_core_default,
        benefits!inner (
          id,
          name,
          category_id,
          amount,
          amount_unit,
          description,
          benefit_notes,
          benefit_categories!inner (
            id,
            name
          )
        )
      )
    `)
    .order('name') as any

  // Fetch user's cards
  const { data: userCards } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Compare Cards</h1>
          <p className="text-gray-600">Browse benefits across premium card templates</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <ComparisonView templates={templates || []} userCards={userCards || []} />
      </div>
    </div>
  )
}
