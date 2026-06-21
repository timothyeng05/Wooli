// Country reference data for the travel wishlist. We keep only ISO 3166-1
// alpha-2 codes and derive the display name (Intl.DisplayNames) and flag emoji
// (regional-indicator code points) at runtime, so there's nothing to keep in
// sync by hand.

const CODES = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ ' +
  'CA CD CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ ' +
  'MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PR PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ ' +
  'UA UG US UY UZ VA VC VE VG VI VN VU WS XK YE ZA ZM ZW'
).split(' ')

let regionNames: Intl.DisplayNames | null = null
try {
  regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
} catch {
  regionNames = null
}

export function countryName(code: string): string {
  const cc = code.toUpperCase()
  // Kosovo (XK) is a user-assigned code Intl doesn't always know.
  if (cc === 'XK') return 'Kosovo'
  try {
    return regionNames?.of(cc) ?? cc
  } catch {
    return cc
  }
}

export function flagEmoji(code: string): string {
  const cc = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️'
  return String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export type Country = { code: string; name: string; flag: string }

export const ALL_COUNTRIES: Country[] = CODES
  .map(code => ({ code, name: countryName(code), flag: flagEmoji(code) }))
  .filter(c => c.name && c.name !== c.code)
  .sort((a, b) => a.name.localeCompare(b.name))
