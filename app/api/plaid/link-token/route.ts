import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { plaidClient } from '@/lib/budget/plaid-client'
import { CountryCode, Products } from 'plaid'

// New-connection Link token by default; pass { item_id } for an update-mode
// token that re-authenticates an existing (broken) item instead.
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const itemId: string | undefined = body?.item_id

  if (itemId) {
    const { data: item } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('item_id', itemId)
      .eq('user_id', user.id)
      .single()
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    // Update mode: pass the access token, no products array.
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: 'Wooli',
      country_codes: [CountryCode.Us],
      language: 'en',
      access_token: item.access_token,
    })
    return NextResponse.json({ link_token: response.data.link_token, update_mode: true })
  }

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: user.id },
    client_name: 'Wooli',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })

  return NextResponse.json({ link_token: response.data.link_token })
}
