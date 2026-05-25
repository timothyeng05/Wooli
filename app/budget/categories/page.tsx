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
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Categories</h1>
          <p className="text-gray-600 text-sm">Organize your transactions</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {needsMigration ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">Database setup required</h2>
            <p className="text-gray-600 mb-4">Run this SQL in your Supabase SQL editor, then come back:</p>
            <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-auto mb-6 leading-relaxed">
{`-- See supabase/migrations/008_budget_module.sql`}
            </pre>
            <p className="text-sm text-gray-500">After running the migration, click the button below to set up default categories.</p>
            <SetupButton />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
            {(!categories || categories.length === 0) && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-3">No categories yet. Set up defaults to get started quickly.</p>
                <SetupButton />
              </div>
            )}
            <CategoryManager userId={user.id} categories={categories || []} />
          </div>
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
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        Set Up Default Categories
      </button>
    </form>
  )
}
