import { useEffect, useState } from 'react'
import type { MetadataCandidateDto } from '@/common/types/api'

/**
 * Free composition of the displayed/saved title for the Jikan/MyAnimeList
 * candidates (manga) - persisted locally (no backend: a display setting
 * specific to this device, consistent with the single-user design without
 * accounts of the app).
 *
 * A TitleComposition is an ORDERED list of the 3 languages (always the 3,
 * in the order chosen through drag and drop in Settings), each one
 * enabled/disabled independently of its position:
 * - the first ACTIVE language whose value is available for this candidate
 *   becomes the "main" title (the one actually entered/saved);
 * - the following active languages whose value is available appear after it
 *   in parentheses, in the same order.
 * "Available" depends on the source: romaji is always provided by
 * Jikan/MAL, English only if it exists, French only if the best-effort
 * search (Open Library/Google Books) found one.
 */
export type TitleLanguage = 'FRENCH' | 'ENGLISH' | 'ROMAJI'

export interface TitleLanguageItem {
  language: TitleLanguage
  enabled: boolean
}

export type TitleComposition = TitleLanguageItem[]

const STORAGE_KEY = 'iozycore.titleComposition'

export const TITLE_LANGUAGE_LABELS: Record<TitleLanguage, string> = {
  FRENCH: 'Français',
  ENGLISH: 'Anglais',
  ROMAJI: 'Romaji (titre japonais d\'origine)',
}

// Reproduces the historical default behavior: French first (best-effort),
// romaji as a secondary mark, English not displayed (but still available if
// the user drags/enables it in Settings).
const DEFAULT_COMPOSITION: TitleComposition = [
  { language: 'FRENCH', enabled: true },
  { language: 'ROMAJI', enabled: true },
  { language: 'ENGLISH', enabled: false },
]

function isValidComposition(value: unknown): value is TitleComposition {
  if (!Array.isArray(value) || value.length !== 3) return false
  const languages = new Set(value.map((item) => item?.language))
  return (
    languages.size === 3 &&
    ['FRENCH', 'ENGLISH', 'ROMAJI'].every((lang) => languages.has(lang)) &&
    value.every((item) => typeof item.enabled === 'boolean')
  )
}

export function getTitleComposition(): TitleComposition {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isValidComposition(stored) ? stored : DEFAULT_COMPOSITION
  } catch {
    return DEFAULT_COMPOSITION
  }
}

export function setTitleComposition(composition: TitleComposition): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(composition))
  // Only one tab at a time in practice for this app, but still notify the
  // other instances of useTitleComposition in the same page
  // (the Settings component and QuickAddPage, for example).
  window.dispatchEvent(new CustomEvent(STORAGE_KEY))
}

/** Reads the composition and updates if it changes elsewhere (Settings, on Profile). */
export function useTitleComposition(): TitleComposition {
  const [composition, setComposition] = useState(getTitleComposition)

  useEffect(() => {
    const onChange = () => setComposition(getTitleComposition())
    window.addEventListener(STORAGE_KEY, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(STORAGE_KEY, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  return composition
}

export function isFrenchEnabled(composition: TitleComposition): boolean {
  return composition.some((item) => item.language === 'FRENCH' && item.enabled)
}

/** Raw value of a candidate for a given language, or undefined if the
 * source does not provide it for this specific candidate (e.g. no distinct
 * English title, or French search not yet resolved/unsuccessful). */
function languageValue(
  candidate: MetadataCandidateDto,
  language: TitleLanguage,
  frenchTitle: string | undefined,
): string | undefined {
  switch (language) {
    case 'FRENCH':
      return frenchTitle
    case 'ENGLISH':
      return typeof candidate.attributes.titleEnglish === 'string' ? candidate.attributes.titleEnglish : undefined
    case 'ROMAJI':
      return typeof candidate.attributes.titleRomaji === 'string' ? candidate.attributes.titleRomaji : candidate.title
  }
}

/** Values available for this candidate, in the order of the composition,
 * limited to the enabled languages - `candidate.title` as a last fallback if
 * none of the enabled languages has a value (should only happen if
 * everything was disabled, ROMAJI included, which the Settings UI already
 * prevents). */
function availableValuesInOrder(
  candidate: MetadataCandidateDto,
  composition: TitleComposition,
  frenchTitle: string | undefined,
): string[] {
  const values = composition
    .filter((item) => item.enabled)
    .map((item) => languageValue(candidate, item.language, frenchTitle))
    .filter((value): value is string => !!value)
  return values.length > 0 ? values : [candidate.title]
}

/** "Main" title resolved according to the composition - this is the one
 * actually entered/saved (see QuickAddPage.pickCandidate), never the string
 * with parentheses of candidateDisplayTitle. */
export function resolvePrimaryTitle(
  candidate: MetadataCandidateDto,
  composition: TitleComposition,
  frenchTitle: string | undefined,
): string {
  return availableValuesInOrder(candidate, composition, frenchTitle)[0]
}

/** e.g. "L'Attaque des Titans (Shingeki no Kyojin)" - the first available
 * active language becomes the main title, the following ones (active and
 * available) follow in parentheses in the chosen order. Never built into the
 * title actually entered/saved (see resolvePrimaryTitle). */
export function candidateDisplayTitle(
  candidate: MetadataCandidateDto,
  composition: TitleComposition,
  frenchTitle: string | undefined,
): string {
  const [mainTitle, ...secondary] = availableValuesInOrder(candidate, composition, frenchTitle)
  const dedupedSecondary = secondary.filter((value, index) => value !== mainTitle && secondary.indexOf(value) === index)
  return dedupedSecondary.length > 0 ? `${mainTitle} (${dedupedSecondary.join(', ')})` : mainTitle
}
