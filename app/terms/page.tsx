export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: May 2026</p>

      <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Use of Service</h2>
          <p>Wooli is a personal productivity app. By using this app, you agree to use it only for lawful purposes and in accordance with these terms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Your Data</h2>
          <p>You retain ownership of all data you enter into Wooli. We do not sell, share, or transfer your data to third parties.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Google Services</h2>
          <p>Wooli uses Google OAuth to authenticate users. Use of Google services is subject to <a href="https://policies.google.com/terms" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google's Terms of Service</a>.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Disclaimer</h2>
          <p>This app is provided as-is without warranties of any kind. We are not liable for any loss of data or damages arising from use of the app.</p>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 mb-1">Contact</h2>
          <p>Questions? Email <a href="mailto:woolitravel@gmail.com" className="text-blue-600 hover:underline">woolitravel@gmail.com</a></p>
        </section>
      </div>
    </div>
  )
}
