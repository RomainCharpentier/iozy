import { useEffect, useState } from 'react'
import type { MetadataCandidateDto } from '@/common/types/api'

/**
 * Composition libre du titre affiché/sauvegardé pour les candidats
 * Jikan/MyAnimeList (mangas) - persistée en local (pas de backend : un
 * réglage d'affichage propre à cet appareil, cohérent avec la conception
 * mono-utilisateur sans compte de l'app).
 *
 * Une TitleComposition est une liste ORDONNÉE des 3 langues (toujours les 3,
 * dans l'ordre choisi via glisser-déposer dans Réglages), chacune
 * activable/désactivable indépendamment de sa position :
 * - la première langue ACTIVE dont la valeur est disponible pour ce candidat
 *   devient le titre "principal" (celui réellement saisi/sauvegardé) ;
 * - les langues actives suivantes dont la valeur est disponible apparaissent
 *   à la suite entre parenthèses, dans le même ordre.
 * "Disponible" dépend de la source : le romaji est toujours fourni par
 * Jikan/MAL, l'anglais seulement s'il existe, le français seulement si la
 * recherche best-effort (Open Library/Google Books) en a trouvé un.
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

// Reproduit le comportement par défaut historique : français en priorité
// (best-effort), romaji en repère secondaire, anglais non affiché (mais
// toujours disponible si l'utilisateur le glisse/active dans Réglages).
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
  // Un seul onglet à la fois en pratique pour cette app, mais notifie quand
  // même les autres instances de useTitleComposition dans la même page
  // (le composant Settings et QuickAddPage, par exemple).
  window.dispatchEvent(new CustomEvent(STORAGE_KEY))
}

/** Lit la composition et se met à jour si elle change ailleurs (SettingsPage). */
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

/** Valeur brute d'un candidat pour une langue donnée, ou undefined si la
 * source ne la fournit pas pour ce candidat précis (ex: pas de titre anglais
 * distinct, ou recherche française pas encore résolue/infructueuse). */
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

/** Valeurs disponibles pour ce candidat, dans l'ordre de la composition,
 * limitées aux langues activées - `candidate.title` en dernier repli si
 * aucune des langues activées n'a de valeur (ne devrait arriver que si tout
 * a été désactivé, ROMAJI y compris, ce que l'UI Réglages empêche déjà). */
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

/** Titre "principal" résolu selon la composition - c'est celui réellement
 * saisi/sauvegardé (voir QuickAddPage.pickCandidate), jamais la chaîne avec
 * parenthèses de candidateDisplayTitle. */
export function resolvePrimaryTitle(
  candidate: MetadataCandidateDto,
  composition: TitleComposition,
  frenchTitle: string | undefined,
): string {
  return availableValuesInOrder(candidate, composition, frenchTitle)[0]
}

/** ex: "L'Attaque des Titans (Shingeki no Kyojin)" - la première langue
 * active disponible devient le titre principal, les suivantes (actives et
 * disponibles) suivent entre parenthèses dans l'ordre choisi. Jamais
 * intégré au titre réellement saisi/sauvegardé (voir resolvePrimaryTitle). */
export function candidateDisplayTitle(
  candidate: MetadataCandidateDto,
  composition: TitleComposition,
  frenchTitle: string | undefined,
): string {
  const [mainTitle, ...secondary] = availableValuesInOrder(candidate, composition, frenchTitle)
  const dedupedSecondary = secondary.filter((value, index) => value !== mainTitle && secondary.indexOf(value) === index)
  return dedupedSecondary.length > 0 ? `${mainTitle} (${dedupedSecondary.join(', ')})` : mainTitle
}
