// Sample data for the "Load demo data" button, so the preview can show
// populated screens without a real SimpleFIN token.
import type { LocalAccount, LocalTransaction } from './local-db'

export function generateDemoData(): { accounts: LocalAccount[]; transactions: LocalTransaction[] } {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  const accounts: LocalAccount[] = [
    { providerAccountId: 'demo-checking', name: 'Everyday Checking', institutionName: 'Ridgeline Credit Union', currency: 'USD', balance: 2418.32, balanceDate: now },
    { providerAccountId: 'demo-savings', name: 'High-Yield Savings', institutionName: 'Ridgeline Credit Union', currency: 'USD', balance: 11250.0, balanceDate: now },
  ]

  const sample: Array<[string, string, number]> = [
    ['demo-checking', "Trader Joe's", -64.21],
    ['demo-checking', 'Blue Bottle Coffee', -6.5],
    ['demo-checking', 'Paycheck -- Acme Co', 2850.0],
    ['demo-checking', 'Rent', -1800.0],
    ['demo-checking', 'Delta Air Lines', -412.6],
    ['demo-checking', 'Netflix', -15.49],
    ['demo-savings', 'Transfer from Checking', 500.0],
  ]

  const transactions: LocalTransaction[] = sample.map(([accountId, description, amount], i) => ({
    providerTransactionId: `demo-txn-${i}`,
    accountId,
    amount,
    description,
    transactedAt: now - i * 2 * day,
    isPending: false,
  }))

  return { accounts, transactions }
}
