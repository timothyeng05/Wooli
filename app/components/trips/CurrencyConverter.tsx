'use client'
import { useState, useEffect } from 'react'

type Code = 'usd' | 'jpy' | 'krw'

const CURRENCIES: { code: Code; symbol: string; label: string; flag: string; decimals: number }[] = [
  { code: 'usd', symbol: '$', label: 'USD', flag: '🇺🇸', decimals: 2 },
  { code: 'jpy', symbol: '¥', label: 'JPY', flag: '🇯🇵', decimals: 0 },
  { code: 'krw', symbol: '₩', label: 'KRW', flag: '🇰🇷', decimals: 0 },
]

export default function CurrencyConverter() {
  const [rates, setRates] = useState<Record<Code, number> | null>(null)
  const [values, setValues] = useState<Record<Code, string>>({ usd: '', jpy: '', krw: '' })

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
      .then(r => r.json())
      .then(data => setRates({ usd: 1, jpy: data.usd.jpy, krw: data.usd.krw }))
      .catch(() => {})
  }, [])

  const convert = (code: Code, raw: string) => {
    if (!raw) {
      setValues({ usd: '', jpy: '', krw: '' })
      return
    }
    const num = parseFloat(raw)
    if (isNaN(num) || !rates) {
      setValues(v => ({ ...v, [code]: raw }))
      return
    }
    const inUSD = num / rates[code]
    const next = {} as Record<Code, string>
    for (const c of CURRENCIES) {
      if (c.code === code) {
        next[c.code] = raw
      } else {
        const converted = inUSD * rates[c.code]
        next[c.code] = c.decimals === 0
          ? Math.round(converted).toLocaleString()
          : converted.toFixed(2)
      }
    }
    setValues(next)
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
        <span className="text-base">💱</span>
        <span className="text-sm font-semibold text-gray-700">Currency Converter</span>
        <span className="ml-auto text-xs text-gray-400">{rates ? 'Live rates' : 'Loading rates…'}</span>
      </div>
      <div className="divide-y divide-gray-100">
        {CURRENCIES.map(({ code, symbol, label, flag }) => (
          <div key={code} className="flex items-center gap-3 px-4 py-2.5 bg-white">
            <span className="text-xl w-7 flex-shrink-0 leading-none">{flag}</span>
            <span className="w-9 flex-shrink-0 text-xs font-semibold text-gray-500">{label}</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">
                {symbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={values[code]}
                onChange={e => convert(code, e.target.value.replace(/,/g, ''))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>
          </div>
        ))}
      </div>
      {rates && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            1 USD = {Math.round(rates.jpy).toLocaleString()} JPY · {Math.round(rates.krw).toLocaleString()} KRW
          </p>
        </div>
      )}
    </div>
  )
}
