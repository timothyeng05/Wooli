import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import FeatureTabs from '@/app/components/FeatureTabs'
import WooliLogo from '@/app/components/WooliLogo'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/budget/accounts')

  return (
    <div className="bg-white">

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-16 text-center">
        <div className="flex justify-center mb-6">
          <WooliLogo size={80} />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-4">
          Your finances and travels,<br className="hidden sm:block" /> all in one place.
        </h1>
        <p className="text-lg text-gray-500 mb-4 max-w-xl mx-auto">
          Wooli helps your household track spending and plan trips. Set up your budget first — trips unlock automatically once you're done.
        </p>
        <p className="text-sm text-gray-400 mb-10">
          Invite-only · Setup takes about 3 minutes.
        </p>
        <div className="flex items-center justify-center">
          <Link
            href="/login"
            className="px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Log in to Wooli
          </Link>
        </div>
      </div>

      {/* Feature tabs */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <FeatureTabs />
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ready to take control?</h2>
          <p className="text-gray-500 text-sm mb-2">Start with budget. Trips unlock automatically.</p>
          <p className="text-gray-400 text-xs mb-6">Setup takes about 3 minutes.</p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Log in to Wooli
          </Link>
        </div>
      </div>

    </div>
  )
}
