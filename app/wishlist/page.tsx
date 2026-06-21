import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import WishlistClient, { type WishItem } from './WishlistClient'

export default async function WishlistPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('wishlist_countries')
    .select('id, country_code, country_name, note, visited, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const items: WishItem[] = (data ?? []).map(d => ({
    id: d.id,
    code: d.country_code,
    name: d.country_name,
    note: d.note,
    visited: d.visited,
  }))

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Wishlist' }]} />
          <div className="mt-4 sm:mt-6">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Travel Wishlist</h1>
            <p className="text-sm sm:text-base text-gray-600">Countries you want to visit — and the ones you’ve made it to.</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-10">
        <WishlistClient initialItems={items} />
      </div>
    </div>
  )
}
