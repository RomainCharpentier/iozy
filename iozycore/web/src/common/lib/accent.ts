import { useSyncExternalStore } from 'react'
import { annoncerChoix } from './preferencesCompte'
import type { AccentCompte } from '@/common/api/auth'

/**
 * The accent color (lot 218): the two tones read from the cover on screen
 * (`AUTO`, the look of the redesign), or the brand terracotta whatever the
 * cover. The charter has one brand accent, so these are the only two values
 * that really change something (see PleinCadre).
 *
 * <p>Same shape as lib/theme: one store outside React, a local copy that
 * serves when there is no account, and a choice announced to the shell so it
 * reaches the account.
 */
const STORAGE_KEY = 'iozycore.accent'
const DEFAULT_ACCENT: AccentCompte = 'TERRACOTTA'

function lireStocke(): AccentCompte {
  try {
    const stored = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    return stored === 'TERRACOTTA' || stored === 'AUTO' ? stored : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

let accentCourant: AccentCompte = lireStocke()
const abonnes = new Set<() => void>()

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

export function setAccent(accent: AccentCompte, { annoncer = true } = {}): void {
  const changement = accent !== accentCourant
  accentCourant = accent
  try {
    window.localStorage.setItem(STORAGE_KEY, accent)
  } catch {
    // Kept for this visit only.
  }
  for (const rappel of abonnes) rappel()
  if (annoncer && changement) annoncerChoix({ accent })
}

/** Reads the device copy again (tests, and a storage cleared elsewhere). */
export function relireAccent(): void {
  accentCourant = lireStocke()
  for (const rappel of abonnes) rappel()
}

export function useAccent(): AccentCompte {
  return useSyncExternalStore(souscrire, () => accentCourant, () => DEFAULT_ACCENT)
}
