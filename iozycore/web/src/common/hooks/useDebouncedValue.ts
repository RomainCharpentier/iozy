import { useEffect, useState } from 'react'

/** Debounces a value (e.g. search text). 300ms by default, suited to a
 * local search (RelationshipsSection, free - simple SQL query on the
 * collection). QuickAddPage passes a longer delay
 * (500ms) for its external metadata search (Jikan/MAL/BGG/IGDB), which is
 * more expensive to limit - see the usage comment on site. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
