import { coverImageUrlFrom } from './coverImage'
import type { EntityResponse, VariantDto, VolumeCandidateDto } from '@/common/types/api'
import { editionDe, numeroDe } from './attributsTome'
import { indicesDe } from './indicesOeuvre'

/** A recognizable "manga" Variant (carries a structured volumeNumber) without
 * its own cover - only these are eligible for the backfill (see
 * "Retrouver les jaquettes manquantes", Ma collection). */
export function variantsMissingCover(entity: EntityResponse): VariantDto[] {
  return entity.variants.filter(
    (v) => numeroDe(v) !== null && !coverImageUrlFrom(v.attributes),
  )
}

/** Best match in the volume search results
 * (GET /metadata/volumes, see VolumeSelectionGrid on the Ajout rapide side -
 * same source, never a new matching algorithm) for a given Variant: same
 * volumeNumber, then same edition if the Variant has one filled in
 * (case-insensitive), otherwise the first match with a real cover. Never an
 * invented match: a volumeNumber that is absent from the search result stays
 * without a cover. */
export function findBestCoverMatch(
  candidates: VolumeCandidateDto[],
  /** Only the attributes are read - a volume that was just created does not
   *  have a full object to offer yet, and does not have to build a fake one. */
  variant: Pick<VariantDto, 'attributes'>,
): VolumeCandidateDto | undefined {
  const volumeNumber = numeroDe(variant)
  if (volumeNumber === null) return undefined

  const sameVolume = candidates.filter((c) => c.volumeNumber === volumeNumber && c.imageUrl)
  if (sameVolume.length === 0) return undefined

  // Case lowered HERE and nowhere else: we compare with the edition as an
  // external provider announces it, where "Kana" and "KANA" are the same.
  const edition = editionDe(variant).toLowerCase()
  if (edition) {
    const editionMatch = sameVolume.find((c) => c.edition.trim().toLowerCase() === edition)
    if (editionMatch) return editionMatch
  }
  return sameVolume[0]
}


/** What a backfill pass gave for ONE series. */
export interface ResultatRattrapage {
  trouvees: number
  /** The provider said NOTHING: quota exceeded, or silent source (503,
   * timeout). Different from "it answered, it does not have this cover". */
  fournisseurMuet: boolean
}

/**
 * Finds the missing covers of ONE series.
 *
 * <h2>One single implementation, two callers</h2>
 * Ma collection runs it over the whole library; the detail page calls it for
 * the series being viewed, when needed - typically after a one-click add, or
 * after a failure at the provider. The matching logic, the second attempt and
 * the reading of the failure lived in the loop of Ma collection: two copies
 * would have ended up diverging.
 *
 * <p><b>At most two searches, and only if the first is not enough</b>:
 * the second forces the cache to refresh, which costs a real call to the
 * provider. Doing it right away would waste the quota on the series that the
 * cache already served.
 *
 * <p>Best-effort by nature: a series that fails simply stays without a cover.
 * A silent provider, however, is reported - it is the only information that
 * changes what the user has to do (try again later).
 */
export async function rattraperJaquettes(
  entity: EntityResponse,
  entityTypeId: string,
  chercherTomes: (entityTypeId: string, titre: string, options?: { author?: string; forceRefresh?: boolean }) => Promise<{ volumes: VolumeCandidateDto[]; quotaExceeded: boolean }>,
  enregistrerJaquette: (entityId: string, variantId: string, url: string) => Promise<unknown>,
): Promise<ResultatRattrapage> {
  const manquantes = variantsMissingCover(entity)
  if (manquantes.length === 0) return { trouvees: 0, fournisseurMuet: false }

  const { author: auteur } = indicesDe(entity.attributes)
  try {
    let reponse = await chercherTomes(entityTypeId, entity.title, { author: auteur })
    if (reponse.quotaExceeded) return { trouvees: 0, fournisseurMuet: true }

    if (manquantes.some((v) => !findBestCoverMatch(reponse.volumes, v)?.imageUrl)) {
      reponse = await chercherTomes(entityTypeId, entity.title, { author: auteur, forceRefresh: true })
      if (reponse.quotaExceeded) return { trouvees: 0, fournisseurMuet: true }
    }

    let trouvees = 0
    for (const variante of manquantes) {
      const correspondance = findBestCoverMatch(reponse.volumes, variante)
      if (correspondance?.imageUrl) {
        await enregistrerJaquette(entity.id, variante.id, correspondance.imageUrl)
        trouvees++
      }
    }
    return { trouvees, fournisseurMuet: false }
  } catch {
    // A series that fails must never make the caller fail.
    return { trouvees: 0, fournisseurMuet: false }
  }
}
