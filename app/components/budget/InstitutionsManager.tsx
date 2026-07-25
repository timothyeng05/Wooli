'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useToast } from '@/app/components/ui/ToastProvider'
import InstitutionLogo from './InstitutionLogo'

export interface InstitutionRow {
  name: string
  logoUrl: string | null
}

function sanitize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Uploads a logo file for the given institution name and upserts institution_logos. Returns the public URL. */
async function uploadInstitutionLogo(userId: string, institutionName: string, file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${sanitize(institutionName)}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('institution-logos')
    .upload(path, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage.from('institution-logos').getPublicUrl(path)

  const { error: dbError } = await supabase.from('institution_logos').upsert(
    { user_id: userId, institution_name: institutionName, logo_url: publicUrl },
    { onConflict: 'user_id,institution_name' }
  )
  if (dbError) throw dbError

  return publicUrl
}

function InstitutionCard({ institution, userId, onSaved }: {
  institution: InstitutionRow
  userId: string
  onSaved: (name: string, logoUrl: string) => void
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setUploading(true)
    setPreview(URL.createObjectURL(file))
    try {
      const publicUrl = await uploadInstitutionLogo(userId, institution.name, file)
      onSaved(institution.name, publicUrl)
      toast.success(`Logo updated for ${institution.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={institution.name} className="w-full h-full object-cover" />
        ) : (
          <InstitutionLogo institution={institution.name} customUrl={institution.logoUrl} size={40} />
        )}
      </div>
      <p className="flex-1 text-sm font-medium text-gray-900 truncate">{institution.name}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 px-2 py-1"
      >
        {uploading ? 'Uploading…' : institution.logoUrl ? 'Change photo' : 'Upload photo'}
      </button>
    </div>
  )
}

function AddInstitutionForm({ userId, existingNames, onAdded, onCancel }: {
  userId: string
  existingNames: string[]
  onAdded: (row: InstitutionRow) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { toast.error('Enter an institution name'); return }
    if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('That institution is already in the list'); return
    }
    if (!file) { toast.error('Choose a photo'); return }
    setSaving(true)
    try {
      const publicUrl = await uploadInstitutionLogo(userId, trimmed, file)
      onAdded({ name: trimmed, logoUrl: publicUrl })
      toast.success(`Added ${trimmed}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add institution')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Institution name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Hyundai"
            autoFocus
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 mb-0.5 block">Photo</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-left text-gray-600 truncate"
          >
            {file ? file.name : 'Choose file…'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={saving || !name.trim() || !file}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-gray-500 rounded text-xs hover:bg-gray-100">
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function InstitutionsManager({ userId, institutions }: {
  userId: string
  institutions: InstitutionRow[]
}) {
  const [rows, setRows] = useState(institutions)
  const [adding, setAdding] = useState(false)

  const handleSaved = (name: string, logoUrl: string) => {
    setRows(prev => prev.map(r => r.name === name ? { ...r, logoUrl } : r))
  }

  const handleAdded = (row: InstitutionRow) => {
    setRows(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)))
    setAdding(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-xs text-gray-400">
          Upload a photo for any institution — it'll show next to every account connected to it, replacing the built-in logo (or generic placeholder) automatically.
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex-shrink-0 text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
          >
            + Add institution
          </button>
        )}
      </div>
      {adding && (
        <AddInstitutionForm
          userId={userId}
          existingNames={rows.map(r => r.name)}
          onAdded={handleAdded}
          onCancel={() => setAdding(false)}
        />
      )}
      {rows.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-8">No institutions yet — connect a bank, add a manual account, or add one above.</p>
      )}
      {rows.map(inst => (
        <InstitutionCard key={inst.name} institution={inst} userId={userId} onSaved={handleSaved} />
      ))}
    </div>
  )
}
