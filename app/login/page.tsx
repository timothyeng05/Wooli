'use client'

import { useActionState } from 'react'
import { login } from '@/app/auth/actions'
import GoogleSignInButton from '@/app/components/GoogleSignInButton'

export default function LoginPage() {
  const [state, formAction] = useActionState(login, null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-400">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-8 border border-primary-100">
        <h1 className="text-3xl font-bold mb-6 text-primary-600">Wooli</h1>
        <p className="text-gray-600 mb-6">Sign in to your account</p>
        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            className="w-full bg-primary-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-600"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          No account?{' '}
          <a href="/signup" className="text-primary-600 hover:underline font-medium">
            Sign up
          </a>
        </p>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="mt-4">
          <GoogleSignInButton />
        </div>
      </div>
    </div>
  )
}
