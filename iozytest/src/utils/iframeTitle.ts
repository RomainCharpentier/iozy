/**
 * Anti-triche : masque le titre de la vidéo porté par l'iframe YouTube.
 *
 * L'API IFrame YouTube renseigne l'attribut `title` de l'iframe avec le titre de la vidéo
 * (lisible dans le DOM et l'arbre d'accessibilité), et le réécrit au chargement et à chaque
 * changement de vidéo. On force donc un titre générique, et on le réapplique à chaque mutation.
 */

export const GENERIC_PLAYER_TITLE = 'Lecteur du blindtest'

/**
 * Force le titre générique sur une iframe (sans écriture si déjà correct, pour ne pas boucler)
 */
export function forceGenericIframeTitle(
  iframe: Element | null | undefined,
  title: string = GENERIC_PLAYER_TITLE
): void {
  if (!iframe || iframe.tagName !== 'IFRAME') return
  if (iframe.getAttribute('title') !== title) {
    iframe.setAttribute('title', title)
  }
}

/**
 * Applique le titre générique à toutes les iframes d'un conteneur
 */
function forceOnContainer(container: Element, title: string): void {
  if (container.tagName === 'IFRAME') forceGenericIframeTitle(container, title)
  container.querySelectorAll('iframe').forEach((iframe) => forceGenericIframeTitle(iframe, title))
}

/**
 * Surveille un conteneur : toute iframe insérée, ou dont le `title` change, reçoit le titre
 * générique. Retourne une fonction d'arrêt de la surveillance.
 */
export function guardIframeTitle(
  container: Element | null | undefined,
  title: string = GENERIC_PLAYER_TITLE
): () => void {
  if (!container) return () => {}

  forceOnContainer(container, title)

  if (typeof MutationObserver === 'undefined') return () => {}

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        forceGenericIframeTitle(mutation.target as Element, title)
      } else {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) forceOnContainer(node as Element, title)
        })
      }
    }
  })
  observer.observe(container, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['title'],
  })

  return () => observer.disconnect()
}
