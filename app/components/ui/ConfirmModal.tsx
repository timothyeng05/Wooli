'use client'

import { useEffect } from 'react'

interface ConfirmState {
  message: string
  detail?: string
  resolve: (value: boolean) => void
}

interface Props {
  state: ConfirmState | null
  onResolve: (value: boolean) => void
}

export default function ConfirmModal({ state, onResolve }: Props) {
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResolve(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, onResolve])

  if (!state) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/40"
        onClick={() => onResolve(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-[81] bg-white shadow-xl bottom-0 left-0 right-0 rounded-t-2xl px-6 pt-5 pb-8 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:right-auto md:w-full md:max-w-sm md:rounded-2xl md:px-8 md:py-7"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
        <h2 className="text-base font-semibold text-gray-900 leading-snug">{state.message}</h2>
        {state.detail && (
          <p className="mt-1.5 text-sm text-gray-500">{state.detail}</p>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onResolve(false)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(true)}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  )
}
