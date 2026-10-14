/**
 * <b>The boundary of a visit, as it is really computed.</b>
 *
 * This list is read in three places that do not talk to each other - the
 * routing, the two navigation bars, the header shortcuts. A loose comparison
 * would be hard to notice there: one screen too many would stay offered to a
 * visitor (and would bounce without a word), one screen too few would
 * disappear for an ordinary account, on paths that nobody thinks to reopen.
 */
import { describe, expect, it } from 'vitest'
import { estReserveeAuxComptes } from './accesInvite'

describe('what a visit cannot reach', () => {
  it('closes the screens whose subject is to write', () => {
    expect(estReserveeAuxComptes('/scan')).toBe(true)
    expect(estReserveeAuxComptes('/import-bgg')).toBe(true)
    expect(estReserveeAuxComptes('/import-photo')).toBe(true)
    // Each step of an analysis is a POST, and some of them go out to a
    // provider or to a model: a door open to the whole Internet must not
    // offer that.
    expect(estReserveeAuxComptes('/purchase-analysis')).toBe(true)
    expect(estReserveeAuxComptes('/purchase-analysis/history')).toBe(true)
  })

  it('closes the tools of the instance and the account itself', () => {
    expect(estReserveeAuxComptes('/administration')).toBe(true)
    expect(estReserveeAuxComptes('/administration/comptes')).toBe(true)
    expect(estReserveeAuxComptes('/types/new')).toBe(true)
    expect(estReserveeAuxComptes('/profile')).toBe(true)
    expect(estReserveeAuxComptes('/settings')).toBe(true)
  })

  it('leaves the CATALOG open, which is what a visitor comes to see', () => {
    // `/add` is no longer an add screen: it is the entry of the catalog, and
    // the fallback destination of the routing for a visitor. Closing it would
    // make the redirect loop on itself.
    expect(estReserveeAuxComptes('/add')).toBe(false)
    expect(estReserveeAuxComptes('/entity/abc-123')).toBe(false)
    expect(estReserveeAuxComptes('/collection/manga')).toBe(false)
  })

  it('leaves the preview open, where an ISBN found from the catalog leads', () => {
    // Closed, the guard sent the visitor back to `/add` without a word, and
    // the work the lookup had just found was lost.
    expect(estReserveeAuxComptes('/apercu')).toBe(false)
  })

  it('closes "Ma collection", which is a PERSONAL space', () => {
    // It only shows what one owns or wishes: it would be empty for a visitor,
    // and its title would speak of a collection that they do not have.
    expect(estReserveeAuxComptes('/')).toBe(true)
    // Without making "/" a prefix that would swallow everything else.
    expect(estReserveeAuxComptes('/add')).toBe(false)
    expect(estReserveeAuxComptes('/entity/abc')).toBe(false)
  })

  it('closes what is COMPUTED on a collection, and would therefore be empty', () => {
    // A visit session names no owner: these screens would be exact and
    // empty - zeros and lists with nothing in them, which read as a failure
    // rather than as an answer.
    expect(estReserveeAuxComptes('/discover')).toBe(true)
    expect(estReserveeAuxComptes('/tier-lists/general/manga')).toBe(true)
    expect(estReserveeAuxComptes('/stats')).toBe(true)
    expect(estReserveeAuxComptes('/recap')).toBe(true)
    expect(estReserveeAuxComptes('/suggestions')).toBe(true)
    expect(estReserveeAuxComptes('/wishlist')).toBe(true)
  })

  it('compares SEGMENTS, not string beginnings', () => {
    // Without this nuance, `/types` would close a future `/typesetting` - and
    // the screen would disappear from the navigation with nothing to explain it.
    expect(estReserveeAuxComptes('/typesetting')).toBe(false)
    expect(estReserveeAuxComptes('/scanner-pro')).toBe(false)
  })
})
