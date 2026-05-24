'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface ParsedRow {
  date: string
  merchant: string
  category: string
  account: string
  notes: string
  amount: number
  owner: string | null
}

const OWNER_COLORS: Record<string, string> = {
  'Timothy Eng': 'bg-blue-100 text-blue-700',
  'Jessica Li':  'bg-rose-100 text-rose-700',
  'Shared':      'bg-gray-100 text-gray-600',
}

const VALID_OWNERS = new Set(['Timothy Eng', 'Jessica Li', 'Shared'])

// Handles quoted fields with embedded commas
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase())
  const idx = (name: string) => headers.indexOf(name)

  const iDate     = idx('date')
  const iMerchant = idx('merchant')
  const iCat      = idx('category')
  const iAccount  = idx('account')
  const iNotes    = idx('notes')
  const iAmount   = idx('amount')
  const iOwner    = idx('owner')

  const rows: ParsedRow[] = []
  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line)
    const amountRaw = parseFloat(cols[iAmount] ?? '')
    if (!isFinite(amountRaw)) continue

    const ownerRaw = cols[iOwner]?.trim() ?? ''
    const owner = VALID_OWNERS.has(ownerRaw) ? ownerRaw : null

    rows.push({
      date:     cols[iDate]?.trim()     ?? '',
      merchant: cols[iMerchant]?.trim() ?? '',
      category: cols[iCat]?.trim()      ?? '',
      account:  cols[iAccount]?.trim()  ?? '',
      notes:    cols[iNotes]?.trim()    ?? '',
      amount:   amountRaw,
      owner,
    })
  }
  return rows
}

export default function CsvImportClient() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [replace, setReplace] = useState(true)
  const [status, setStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ imported: number } | null>(null)
  const [error, setError] = useState('')

  const handleFile = (file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const parsed = parseCSV(e.target?.result as string)
      setRows(parsed)
      setStatus('idle')
      setResult(null)
    }
    reader.readAsText(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const doImport = async () => {
    setStatus('importing')
    setError('')
    try {
      const res = await fetch('/api/budget/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, replace }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setStatus('done')
        router.refresh()
      } else {
        throw new Error(data.error ?? 'Import failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setStatus('error')
    }
  }

  // Stats
  const ownerCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.owner ?? 'Unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
  const dates = rows.map(r => r.date).filter(Boolean).sort()
  const uniqueAccounts = [...new Set(rows.map(r => r.account).filter(Boolean))]

  return (
    <div className="space-y-8">

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
      >
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        <p className="text-2xl mb-2">📂</p>
        {fileName ? (
          <p className="text-sm font-medium text-gray-900">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">Drop your CSV here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Expects columns: Date, Merchant, Category, Account, Notes, Amount, Owner</p>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Transactions" value={rows.length.toLocaleString()} />
            <StatCard label="Date range" value={dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : '—'} small />
            <StatCard label="Accounts" value={uniqueAccounts.length.toString()} />
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-400 mb-2">By owner</p>
              <div className="space-y-1">
                {Object.entries(ownerCounts).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${OWNER_COLORS[name] ?? 'bg-gray-100 text-gray-500'}`}>
                      {name === 'Timothy Eng' ? 'Tim' : name === 'Jessica Li' ? 'Jess' : name}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Preview (first 15 rows)</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date', 'Merchant', 'Category', 'Account', 'Amount', 'Owner'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 15).map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{r.date}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[160px] truncate">{r.merchant}</td>
                      <td className="px-3 py-2 text-gray-500">{r.category}</td>
                      <td className="px-3 py-2 text-gray-400 max-w-[140px] truncate">{r.account}</td>
                      <td className={`px-3 py-2 font-semibold tabular-nums whitespace-nowrap ${r.amount >= 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        {r.amount >= 0 ? '+' : ''}${Math.abs(r.amount).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        {r.owner && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${OWNER_COLORS[r.owner] ?? 'bg-gray-100 text-gray-500'}`}>
                            {r.owner === 'Timothy Eng' ? 'Tim' : r.owner === 'Jessica Li' ? 'Jess' : r.owner}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 15 && (
              <p className="text-xs text-gray-400 mt-2 text-right">…and {(rows.length - 15).toLocaleString()} more</p>
            )}
          </div>

          {/* Import options */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={replace}
                onChange={e => setReplace(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Replace all existing transactions</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Deletes all current transactions before importing. Recommended when importing a full history export.
                </p>
              </div>
            </label>

            {status === 'done' && result ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <span className="text-base">✓</span>
                <p className="text-sm font-medium">Imported {result.imported.toLocaleString()} transactions successfully.</p>
              </div>
            ) : status === 'error' ? (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <span className="text-base">⚠</span>
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <button
                onClick={doImport}
                disabled={status === 'importing'}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                {status === 'importing'
                  ? `Importing ${rows.length.toLocaleString()} transactions…`
                  : `Import ${rows.length.toLocaleString()} transactions`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`font-bold text-gray-900 ${small ? 'text-xs' : 'text-xl'}`}>{value}</p>
    </div>
  )
}
