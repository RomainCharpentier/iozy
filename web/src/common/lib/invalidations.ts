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
  queryClient.invalidateQueries({ queryKey: ['insights', 'releases'] })
  queryClient.invalidateQueries({ queryKey: ['ownerships'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
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
}

/** After following or unfollowing a work: the state, the wish it may have removed, and the calendar. */
export function invaliderApresSuivi(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.followedWorks.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  queryClient.invalidateQueries({ queryKey: ['insights', 'releases'] })
}
