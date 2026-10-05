import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null && !el.hasAttribute('disabled'),
  )
}

/**
 * Standard keyboard behavior for every `role="dialog"` surface of the app
 * (see DS v1.1, source pattern: Escape closes + gives the focus back to the
 * trigger, Tab stays trapped in the topmost modal surface) -
 * shared rather than reimplemented per component (before this hook, only
 * Escape existed, and not everywhere: `AddTierListItemsPanel`/
 * `CreateTierListModal` did not even have that - see
 * docs/DESIGN_MIGRATION_V1.2.md Batch 9).
 *
 * Two ways to call this hook depending on how the component already manages
 * its visibility:
 * - component always mounted, `open` prop toggles the internal display (see
 *   TierPicker/CollectionFilters): pass the real
 *   boolean.
 * - component only mounted by the parent when open (see
 *   CreateTierListModal/AddTierListItemsPanel, `{open && <Panel .../>}`):
 *   pass `true` unconditionally, the mounting/unmounting already does this
 *   work.
 *
 * `onClose` can be a function recreated at each render (common case,
 * `onClick={() => setX(null)}`) without reattaching the effect each time:
 * read through a ref that is always up to date, the effect only depends on
 * `open`.
 *
 * To give the initial focus to a precise field rather than to the first
 * element in DOM order (see CreateTierListModal, "Nom" must receive the
 * focus, not the Close button that visually precedes it): put
 * `data-modal-initial-focus` on that element, never the React prop
 * `autoFocus` - `autoFocus` calls its own imperative .focus() at commit,
 * before this hook has any chance to act, which races with its own logic
 * (seen when checking this hook live: the double mount of React StrictMode in
 * dev means that a phantom pass makes this concurrent focus downright
 * unpredictable). One single mechanism that sets the initial focus, never two.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const triggerRef = useRef<Element | null>(null)
  const capturedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Captured DURING the render (not in an effect): at the moment THIS render
  // runs, React has not committed the new tree yet - `document.
  // activeElement` still faithfully reflects the external trigger.
  if (open && !capturedRef.current) {
    triggerRef.current = document.activeElement
    capturedRef.current = true
  } else if (!open) {
    capturedRef.current = false
  }

  useEffect(() => {
    if (!open) return

    function focusFirst(): boolean {
      const container = containerRef.current
      if (!container) return false
      const preferred = container.querySelector<HTMLElement>('[data-modal-initial-focus]')
      if (preferred && preferred.offsetParent !== null && !preferred.hasAttribute('disabled')) {
        preferred.focus()
        return true
      }
      const items = focusableElements(container)
      if (items.length === 0) return false
      items[0].focus()
      return true
    }
    // Called without an "only once" guard: `focusFirst` is idempotent (it
    // always targets the same element through `[data-modal-initial-focus]`,
    // never "what currently has focus"), so nothing prevents running it
    // again. It is even necessary to stay correct under React StrictMode
    // (dev): the "phantom" cleanup of its double mount (see below, it brings
    // the focus back to the external trigger) would otherwise move the focus
    // out of the dialog without any second pass to correct it.
    const retryTimer: ReturnType<typeof setTimeout> | undefined = focusFirst() ? undefined : setTimeout(focusFirst, 90)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusableElements(containerRef.current)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const container = containerRef.current
      if (!container || !container.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
        return
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    }
    // Capture (like the mockup): intercepts before a local handler of the
    // content (e.g. an input) consumes the key differently.
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      clearTimeout(retryTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      const trigger = triggerRef.current
      if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus()
    }
  }, [open])

  return containerRef
}
