import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastAction } from '@/common/lib/toast'

interface ToastState {
  id: number
  message: string
  action?: ToastAction
}

const AUTO_DISMISS_MS = 6000

/**
 * Brief visual feedback, with at most ONE action - "Annuler" in practice.
 * <p>
 * Deliberately minimal: one message at a time (a new one replaces the
 * previous one), automatic disappearance, no queue. The app had
 * no feedback mechanism until now; this one only exists because a reversible
 * write must be able to offer its cancellation right after
 * the fact, without turning every action into a dialog box.
 * <p>
 * Rule: NEVER display "Annuler" if the cancellation does not really restore
 * the state. A decorative button would be worse than no button.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = useRef(0)

  const show = useCallback((message: string, action?: ToastAction) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    nextId.current += 1
    setToast({ id: nextId.current, message, action })
  }, [])

  useEffect(() => {
    if (!toast) return
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast])

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          // Above the thumb bar on mobile (see TabBar), at the bottom
          // left on desktop where nothing hides this area.
          className="entree-douce fixed inset-x-4 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-[60] flex items-center gap-3 rounded-xl bg-surface2 p-3 shadow-token-elevated ring-1 ring-line md:inset-x-auto md:bottom-6 md:left-6 md:w-[360px]"
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 flex-1 text-sm text-textPrimary">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onAction()
                setToast(null)
              }}
              // 44 px like everywhere else. This button never shows up in
              // an automatic sweep - the toast is only in the DOM for
              // a few seconds - and it still carried py-1.5, which is 34 px.
              className="flex min-h-11 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold text-accentText underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
