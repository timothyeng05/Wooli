'use client'

export const KNOWN_INSTITUTIONS = [
  'Chase',
  'Citibank',
  'American Express',
  'Charles Schwab',
  'Fidelity',
  'Health Equity',
  'Alight',
  'Hyundai',
  'Other',
] as const

const LOGO_MAP: { match: RegExp; src: string }[] = [
  { match: /chase/i,             src: '/logos/chase.png' },
  { match: /citi/i,              src: '/logos/citi.png' },
  { match: /american express|amex/i, src: '/logos/amex.jpeg' },
  { match: /schwab/i,            src: '/logos/schwab.png' },
  { match: /fidelity/i,          src: '/logos/fidelity.jpeg' },
  { match: /health ?equity/i,    src: '/logos/healthequity.svg' },
  { match: /alight/i,            src: '/logos/alight.png' },
  { match: /hyundai/i,           src: '/logos/hyundai.png' },
]

export default function InstitutionLogo({ institution, customUrl, size = 28 }: {
  institution: string | null | undefined
  /** User-supplied logo URL — takes priority over the built-in institution match. */
  customUrl?: string | null
  size?: number
}) {
  const src = customUrl || LOGO_MAP.find(l => institution && l.match.test(institution))?.src
  // Hold the slot when there's no logo. Returning null collapsed it, so rows
  // with a known institution were indented and rows without were not, leaving
  // the account list with a ragged left edge.
  if (!src) return <div style={{ width: size, height: size }} className="flex-shrink-0" aria-hidden />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={institution ?? 'Account logo'}
      width={size}
      height={size}
      className="rounded-full flex-shrink-0 object-cover"
    />
  )
}
