import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '@/common/api/tags'
import { queryKeys } from '@/common/lib/queryKeys'
import type { CompletionFilter } from './CollectionFilters'
import type { EntityResponse, TagDto } from '@/common/types/api'

// Stable reference: `?? []` would build a new array at each render, and
// the memoizations that depend on it would be recomputed for nothing.
const AUCUN_TAG: TagDto[] = []

/**
 * The collection filters, in a single place.
 *
 * <h2>Two screens, the same filters</h2>
 * My collection and the category view each declared their `status`,
 * their panel, their count badge and their "Réinitialiser" button -
 * about ten duplicated lines, and two chances to diverge as soon as a
 * filter is added. Same reason to exist as {@link useDonneesCollection}, one
 * level higher: the data is shared there, the filters here.
 *
 * <h2>The tag filter, and why it arrives now</h2>
 * One could create a tag and attach it to a work from its detail page, but
 * <b>no screen used it afterwards</b>: the sorting was set and never
 * read back. The parameter existed from end to end though - down
 * to `searchEntities` and the cache keys - without a single caller.
 *
 * <p>The filtering is done <b>in memory</b> rather than by passing `tagId` back to the
 * server: these screens already hold the whole collection, `tagIds` is in
 * each work, and a query that would ask again for a subset of what we
 * have at hand would be strictly slower. Same choice as the state
 * filter, which has been computed here from day one.
 *
 * <p><b>One single tag at a time</b>, like the server parameter: a
 * multiple selection would force us to choose between "at least one" and "all",
 * and to make it understood in a panel of four lines. This is decided,
 * it is not slipped into a batch.
 */
export function useFiltresCollection() {
  const [ouverts, setOuverts] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')
  const [tagId, setTagId] = useState<string | null>(null)

  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const tags = tagsQuery.data ?? AUCUN_TAG

  /** How many filters really carry something - the badge of the button. */
  const nombreActifs = (status === 'ALL' ? 0 : 1) + (tagId === null ? 0 : 1)

  /** The only criterion this hook knows how to apply alone: the collection state
   *  depends on the progress, which each screen already has at hand. */
  const porteLeTag = useCallback(
    (oeuvre: EntityResponse) => tagId === null || oeuvre.tagIds.includes(tagId),
    [tagId],
  )

  const reinitialiser = useCallback(() => {
    setStatus('ALL')
    setTagId(null)
  }, [])

  return useMemo(
    () => ({
      ouverts,
      ouvrir: () => setOuverts(true),
      fermer: () => setOuverts(false),
      status,
      definirStatus: setStatus,
      tags,
      tagId,
      definirTag: setTagId,
      nombreActifs,
      porteLeTag,
      reinitialiser,
    }),
    [ouverts, status, tags, tagId, nombreActifs, porteLeTag, reinitialiser],
  )
}
