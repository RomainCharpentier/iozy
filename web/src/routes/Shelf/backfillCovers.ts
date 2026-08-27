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
  /** Seuls les attributs sont lus - un tome qu'on vient de créer n'a pas
   *  encore d'objet complet à offrir, et n'a pas à en fabriquer un faux. */
  variant: Pick<VariantDto, 'attributes'>,
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


/** Ce qu'une passe de rattrapage a donné pour UNE série. */
export interface ResultatRattrapage {
  trouvees: number
  quotaDepasse: boolean
}

/**
 * Retrouve les jaquettes manquantes d'UNE série.
 *
 * <h2>Une seule implémentation, deux appelants</h2>
 * Ma collection la déroule sur toute la bibliothèque ; la fiche l'appelle pour
 * la série qu'on regarde, quand on en a besoin - typiquement après un ajout
 * d'un clic, ou après une panne de quota chez le fournisseur. La logique
 * d'appariement, la seconde tentative et la lecture du quota vivaient dans la
 * boucle de Ma collection : deux copies auraient fini par diverger.
 *
 * <p><b>Deux recherches au plus, et seulement si la première ne suffit pas</b> :
 * la seconde force le rafraîchissement du cache, ce qui coûte un vrai appel au
 * fournisseur. La faire d'emblée gaspillerait le quota sur les séries que le
 * cache servait déjà.
 *
 * <p>Best-effort par nature : une série en échec reste simplement sans
 * jaquette. Le quota dépassé, lui, remonte - c'est la seule information qui
 * change ce que l'utilisateur doit faire (réessayer plus tard).
 */
export async function rattraperJaquettes(
  entity: EntityResponse,
  entityTypeId: string,
  chercherTomes: (entityTypeId: string, titre: string, options?: { author?: string; forceRefresh?: boolean }) => Promise<{ volumes: VolumeCandidateDto[]; quotaExceeded: boolean }>,
  enregistrerJaquette: (entityId: string, variantId: string, url: string) => Promise<unknown>,
): Promise<ResultatRattrapage> {
  const manquantes = variantsMissingCover(entity)
  if (manquantes.length === 0) return { trouvees: 0, quotaDepasse: false }

  const auteur = typeof entity.attributes.mangaka === 'string' ? entity.attributes.mangaka : undefined
  try {
    let reponse = await chercherTomes(entityTypeId, entity.title, { author: auteur })
    if (reponse.quotaExceeded) return { trouvees: 0, quotaDepasse: true }

    if (manquantes.some((v) => !findBestCoverMatch(reponse.volumes, v)?.imageUrl)) {
      reponse = await chercherTomes(entityTypeId, entity.title, { author: auteur, forceRefresh: true })
      if (reponse.quotaExceeded) return { trouvees: 0, quotaDepasse: true }
    }

    let trouvees = 0
    for (const variante of manquantes) {
      const correspondance = findBestCoverMatch(reponse.volumes, variante)
      if (correspondance?.imageUrl) {
        await enregistrerJaquette(entity.id, variante.id, correspondance.imageUrl)
        trouvees++
      }
    }
    return { trouvees, quotaDepasse: false }
  } catch {
    // Une série en échec ne doit jamais faire échouer l'appelant.
    return { trouvees: 0, quotaDepasse: false }
  }
}
