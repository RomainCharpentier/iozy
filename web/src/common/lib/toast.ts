import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onAction: () => void
}

/**
 * Le contexte et son hook vivent hors du fichier du composant.
 *
 * Un module qui exporte à la fois un composant et autre chose fait perdre le
 * rafraîchissement à chaud à tout le fichier : éditer `ToastProvider`
 * rechargeait la page entière au lieu de remplacer le composant. Séparer le
 * hook seul n'aurait rien réglé - il lui aurait fallu le contexte, qui est
 * lui aussi un export non-composant. C'est donc le couple contexte + hook qui
 * déménage, et `Toast.tsx` n'exporte plus qu'un composant.
 */
export const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null)

/**
 * Affiche un message bref. Hors d'un `ToastProvider`, ne fait rien plutôt que
 * de lever - un retour visuel manquant ne doit jamais casser une écriture qui,
 * elle, a réussi.
 */
export function useToast() {
  return useContext(ToastContext) ?? (() => {})
}
