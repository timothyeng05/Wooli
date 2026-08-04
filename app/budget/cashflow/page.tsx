import { redirect } from 'next/navigation'

export interface CashFlowTransaction {
  id: string
  amount: number
  merchant: string | null
  transacted_at: string
  is_transfer: boolean
  is_reimbursement: boolean
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

export default async function CashFlowPage() {
  redirect('/budget')
}
