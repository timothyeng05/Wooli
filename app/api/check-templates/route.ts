import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {}
        }
      }
    )

    const { count } = await supabase
      .from('card_templates')
      .select('id', { count: 'exact', head: true })

    return NextResponse.json({
      hasTemplates: (count ?? 0) > 0
    })
  } catch (error) {
    console.error('Check templates error:', error)
    return NextResponse.json({ hasTemplates: false }, { status: 500 })
  }
}
