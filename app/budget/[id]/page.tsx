import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TransactionDetail from '@/app/components/budget/TransactionDetail'

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [txnResult, catResult, acctResult, memberResult, plaidAcctResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, amount, description, merchant, category_id, account_id, account_name, plaid_account_id, transacted_at, is_transfer, is_reimbursement, is_pending, owner, notes')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('categories')
      .select('id, name, color, icon, is_income, parent_id, sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }) as any,
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name') as any,
    supabase
      .from('household_members')
      .select('id, full_name, display_name, color, sort_order, is_shared')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('plaid_accounts')
      .select('id, name, mask, official_name')
      .eq('user_id', user.id)
      .order('name') as any,
  ])

  if (!txnResult.data) notFound()

  return (
    <TransactionDetail
      transaction={txnResult.data as any}
      categories={catResult.data || []}
      accounts={acctResult.data || []}
      members={memberResult.data || []}
      plaidAccounts={plaidAcctResult.data || []}
    />
  )
}
