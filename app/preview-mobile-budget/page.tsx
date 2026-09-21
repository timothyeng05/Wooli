'use client'

import { useEffect, useState } from 'react'
import {
  clearAll,
  getAllAccounts,
  getSetting,
  getTransactionsForAccount,
  putAccounts,
  putTransactions,
  setSetting,
  type LocalAccount,
  type LocalTransaction,
} from './local-db'
import { generateDemoData } from './demo-data'
import { claimSetupToken, fetchSimplefinAccounts } from './simplefin-browser'

type Screen = 'loading' | 'connect' | 'accounts' | 'transactions'

const currency = (n: number, code: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n)

export default function MobileBudgetPreview() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [accounts, setAccounts] = useState<LocalAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<LocalAccount | null>(null)
  const [transactions, setTransactions] = useState<LocalTransaction[]>([])
  const [tokenInput, setTokenInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')

    // ?view=accounts / ?view=transactions is a shortcut for screenshotting
    // populated states directly, without clicking through demo data first.
    if (view === 'accounts' || view === 'transactions') {
      const demo = generateDemoData()
      await putAccounts(demo.accounts)
      await putTransactions(demo.transactions)
      await setSetting('connected', '1')
    }

    const connected = await getSetting('connected')
    if (!connected) {
      setScreen('connect')
      return
    }
    const stored = await getAllAccounts()
    setAccounts(stored)

    if (view === 'transactions' && stored.length > 0) {
      const target = params.get('account') ?? stored[0].providerAccountId
      await openAccount(stored.find((a) => a.providerAccountId === target) ?? stored[0])
      return
    }
    setScreen('accounts')
  }

  async function handleConnect() {
    const token = tokenInput.trim()
    if (!token) return
    setConnecting(true)
    setError(null)
    try {
      const accessUrl = await claimSetupToken(token)
      const response = await fetchSimplefinAccounts(accessUrl)
      const localAccounts: LocalAccount[] = response.accounts.map((a) => ({
        providerAccountId: a.id,
        name: a.name,
        institutionName: a.org.name ?? 'Unknown',
        currency: a.currency,
        balance: Number(a.balance) || 0,
        balanceDate: a['balance-date'] * 1000,
      }))
      const localTransactions: LocalTransaction[] = response.accounts.flatMap((a) =>
        (a.transactions ?? []).map((t) => ({
          providerTransactionId: t.id,
          accountId: a.id,
          amount: Number(t.amount) || 0,
          description: t.description,
          transactedAt: (t.transacted_at ?? t.posted) * 1000,
          isPending: t.pending ?? false,
        }))
      )
      await putAccounts(localAccounts)
      await putTransactions(localTransactions)
      await setSetting('connected', '1')
      setAccounts(localAccounts)
      setScreen('accounts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleLoadDemo() {
    const demo = generateDemoData()
    await putAccounts(demo.accounts)
    await putTransactions(demo.transactions)
    await setSetting('connected', '1')
    setAccounts(demo.accounts)
    setScreen('accounts')
  }

  async function handleDisconnect() {
    await clearAll()
    setAccounts([])
    setTransactions([])
    setTokenInput('')
    setScreen('connect')
  }

  async function openAccount(account: LocalAccount) {
    const txns = await getTransactionsForAccount(account.providerAccountId)
    txns.sort((a, b) => b.transactedAt - a.transactedAt)
    setSelectedAccount(account)
    setTransactions(txns)
    setScreen('transactions')
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-white pb-8">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Wooli</h1>
          <p className="text-xs font-medium text-primary-600">Local &amp; private -- no Wooli server</p>
        </div>
        {screen !== 'connect' && screen !== 'loading' && (
          <button
            onClick={handleDisconnect}
            className="text-sm font-medium text-red-600"
          >
            Disconnect
          </button>
        )}
      </header>

      {screen === 'loading' && (
        <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading…</div>
      )}

      {screen === 'connect' && (
        <div className="space-y-4 px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900">Connect your bank</h2>
          <p className="text-sm text-gray-600">
            Paste a SimpleFIN setup token from your SimpleFIN Bridge account. This
            page talks to your bank&apos;s SimpleFIN bridge directly from your
            phone&apos;s browser -- there is no Wooli server in the loop, and
            everything is stored only in this browser (IndexedDB).
          </p>
          <textarea
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste your SimpleFIN setup token"
            rows={3}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-primary-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleConnect}
            disabled={!tokenInput.trim() || connecting}
            className="w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
          <div className="pt-2 text-center">
            <button onClick={handleLoadDemo} className="text-sm font-medium text-gray-500 underline">
              Or load demo data to look around
            </button>
          </div>
        </div>
      )}

      {screen === 'accounts' && (
        <div className="px-4 py-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Accounts</h2>
          <div className="space-y-3">
            {accounts.map((account) => (
              <button
                key={account.providerAccountId}
                onClick={() => openAccount(account)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-xs text-gray-500">{account.institutionName}</p>
                </div>
                <p className="font-semibold text-gray-900">{currency(account.balance, account.currency)}</p>
              </button>
            ))}
            {accounts.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">No accounts yet.</p>
            )}
          </div>
        </div>
      )}

      {screen === 'transactions' && selectedAccount && (
        <div className="px-4 py-4">
          <button
            onClick={() => setScreen('accounts')}
            className="mb-3 text-sm font-medium text-primary-600"
          >
            ← Accounts
          </button>
          <h2 className="mb-1 text-lg font-bold text-gray-900">{selectedAccount.name}</h2>
          <p className="mb-4 text-sm text-gray-500">{selectedAccount.institutionName}</p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
            {transactions.map((t) => (
              <div key={t.providerTransactionId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.description}</p>
                  <p className="text-xs text-gray-500">{new Date(t.transactedAt).toLocaleDateString()}</p>
                </div>
                <p className={`text-sm font-semibold ${t.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {currency(t.amount, selectedAccount.currency)}
                </p>
              </div>
            ))}
            {transactions.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No transactions.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
