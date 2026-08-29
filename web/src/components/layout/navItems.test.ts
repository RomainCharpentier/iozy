/**
 * <b>Une seule liste, lue par deux barres — et l'invariant qui le prouve.</b>
 *
 * Les deux barres portaient chacune leur copie, « gardée manuellement
 * synchronisée » : c'est-à-dire garantie de diverger. Dix parcours ont ainsi
 * disparu du mobile sans que rien ne le signale.
 *
 * <p>Le vrai risque restant n'est plus la copie, c'est le <b>surlignage</b> :
 * `activeWhen` est écrit à la main, route par route. Une route oubliée
 * n'allume rien (l'utilisateur ne sait plus où il est), une route trop large
 * en allume deux (il croit être ailleurs). Ce fichier vérifie donc, pour
 * chaque route réelle de l'app, qu'<b>exactement une</b> entrée s'allume.
 */
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './navItems'

/** Les routes réelles, avec la destination qui doit s'allumer sur chacune. */
const ROUTES: [chemin: string, destination: string][] = [
  ['/', '/'],
  ['/entity/berserk', '/'],
  ['/collection/type-manga', '/'],
  ['/add', '/add'],
  ['/scan', '/add'],
  ['/apercu', '/add'],
  ['/discover', '/discover'],
  ['/tier-lists', '/discover'],
  ['/tier-lists/board-1', '/discover'],
  ['/purchase-analysis', '/purchase-analysis'],
  ['/purchase-analysis/history', '/purchase-analysis'],
]

function allumees(pathname: string): string[] {
  return NAV_ITEMS.filter((item) => item.activeWhen(pathname)).map((item) => item.to)
}

describe('le surlignage de la navigation', () => {
  it.each(ROUTES)('%s allume %s, et rien d’autre', (chemin, destination) => {
    expect(allumees(chemin)).toEqual([destination])
  })

  it('n’allume rien sur une route qui n’appartient à aucune destination', () => {
    // Profil, Paramètres, Statistiques : atteints par raccourci, pas par la
    // navigation. Y allumer une destination mentirait sur où l'on est.
    expect(allumees('/profile')).toEqual([])
    expect(allumees('/settings')).toEqual([])
    expect(allumees('/stats')).toEqual([])
  })

  it('ne laisse pas « / » allumer tout ce qui commence par un slash', () => {
    // Le piège classique du préfixe : `startsWith('/')` est vrai partout.
    expect(allumees('/discover')).not.toContain('/')
  })
})

describe('la liste elle-même', () => {
  it('porte quatre destinations, toutes distinctes', () => {
    expect(NAV_ITEMS).toHaveLength(4)
    expect(new Set(NAV_ITEMS.map((item) => item.to)).size).toBe(4)
  })

  it('donne à chaque entrée un libellé court qui tient dans la barre du pouce', () => {
    // Quatre onglets sur 375 px : « Analyser une annonce » n'y entre pas.
    for (const item of NAV_ITEMS) {
      expect(item.labelCourt.length).toBeLessThanOrEqual(item.label.length)
      expect(item.labelCourt.length).toBeLessThanOrEqual(12)
    }
  })

  it('allume chaque entrée sur sa propre route', () => {
    for (const item of NAV_ITEMS) {
      expect(item.activeWhen(item.to)).toBe(true)
    }
  })
})
