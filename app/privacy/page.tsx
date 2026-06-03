export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: May 2026</p>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Overview</h2>
          <p>Wooli is a personal productivity app for tracking trips, mood, budgets, and lists. This policy explains what data is accessed and how it is used.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Data Storage</h2>
          <p>App data (trips, mood entries, transactions, lists) is stored in a private Supabase database accessible only to the authenticated user. No data is shared with or sold to third parties.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Contact</h2>
          <p>Questions? Email <a href="mailto:woolitravel@gmail.com" className="text-blue-600 hover:underline">woolitravel@gmail.com</a></p>
        </section>
      </div>
    </div>
  )
}
