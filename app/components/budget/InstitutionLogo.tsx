'use client'

export const KNOWN_INSTITUTIONS = [
  'Chase',
  'Citibank',
  'American Express',
  'Charles Schwab',
  'Fidelity',
  'Health Equity',
  'Alight',
] as const

const LOGO_MAP: { match: RegExp; src: string }[] = [
  { match: /chase/i,             src: '/logos/chase.png' },
  { match: /citi/i,              src: '/logos/citi.png' },
  { match: /american express/i,  src: '/logos/amex.jpeg' },
  { match: /schwab/i,            src: '/logos/schwab.png' },
  { match: /fidelity/i,          src: '/logos/fidelity.jpeg' },
  { match: /health ?equity/i,    src: '/logos/healthequity.svg' },
  { match: /alight/i,            src: '/logos/alight.png' },
]

export default function InstitutionLogo({ institution, size = 28 }: { institution: string | null | undefined; size?: number }) {
  if (!institution) return null
  const logo = LOGO_MAP.find(l => l.match.test(institution))
  if (!logo) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt={institution}
      width={size}
      height={size}
      className="rounded-full flex-shrink-0 object-cover"
    />
  )
}
