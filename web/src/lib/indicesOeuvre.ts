/**
 * Les indices qu'une œuvre porte déjà pour interroger un fournisseur.
 *
 * <h2>Une seule liste, quatre appelants</h2>
 * Ces attributs ont été recopiés du fournisseur au moment où l'œuvre a été
 * résolue (voir MetadataSearchService côté serveur) : les redonner en entrée
 * d'une recherche ultérieure, c'est ce qui distingue « Naruto » de ses huit
 * dérivés. Trois écrans les ré-extrayaient chacun à la main, chacun un
 * sous-ensemble différent - la recherche de tomes en utilisait quatre, le
 * rattrapage de jaquettes un seul, la résolution de titre français trois.
 *
 * <h2>`mangaka` et non `creatorFrom`</h2>
 * Volontairement l'auteur MANGA seul, jamais le `studio` d'un jeu vidéo :
 * les trois appelants interrogent des fournisseurs de manga (recherche de
 * tomes, titre français). Un studio y serait un indice faux, pas un indice
 * en plus. `creatorFrom` reste la fonction d'AFFICHAGE, elle, tous types
 * confondus.
 */
export interface IndicesOeuvre {
  author?: string
  malId?: string
  titleRomaji?: string
  /** Le titre d'origine du catalogue : c'est lui qui retrouve les éditions
   *  chez les fournisseurs qui n'indexent pas le titre français. */
  originalTitle?: string
  /** Le nombre de tomes d'après le catalogue : jusqu'à lui, le serveur sonde
   *  les numéros manquants un par un (Lot 125). */
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
