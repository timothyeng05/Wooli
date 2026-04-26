import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import ListForm from '@/app/components/lists/ListForm'

export default async function NewListPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <Breadcrumbs items={[
            { label: 'Lists', href: '/lists' },
            { label: 'New List' },
          ]} />
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">New List</h1>
          <ListForm userId={user.id} />
        </div>
      </div>
    </div>
  )
}
