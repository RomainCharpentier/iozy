import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getReleaseRefreshStatus, startReleaseRefresh } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'

const POLL_MS = 2000

/**
 * When the release dates were last refreshed, and the launch of a new pass.
 *
 * <p>The pass runs in the background on the server: while it runs the status is
 * read again every couple of seconds, and when it ends the release lists are
 * read again, so the dates it found show up without a reload.
 */
export function useReleaseRefresh() {
  const queryClient = useQueryClient()

  const status = useQuery({
    queryKey: queryKeys.insights.releaseRefresh,
    queryFn: getReleaseRefreshStatus,
    refetchInterval: (query) => (query.state.data?.running ? POLL_MS : false),
  })

  const launch = useMutation({
    mutationFn: startReleaseRefresh,
    onSuccess: (next) => queryClient.setQueryData(queryKeys.insights.releaseRefresh, next),
    // A pass already running (409) is not a failure to show: read the real state.
    onError: () => queryClient.invalidateQueries({ queryKey: queryKeys.insights.releaseRefresh }),
  })

  const running = status.data?.running ?? false
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: ['insights', 'releases'] })
    }
    wasRunning.current = running
  }, [running, queryClient])

  return { status: status.data ?? null, launch }
}
