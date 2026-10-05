/**
 * <b>The tab title, which is also an accessibility announcement.</b>
 *
 * The seventeen routes all carried "IozyCore". It was not only an
 * annoyance: in a single-page application, <b>nothing announces a
 * navigation to a screen reader</b> - the page does not reload. Updating the
 * title is the conventional remedy, and it is therefore checked here as a
 * behavior, not as a cosmetic detail.
 *
 * <p>The title is read from the `h1` rather than declared in a
 * route → label table: this repository knows two lists that diverge. Three
 * situations follow from it, and each one breaks silently: the `h1` is
 * already there, it arrives <b>after</b> (page loading), or it does not
 * exist.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useDocumentTitleFromHeading } from './useDocumentTitle'

function poser(html: string) {
  document.body.innerHTML = html
}

beforeEach(() => {
  document.title = 'IozyCore'
  document.body.innerHTML = ''
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('when the title is already there', () => {
  it('makes the document title follow', () => {
    poser('<main><h1>Berserk</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/entity/berserk'))

    expect(document.title).toBe('Berserk · IozyCore')
  })

  it('reads an h1 outside <main> - the public shared space lives outside the shell', () => {
    poser('<h1>La collection de Romain</h1>')

    renderHook(() => useDocumentTitleFromHeading('/public/share/jeton'))

    expect(document.title).toBe('La collection de Romain · IozyCore')
  })

  it('normalizes the spaces of a title written on several lines', () => {
    poser('<main><h1>\n  Ma\n  collection\n</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/'))

    expect(document.title).toBe('Ma collection · IozyCore')
  })
})

describe('when the title arrives after', () => {
  it('does not show the title of the previous page during loading', () => {
    // A skeleton without an h1: keeping "Berserk" would make the tab lie.
    document.title = 'Berserk · IozyCore'
    poser('<main><div>chargement…</div></main>')

    renderHook(() => useDocumentTitleFromHeading('/stats'))

    expect(document.title).toBe('IozyCore')
  })

  it('catches the title as soon as it appears', async () => {
    poser('<main><div>chargement…</div></main>')
    renderHook(() => useDocumentTitleFromHeading('/stats'))

    document.querySelector('main')!.innerHTML = '<h1>Statistiques</h1>'

    await waitFor(() => expect(document.title).toBe('Statistiques · IozyCore'))
  })

  it('does not take "…" for a title, and follows the label that replaces it', async () => {
    // A shelf displays "…" while the name of the category arrives, then
    // React replaces the TEXT of the h1 without touching the node: the tab
    // stayed "… · IozyCore" (seen on /collection/:id, batch 148).
    poser('<main><h1>…</h1></main>')
    renderHook(() => useDocumentTitleFromHeading('/collection/manga'))

    expect(document.title).toBe('IozyCore')

    document.querySelector('h1')!.firstChild!.nodeValue = 'Manga'

    await waitFor(() => expect(document.title).toBe('Manga · IozyCore'))
  })
})

describe('when the screen changes without the URL moving', () => {
  it('follows the new title - the authentication gate is in the same place', () => {
    // Signing in replaces the whole screen without changing the URL: without
    // a key that takes it into account, the tab would keep "IozyCore" on the
    // collection.
    poser('<main><h1>IozyCore</h1></main>')
    const { rerender } = renderHook(({ cle }) => useDocumentTitleFromHeading(cle), {
      initialProps: { cle: '/|anonyme' },
    })
    expect(document.title).toBe('IozyCore')

    poser('<main><h1>Ma collection</h1></main>')
    rerender({ cle: '/|connecte' })

    expect(document.title).toBe('Ma collection · IozyCore')
  })

  it('does not suffix the name of the application with itself', () => {
    poser('<main><h1>IozyCore</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/'))

    expect(document.title).toBe('IozyCore')
  })
})

describe('when there is no title at all', () => {
  it('falls back on the name of the application', () => {
    poser('<main></main>')

    renderHook(() => useDocumentTitleFromHeading('/inconnue'))

    expect(document.title).toBe('IozyCore')
  })

  it('does not leave an observer behind after unmount', async () => {
    poser('<main></main>')
    const { unmount } = renderHook(() => useDocumentTitleFromHeading('/inconnue'))

    unmount()
    document.querySelector('main')!.innerHTML = '<h1>Trop tard</h1>'

    // Gives a chance to an observer that stayed alive to show itself.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.title).toBe('IozyCore')
  })
})
