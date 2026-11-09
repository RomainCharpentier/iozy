import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { modifierCompte, type Compte, type ModificationCompte, type PreferencesCompte } from '@/common/api/auth'
import { useAuth } from '@/common/hooks/useAuth'
import { setAccent } from '@/common/lib/accent'
import {
  EVENEMENT_PREFERENCE_CHOISIE,
  declarerEnregistrement,
  type ChoixPreference,
} from '@/common/lib/preferencesCompte'
import { queryKeys } from '@/common/lib/queryKeys'
import { appliquerApparenceDuCompte } from '@/common/lib/theme'
import { getTitleComposition, setTitleComposition } from '@/common/lib/titleLanguage'

/**
 * Writes the account's preferences on this device, once per account.
 *
 * <p>Once, and not at each answer: a save that comes back late would
 * otherwise put back a value the person already changed again. A preference
 * the account never chose (null) leaves the device's own setting in place.
 */
export function appliquerPreferencesDuCompte(preferences: PreferencesCompte): void {
  if (preferences.appearance) appliquerApparenceDuCompte(preferences.appearance)
  if (preferences.accent) setAccent(preferences.accent, { annoncer: false })
  if (preferences.titleComposition) {
    const actuelle = JSON.stringify(getTitleComposition())
    if (actuelle !== JSON.stringify(preferences.titleComposition)) {
      setTitleComposition(preferences.titleComposition, { annoncer: false })
    }
  }
}

/** Saves a change of the profile, and puts the answer in the cache of "who is signed in". */
export function useModifierCompte() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (modification: ModificationCompte) => modifierCompte(modification),
    onSuccess: (compte: Compte) => queryClient.setQueryData(queryKeys.auth.compte, compte),
  })
}

/**
 * The bridge between the device and the account (lot 218), mounted once in
 * the shell.
 *
 * <ul>
 *   <li>At sign-in, the account's preferences are written on the device: the
 *       theme, the accent and the title languages follow the person from one
 *       browser to another.</li>
 *   <li>A choice made on this device (see lib/preferencesCompte) is sent to
 *       the account. Without an account (a visit) or when the server refuses
 *       or does not answer, it stays on the device, and the profile says so.</li>
 * </ul>
 */
export function usePreferencesCompte(): void {
  const { compte, estInvite } = useAuth()
  const queryClient = useQueryClient()
  const sauvegarde = useModifierCompte()
  const { mutateAsync } = sauvegarde
  const appliquePour = useRef<string | null>(null)
  const relu = useRef<string | null>(null)

  const id = compte && !estInvite ? compte.id : null
  const preferences = compte?.preferences

  useEffect(() => {
    if (!id) return
    if (preferences === undefined) {
      // The sign-in answer does not carry the preferences: ask "/me" once.
      if (relu.current !== id) {
        relu.current = id
        void queryClient.invalidateQueries({ queryKey: queryKeys.auth.compte })
      }
      return
    }
    if (preferences === null || appliquePour.current === id) return
    appliquePour.current = id
    appliquerPreferencesDuCompte(preferences)
  }, [id, preferences, queryClient])

  useEffect(() => {
    const auChoix = (evenement: Event) => {
      const choix = (evenement as CustomEvent<ChoixPreference>).detail
      if (!id) {
        declarerEnregistrement('appareil')
        return
      }
      declarerEnregistrement('en-cours')
      mutateAsync({ preferences: choix }).then(
        () => declarerEnregistrement('compte'),
        () => declarerEnregistrement('appareil'),
      )
    }
    window.addEventListener(EVENEMENT_PREFERENCE_CHOISIE, auChoix)
    return () => window.removeEventListener(EVENEMENT_PREFERENCE_CHOISIE, auChoix)
  }, [id, mutateAsync])
}
