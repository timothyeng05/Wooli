import { redirect } from 'next/navigation'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import CsvImportClient from '@/app/components/budget/CsvImportClient'

export default async function ImportPage() {
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('household_members')
    .select('id, full_name, display_name, color, sort_order, is_shared')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Import Transactions</h1>
          <p className="text-gray-500 mt-1 text-sm">Import from Monarch, Copilot, or any CSV export</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <CsvImportClient members={members ?? []} />
      </div>
    </div>
  )
}
