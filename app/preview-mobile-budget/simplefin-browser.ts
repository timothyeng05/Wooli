// Browser port of lib/budget/simplefin-client.ts. Runs entirely client-side
// -- these fetch calls go straight from this device to the SimpleFIN
// bridge, with no Wooli server in between. Untested against a real
// SimpleFIN bridge in this session (no token to test with, and none
// should be pasted into a shared dev session) -- in particular, whether
// the bridge's CORS headers allow a direct browser fetch is unverified.

export interface SimplefinCredentials {
  url: string
  authHeader: string
}

export function splitAccessUrl(accessUrl: string): SimplefinCredentials {
  const u = new URL(accessUrl)
  const authHeader = 'Basic ' + btoa(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`)
  u.username = ''
  u.password = ''
  return { url: u.toString(), authHeader }
}

export async function claimSetupToken(setupToken: string): Promise<string> {
  const claimUrl = atob(setupToken)
  const res = await fetch(claimUrl, { method: 'POST', body: '' })
  if (!res.ok) throw new Error(`SimpleFIN claim failed: HTTP ${res.status}`)
  const accessUrl = (await res.text()).trim()
  if (!accessUrl) throw new Error('SimpleFIN claim returned an empty access URL')
  return accessUrl
}

export interface SimplefinTransaction {
  id: string
  posted: number
  amount: string
  description: string
  transacted_at?: number
  pending?: boolean
}

export interface SimplefinAccount {
  id: string
  name: string
  currency: string
  balance: string
  'balance-date': number
  org: { name?: string }
  transactions?: SimplefinTransaction[]
}

export interface SimplefinAccountsResponse {
  accounts: SimplefinAccount[]
  errors: string[]
}

export async function fetchSimplefinAccounts(accessUrl: string): Promise<SimplefinAccountsResponse> {
  const { url, authHeader } = splitAccessUrl(accessUrl)
  const startDate = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60
  const res = await fetch(`${url.replace(/\/$/, '')}/accounts?start-date=${startDate}&pending=1`, {
    headers: { Authorization: authHeader },
  })
  if (!res.ok) throw new Error(`SimpleFIN request failed: HTTP ${res.status}`)
  return res.json()
}
