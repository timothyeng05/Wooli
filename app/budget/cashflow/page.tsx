export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CashFlowClient from '@/app/components/budget/CashFlowClient'
import MonthNav from '@/app/components/budget/MonthNav'

export interface CashFlowTransaction {
  id: string
  amount: number
  merchant: string | null
  transacted_at: string
  is_transfer: boolean
  owner: string | null
  category: {
    id: string
    name: string
    color: string
    icon: string | null
    is_income: boolean
    is_transfer: boolean
    parent_id: string | null
  } | null
}

export interface CashFlowCategory {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  is_transfer: boolean
  parent_id: string | null
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()
  const month = parseInt(params.month ?? '')  // 0-indexed
  const resolvedMonth = isNaN(month) ? now.getMonth() : month

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Last 6 months ending at the selected month
  const start = new Date(year, resolvedMonth - 5, 1).toISOString()
  const end = new Date(year, resolvedMonth + 1, 0, 23, 59, 59).toISOString()

  // Supabase caps results at 1000 rows server-side; paginate to fetch all
  const PAGE = 1000
  let allTxns: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from('transactions')
      .select(`
        id, amount, merchant, transacted_at, is_transfer, is_pending, owner,
        categories ( id, name, color, icon, is_income, is_transfer, parent_id )
      `)
      .eq('user_id', user.id)
      .gte('transacted_at', start)
      .lte('transacted_at', end)
      .order('transacted_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1) as any
    if (!data || data.length === 0) break
    allTxns = allTxns.concat(data)
    if (data.length < PAGE) break
  }

  const [catResult] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color, icon, is_income, is_transfer, parent_id')
      .eq('user_id', user.id) as any,
  ])

  const transactions: CashFlowTransaction[] = allTxns.map((t: any) => ({
    id: t.id,
    amount: Number(t.amount),
    merchant: t.merchant ?? null,
    transacted_at: t.transacted_at,
    is_transfer: t.is_transfer ?? false,
    owner: t.owner ?? null,
    category: t.categories ?? null,
  }))

  const categories: CashFlowCategory[] = catResult.data ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Cash Flow</h1>
        <MonthNav year={year} month={resolvedMonth} />
      </div>
      <CashFlowClient
        transactions={transactions}
        categories={categories}
        currentYear={year}
        currentMonth={resolvedMonth}
      />
    </div>
  )
}
