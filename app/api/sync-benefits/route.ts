import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export async function POST(request: NextRequest) {
  try {
    // Create Supabase service client (bypasses RLS for admin sync)
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

    // Read Excel file from public/data/benefits.xlsx
    const excelPath = path.join(process.cwd(), 'public', 'data', 'benefits.xlsx')

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ error: 'Benefits file not found' }, { status: 404 })
    }

    const fileBuffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const worksheet = workbook.Sheets['Benefits']
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][]

    if (data.length < 2) {
      return NextResponse.json({ error: 'Empty benefits file' }, { status: 400 })
    }

    const headers = data[0]
    const rows = data.slice(1)

    // Map column headers
    const getColumn = (colName: string) => headers.indexOf(colName)
    const colCard = getColumn('Card')
    const colBenefitName = getColumn('Benefit Name')
    const colCategory = getColumn('Category')
    const colAmount = getColumn('Amount')
    const colAmountUnit = getColumn('Amount Unit')
    const colPeriodType = getColumn('Period Type')
    const colPeriodFrequency = getColumn('Period Frequency')
    const colCoreAncillary = getColumn('Core/Ancillary')
    const colDescription = getColumn('Description')

    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // Step 1: Sync card templates
    const cardSet = new Set(rows.map((row) => row[colCard]).filter(Boolean))
    for (const cardName of cardSet) {
      const [issuer] = cardName.split(' - ')
      const { error } = await supabase
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
      if (error) {
        errors.push(`Failed to sync card ${cardName}: ${error.message}`)
        errorCount++
      }
    }

    // Step 2: Sync categories
    const categorySet = new Set(rows.map((row) => row[colCategory]).filter(Boolean))
    const categoryMap = new Map<string, string>()

    for (const categoryName of categorySet) {
      const { error } = await supabase
        .from('benefit_categories')
        .upsert(
          {
            name: categoryName,
            description: `${categoryName} benefits`
          },
          { onConflict: 'name' }
        )
      if (error) {
        errors.push(`Failed to sync category ${categoryName}: ${error.message}`)
        errorCount++
      }
    }

    // Load all categories at once
    const { data: allCategories } = await supabase.from('benefit_categories').select('id, name')
    if (allCategories) {
      allCategories.forEach((cat) => categoryMap.set(cat.name, cat.id))
    }

    // Load all cards at once
    const { data: allCards } = await supabase.from('card_templates').select('id, name')
    const cardMap = new Map<string, string>()
    if (allCards) {
      allCards.forEach((card) => cardMap.set(card.name, card.id))
    }

    // Step 3: Sync benefits and template links
    for (const row of rows) {
      const benefitName = row[colBenefitName]
      const categoryName = row[colCategory]
      const amount = row[colAmount] ? parseFloat(String(row[colAmount])) : null
      const amountUnit = row[colAmountUnit]
      const periodType = row[colPeriodType]
      const periodFrequency = row[colPeriodFrequency] ? parseInt(String(row[colPeriodFrequency])) : null
      const isCore = row[colCoreAncillary] === 'Core'
      const description = row[colDescription]

      if (!benefitName || !categoryName) continue

      const categoryId = categoryMap.get(categoryName)
      if (!categoryId) {
        errors.push(`Category not found: ${categoryName}`)
        errorCount++
        continue
      }

      // Upsert benefit
      const { data: benefitData, error: benefitError } = await supabase
        .from('benefits')
        .upsert(
          {
            name: benefitName,
            category_id: categoryId,
            amount: amount,
            amount_unit: amountUnit,
            period_type: periodType,
            period_frequency: periodFrequency,
            description: description
          },
          { onConflict: 'name' }
        )
        .select()
        .single()

      if (benefitError) {
        errors.push(`Failed to sync benefit ${benefitName}: ${benefitError.message}`)
        errorCount++
        continue
      }

      // Link to card template
      const cardName = row[colCard]
      const cardId = cardMap.get(cardName)

      if (!cardId) {
        errors.push(`Card template not found: ${cardName}`)
        errorCount++
        continue
      }

      const { error: linkError } = await supabase
        .from('template_benefits')
        .upsert(
          {
            card_template_id: cardId,
            benefit_id: benefitData.id,
            is_core_default: isCore
          },
          { onConflict: 'card_template_id,benefit_id' }
        )

      if (linkError) {
        errors.push(`Failed to link benefit ${benefitName} to ${cardName}: ${linkError.message}`)
        errorCount++
        continue
      }

      syncedCount++
    }

    return NextResponse.json(
      {
        message: 'Benefits synced successfully',
        synced: syncedCount,
        errors: errorCount,
        errorDetails: errors
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
