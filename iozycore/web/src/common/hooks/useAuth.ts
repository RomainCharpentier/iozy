import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  creerCompte,
  entrerEnVisite,
  lireCompte,
  lireEtatAuth,
  seConnecter,
  seDeconnecter,
  type Compte,
} from '@/common/api/auth'
import { ApiError, EVENEMENT_SESSION_PERDUE, declarerVisiteEnCours } from '@/common/api/client'
import { queryKeys } from '@/common/lib/queryKeys'

/**
 * SINGLE SOURCE of "who is signed in".
 *
 * <h2>A 401 is not an error, it is an answer</h2>
 * `/auth/me` answers 401 when nobody is signed in: this is the NORMAL case at
 * the first load. Treating it as a failure would show a red banner to someone
 * who simply has not opened their session yet - and TanStack Query would
 * retry three times before admitting it.
 *
 * <h2>A visit is a session like any other</h2>
 * Entering without an account does not follow a separate path: it is the same
 * question ("who is there?"), the same answer (`/auth/me`), the same cache.
 * What changes fits in a flag - `estInvite` - and in the fact that the HTTP
 * client then refuses any write (see api/client). On the server side, the
 * session names no owner: it therefore only sees the catalog.
 *
 * <h2>A session can drop at any time</h2>
 * Server restarted, session expired, sign-out from another tab: the 401 then
 * falls on any call, not on this one. The HTTP client announces it (see
 * api/client), and this hook just listens - this is what puts the sign-in
 * screen back in place without any screen having to deal with it.
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
    // A session cannot be invented: no point in retrying a refusal.
    retry: false,
  })

  const etat = useQuery({
    queryKey: queryKeys.auth.etat,
    queryFn: lireEtatAuth,
    // Only used by the sign-in screen, and only changes at the creation of
    // the first account: asking again at each return to the tab would
    // teach nothing.
    staleTime: Infinity,
    enabled: compte.data === null,
  })

  useEffect(() => {
    const auSignal = () => queryClient.setQueryData(queryKeys.auth.compte, null)
    window.addEventListener(EVENEMENT_SESSION_PERDUE, auSignal)
    return () => window.removeEventListener(EVENEMENT_SESSION_PERDUE, auSignal)
  }, [queryClient])

  // The HTTP client is not a component: it is here, where we know who is
  // signed in, that we tell it - once, rather than at each call.
  const estInvite = compte.data?.invite ?? false
  useEffect(() => {
    declarerVisiteEnCours(estInvite)
  }, [estInvite])

  /** After an account change, nothing in the cache concerns it anymore. */
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

  const visite = useMutation({
    mutationFn: entrerEnVisite,
    onSuccess: repartirDeZero,
  })

  const deconnexion = useMutation({
    mutationFn: seDeconnecter,
    // Even in case of a network failure: what the user wanted was to get out.
    onSettled: () => repartirDeZero(null),
  })

  return {
    compte: compte.data ?? null,
    /** As long as the question has no answer, we show neither the app nor the sign-in. */
    enCoursDeVerification: compte.isLoading,
    aucunCompteSurLInstance: etat.data?.aucunCompte ?? false,
    creationOuverte: etat.data?.creationOuverte ?? false,
    /** The catalog is browsed without an account: nothing is written, and nothing personal is read. */
    estInvite,
    connexion,
    creation,
    visite,
    deconnexion,
  }
}
