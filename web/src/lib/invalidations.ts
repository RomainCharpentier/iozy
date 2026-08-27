import type { QueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'

/**
 * Ce qui devient faux quand une POSSESSION ou une ENVIE change.
 *
 * <h2>Pourquoi une fonction plutôt qu'une liste recopiée</h2>
 * Cinq endroits écrivaient leur propre liste d'invalidations après un ajout ou
 * un retrait, et les cinq différaient : l'un oubliait la recherche, un autre le
 * détail de la fiche, un troisième portait le commentaire « ajouté ici pour
 * s'aligner sur OwnershipDetails » - un composant supprimé depuis. S'aligner à
 * la main est une promesse qu'aucun écran ne peut tenir : au Lot 51, ajouter un
 * tome laissait Ma collection sur l'ancien décompte, précisément parce qu'une
 * clé manquait à un endroit sur cinq.
 *
 * <h2>Trois préfixes, et rien d'autre à retenir</h2>
 * Les clés sont hiérarchiques : `['entities']` couvre la recherche
 * (`entities.search`) ET chaque fiche (`entities.detail`) ; `['ownerships']`
 * couvre celles d'une œuvre et la liste complète ; `['insights','progress']`
 * couvre la progression de toute la collection et celle d'une fiche
 * (`progressOf`, voir Lot 60). Un écran n'a donc plus à savoir QUELLES données
 * il touche - seulement qu'il a touché à ce qu'on possède.
 *
 * <p>Invalider large ne coûte pas un appel de plus : React Query ne
 * re-télécharge que les requêtes ACTIVES, c'est-à-dire ce qui est à l'écran.
 */
export function invaliderApresPossession(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  queryClient.invalidateQueries({ queryKey: ['ownerships'] })
  queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
}

/**
 * Une envie posée sur un TOME fait exister ce tome au catalogue (voir
 * TomeResolver côté serveur) : la fiche et la progression changent donc, sans
 * qu'aucune possession n'ait bougé. C'est ce que le seul
 * `invalidateQueries(wishlist)` d'origine laissait passer - le tome apparaissait
 * dans les envies, mais la grille continuait de l'ignorer jusqu'au rechargement.
 */
export function invaliderApresEnvie(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.wishlist.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.insights.progress })
}
