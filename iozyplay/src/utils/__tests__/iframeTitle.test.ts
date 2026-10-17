/**
 * Tests anti-triche : le titre de la vidéo ne doit pas rester sur l'iframe YouTube
 */
import {
  GENERIC_PLAYER_TITLE,
  forceGenericIframeTitle,
  guardIframeTitle,
} from '@/utils/iframeTitle'

// Laisse passer les callbacks du MutationObserver (microtâches)
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('forceGenericIframeTitle', () => {
  it("remplace le titre d'une iframe", () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'One Piece OP 1 - We Are! Lyrics')
    forceGenericIframeTitle(iframe)
    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
  })

  it("ignore les éléments qui ne sont pas des iframes, et l'absence d'élément", () => {
    const div = document.createElement('div')
    div.setAttribute('title', 'Garder')
    forceGenericIframeTitle(div)
    forceGenericIframeTitle(null)
    expect(div.getAttribute('title')).toBe('Garder')
  })
})

describe('guardIframeTitle', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('force le titre sur une iframe déjà présente', () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'Titre de la vidéo')
    container.appendChild(iframe)

    const stop = guardIframeTitle(container)
    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    stop()
  })

  it("force le titre sur l'iframe insérée par l'API (remplacement du placeholder)", async () => {
    const placeholder = document.createElement('div')
    container.appendChild(placeholder)
    const stop = guardIframeTitle(container)

    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'YouTube video player')
    placeholder.replaceWith(iframe)
    await flush()

    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    stop()
  })

  it("réapplique le titre générique quand l'API le réécrit (onReady, changement de vidéo)", async () => {
    const iframe = document.createElement('iframe')
    container.appendChild(iframe)
    const stop = guardIframeTitle(container)

    iframe.setAttribute('title', 'One Piece OP 1 - We Are! Lyrics')
    await flush()
    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)

    iframe.setAttribute('title', 'Naruto OP 3')
    await flush()
    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    stop()
  })

  it('force le titre sur une iframe imbriquée insérée plus tard', async () => {
    const stop = guardIframeTitle(container)
    const wrapper = document.createElement('div')
    const iframe = document.createElement('iframe')
    iframe.setAttribute('title', 'Titre de la vidéo')
    wrapper.appendChild(iframe)
    container.appendChild(wrapper)
    await flush()

    expect(iframe.getAttribute('title')).toBe(GENERIC_PLAYER_TITLE)
    stop()
  })

  it("n'agit plus après l'arrêt de la surveillance", async () => {
    const iframe = document.createElement('iframe')
    container.appendChild(iframe)
    const stop = guardIframeTitle(container)
    stop()

    iframe.setAttribute('title', 'Titre de la vidéo')
    await flush()
    expect(iframe.getAttribute('title')).toBe('Titre de la vidéo')
  })

  it('accepte un conteneur absent', () => {
    expect(() => guardIframeTitle(null)()).not.toThrow()
  })
})
