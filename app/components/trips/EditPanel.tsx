'use client'
import type { ReactNode } from 'react'

// Slide-out edit panel: right-side drawer on desktop, bottom sheet on mobile.
export default function EditPanel({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`fixed z-50 bg-white shadow-2xl flex flex-col transition-transform duration-300
          inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl
          lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[460px] lg:max-h-none lg:rounded-none
          ${open ? 'translate-y-0 lg:translate-x-0' : 'translate-y-full lg:translate-y-0 lg:translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 truncate">{title ?? 'Edit'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1" aria-label="Close">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{open && children}</div>
      </div>
    </>
  )
}
