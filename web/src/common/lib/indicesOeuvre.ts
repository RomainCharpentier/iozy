/**
 * The hints that a work already carries to query a provider.
 *
 * <h2>One single list, four callers</h2>
 * These attributes were copied from the provider when the work was resolved
 * (see MetadataSearchService on the server side): giving them back as input
 * to a later search is what tells "Naruto" apart from its eight spin-offs.
 * Three screens extracted them again by hand, each with a different subset -
 * the volume search used four, the cover backfill only one, the French title
 * resolution three.
 *
 * <h2>`mangaka` and not `creatorFrom`</h2>
 * Deliberately the MANGA author only, never the `studio` of a video game:
 * the three callers query manga providers (volume search, French title). A
 * studio would be a wrong hint there, not an extra hint. `creatorFrom`
 * remains the DISPLAY function, for all types together.
 */
export interface IndicesOeuvre {
  author?: string
  malId?: string
  titleRomaji?: string
  /** The original title of the catalog: it is the one that finds the editions
   *  at providers that do not index the French title. */
  originalTitle?: string
  /** The number of volumes according to the catalog: up to this number, the
   *  server probes the missing numbers one by one (Batch 125). */
  totalVolumes?: number
}

export function indicesDe(attributs: Record<string, unknown> | undefined): IndicesOeuvre {
  const texte = (cle: string) => {
    const valeur = attributs?.[cle]
    return typeof valeur === 'string' && valeur.trim() !== '' ? valeur : undefined
  }
  return {
    author: texte('mangaka'),
    malId: texte('malId'),
    titleRomaji: texte('titleRomaji'),
    originalTitle: texte('titleRomaji') ?? texte('titleEnglish'),
    totalVolumes: nombre(attributs?.totalVolumes),
  }
}

function nombre(valeur: unknown): number | undefined {
  if (typeof valeur === 'number' && Number.isInteger(valeur) && valeur > 0) return valeur
  if (typeof valeur === 'string' && /^\d+$/.test(valeur.trim())) return Number(valeur.trim())
  return undefined
}
