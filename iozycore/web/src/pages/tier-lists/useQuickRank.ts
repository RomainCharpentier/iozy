import { useCallback, useState } from 'react'
import type { TierListEntryDto } from '@/common/types/tierList'

/**
 * "Classer rapidement" flow (see DS v1.1 section 50) - chains the UNRANKED
 * works one by one in the same TierPicker as the board, instead of
 * making the user reopen the picker by hand for each one. Shared by the general
 * board and a custom Tier List: only the mutation differs, the
 * queue mechanics are identical.
 * <p>
 * The queue is a SNAPSHOT taken at the start, never the live list:
 * each ranking invalidates the board query, so `unranked` shrinks
 * under our feet - relying on it would skip every other item. The index
 * advances alone, the queue no longer moves until the exit.
 */
export function useQuickRank() {
  // The queue and the position in it, in one state: the screen reads the
  // snapshot as it is, never a ref during a render.
  const [run, setRun] = useState<{ queue: TierListEntryDto[]; index: number } | null>(null)

  const start = useCallback((unranked: TierListEntryDto[]) => {
    if (unranked.length === 0) return
    setRun({ queue: [...unranked], index: 0 })
  }, [])

  const stop = useCallback(() => setRun(null), [])

  /** Moves to the next item, and exits by itself at the end of the queue -
   * "done" and "abandoned" look alike on purpose from the point of view
   * of the caller: in both cases there is nothing left to show. */
  const next = useCallback(() => {
    setRun((current) => {
      if (current === null) return null
      const following = current.index + 1
      return following >= current.queue.length ? null : { queue: current.queue, index: following }
    })
  }, [])

  const isActive = run !== null
  const current = run ? (run.queue[run.index] ?? null) : null

  return {
    isActive,
    current,
    // 1-indexed: it is a counter shown to the user ("3 / 12"), not an index.
    progress: run ? { current: run.index + 1, total: run.queue.length } : null,
    start,
    stop,
    next,
  }
}
