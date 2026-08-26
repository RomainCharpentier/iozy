import { useQuery } from '@tanstack/react-query'
import { listEntityTypes } from '../api/entityTypes'
import { queryKeys } from './queryKeys'

/**
 * Un type de collection se collectionne-t-il PAR TOME, ou d'une seule pièce ?
 *
 * <h2>Pourquoi cette question mérite un module</h2>
 * C'est elle qui décide de l'objet sur lequel portent les actions
 * personnelles. Un manga se possède tome par tome : la série et l'édition ne
 * sont que des GROUPES, et « je veux Naruto » ne veut rien dire de précis -
 * c'est le tome 47 qu'on veut. Un jeu vidéo se possède d'une seule pièce :
 * l'œuvre EST l'objet collectionnable, et le cœur a donc toute sa place sur
 * sa fiche.
 *
 * <p>Avant, chaque surface tranchait dans son coin (`entityType?.code ===
 * 'MANGA'` recopié à la fiche, absent partout ailleurs), si bien que la
 * recherche proposait un cœur de série là où la fiche n'en voulait plus.
 *
 * <p>Par code et non par `hasMetadataProvider` : c'est une propriété du
 * MÉDIUM, pas de la disponibilité d'un fournisseur.
 */
const CODES_PAR_TOME = new Set(['MANGA'])

export function collecteParTome(code: string | null | undefined): boolean {
  return !!code && CODES_PAR_TOME.has(code)
}

/**
 * La même question depuis un `entityTypeId`. S'appuie sur la liste des types
 * déjà en cache dans à peu près tous les écrans - aucune requête de plus dans
 * la pratique.
 *
 * <p>Répond `false` tant que la liste n'est pas chargée : le doute profite à
 * l'affichage de l'action. Un cœur qui apparaît un instant plus tard vaut
 * mieux qu'un cœur qui disparaît sous le curseur.
 */
export function useCollecteParTome(entityTypeId: string | null | undefined): boolean {
  const { data } = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  return collecteParTome(data?.find((type) => type.id === entityTypeId)?.code)
}
