export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, getServerUser } from '@/lib/supabase-server'
import CategoryDetailClient from '@/app/components/budget/CategoryDetailClient'
import { getCatEmoji } from '@/app/components/budget/catEmoji'
import { visibleTransactionsFilter } from '@/lib/budget/hidden-accounts'

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const user = await getServerUser()
  if (!user) redirect('/login')

  const { data: category } = await supabase
    .from('categories')
    .select('id, name, color, icon, is_income, is_transfer, parent_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as any

  if (!category) notFound()

  // Fetch parent category if this is a sub-category
  let parentCategory = null
  if (category.parent_id) {
    const { data: parent } = await supabase
      .from('categories')
      .select('id, name, icon')
      .eq('id', category.parent_id)
      .single() as any
    parentCategory = parent
  }

  // Fetch child categories (so we can include their transactions too)
  const { data: children } = await supabase
    .from('categories')
    .select('id, name, icon, color')
    .eq('parent_id', id)
    .eq('user_id', user.id) as any

  const catIds = [id, ...(children?.map((c: any) => c.id) ?? [])]

  const onlyVisible = await visibleTransactionsFilter(supabase, user.id)

  const PAGE = 1000
  let transactions: any[] = []
  for (let page = 0; ; page++) {
    const { data } = await onlyVisible(supabase
      .from('transactions')
      .select('id, amount, merchant, description, transacted_at, is_pending, owner, account_name')
      .eq('user_id', user.id)
      .in('category_id', catIds)
      // Hidden transactions, and transactions on a hidden account, are excluded
      // from every reporting surface.
      .eq('is_hidden', false)
      .order('transacted_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1)) as any
    if (!data || data.length === 0) break
    transactions = transactions.concat(data)
    if (data.length < PAGE) break
  }

  const emoji = getCatEmoji(category.name, category.icon)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 pt-5 pb-4">
          <Link href={parentCategory ? `/budget/categories/${parentCategory.id}` : '/budget'} className="text-gray-400 hover:text-gray-900 transition p-1 -ml-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <h1 className="text-xl font-bold text-gray-900">{category.name}</h1>
          </div>
        </div>

        {/* Sub-category chips (if parent category with children) */}
        {children && children.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {children.map((child: any) => (
              <Link
                key={child.id}
                href={`/budget/categories/${child.id}`}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-gray-400 transition shadow-sm"
              >
                {getCatEmoji(child.name, child.icon)} {child.name}
              </Link>
            ))}
          </div>
        )}

        <CategoryDetailClient
          category={category}
          transactions={transactions ?? []}
          parentCategory={parentCategory}
        />
      </div>
    </div>
  )
}
