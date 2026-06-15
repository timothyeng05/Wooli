import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CategoryManager from '@/app/components/budget/CategoryManager'

export default async function CategoriesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, name, color, is_income, is_transfer, parent_id, sort_order, keywords, icon')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true }) as any

  const needsMigration = error?.message?.includes('does not exist') || error?.code === '42P01'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-16">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Categories</h1>

        {needsMigration ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">Database setup required</h2>
            <p className="text-sm text-gray-500 mb-4">Run this SQL in your Supabase SQL editor, then come back:</p>
            <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto mb-4 leading-relaxed">
{`-- See supabase/migrations/008_budget_module.sql`}
            </pre>
            <SetupButton />
          </div>
        ) : (
          <>
            {(!categories || categories.length === 0) && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-blue-800">No categories yet.</p>
                <SetupButton />
              </div>
            )}
            <CategoryManager userId={user.id} categories={categories || []} />
          </>
        )}
      </div>
    </div>
  )
}

function SetupButton() {
  return (
    <form action="/api/setup-budget" method="POST">
      <button
        type="submit"
        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
      >
        Set Up Defaults
      </button>
    </form>
  )
}
