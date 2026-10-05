import { useCallback, useRef, useState } from 'react'
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
  const queueRef = useRef<TierListEntryDto[]>([])
  const [index, setIndex] = useState<number | null>(null)

  const start = useCallback((unranked: TierListEntryDto[]) => {
    if (unranked.length === 0) return
    queueRef.current = [...unranked]
    setIndex(0)
  }, [])

  const stop = useCallback(() => {
    queueRef.current = []
    setIndex(null)
  }, [])

  /** Moves to the next item, and exits by itself at the end of the queue -
   * "done" and "abandoned" look alike on purpose from the point of view
   * of the caller: in both cases there is nothing left to show. */
  const next = useCallback(() => {
    setIndex((current) => {
      if (current === null) return null
      const following = current + 1
      if (following >= queueRef.current.length) {
        queueRef.current = []
        return null
      }
      return following
    })
  }, [])

  const isActive = index !== null
  const current = isActive ? (queueRef.current[index] ?? null) : null

  return {
    isActive,
    current,
    // 1-indexed: it is a counter shown to the user ("3 / 12"), not an index.
    progress: isActive ? { current: index + 1, total: queueRef.current.length } : null,
    start,
    stop,
    next,
  }
}
