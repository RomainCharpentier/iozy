import { useState } from 'react'

/**
 * The moment the screen was opened, read once. A screen does not tick, and a
 * clock read during a render gives a different value at each render (React
 * rule "purity"); three screens needed the same line.
 */
export function useNow(): Date {
  const [now] = useState(() => new Date())
  return now
}
