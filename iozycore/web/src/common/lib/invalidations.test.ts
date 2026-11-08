/**
 * <b>What becomes wrong when something is added or removed.</b>
 *
 * Five screens copied their own list of invalidations, and the five
 * differed: in Batch 51, adding a volume left Ma collection on the old count
 * because a key was missing in one place out of five. A forgotten key breaks
 * nothing visible - the screen simply shows the previous state, which is
 * exactly the kind of bug that takes weeks to believe.
 *
 * <p>These tests therefore check the <b>prefixes</b>, not the leaf keys:
 * `['entities']` must cover the search AND each detail page. Checking
 * `entities.detail(id)` here would record the opposite of the rule.
 */
import { describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import {
  invalidateAfterMarketObservation,
  invalidateAfterPurchaseAnalysis,
  invaliderApresEnvie,
  invaliderApresPossession,
  invaliderApresSuivi,
} from './invalidations'
import { queryKeys } from './queryKeys'

/** A client reduced to what these functions ask of it. */
function clientEspion() {
  const invalidateQueries = vi.fn()
  return {
    client: { invalidateQueries } as unknown as QueryClient,
    /** The invalidated prefixes, flattened to be read at a glance. */
    prefixes: () => invalidateQueries.mock.calls.map(([arg]) => (arg.queryKey as unknown[]).join('/')),
  }
}

describe('after an ownership', () => {
  it('invalidates the catalog, the ownerships and the progress', () => {
    const { client, prefixes } = clientEspion()

    invaliderApresPossession(client)

    // Owning the work of a piece removes the follow (one state at a time), and
    // the calendar only shows the follow: both become wrong too. Every insight
    // (stats, value, timeline...) counts what we own, and so do the series
    // that are near complete.
    expect(prefixes()).toEqual([
      'entities',
      'followedWorks',
      'ownerships',
      'insights',
      'purchaseAnalysis/nearCompleteSuggestions',
      'works',
    ])
    expect(queryKeys.insights.value.slice(0, 1)).toEqual(['insights'])
    expect(queryKeys.insights.stats.slice(0, 1)).toEqual(['insights'])
  })
})

describe('after a wish', () => {
  it('invalidates the wishes, the catalog AND the progress', () => {
    // A wish placed on a VOLUME makes this volume exist in the catalog: the
    // detail page and the progress change without any ownership having moved.
    // The original single `invalidateQueries(wishlist)` let the grid ignore
    // the volume until a reload.
    const { client, prefixes } = clientEspion()

    invaliderApresEnvie(client)

    // Wanting the whole work removes the follow: the follow and the calendar follow.
    expect(prefixes()).toEqual([
      'wishlist',
      'followedWorks',
      'insights/releases',
      'entities',
      'insights/progress',
      'works',
    ])
  })
})

describe('the prefixes themselves', () => {
  it('are prefixes, not leaf keys', () => {
    // This is what lets a screen not know WHICH data it touches:
    // `['entities']` carries the search and each detail page, and
    // `['insights','progress']` also carries the progress of a work.
    expect(queryKeys.entities.detail('berserk').slice(0, 1)).toEqual(queryKeys.entities.all)
    expect(queryKeys.entities.search({ q: 'ber' }).slice(0, 1)).toEqual(queryKeys.entities.all)
    expect(queryKeys.insights.progressOf('berserk').slice(0, 2)).toEqual(queryKeys.insights.progress)
    // `['works']` carries one work, the list and the summary.
    expect(queryKeys.works.detail('berserk').slice(0, 1)).toEqual(queryKeys.works.all)
    expect(queryKeys.works.list.slice(0, 1)).toEqual(queryKeys.works.all)
    expect(queryKeys.works.summary.slice(0, 1)).toEqual(queryKeys.works.all)
  })
})

describe('after a follow', () => {
  it('invalidates the follow, the wish it may have removed, the catalog and the calendar', () => {
    const { client, prefixes } = clientEspion()
    invaliderApresSuivi(client)
    expect(prefixes()).toEqual(['followedWorks', 'wishlist', 'entities', 'insights/releases', 'works'])
  })
})

describe('after a purchase analysis', () => {
  it('invalidates the history and every market observation', () => {
    const { client, prefixes } = clientEspion()
    invalidateAfterPurchaseAnalysis(client)
    // The server saves the analysis AND the prices it read from the listing.
    // The cost to complete a series is estimated from those prices.
    expect(prefixes()).toEqual([
      'purchaseAnalysis/history',
      'purchaseAnalysis/marketObservations',
      'purchaseAnalysis/completeness',
      'purchaseAnalysis/nearCompleteSuggestions',
    ])
    expect(queryKeys.purchaseAnalysis.marketObservations('ed-1').slice(0, 2)).toEqual(['purchaseAnalysis', 'marketObservations'])
    expect(queryKeys.purchaseAnalysis.completeness('Berserk', 'Deluxe', [1]).slice(0, 2)).toEqual([
      'purchaseAnalysis',
      'completeness',
    ])
  })
})

describe('after a market observation', () => {
  it('invalidates the observations of that edition and the cost to complete', () => {
    const { client, prefixes } = clientEspion()
    invalidateAfterMarketObservation(client, 'ed-1')
    expect(prefixes()).toEqual([
      'purchaseAnalysis/marketObservations/ed-1',
      'purchaseAnalysis/completeness',
      'purchaseAnalysis/nearCompleteSuggestions',
    ])
  })
})
