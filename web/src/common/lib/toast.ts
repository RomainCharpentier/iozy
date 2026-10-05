import { createContext, useContext } from 'react'

export interface ToastAction {
  label: string
  onAction: () => void
}

/**
 * The context and its hook live outside the component file.
 *
 * A module that exports both a component and something else makes the whole
 * file lose hot refresh: editing `ToastProvider` reloaded the entire page
 * instead of replacing the component. Moving only the hook would have fixed
 * nothing - it would have needed the context, which is also a non-component
 * export. So it is the context + hook pair that moves out, and `Toast.tsx`
 * only exports a component now.
 */
export const ToastContext = createContext<((message: string, action?: ToastAction) => void) | null>(null)

/**
 * Shows a brief message. Outside a `ToastProvider`, does nothing rather than
 * throwing - a missing visual feedback must never break a write that, for
 * its part, succeeded.
 */
export function useToast() {
  return useContext(ToastContext) ?? (() => {})
}
