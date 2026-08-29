import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { creerCompte, lireCompte, lireEtatAuth, seConnecter, seDeconnecter, type Compte } from '../api/auth'
import { ApiError, EVENEMENT_SESSION_PERDUE } from '../api/client'
import { queryKeys } from './queryKeys'

/**
 * SOURCE UNIQUE de « qui est connecté ».
 *
 * <h2>Un 401 n'est pas une erreur, c'est une réponse</h2>
 * `/auth/me` répond 401 quand personne n'est connecté : c'est le cas NORMAL au
 * premier chargement. Le traiter comme une panne afficherait une bannière
 * rouge à quelqu'un qui n'a simplement pas encore ouvert sa session - et
 * TanStack Query réessaierait trois fois avant de l'admettre.
 *
 * <h2>Une session peut sauter n'importe quand</h2>
 * Serveur redémarré, session expirée, déconnexion depuis un autre onglet : le
 * 401 tombe alors sur un appel quelconque, pas sur celui-ci. Le client HTTP
 * l'annonce (voir api/client), et ce hook se contente d'écouter - c'est ce qui
 * remet l'écran de connexion en place sans qu'aucun écran n'ait à s'en
 * occuper.
 */
export function useAuth() {
  const queryClient = useQueryClient()

  const compte = useQuery<Compte | null>({
    queryKey: queryKeys.auth.compte,
    queryFn: async () => {
      try {
        return await lireCompte()
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) return null
        throw cause
      }
    },
    // Une session ne s'invente pas : inutile de réessayer un refus.
    retry: false,
  })

  const etat = useQuery({
    queryKey: queryKeys.auth.etat,
    queryFn: lireEtatAuth,
    // Ne sert qu'à l'écran de connexion, et ne change qu'à la création du
    // premier compte : le redemander à chaque retour d'onglet n'apprendrait
    // rien.
    staleTime: Infinity,
    enabled: compte.data === null,
  })

  useEffect(() => {
    const auSignal = () => queryClient.setQueryData(queryKeys.auth.compte, null)
    window.addEventListener(EVENEMENT_SESSION_PERDUE, auSignal)
    return () => window.removeEventListener(EVENEMENT_SESSION_PERDUE, auSignal)
  }, [queryClient])

  /** Après un changement de compte, plus rien de ce qui est en cache ne le concerne. */
  function repartirDeZero(nouveau: Compte | null) {
    queryClient.setQueryData(queryKeys.auth.compte, nouveau)
    queryClient.clear()
    queryClient.setQueryData(queryKeys.auth.compte, nouveau)
  }

  const connexion = useMutation({
    mutationFn: ({ email, motDePasse }: { email: string; motDePasse: string }) => seConnecter(email, motDePasse),
    onSuccess: repartirDeZero,
  })

  const creation = useMutation({
    mutationFn: creerCompte,
    onSuccess: repartirDeZero,
  })

  const deconnexion = useMutation({
    mutationFn: seDeconnecter,
    // Même en cas d'échec réseau : ce que l'utilisateur voulait, c'est sortir.
    onSettled: () => repartirDeZero(null),
  })

  return {
    compte: compte.data ?? null,
    /** Tant que la question n'a pas de réponse, on ne montre ni l'app ni la connexion. */
    enCoursDeVerification: compte.isLoading,
    aucunCompteSurLInstance: etat.data?.aucunCompte ?? false,
    creationOuverte: etat.data?.creationOuverte ?? false,
    connexion,
    creation,
    deconnexion,
  }
}
