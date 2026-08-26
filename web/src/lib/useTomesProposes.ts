import { useQuery } from '@tanstack/react-query'
import { searchVolumes } from '../api/metadata'
import { queryKeys } from './queryKeys'
import type { VolumeCandidateDto } from '../types/api'

/** Les indices de recherche qu'une fiche porte déjà dans ses attributs -
 *  recopiés par le fournisseur au moment où l'œuvre a été résolue. */
function indicesDe(attributs: Record<string, unknown>) {
  const texte = (cle: string) => (typeof attributs[cle] === 'string' ? (attributs[cle] as string) : undefined)
  return {
    author: texte('mangaka'),
    malId: texte('malId'),
    titleRomaji: texte('titleRomaji'),
    // Le titre d'origine du catalogue : c'est lui qui retrouve les éditions
    // chez les fournisseurs qui n'indexent pas le titre français.
    originalTitle: texte('titleRomaji') ?? texte('titleEnglish'),
  }
}

/**
 * Les tomes qu'un fournisseur connaît pour cette œuvre, et que le catalogue
 * n'a pas encore.
 *
 * <h2>Pourquoi la fiche en a besoin</h2>
 * Depuis que consulter un résultat de recherche ouvre directement la fiche
 * (voir `resolveEntity`), une fiche peut exister sans le moindre tome : rien
 * n'a encore été ajouté. Sans cette recherche, elle s'ouvrirait vide, avec
 * pour seule issue une saisie manuelle - alors que c'est exactement le moment
 * où l'on veut cocher « j'ai les tomes 1 à 12 ».
 *
 * <p>C'est la recherche que faisait l'ancien écran `/add/draft`, déplacée là
 * où elle sert. Même endpoint, même cache : une œuvre déjà consultée ne
 * relance rien.
 *
 * <h2>Ce qu'elle ne fait pas</h2>
 * Elle ne s'exécute que sur demande (`actif`) : une fiche dont les tomes sont
 * déjà catalogués n'a rien à demander à un fournisseur externe, et le quota
 * Google Books est une ressource réelle (voir `quotaExceeded`).
 */
export function useTomesProposes({
  entityTypeId,
  titre,
  attributs,
  actif,
}: {
  entityTypeId: string
  titre: string
  attributs: Record<string, unknown>
  actif: boolean
}) {
  const indices = indicesDe(attributs)
  const requete = useQuery({
    queryKey: queryKeys.tomesProposes(entityTypeId, titre),
    queryFn: () => searchVolumes(entityTypeId, titre, indices),
    enabled: actif && titre.trim() !== '',
    // Un fournisseur externe qui ne répond pas n'est pas une panne de la
    // fiche : elle reste utilisable, la saisie manuelle prend le relais.
    retry: false,
  })

  return {
    candidats: (requete.data?.volumes ?? []) as VolumeCandidateDto[],
    quotaDepasse: requete.data?.quotaExceeded ?? false,
    enCours: requete.isFetching,
    aEchoue: requete.isError,
    relancer: requete.refetch,
  }
}
