import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, destinationLabelFor } from '@/components/layout/navItems'

/**
 * IozyTest est une app voisine d'IozyCore (lot 234) : sa barre ne montre que
 * ses destinations, jamais celles de la collection, qu'on rejoint par la marque.
 */
describe('les destinations de l’app', () => {
  it('ne sont que les siennes : jouer, et l’éditeur qui nourrit le jeu', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Jouer', 'Éditeur'])
    expect(NAV_ITEMS.every((item) => !item.to.startsWith('/core'))).toBe(true)
  })

  it('allument « Jouer » sur les thèmes et le salon', () => {
    const jouer = NAV_ITEMS.find((item) => item.label === 'Jouer')!
    expect(['/', '/categories', '/room/create'].every((p) => jouer.activeWhen(p))).toBe(true)
    expect(jouer.activeWhen('/editor')).toBe(false)
  })

  it('nomment la destination d’un lien retour', () => {
    expect(destinationLabelFor('/editor/import-video')).toEqual({ to: '/editor', label: 'Éditeur' })
    expect(destinationLabelFor('/settings')).toEqual({ to: '/settings', label: 'Réglages' })
  })
})
