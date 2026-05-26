'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import ConfirmModal from './ConfirmModal'

export type ToastType = 'error' | 'success' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ConfirmState {
  message: string
  detail?: string
  resolve: (value: boolean) => void
}

interface ToastContextValue {
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

interface ConfirmContextValue {
  confirm: (message: string, detail?: string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)
const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return {
    toast: {
      error:   (message: string) => ctx.addToast(message, 'error'),
      success: (message: string) => ctx.addToast(message, 'success'),
      info:    (message: string) => ctx.addToast(message, 'info'),
    },
  }
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used inside <ToastProvider>')
  return ctx.confirm
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const counterRef = useRef(0)

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${++counterRef.current}`
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const confirm = useCallback(
    (message: string, detail?: string): Promise<boolean> =>
      new Promise<boolean>(resolve => {
        setConfirmState({ message, detail, resolve })
      }),
    []
  )

  const handleConfirmResolve = useCallback(
    (value: boolean) => {
      confirmState?.resolve(value)
      setConfirmState(null)
    },
    [confirmState]
  )

  const chipClass: Record<ToastType, string> = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    info:    'bg-blue-50 border-blue-200 text-blue-600',
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}
        <div className="fixed top-4 right-4 z-[70] space-y-2 pointer-events-none">
          {toasts.map(t => (
            <ToastChip
              key={t.id}
              toast={t}
              chipClass={chipClass[t.type]}
              onDismiss={removeToast}
            />
          ))}
        </div>
        <ConfirmModal state={confirmState} onResolve={handleConfirmResolve} />
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

function ToastChip({
  toast,
  chipClass,
  onDismiss,
}: {
  toast: Toast
  chipClass: string
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3500)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-md text-sm font-medium border pointer-events-auto ${chipClass}`}>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-1 opacity-60 hover:opacity-100 transition text-current"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
