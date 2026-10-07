import { useQuery } from '@tanstack/react-query'
import { getLatestReleases } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'

export const LATEST_COUNT = 10
const STALE_MS = 5 * 60 * 1000

/**
 * The ten releases with the latest dates, future or past, newest first. The
 * server picks them: there is no period to give, and none to widen.
 */
export function useLatestReleases() {
  return useQuery({
    queryKey: queryKeys.insights.latestReleases,
    queryFn: async () => (await getLatestReleases(LATEST_COUNT)).entries,
    staleTime: STALE_MS,
  })
}
