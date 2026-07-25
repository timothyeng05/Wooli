import { redirect } from 'next/navigation'

export default async function BudgetSettingsPage() {
  redirect('/budget/settings/categories')
}
