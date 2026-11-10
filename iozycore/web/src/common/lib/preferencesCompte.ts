import { useSyncExternalStore } from 'react'
import type { PreferencesCompte } from '@/common/api/auth'

/**
 * The preferences of the account, between the device and the server (lot 218).
 *
 * <h2>Two sides, one rule</h2>
 * Each preference has a local copy (localStorage): the theme, the accent, the
 * title languages. It is what the screen applies at once, and the fallback
 * when there is no account or the server does not answer. When the person
 * CHOOSES something (the sun or the moon of the header, a row of the
 * profile), the local setter announces it here; the shell (see
 * usePreferencesCompte) sends it to the account. When the account answers
 * with its own values, the shell writes them on the device without
 * announcing them again - otherwise every page load would save what it had
 * just read.
 *
 * <p>No import of React Query or of the API here: the setters live in plain
 * modules (lib/theme, lib/accent, lib/titleLanguage) that tests and
 * `main.tsx` use without a provider.
 */
export const EVENEMENT_PREFERENCE_CHOISIE = 'iozycore.preferenceChoisie'

export type ChoixPreference = Partial<PreferencesCompte>

/** A person chose something: the shell saves it on the account, if there is one. */
export function annoncerChoix(choix: ChoixPreference): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ChoixPreference>(EVENEMENT_PREFERENCE_CHOISIE, { detail: choix }))
}

/**
 * Where the last choice went: on the account, only on this device (no account,
 * or the server refused or did not answer), or still on its way.
 */
export type EtatEnregistrement = 'repos' | 'en-cours' | 'compte' | 'appareil'

let etat: EtatEnregistrement = 'repos'
const abonnes = new Set<() => void>()

export function declarerEnregistrement(nouveau: EtatEnregistrement): void {
  etat = nouveau
  for (const rappel of abonnes) rappel()
}

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

/** The state of the last save, for the profile to say where a setting lives. */
export function useEtatEnregistrement(): EtatEnregistrement {
  return useSyncExternalStore(souscrire, () => etat, () => 'repos')
}
