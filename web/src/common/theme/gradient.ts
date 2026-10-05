import { gradientPalettes } from './tokens'

/**
 * Deterministic hash (djb2) of a string. Note: Swift's `String.hashValue`
 * (used by Theme.gradient(for:) on the iOS side) is randomly salted per
 * process for security reasons - it is therefore NOT stable from one launch
 * of the app to the next, even on iOS itself. The web therefore does not
 * look for a pixel-perfect mirroring with iOS (impossible), only an internal
 * consistency: the same title always gives the same gradient on this web
 * app, at each reload.
 */
export function djb2Hash(value: string): number {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return hash >>> 0 // force to an unsigned integer
}

/** Deterministic CSS gradient for a "cover" from its title. */
export function gradientFor(title: string): string {
  const [from, to] = gradientPalettes[djb2Hash(title) % gradientPalettes.length]
  return `linear-gradient(135deg, #${from}, #${to})`
}
