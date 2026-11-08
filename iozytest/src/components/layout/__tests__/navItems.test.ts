import { describe, expect, it } from 'vitest'
import { siteItemsPour } from '@/components/layout/navItems'

/**
 * La barre du site ne montre pas une porte qui renvoie à la connexion :
 * sans compte, seules les pages d'IozyCore ouvertes sans compte restent.
 */
describe('les destinations du site', () => {
  it('sans compte, ne garde que Sorties', () => {
    expect(siteItemsPour(false).map((item) => item.label)).toEqual(['Sorties'])
  })

  it('avec un compte, garde les quatre, et Partager mène au partage du profil', () => {
    const items = siteItemsPour(true)
    expect(items.map((item) => item.label)).toEqual(['Accueil', 'Sorties', 'À acheter', 'Partager'])
    expect(items.find((item) => item.label === 'Partager')?.href).toBe('/core/profile#partage')
  })
})
