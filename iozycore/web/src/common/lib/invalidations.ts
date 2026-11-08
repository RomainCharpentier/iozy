import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/**
 * What becomes wrong when an OWNERSHIP or a WISH changes.
 *
 * <h2>Why a function rather than a copied list</h2>
 * Five places wrote their own list of invalidations after an add or a
 * removal, and the five differed: one forgot the search, another the detail
 * of the page, a third carried the comment "added here to align with
 * OwnershipDetails" - a component that has since been deleted. Aligning by
 * hand is a promise that no screen can keep: in Batch 51, adding a volume
 * left Ma collection on the old count, precisely because a key was missing in
 * one place out of five.
 *
 * <h2>Three prefixes, and nothing else to remember</h2>
 * The keys are hierarchical: `['entities']` covers the search
 * (`entities.search`) AND each detail page (`entities.detail`); `['ownerships']`
 * covers those of a work and the full list; `['insights','progress']`
 * covers the progress of the whole collection and the one of a detail page
 * (`progressOf`, see Batch 60). A screen therefore no longer has to know WHICH
 * data it touches - only that it touched what we own.
 *
 * <p>Invalidating widely does not cost one more call: React Query only
 * downloads the ACTIVE queries again, that is, what is on the screen.
 */
export function invaliderApresPossession(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  // Owning the work of a piece removes the follow (one state at a time).
  queryClient.invalidateQueries({ queryKey: queryKeys.followedWorks.all })
  queryClient.invalidateQueries({ queryKey: ['ownerships'] })
  // The whole `insights` prefix: progress and calendar, but also stats, value,
  // timeline, recap and discover. They all count what we own, and with a
  // staleTime they would no longer refresh on the next mount.
  queryClient.invalidateQueries({ queryKey: ['insights'] })
  // What is missing to complete a series changes with what we own.
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.nearCompleteSuggestions })
  // A work, its elements, the list and the summary all count what we own.
  queryClient.invalidateQueries({ queryKey: queryKeys.works.all })
  // What to buy and what was spent this month (batch 216).
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all })
}

/**
 * A wish placed on a VOLUME makes this volume exist in the catalog (see
 * TomeResolver on the server side): the detail page and the progress
 * therefore change, without any ownership having moved. This is what the
 * original single `invalidateQueries(wishlist)` let through - the volume
 * appeared in the wishes, but the grid kept ignoring it until a reload.
 */
export function invaliderApresEnvie(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  // Wanting the whole work removes the follow, and the calendar only shows the follow.
  queryClient.invalidateQueries({ queryKey: queryKeys.followedWorks.all })
  queryClient.invalidateQueries({ queryKey: ['insights', 'releases'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
  // A wished element changes state, and the list holds the wished works.
  queryClient.invalidateQueries({ queryKey: queryKeys.works.all })
  // A wish is a line to buy (batch 216).
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases.toBuy })
}

/**
 * After a purchase analysis: the server saves it in the history and records
 * the market prices it read. Without this, the history list stays on the old
 * state for the whole staleTime (see queryClient.ts).
 */
export function invalidateAfterPurchaseAnalysis(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.history })
  queryClient.invalidateQueries({ queryKey: ['purchaseAnalysis', 'marketObservations'] })
  invalidateCostToComplete(queryClient)
}

/** After recording a market price by hand: the observations of that edition. */
export function invalidateAfterMarketObservation(queryClient: QueryClient, mangaEditionId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.marketObservations(mangaEditionId) })
  invalidateCostToComplete(queryClient)
}

/** The cost to complete a series is estimated from the observed prices. */
function invalidateCostToComplete(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['purchaseAnalysis', 'completeness'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.nearCompleteSuggestions })
}

/** After following or unfollowing a work: the state, the wish it may have removed, and the calendar. */
export function invaliderApresSuivi(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.followedWorks.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  queryClient.invalidateQueries({ queryKey: ['insights', 'releases'] })
  // Following removes the wish for the work: its wished count and its place in the list change.
  queryClient.invalidateQueries({ queryKey: queryKeys.works.all })
  // The removed wish was a line to buy.
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases.toBuy })
}

/**
 * After the collector says where they stand with a work (ongoing, paused,
 * dropped): its missing count changes, so does every list that reads it
 * (the work, the list of works, the "to buy" page).
 */
export function invalidateAfterCollectorStatus(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.works.all })
  // A paused or dropped work no longer counts in what to buy.
  queryClient.invalidateQueries({ queryKey: queryKeys.purchases.toBuy })
}
