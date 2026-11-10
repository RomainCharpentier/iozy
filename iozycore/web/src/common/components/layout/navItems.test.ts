/**
 * <b>A single list, read by two bars - and the invariant that proves it.</b>
 *
 * The real risk is the <b>highlighting</b>: `activeWhen` is written by hand,
 * route by route. A route that is too wide lights two entries (the user thinks
 * they are elsewhere). This file checks, for each real route of the app, that
 * <b>at most one</b> entry lights up, and the right one.
 */
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, destinationsPour } from './navItems'

/** The real routes, with the destination that must light up on each. */
const ROUTES: [chemin: string, destination: string][] = [
  ['/', 'accueil'],
  ['/collection', 'collection'],
  ['/entity/berserk', 'collection'],
  ['/collection/type-manga', 'collection'],
  ['/releases', 'sorties'],
  ['/to-buy', 'acheter'],
  ['/to-buy/analyse', 'acheter'],
  ['/purchase-analysis', 'acheter'],
  ['/purchase-analysis/history', 'acheter'],
  ['/purchase-analysis/history/42', 'acheter'],
  ['/share', 'partager'],
]

function allumees(pathname: string): string[] {
  return NAV_ITEMS.filter((item) => item.activeWhen(pathname)).map((item) => item.cle)
}

describe('the navigation highlighting', () => {
  it.each(ROUTES)('%s lights %s, and nothing else', (chemin, destination) => {
    expect(allumees(chemin)).toEqual([destination])
  })

  it('lights nothing on a route that belongs to no destination', () => {
    // The profile is lit by the avatar, the catalog by nothing: lighting a
    // destination there would lie about where one is.
    expect(allumees('/profile')).toEqual([])
    expect(allumees('/add')).toEqual([])
    expect(allumees('/stats')).toEqual([])
  })

  it('does not let "/" light everything that starts with a slash', () => {
    expect(allumees('/releases')).not.toContain('accueil')
  })
})

describe('the list itself', () => {
  it('carries the destinations of the site, in their order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Accueil', 'Collection', 'Sorties', 'À acheter', 'Partager', 'IozyTest'])
  })

  it('leads to IozyTest by a plain address, outside the router of this app', () => {
    const iozytest = NAV_ITEMS.find((item) => item.cle === 'iozytest')
    expect(iozytest?.href).toBe('/test/')
    expect(iozytest?.to).toBeUndefined()
  })

  it('opens the "Partager" page (lot 217)', () => {
    const partager = NAV_ITEMS.find((item) => item.cle === 'partager')
    expect(partager?.to).toBe('/share')
  })

  it('gives each entry a short label that fits in the thumb bar', () => {
    for (const item of NAV_ITEMS) {
      expect(item.labelCourt.length).toBeLessThanOrEqual(12)
    }
  })
})

describe('the navigation of a visitor', () => {
  it('keeps only what needs no account', () => {
    expect(destinationsPour(true).map((item) => item.cle)).toEqual(['sorties', 'iozytest'])
  })

  it('keeps everything for an account', () => {
    expect(destinationsPour(false)).toHaveLength(6)
  })
})
