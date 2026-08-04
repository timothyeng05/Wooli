'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-client'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import { useToast, useConfirm } from '@/app/components/ui/ToastProvider'

interface Category {
  id: string
  name: string
  color: string
  icon: string | null
  is_income: boolean
  parent_id: string | null
}

interface Account {
  id: string
  name: string
  type: string
}

interface PlaidAccount {
  id: string
  name: string
  mask: string | null
  official_name: string | null
}

interface Transaction {
  id: string
  amount: number
  description: string | null
  merchant: string | null
  category_id: string | null
  account_id: string | null
  account_name: string | null
  plaid_account_id: string | null
  transacted_at: string
  is_transfer: boolean | null
  is_reimbursement: boolean | null
  is_pending: boolean | null
  owner: string | null
  notes: string | null
}

interface HouseholdMember { id: string; full_name: string; display_name: string; color: string; sort_order: number; is_shared: boolean }

// ── Field row ──────────────────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 min-h-[56px]">
      <span className="text-sm text-gray-500 flex-shrink-0 w-36">{label}</span>
      <div className="flex-1 flex justify-end">{children}</div>
    </div>
  )
}

export default function TransactionDetail({
  transaction,
  categories,
  accounts,
  members = [],
  plaidAccounts = [],
}: {
  transaction: Transaction
  categories: Category[]
  accounts: Account[]
  members?: HouseholdMember[]
  plaidAccounts?: PlaidAccount[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()

  const initMode = (): 'expense' | 'income' | 'transfer' => {
    if (transaction.is_transfer) return 'transfer'
    return transaction.amount > 0 ? 'income' : 'expense'
  }

  const [mode, setMode]           = useState<'expense' | 'income' | 'transfer'>(initMode)
  const [amount, setAmount]       = useState(Math.abs(transaction.amount).toFixed(2))
  const [merchant, setMerchant]   = useState(transaction.merchant ?? '')
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [isReimbursement, setIsReimbursement] = useState(!!transaction.is_reimbursement)
  const [accountId, setAccountId] = useState(transaction.account_id ?? '')
  const [date, setDate]           = useState(transaction.transacted_at.split('T')[0])
  const [owner, setOwner]         = useState(transaction.owner ?? '')
  const [notes, setNotes]         = useState(transaction.notes ?? '')
  const [saving, setSaving]       = useState(false)

  const parents  = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => !!c.parent_id)

  const selectedCat = categories.find(c => c.id === categoryId)

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    try {
      const supabase = createClient()
      const signed = mode === 'income' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount))
      const { error } = await supabase.from('transactions').update({
        amount: signed,
        merchant: merchant.trim() || null,
        description: transaction.description,
        category_id: mode === 'transfer' ? null : (categoryId || null),
        account_id: accountId || null,
        transacted_at: new Date(date + 'T12:00:00').toISOString(),
        is_transfer: mode === 'transfer',
        is_reimbursement: mode === 'expense' ? isReimbursement : false,
        owner: owner || null,
        notes: notes.trim() || null,
      }).eq('id', transaction.id)
      if (error) throw error
      toast.success('Saved')
      router.push('/budget/transactions')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!await confirm('Delete this transaction?')) return
    const supabase = createClient()
    await supabase.from('transactions').delete().eq('id', transaction.id)
    router.push('/budget/transactions')
    router.refresh()
  }

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const amountColor = mode === 'income' ? 'text-green-600' : mode === 'transfer' ? 'text-gray-500' : 'text-gray-900'

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-[53px] z-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14">
        <Link
          href="/budget/transactions"
          className="flex items-center gap-1 text-blue-600 text-sm font-medium"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Transactions
        </Link>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
          {transaction.merchant || transaction.description || 'Transaction'}
        </span>
        <button
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-500 transition p-1"
          title="Delete transaction"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      <div className="max-w-lg mx-auto">
        {/* ── Amount hero ─────────────────────────────────────────────────── */}
        <div className="px-6 pt-10 pb-8 text-center">
          {transaction.is_pending && (
            <span className="inline-block mb-3 text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full">
              Pending
            </span>
          )}
          <div className="flex items-start justify-center gap-1">
            <span className="text-2xl font-semibold text-gray-400 mt-2">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={`text-5xl font-bold bg-transparent border-none outline-none text-center w-48 ${amountColor}`}
            />
          </div>
        </div>

        {/* ── Field rows ──────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100">

          {/* Type toggle */}
          <Row label="Type">
            <div className="flex gap-1.5">
              {(['expense', 'income', 'transfer'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setMode(t); if (t !== 'expense') setIsReimbursement(false) }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                    mode === t
                      ? t === 'income' ? 'bg-green-600 text-white'
                        : t === 'transfer' ? 'bg-gray-600 text-white'
                        : 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>

          {/* Merchant */}
          <Row label="Merchant">
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              placeholder="—"
              className="text-sm text-gray-900 text-right bg-transparent border-none outline-none w-full max-w-[200px] placeholder:text-gray-300"
            />
          </Row>

          {/* Original statement (read-only) */}
          {transaction.description && transaction.description !== transaction.merchant && (
            <Row label="Original Statement">
              <span className="text-sm text-gray-400 text-right truncate max-w-[200px]">
                {transaction.description}
              </span>
            </Row>
          )}

          {/* Account */}
          <Row label="Account">
            {transaction.plaid_account_id ? (
              /* Plaid account — resolve name from plaidAccounts list, fall back to account_name */
              <span className="text-sm text-gray-900">
                {plaidAccounts.find(a => a.id === transaction.plaid_account_id)?.name ?? transaction.account_name ?? 'Unknown account'}
              </span>
            ) : (
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="text-sm text-gray-900 text-right bg-transparent border-none outline-none cursor-pointer appearance-none"
              >
                <option value="">No account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
          </Row>

          {/* Owner */}
          <Row label="Owner">
            <select
              value={owner}
              onChange={e => setOwner(e.target.value)}
              className="text-sm text-gray-900 text-right bg-transparent border-none outline-none cursor-pointer appearance-none"
            >
              <option value="">No owner</option>
              {members.map(m => (
                <option key={m.id} value={m.full_name}>{m.display_name}</option>
              ))}
            </select>
          </Row>

          {/* Category */}
          {mode !== 'transfer' && (
            <Row label="Category">
              <div className="flex items-center gap-1.5 justify-end">
                {selectedCat && (
                  <span className="text-base">{getCatEmoji(selectedCat.name, selectedCat.icon)}</span>
                )}
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="text-sm text-gray-900 text-right bg-transparent border-none outline-none cursor-pointer appearance-none max-w-[160px]"
                >
                  <option value="">Uncategorized</option>
                  {parents.map(parent => {
                    const subs = children.filter(c => c.parent_id === parent.id)
                    const pEmoji = getCatEmoji(parent.name, parent.icon)
                    if (subs.length === 0) return (
                      <option key={parent.id} value={parent.id}>{pEmoji} {parent.name}</option>
                    )
                    return (
                      <optgroup key={parent.id} label={`${pEmoji} ${parent.name}`}>
                        {subs.map(child => (
                          <option key={child.id} value={child.id}>
                            {getCatEmoji(child.name, child.icon)} {child.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            </Row>
          )}

          {/* Reimbursement — expense-only; keeps the category but nets against its spend */}
          {mode === 'expense' && (
            <Row label="Reimbursement">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-900">Reimbursed to me</span>
                <input
                  type="checkbox"
                  checked={isReimbursement}
                  onChange={e => setIsReimbursement(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </Row>
          )}

          {/* Date */}
          <Row label="Date">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-900">{formattedDate}</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="sr-only"
              />
            </label>
          </Row>

          {/* Notes */}
          <Row label="Notes">
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes…"
              className="text-sm text-gray-900 text-right bg-transparent border-none outline-none w-full max-w-[220px] placeholder:text-gray-300"
            />
          </Row>

        </div>

        {/* ── Save button ─────────────────────────────────────────────────── */}
        <div className="px-5 py-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
