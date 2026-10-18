import { useQuery } from '@tanstack/react-query'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from './queryKeys'

/**
 * Is a collection type collected BY VOLUME, or as a single piece?
 *
 * <h2>Why this question deserves a module</h2>
 * It decides the object that the personal actions apply to. A manga is owned
 * volume by volume: the series and the edition are only GROUPS, and "I want
 * Naruto" means nothing precise - it is volume 47 that you want. A video game
 * is owned as a single piece: the work IS the collectible object, and the
 * heart therefore has its full place on its detail page.
 *
 * <p>Before, each surface decided in its own corner (`entityType?.code ===
 * 'MANGA'` copied on the detail page, absent everywhere else), so that the
 * search offered a series heart where the detail page no longer wanted one.
 *
 * <p>By code and not by `hasMetadataProvider`: it is a property of the
 * MEDIUM, not of the availability of a provider.
 */
const CODES_PAR_TOME = new Set(['MANGA'])

function collecteParTome(code: string | null | undefined): boolean {
  return !!code && CODES_PAR_TOME.has(code)
}

/**
 * The same question from an `entityTypeId`. Relies on the list of types
 * already in the cache in almost all screens - no extra request in
 * practice.
 *
 * <p>Answers `false` as long as the list is not loaded: the doubt favors
 * displaying the action. A heart that appears a moment later is better than
 * a heart that disappears under the cursor.
 */
export function useCollecteParTome(entityTypeId: string | null | undefined): boolean {
  const { data } = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  return collecteParTome(data?.find((type) => type.id === entityTypeId)?.code)
}
