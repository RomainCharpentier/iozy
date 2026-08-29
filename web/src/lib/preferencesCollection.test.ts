/**
 * <b>Un réglage retenu d'une visite à l'autre, et qui survit à ce qu'il relit.</b>
 *
 * Ces préférences viennent du `localStorage` : une donnée que l'app ne contrôle
 * pas: écrite par une version précédente, tronquée, éditée à la main, ou
 * simplement refusée par le navigateur en navigation privée. Deux règles en
 * découlent, et les deux se cassent en silence - l'écran s'ouvre juste sur le
 * mauvais filtre :
 * <ul>
 *   <li>la validation est faite <b>champ par champ</b> : un réglage ajouté plus
 *       tard, ou corrompu, ne doit pas faire retomber les autres sur leur
 *       défaut ;</li>
 *   <li>écrire ne remplace que ce qu'on nomme - `definir({ tri })` ne doit pas
 *       effacer le filtre en cours.</li>
 * </ul>
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { definirPreferencesCollection, usePreferencesCollection } from './preferencesCollection'
import { act, renderHook } from '@testing-library/react'

const CLE = 'iozycore.preferencesCollection'

function lireBrut(): unknown {
  return JSON.parse(localStorage.getItem(CLE) ?? 'null')
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('la lecture', () => {
  it('ouvre sur « tout / groupée / récent » quand rien n’a jamais été choisi', () => {
    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout', vue: 'groupee', tri: 'recent' })
  })

  it('relit ce qui a été choisi', () => {
    localStorage.setItem(CLE, JSON.stringify({ filtre: 'envies', vue: 'plate', tri: 'titre' }))

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'envies', vue: 'plate', tri: 'titre' })
  })

  it('ne laisse pas un champ corrompu emporter les autres', () => {
    // Le cas d'un réglage renommé entre deux versions : « grille » n'existe
    // plus, mais le filtre et le tri choisis, eux, sont toujours valides.
    localStorage.setItem(CLE, JSON.stringify({ filtre: 'possedes', vue: 'grille', tri: 'titre' }))

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'possedes', vue: 'groupee', tri: 'titre' })
  })

  it('survit à un contenu qui n’est même pas du JSON', () => {
    localStorage.setItem(CLE, '{ceci nest pas du json')

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout', vue: 'groupee', tri: 'recent' })
  })

  it('survit à un JSON valide qui n’est pas un objet', () => {
    localStorage.setItem(CLE, '"envies"')

    const { result } = renderHook(() => usePreferencesCollection())

    expect(result.current).toMatchObject({ filtre: 'tout' })
  })
})

describe('l’écriture', () => {
  it('ne remplace que ce qu’on nomme', () => {
    definirPreferencesCollection({ filtre: 'envies' })
    definirPreferencesCollection({ tri: 'titre' })

    expect(lireBrut()).toEqual({ filtre: 'envies', vue: 'groupee', tri: 'titre' })
  })

  it('met à jour les écrans déjà ouverts, sans rechargement', () => {
    // Ma collection et la vue d'une catégorie partagent le réglage : elles
    // doivent se suivre, pas repartir chacune de son propre défaut.
    const { result } = renderHook(() => usePreferencesCollection())

    act(() => definirPreferencesCollection({ vue: 'plate' }))

    expect(result.current.vue).toBe('plate')
  })

  it('laisse la page utilisable quand le stockage est refusé', () => {
    // Navigation privée : `setItem` lève. Le comportement voulu est explicite
    // dans le module - la page ne tombe pas, elle oublie simplement le choix.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => usePreferencesCollection())

    expect(() => act(() => result.current.definir({ filtre: 'envies' }))).not.toThrow()
    expect(result.current.filtre).toBe('tout')
  })
})
