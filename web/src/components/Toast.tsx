import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  onAction: () => void
}

interface ToastState {
  id: number
  message: string
  action?: ToastAction
}

const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null)

const AUTO_DISMISS_MS = 6000

/**
 * Retour visuel bref, avec au plus UNE action - « Annuler » en pratique.
 * <p>
 * Volontairement minimal : un seul message à la fois (un nouveau remplace le
 * précédent), disparition automatique, aucune file d'attente. L'app n'avait
 * aucun mécanisme de feedback jusqu'ici ; celui-ci n'existe que parce qu'une
 * écriture réversible doit pouvoir proposer son annulation immédiatement après
 * coup, sans transformer chaque action en boîte de dialogue.
 * <p>
 * Règle : ne JAMAIS afficher « Annuler » si l'annulation ne restaure pas
 * réellement l'état. Un bouton décoratif serait pire que pas de bouton.
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
          // Au-dessus de la barre du pouce en mobile (voir TabBar), en bas à
          // gauche en desktop où rien ne masque cette zone.
          className="fixed inset-x-4 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] z-[60] flex items-center gap-3 rounded-xl bg-surface2 p-3 shadow-token-elevated md:inset-x-auto md:bottom-6 md:left-6 md:w-[360px]"
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
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accentText underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** Affiche un message bref. Hors d'un ToastProvider, ne fait rien plutôt que de
 * lever - un retour visuel manquant ne doit jamais casser une écriture qui,
 * elle, a réussi. */
export function useToast() {
  return useContext(ToastContext) ?? (() => {})
}
