// Minimal IndexedDB wrapper for the local-first mobile web preview. No
// server, no Supabase -- everything here lives only in this browser's
// origin storage.

const DB_NAME = 'wooli-local-budget'
const DB_VERSION = 1

export interface LocalAccount {
  providerAccountId: string
  name: string
  institutionName: string
  currency: string
  balance: number
  balanceDate: number
}

export interface LocalTransaction {
  providerTransactionId: string
  accountId: string
  amount: number
  description: string
  transactedAt: number
  isPending: boolean
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'providerAccountId' })
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const store = db.createObjectStore('transactions', { keyPath: 'providerTransactionId' })
        store.createIndex('accountId', 'accountId')
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly')
    const req = tx.objectStore('settings').get(key)
    req.onsuccess = () => resolve((req.result as { value: string } | undefined)?.value)
    req.onerror = () => reject(req.error)
  })
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('settings', 'readwrite')
  tx.objectStore('settings').put({ key, value })
  await txDone(tx)
}

export async function putAccounts(accounts: LocalAccount[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('accounts', 'readwrite')
  const store = tx.objectStore('accounts')
  for (const account of accounts) store.put(account)
  await txDone(tx)
}

export async function putTransactions(transactions: LocalTransaction[]): Promise<void> {
  const db = await openDb()
  const tx = db.transaction('transactions', 'readwrite')
  const store = tx.objectStore('transactions')
  for (const transaction of transactions) store.put(transaction)
  await txDone(tx)
}

export async function getAllAccounts(): Promise<LocalAccount[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('accounts', 'readonly')
    const req = tx.objectStore('accounts').getAll()
    req.onsuccess = () => resolve(req.result as LocalAccount[])
    req.onerror = () => reject(req.error)
  })
}

export async function getTransactionsForAccount(accountId: string): Promise<LocalTransaction[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readonly')
    const req = tx.objectStore('transactions').index('accountId').getAll(accountId)
    req.onsuccess = () => resolve(req.result as LocalTransaction[])
    req.onerror = () => reject(req.error)
  })
}

export async function clearAll(): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(['accounts', 'transactions', 'settings'], 'readwrite')
  tx.objectStore('accounts').clear()
  tx.objectStore('transactions').clear()
  tx.objectStore('settings').clear()
  await txDone(tx)
}
