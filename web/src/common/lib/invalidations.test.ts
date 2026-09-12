/**
 * <b>Ce qui devient faux quand on ajoute ou retire quelque chose.</b>
 *
 * Cinq écrans recopiaient leur propre liste d'invalidations, et les cinq
 * différaient : au Lot 51, ajouter un tome laissait Ma collection sur l'ancien
 * décompte parce qu'une clé manquait à un endroit sur cinq. Une clé oubliée ne
 * casse rien de visible - l'écran affiche simplement l'état d'avant, ce qui est
 * exactement le genre de bug qu'on met des semaines à croire.
 *
 * <p>Ces tests vérifient donc les <b>préfixes</b>, pas les clés feuilles :
 * `['entities']` doit couvrir la recherche ET chaque fiche. Vérifier
 * `entities.detail(id)` ici enregistrerait le contraire de la règle.
 */
import { describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { invaliderApresEnvie, invaliderApresPossession, invaliderApresSuivi } from './invalidations'
import { queryKeys } from './queryKeys'

/** Un client réduit à ce que ces fonctions lui demandent. */
function clientEspion() {
  const invalidateQueries = vi.fn()
  return {
    client: { invalidateQueries } as unknown as QueryClient,
    /** Les préfixes invalidés, aplatis pour se lire d'un coup d'œil. */
    prefixes: () => invalidateQueries.mock.calls.map(([arg]) => (arg.queryKey as unknown[]).join('/')),
  }
}

describe('après une possession', () => {
  it('invalide le catalogue, les possessions et la progression', () => {
    const { client, prefixes } = clientEspion()

    invaliderApresPossession(client)

    // Posséder l'œuvre d'une pièce retire le suivi (un état à la fois), et le
    // calendrier ne montre que le suivi : les deux deviennent faux aussi.
    expect(prefixes()).toEqual(['entities', 'followedWorks', 'insights/releases', 'ownerships', 'insights/progress'])
  })
})

describe('après une envie', () => {
  it('invalide les envies, le catalogue ET la progression', () => {
    // Une envie posée sur un TOME fait exister ce tome au catalogue : la fiche
    // et la progression changent sans qu'aucune possession n'ait bougé. Le
    // seul `invalidateQueries(wishlist)` d'origine laissait la grille ignorer
    // le tome jusqu'au rechargement.
    const { client, prefixes } = clientEspion()

    invaliderApresEnvie(client)

    // Vouloir l'œuvre entière retire le suivi : le suivi et le calendrier suivent.
    expect(prefixes()).toEqual(['wishlist', 'followedWorks', 'insights/releases', 'entities', 'insights/progress'])
  })
})

describe('les préfixes eux-mêmes', () => {
  it('sont des préfixes, pas des clés feuilles', () => {
    // C'est ce qui permet à un écran de ne pas savoir QUELLES données il
    // touche : `['entities']` emporte la recherche et chaque fiche, et
    // `['insights','progress']` emporte aussi la progression d'une œuvre.
    expect(queryKeys.entities.detail('berserk').slice(0, 1)).toEqual(queryKeys.entities.all)
    expect(queryKeys.entities.search({ q: 'ber' }).slice(0, 1)).toEqual(queryKeys.entities.all)
    expect(queryKeys.insights.progressOf('berserk').slice(0, 2)).toEqual(queryKeys.insights.progress)
  })
})

describe('après un suivi', () => {
  it('invalide le suivi, l’envie qu’il a pu retirer, le catalogue et le calendrier', () => {
    const { client, prefixes } = clientEspion()
    invaliderApresSuivi(client)
    expect(prefixes()).toEqual(['followedWorks', 'wishlist', 'entities', 'insights/releases'])
  })
})
