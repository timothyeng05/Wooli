export type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'loan' | 'other' | 'vehicle'

export interface Account {
  id: string
  name: string
  type: AccountType
  institution: string | null
  current_balance: number
  is_active: boolean
  is_asset: boolean
  notes: string | null
  sort_order: number
  owner: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  depreciation_months?: number | null
  residual_value?: number | null
}

export const ACCOUNT_TYPES: { value: AccountType; label: string; isAsset: boolean }[] = [
  { value: 'checking',   label: 'Checking',   isAsset: true },
  { value: 'savings',    label: 'Savings',    isAsset: true },
  { value: 'credit',     label: 'Credit Card', isAsset: false },
  { value: 'investment', label: 'Investment', isAsset: true },
  { value: 'cash',       label: 'Cash',       isAsset: true },
  { value: 'loan',       label: 'Loan',       isAsset: false },
  { value: 'vehicle',    label: 'Vehicle',    isAsset: true },
  { value: 'other',      label: 'Other',      isAsset: true },
]

export const TYPE_LABEL: Record<AccountType, string> = Object.fromEntries(
  ACCOUNT_TYPES.map(t => [t.value, t.label])
) as Record<AccountType, string>

export function isAssetType(t: AccountType): boolean {
  return ACCOUNT_TYPES.find(x => x.value === t)?.isAsset ?? true
}

/**
 * Straight-line depreciation: linear decline from purchasePrice to residual
 * over `months`, starting at purchaseDate. Clamped to [purchaseDate, purchaseDate+months]
 * so the value never goes below residual or above the original price.
 */
export function depreciatedValue(
  purchasePrice: number,
  purchaseDate: string,
  months: number,
  residual: number,
  asOf: Date = new Date(),
): number {
  if (months <= 0) return residual
  const start = new Date(purchaseDate + 'T00:00:00')
  const msElapsed = asOf.getTime() - start.getTime()
  const monthsElapsed = msElapsed / (365.25 / 12 * 86400000)
  const clamped = Math.max(0, Math.min(months, monthsElapsed))
  return purchasePrice - (purchasePrice - residual) * (clamped / months)
}

export function netWorth(accounts: Account[]): { assets: number; liabilities: number; net: number } {
  let assets = 0
  let liabilities = 0
  for (const a of accounts) {
    if (!a.is_active) continue
    const bal = Number(a.current_balance) || 0
    if (a.is_asset) assets += bal
    else liabilities += Math.abs(bal)
  }
  return { assets, liabilities, net: assets - liabilities }
}
