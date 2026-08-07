// Low-level SimpleFin protocol helpers. Unlike Plaid, SimpleFin needs no
// app-wide client singleton — every secret (the access URL) is per-connection,
// stored on bank_connections.access_url and passed in by the caller.

export interface SimplefinCredentials { url: string; authHeader: string }

/**
 * Split an access URL's embedded user:pass into an explicit Basic-Auth header.
 * Node's fetch (undici) and the browser fetch spec both reject URLs containing
 * userinfo, so the raw access_url must never be passed straight to fetch().
 */
export function splitAccessUrl(accessUrl: string): SimplefinCredentials {
  const u = new URL(accessUrl)
  const authHeader = 'Basic ' + Buffer.from(
    `${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`
  ).toString('base64')
  u.username = ''
  u.password = ''
  return { url: u.toString(), authHeader }
}

/**
 * One-time exchange: POST the claim URL (base64-decoded from the setup token)
 * to get the long-lived access URL. Succeeds only once per setup token.
 */
export async function claimSetupToken(setupToken: string): Promise<string> {
  const claimUrl = Buffer.from(setupToken, 'base64').toString('utf-8')
  const res = await fetch(claimUrl, { method: 'POST', body: '' })
  if (!res.ok) throw new Error(`SimpleFin claim failed: HTTP ${res.status}`)
  const accessUrl = (await res.text()).trim()
  if (!accessUrl) throw new Error('SimpleFin claim returned an empty access URL')
  return accessUrl
}

export interface SimplefinTransaction {
  id: string
  /** When the transaction posted. Per the protocol this is 0 while it's pending. */
  posted: number
  amount: string
  description: string
  payee?: string
  memo?: string
  /** When the transaction actually happened. Optional — not every institution sends it. */
  transacted_at?: number
  pending?: boolean
}

export interface SimplefinAccount {
  id: string
  name: string
  currency: string
  balance: string
  'available-balance'?: string
  'balance-date': number
  org: { domain?: string; name?: string; url?: string; id?: string }
  transactions?: SimplefinTransaction[]
}

export interface SimplefinAccountsResponse {
  accounts: SimplefinAccount[]
  errors: string[]
}

export interface FetchAccountsOptions {
  startDate?: number
  endDate?: number
  pending?: boolean
  accountIds?: string[]
  balancesOnly?: boolean
}

export async function fetchSimplefinAccounts(
  accessUrl: string,
  opts: FetchAccountsOptions = {},
): Promise<SimplefinAccountsResponse> {
  const { url, authHeader } = splitAccessUrl(accessUrl)
  const params = new URLSearchParams()
  if (opts.startDate) params.set('start-date', String(opts.startDate))
  if (opts.endDate) params.set('end-date', String(opts.endDate))
  if (opts.pending) params.set('pending', '1')
  if (opts.balancesOnly) params.set('balances-only', '1')
  for (const id of opts.accountIds ?? []) params.append('account', id)
  const qs = params.toString()

  const res = await fetch(`${url.replace(/\/$/, '')}/accounts${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: authHeader },
  })
  if (!res.ok) throw new Error(`SimpleFin request failed: HTTP ${res.status}`)
  return res.json()
}
