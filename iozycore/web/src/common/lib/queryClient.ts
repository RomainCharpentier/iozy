import { QueryClient } from '@tanstack/react-query'

/**
 * How long a downloaded answer counts as fresh. Within this time, a screen that
 * mounts again or a window that gets the focus back reuses the cache instead of
 * downloading the whole collection again. Writes are not delayed by it: every
 * mutation invalidates the keys it changes (see invalidations.ts), and
 * `invalidateQueries` ignores staleTime. A query that must always be fresh sets
 * its own staleTime (StatsPage uses 0).
 */
export const DEFAULT_STALE_TIME_MS = 30_000

/**
 * The client of the whole app.
 *
 * networkMode 'always': by default, TanStack Query PAUSES any request as soon as
 * navigator.onLine becomes false - the request then stays `pending` with a
 * `paused` fetchStatus, so `isLoading` is false (isLoading = isPending &&
 * isFetching) while no data will ever arrive. The screens fell into their
 * "no data" guard and displayed NOTHING anymore: neither loading nor error (seen
 * on the work detail page, an entirely white screen). This signal is unreliable
 * anyway (navigator.onLine lies as soon as a network interface exists) and of no
 * interest here: the API is reached locally, not at the other end of the
 * Internet. Without a pause, a request fails openly, goes up as `isError`, and
 * the ErrorBanners already in place do their job.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', staleTime: DEFAULT_STALE_TIME_MS },
      mutations: { networkMode: 'always' },
    },
  })
}
