'use client'
import type { ReactNode } from 'react'

// Edit surface: a native-feel bottom sheet on mobile (grab handle, sticky
// Cancel/Save header, safe-area padding), a right-side drawer on desktop.
export default function EditPanel({ open, onSave, onCancel, title, children }: {
  open: boolean
  onSave: () => void
  onCancel: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <>
      {/* Backdrop — only on mobile (desktop stays non-modal so other cards remain clickable) */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onSave}
      />
      {/* Sheet / drawer */}
      <div
        className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300
          inset-x-0 bottom-0 h-[85vh] rounded-t-2xl
          lg:inset-y-0 lg:h-auto lg:right-0 lg:left-auto lg:w-[460px] lg:rounded-none
          ${open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Grab handle (mobile) */}
        <div className="lg:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>
        {/* Sticky header: Cancel · title · Save */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
          <button onClick={onCancel} className="text-base sm:text-sm font-medium text-gray-500 px-2 py-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition">
            Cancel
          </button>
          <h2 className="text-base sm:text-sm font-semibold text-gray-800 truncate text-center flex-1">{title ?? 'Edit'}</h2>
          <button onClick={onSave} className="text-base sm:text-sm font-semibold text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition">
            Save
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {open && children}
        </div>
      </div>
    </>
  )
}
