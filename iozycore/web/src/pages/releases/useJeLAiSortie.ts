import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickAdd } from '@/common/api/entities'
import { invaliderApresPossession } from '@/common/lib/invalidations'
import { useToast } from '@/common/lib/toast'
import type { ReleaseEntryDto } from '@/common/types/api'

/** "Vinland Saga, Tome 15 · Kurokawa" - the release named in a sentence. */
export function nomDeSortie(entry: Pick<ReleaseEntryDto, 'entityTitle' | 'label'>): string {
  return entry.label ? `${entry.entityTitle}, ${entry.label}` : entry.entityTitle
}

/**
 * "Je l'ai précommandé" on a release the collection does not have yet (lot 215).
 *
 * <p>The same path as everywhere else: `quick-add` finds the work by its title
 * and its category, and the volume by its number and edition when the release
 * is a volume. Nothing new is invented here. A copy of a release still to come
 * IS a pre-order: the calendar then shows it as owned, its outline stops
 * breathing.
 */
export function useJeLAiSortie() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (entry: ReleaseEntryDto) =>
      quickAdd({
        entityTypeId: entry.entityTypeId,
        title: entry.entityTitle,
        condition: 'NEW',
        volumeNumber: entry.volumeNumber ?? undefined,
        edition: entry.editionName ?? undefined,
      }),
    onSuccess: (_resultat, entry) => {
      invaliderApresPossession(queryClient)
      toast(`${nomDeSortie(entry)} : précommandé`)
    },
  })
}
