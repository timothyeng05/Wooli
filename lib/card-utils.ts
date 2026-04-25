export const CATEGORY_ORDER = ['Travel', 'Dining', 'Lifestyle', 'Insurance']

export function periodMultiplier(period: string | null): number {
  if (period === 'monthly') return 12
  if (period === 'quarterly') return 4
  if (period === 'biannual') return 2
  return 1
}

export function annualizedValue(amount: number, period: string | null): number {
  return amount * periodMultiplier(period)
}

export function computeCardStats(
  annualFee: number | null,
  cardBenefits: Array<{
    is_core: boolean
    benefits: { amount: number | null; amount_unit: string | null; period_type: string | null } | null
  }>
) {
  const coreCount = cardBenefits.filter(b => b.is_core).length
  const coreValue = cardBenefits
    .filter(b => b.is_core && b.benefits?.amount_unit === '$' && b.benefits?.amount != null)
    .reduce((sum, b) => sum + annualizedValue(b.benefits!.amount!, b.benefits!.period_type), 0)
  const netValue = coreValue - (annualFee ?? 0)
  return { coreCount, coreValue, netValue }
}
