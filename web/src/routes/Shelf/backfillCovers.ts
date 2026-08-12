import { coverImageUrlFrom } from '../../lib/coverImage'
import type { EntityResponse, VariantDto, VolumeCandidateDto } from '../../types/api'

/** Un Variant "manga" reconnaissable (porte un volumeNumber structuré) sans
 * jaquette propre - seuls ceux-là sont éligibles au repêchage (voir
 * "Retrouver les jaquettes manquantes", Ma collection). */
export function variantsMissingCover(entity: EntityResponse): VariantDto[] {
  return entity.variants.filter(
    (v) => typeof v.attributes.volumeNumber === 'number' && !coverImageUrlFrom(v.attributes),
  )
}

/** Meilleure correspondance dans les résultats de recherche de tomes
 * (GET /metadata/volumes, voir VolumeSelectionGrid côté Ajout rapide - même
 * source, jamais un nouvel algorithme de correspondance) pour un Variant
 * donné : même volumeNumber, puis même édition si le Variant en a une
 * renseignée (insensible à la casse), sinon la première correspondance
 * avec une jaquette réelle. Jamais de correspondance inventée : un
 * volumeNumber absent du résultat de recherche reste sans jaquette. */
export function findBestCoverMatch(
  candidates: VolumeCandidateDto[],
  variant: VariantDto,
): VolumeCandidateDto | undefined {
  const volumeNumber = variant.attributes.volumeNumber
  if (typeof volumeNumber !== 'number') return undefined

  const sameVolume = candidates.filter((c) => c.volumeNumber === volumeNumber && c.imageUrl)
  if (sameVolume.length === 0) return undefined

  const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim().toLowerCase() : ''
  if (edition) {
    const editionMatch = sameVolume.find((c) => c.edition.trim().toLowerCase() === edition)
    if (editionMatch) return editionMatch
  }
  return sameVolume[0]
}
