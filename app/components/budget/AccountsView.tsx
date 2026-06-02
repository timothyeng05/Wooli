'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { ACCOUNT_TYPES, TYPE_LABEL, isAssetType, netWorth, type Account, type AccountType } from '@/lib/budget/account-utils'
import { useToast } from '@/app/components/ui/ToastProvider'

interface HouseholdMember { id: string; full_name: string; display_name: string; color: string; sort_order: number; is_shared: boolean }

const TYPE_BADGE_COLOR: Record<AccountType, string> = {
  checking:   'bg-blue-50 text-blue-700',
  savings:    'bg-green-50 text-green-700',
  credit:     'bg-purple-50 text-purple-700',
  investment: 'bg-amber-50 text-amber-700',
  cash:       'bg-gray-100 text-gray-700',
  loan:       'bg-red-50 text-red-700',
  other:      'bg-gray-100 text-gray-700',
}

function formatMoney(n: number, isLiability = false): string {
  const v = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${isLiability ? '-' : ''}$${v}`
}

export default function AccountsView({
  userId,
  initialAccounts,
  members = [],
}: {
  userId: string
  initialAccounts: Account[]
  members?: HouseholdMember[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [adding, setAdding] = useState(false)

  const active = accounts.filter(a => a.is_active)
  const archived = accounts.filter(a => !a.is_active)
  const totals = netWorth(active)

  const addAccount = async (payload: Partial<Account> & { name: string; type: AccountType }) => {
    const isAsset = isAssetType(payload.type)
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: payload.name,
        type: payload.type,
        institution: payload.institution || null,
        current_balance: payload.current_balance ?? 0,
        is_asset: isAsset,
        notes: payload.notes || null,
        owner: payload.owner || null,
      })
      .select('id, name, type, institution, current_balance, is_active, is_asset, notes, sort_order, owner')
      .single()
    if (error || !data) {
      toast.error(error?.message || 'Failed to add account')
      return
    }
    setAccounts(prev => [...prev, data as Account])
    setAdding(false)
    router.refresh()
  }

  const updateAccount = async (id: string, patch: Partial<Account>) => {
    const prev = accounts
    setAccounts(accounts.map(a => (a.id === id ? { ...a, ...patch } : a)))
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) {
      setAccounts(prev)
      toast.error('Failed to update')
    } else {
      router.refresh()
    }
  }

  const archiveAccount = async (id: string, archive: boolean) => {
    await updateAccount(id, { is_active: !archive })
  }

  return (
    <div className="space-y-8">
      {/* Net worth summary */}
      {active.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Assets</p>
            <p className="text-2xl font-bold text-green-600">{formatMoney(totals.assets)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Liabilities</p>
            <p className="text-2xl font-bold text-red-600">{formatMoney(totals.liabilities, true)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500 mb-1">Net worth</p>
            <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
              {formatMoney(totals.net, totals.net < 0)}
            </p>
          </div>
        </div>
      )}

      {/* Add account form */}
      {adding ? (
        <AddAccountForm onSubmit={addAccount} onCancel={() => setAdding(false)} members={members} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition font-medium"
        >
          + Add account
        </button>
      )}

      {/* Active accounts */}
      <div className="space-y-2">
        {active.map(a => (
          <AccountRow key={a.id} account={a} onUpdate={updateAccount} onArchive={() => archiveAccount(a.id, true)} members={members} />
        ))}
        {active.length === 0 && !adding && (
          <p className="text-center text-gray-500 py-8">No accounts yet</p>
        )}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Archived</h2>
          <div className="space-y-2">
            {archived.map(a => (
              <AccountRow key={a.id} account={a} onUpdate={updateAccount} onArchive={() => archiveAccount(a.id, false)} members={members} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AccountRow({
  account,
  onUpdate,
  onArchive,
  members = [],
}: {
  account: Account
  onUpdate: (id: string, patch: Partial<Account>) => void
  onArchive: () => void
  members?: HouseholdMember[]
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [institution, setInstitution] = useState(account.institution || '')
  const [balance, setBalance] = useState(String(account.current_balance))
  const [type, setType] = useState<AccountType>(account.type)
  const [owner, setOwner] = useState<string>(account.owner || '')

  const save = () => {
    const next: Partial<Account> = {
      name: name.trim(),
      institution: institution.trim() || null,
      current_balance: parseFloat(balance) || 0,
      type,
      is_asset: isAssetType(type),
      owner: owner || null,
    }
    onUpdate(account.id, next)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Institution</label>
            <input
              type="text"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              placeholder="Chase, Apple, etc."
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as AccountType)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Current balance</label>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Owner</label>
            <select
              value={owner}
              onChange={e => setOwner(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
            >
              <option value="">No owner</option>
              {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-600 rounded text-sm font-medium hover:bg-gray-100">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex items-center gap-4 p-4 rounded-lg border transition ${account.is_active ? 'border-gray-200 bg-white hover:border-blue-300' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className={`font-semibold truncate ${account.is_active ? 'text-gray-900' : 'text-gray-500'}`}>{account.name}</p>
          <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${TYPE_BADGE_COLOR[account.type]}`}>
            {TYPE_LABEL[account.type]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {account.institution && <p className="text-xs text-gray-500">{account.institution}</p>}
          {account.owner && (() => {
            const m = members.find(x => x.full_name === account.owner)
            return (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: m ? `${m.color}22` : '#f3f4f6', color: m?.color ?? '#6b7280' }}>
                {m?.display_name ?? account.owner}
              </span>
            )
          })()}
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold ${account.is_asset ? 'text-gray-900' : 'text-red-600'}`}>
          {formatMoney(account.current_balance, !account.is_asset)}
        </p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-gray-900 px-1.5">Edit</button>
        <button onClick={onArchive} className="text-xs text-gray-500 hover:text-gray-900 px-1.5">
          {account.is_active ? 'Archive' : 'Restore'}
        </button>
      </div>
    </div>
  )
}

function AddAccountForm({
  onSubmit,
  onCancel,
  members = [],
}: {
  onSubmit: (payload: { name: string; type: AccountType; institution: string; current_balance: number; owner: string }) => void
  onCancel: () => void
  members?: HouseholdMember[]
}) {
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [balance, setBalance] = useState('0')
  const [owner, setOwner] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      type,
      institution: institution.trim(),
      current_balance: parseFloat(balance) || 0,
      owner,
    })
  }

  return (
    <form onSubmit={submit} className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">New account</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Chase Checking"
            required
            autoFocus
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Institution</label>
          <input
            type="text"
            value={institution}
            onChange={e => setInstitution(e.target.value)}
            placeholder="Chase, Apple, etc."
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value as AccountType)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          >
            {ACCOUNT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Current balance</label>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={e => setBalance(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Owner</label>
        <select
          value={owner}
          onChange={e => setOwner(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
        >
          <option value="">No owner</option>
          {members.map(m => <option key={m.id} value={m.full_name}>{m.display_name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Create</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-gray-600 rounded text-sm font-medium hover:bg-gray-100">Cancel</button>
      </div>
    </form>
  )
}
