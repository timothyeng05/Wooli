import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import CardTemplateSelector from '@/app/components/cards/CardTemplateSelector'

export default async function AddCardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Use service role to read templates (bypasses RLS)
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: async () => [],
        setAll: async () => {}
      }
    }
  )

  if (!user) redirect('/login')

  // Fetch templates with benefits
  const { data: rawTemplates, error } = await adminSupabase
    .from('card_templates')
    .select('*')
    .order('name')

  console.log('Raw templates:', rawTemplates)

  let templates: any[] = []
  if (rawTemplates && rawTemplates.length > 0) {
    // Now fetch full details with joins
    const { data: fullTemplates } = await adminSupabase
      .from('card_templates')
      .select(`
        id,
        name,
        issuer,
        network,
        annual_fee,
        template_benefits (
          benefit_id,
          is_core_default,
          benefits (
            id,
            name,
            category_id,
            amount,
            amount_unit,
            period_type,
            period_frequency,
            description,
            benefit_categories (
              id,
              name
            )
          )
        )
      `)
      .order('name') as any

    templates = fullTemplates || []
  }

  if (error) {
    console.error('Template query error:', error)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Add Card</h1>
          <p className="text-gray-600">Choose a card template</p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
          {(templates && templates.length > 0) ? (
            <CardTemplateSelector templates={templates} userId={user.id} />
          ) : (
            <div className="text-center text-gray-600 space-y-4">
              <p>No card templates available.</p>
              {templates && <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto text-left">{JSON.stringify(templates, null, 2)}</pre>}
              {error && <pre className="text-xs bg-red-100 p-2 rounded overflow-auto text-left text-red-800">{JSON.stringify(error, null, 2)}</pre>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
