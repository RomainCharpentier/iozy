import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = 'button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])'

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => el.offsetParent !== null && !el.hasAttribute('disabled'),
  )
}

/**
 * Comportement clavier standard pour toute surface `role="dialog"` de l'app
 * (voir DS v1.1, pattern source : Escape ferme + rend le focus au
 * déclencheur, Tab reste piégé dans la surface modale la plus haute) -
 * partagé plutôt que réimplémenté par composant (avant ce hook, seul
 * l'Escape existait, et pas partout : `AddTierListItemsPanel`/
 * `CreateTierListModal` n'avaient même pas ça - voir
 * docs/DESIGN_MIGRATION_V1.2.md Lot 9).
 *
 * Deux façons d'appeler ce hook selon comment le composant gère déjà sa
 * visibilité :
 * - composant toujours monté, prop `open` bascule l'affichage interne (voir
 *   TierPicker/CollectionFilters) : passer le vrai
 *   booléen.
 * - composant seulement monté par le parent quand ouvert (voir
 *   CreateTierListModal/AddTierListItemsPanel, `{open && <Panel .../>}`) :
 *   passer `true` sans condition, le montage/démontage fait déjà ce travail.
 *
 * `onClose` peut être une fonction recréée à chaque rendu (cas courant,
 * `onClick={() => setX(null)}`) sans réattacher l'effet à chaque fois : lu
 * via une ref toujours à jour, l'effet ne dépend que d'`open`.
 *
 * Pour donner le focus initial à un champ précis plutôt qu'au premier élément
 * dans l'ordre du DOM (voir CreateTierListModal, "Nom" doit recevoir le focus,
 * pas le bouton Fermer qui le précède visuellement) : poser `data-modal-initial-focus`
 * sur cet élément, jamais le prop React `autoFocus` - `autoFocus` appelle son
 * propre .focus() impératif au commit, avant que ce hook n'ait la moindre
 * chance d'agir, ce qui entre en course avec sa propre logique (constaté en
 * vérifiant ce hook en direct : le double montage de React StrictMode en dev
 * fait qu'une passe fantôme rend ce focus concurrent au comportement carrément
 * imprévisible). Un seul mécanisme qui pose le focus initial, jamais deux.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const triggerRef = useRef<Element | null>(null)
  const capturedRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Capturé PENDANT le rendu (pas dans un effet) : au moment où CE rendu
  // s'exécute, React n'a pas encore commité le nouvel arbre - `document.
  // activeElement` reflète encore fidèlement le déclencheur externe.
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
    // Appelé sans garde "une seule fois" : `focusFirst` est idempotent (elle
    // cible toujours le même élément via `[data-modal-initial-focus]`, jamais
    // "ce qui est focus actuellement"), donc rien n'empêche de la relancer.
    // C'est même nécessaire pour rester correct sous React StrictMode (dev) :
    // le nettoyage "fantôme" de son double montage (voir plus bas, il ramène
    // le focus au déclencheur externe) déplacerait sinon le focus hors du
    // dialog sans qu'aucune seconde passe ne le corrige.
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
    // Capture (comme la maquette) : intercepte avant qu'un handler local du
    // contenu (ex: un input) ne consomme la touche différemment.
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
