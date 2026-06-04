import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RulesManager from '@/app/components/budget/RulesManager'

export default async function RulesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rules }, { data: categories }] = await Promise.all([
    supabase
      .from('categorization_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, parent_id')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Categorization Rules</h1>
        <p className="text-sm text-gray-500 mb-6">
          Rules run before AI categorization. When a rule matches, its category is assigned
          automatically — no AI call. Lower priority numbers are checked first.
        </p>
        <RulesManager userId={user.id} rules={rules ?? []} categories={categories ?? []} />
      </div>
    </div>
  )
}
