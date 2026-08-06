import { gradientPalettes } from './tokens'

/**
 * Hash déterministe (djb2) d'une chaîne. Note : Swift's `String.hashValue`
 * (utilisé par Theme.gradient(for:) côté iOS) est salé aléatoirement par
 * process pour des raisons de sécurité - il n'est donc PAS stable d'un
 * lancement de l'app à l'autre, même sur iOS lui-même. Le web ne cherche
 * donc pas un mirroring pixel-perfect avec l'iOS (impossible), seulement
 * une cohérence interne : un même titre donne toujours le même dégradé
 * sur cette app web, à chaque rechargement.
 */
function djb2Hash(value: string): number {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return hash >>> 0 // force en entier non-signé
}

/** Dégradé CSS déterministe pour une "couverture" à partir de son titre. */
export function gradientFor(title: string): string {
  const [from, to] = gradientPalettes[djb2Hash(title) % gradientPalettes.length]
  return `linear-gradient(135deg, #${from}, #${to})`
}
