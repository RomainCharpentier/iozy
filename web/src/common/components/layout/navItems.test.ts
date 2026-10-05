/**
 * <b>A single list, read by two bars — and the invariant that proves it.</b>
 *
 * The two bars each carried their copy, "manually kept
 * in sync": which is a guarantee to diverge. Ten flows thus
 * disappeared from mobile without anything flagging it.
 *
 * <p>The real remaining risk is no longer the copy, it is the <b>highlighting</b>:
 * `activeWhen` is written by hand, route by route. A forgotten route
 * lights nothing (the user no longer knows where they are), a route that is too wide
 * lights two (they think they are elsewhere). This file therefore checks, for
 * each real route of the app, that <b>exactly one</b> entry lights up.
 */
import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './navItems'

/** The real routes, with the destination that must light up on each. */
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
  ['/suggestions', '/discover'],
  ['/releases', '/discover'],
  // The analysis of a listing left the bar (batch 137): it opens from
  // Discover, and it is Discover that lights up.
  ['/purchase-analysis', '/discover'],
  ['/purchase-analysis/history', '/discover'],
]

function allumees(pathname: string): string[] {
  return NAV_ITEMS.filter((item) => item.activeWhen(pathname)).map((item) => item.to)
}

describe('the navigation highlighting', () => {
  it.each(ROUTES)('%s lights %s, and nothing else', (chemin, destination) => {
    expect(allumees(chemin)).toEqual([destination])
  })

  it('lights nothing on a route that belongs to no destination', () => {
    // Profile, Settings, Statistics: reached by shortcut, not by the
    // navigation. Lighting a destination there would lie about where one is.
    expect(allumees('/profile')).toEqual([])
    expect(allumees('/settings')).toEqual([])
    expect(allumees('/stats')).toEqual([])
  })

  it('does not let "/" light everything that starts with a slash', () => {
    // The classic prefix trap: `startsWith('/')` is true everywhere.
    expect(allumees('/discover')).not.toContain('/')
  })
})

describe('the list itself', () => {
  it('carries three destinations, all distinct, and none names a universe', () => {
    expect(NAV_ITEMS).toHaveLength(3)
    expect(new Set(NAV_ITEMS.map((item) => item.to)).size).toBe(3)
    expect(NAV_ITEMS.map((item) => item.to)).not.toContain('/purchase-analysis')
  })

  it('gives each entry a short label that fits in the thumb bar', () => {
    // On 375 px: "Ma collection" becomes "Collection" there.
    for (const item of NAV_ITEMS) {
      expect(item.labelCourt.length).toBeLessThanOrEqual(item.label.length)
      expect(item.labelCourt.length).toBeLessThanOrEqual(12)
    }
  })

  it('lights each entry on its own route', () => {
    for (const item of NAV_ITEMS) {
      expect(item.activeWhen(item.to)).toBe(true)
    }
  })
})
