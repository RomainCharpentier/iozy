/**
 * <b>Le titre de l'onglet, qui est aussi une annonce d'accessibilité.</b>
 *
 * Les dix-sept routes portaient toutes « IozyCore ». Ce n'était pas qu'une
 * gêne : dans une application d'une seule page, <b>rien n'annonce une
 * navigation à un lecteur d'écran</b> - la page ne se recharge pas. La mise à
 * jour du titre est le remède conventionnel, et elle est donc vérifiée ici
 * comme un comportement, pas comme un détail cosmétique.
 *
 * <p>Le titre est lu depuis le `h1` plutôt que déclaré dans une table
 * route → libellé : deux listes qui divergent, ce dépôt connaît. Trois
 * situations en découlent, et chacune casse en silence : le `h1` est déjà là,
 * il arrive <b>après</b> (page en chargement), ou il n'existe pas.
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

describe('quand le titre est déjà là', () => {
  it('fait suivre le titre du document', () => {
    poser('<main><h1>Berserk</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/entity/berserk'))

    expect(document.title).toBe('Berserk · IozyCore')
  })

  it('lit un h1 hors de <main> - l’espace partagé public vit hors du shell', () => {
    poser('<h1>La collection de Romain</h1>')

    renderHook(() => useDocumentTitleFromHeading('/public/share/jeton'))

    expect(document.title).toBe('La collection de Romain · IozyCore')
  })

  it('normalise les espaces d’un titre écrit sur plusieurs lignes', () => {
    poser('<main><h1>\n  Ma\n  collection\n</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/'))

    expect(document.title).toBe('Ma collection · IozyCore')
  })
})

describe('quand le titre arrive après', () => {
  it('n’affiche pas le titre de la page précédente pendant le chargement', () => {
    // Un squelette sans h1 : garder « Berserk » ferait mentir l'onglet.
    document.title = 'Berserk · IozyCore'
    poser('<main><div>chargement…</div></main>')

    renderHook(() => useDocumentTitleFromHeading('/stats'))

    expect(document.title).toBe('IozyCore')
  })

  it('rattrape le titre dès qu’il apparaît', async () => {
    poser('<main><div>chargement…</div></main>')
    renderHook(() => useDocumentTitleFromHeading('/stats'))

    document.querySelector('main')!.innerHTML = '<h1>Statistiques</h1>'

    await waitFor(() => expect(document.title).toBe('Statistiques · IozyCore'))
  })

  it('ne prend pas « … » pour un titre, et suit le libellé qui le remplace', async () => {
    // Un rayon affiche « … » le temps que le nom de la catégorie arrive, puis
    // React remplace le TEXTE du h1 sans toucher au nœud : l'onglet restait
    // « … · IozyCore » (constaté sur /collection/:id, lot 148).
    poser('<main><h1>…</h1></main>')
    renderHook(() => useDocumentTitleFromHeading('/collection/manga'))

    expect(document.title).toBe('IozyCore')

    document.querySelector('h1')!.firstChild!.nodeValue = 'Manga'

    await waitFor(() => expect(document.title).toBe('Manga · IozyCore'))
  })
})

describe('quand l’écran change sans que l’URL bouge', () => {
  it('suit le nouveau titre - la porte d’authentification est au même endroit', () => {
    // Se connecter remplace tout l'écran sans changer d'URL : sans clé qui en
    // tienne compte, l'onglet garderait « IozyCore » sur la collection.
    poser('<main><h1>IozyCore</h1></main>')
    const { rerender } = renderHook(({ cle }) => useDocumentTitleFromHeading(cle), {
      initialProps: { cle: '/|anonyme' },
    })
    expect(document.title).toBe('IozyCore')

    poser('<main><h1>Ma collection</h1></main>')
    rerender({ cle: '/|connecte' })

    expect(document.title).toBe('Ma collection · IozyCore')
  })

  it('ne suffixe pas le nom de l’application par lui-même', () => {
    poser('<main><h1>IozyCore</h1></main>')

    renderHook(() => useDocumentTitleFromHeading('/'))

    expect(document.title).toBe('IozyCore')
  })
})

describe('quand il n’y a pas de titre du tout', () => {
  it('retombe sur le nom de l’application', () => {
    poser('<main></main>')

    renderHook(() => useDocumentTitleFromHeading('/inconnue'))

    expect(document.title).toBe('IozyCore')
  })

  it('ne laisse pas un observateur derrière lui après démontage', async () => {
    poser('<main></main>')
    const { unmount } = renderHook(() => useDocumentTitleFromHeading('/inconnue'))

    unmount()
    document.querySelector('main')!.innerHTML = '<h1>Trop tard</h1>'

    // Laisse une chance à un observateur resté vivant de se manifester.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(document.title).toBe('IozyCore')
  })
})
