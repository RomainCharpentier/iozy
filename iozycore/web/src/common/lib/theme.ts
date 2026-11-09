import { useSyncExternalStore } from 'react'
import { annoncerChoix } from './preferencesCompte'
import type { ApparenceCompte } from '@/common/api/auth'

export type Theme = 'light' | 'dark'

/**
 * What the person chose (lot 218): a theme, or "what the system says". The
 * theme on screen is resolved from it (see {@link resoudre}).
 */
export type PreferenceTheme = Theme | 'system'

const STORAGE_KEY = 'iozycore.theme'

/** Dark by default (index.html starts with the attribute, so the first paint
 * is dark too) - the app has only known dark so far, a light first load would
 * have been a surprise for no reason. Following `prefers-color-scheme` is a
 * choice the person makes on the profile ("Système", lot 218), never the
 * default. */
const DEFAULT_THEME: Theme = 'dark'

function readStoredPreference(): PreferenceTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function requeteSysteme(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-color-scheme: light)')
}

/** "Système" reads the system now; without an answer, dark, like the default. */
function resoudre(preference: PreferenceTheme): Theme {
  if (preference !== 'system') return preference
  return requeteSysteme()?.matches ? 'light' : 'dark'
}

/**
 * Sets the attribute for dark, REMOVES it for light.
 *
 * Assigning `undefined` to `dataset.theme` does not delete the attribute: it
 * sets it to the string `"undefined"`. Light still worked, by accident -
 * `[data-theme="dark"]` simply does not match `"undefined"` - but the DOM
 * carried an attribute that means nothing, and any future selector like
 * `:root:not([data-theme])` would have failed for no visible reason.
 */
function appliquerAttribut(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  } else {
    delete document.documentElement.dataset.theme
  }
}

/**
 * ONE single state, outside React, and all the components read it.
 *
 * <h2>Why no longer a `useState` per component</h2>
 * The hook kept its own state, read again from localStorage on mount. As long
 * as only one switch existed (Settings), nobody saw it. The header button
 * (batch 138) is rendered TWICE - by the desktop header and by the mobile
 * header, one of which is hidden by CSS - and two private states would have
 * diverged at the first click: the icon of the other bar would have shown the
 * old mode, and its next click would have "toggled it back" to the one we
 * had just left. A single store, subscribed to by `useSyncExternalStore`,
 * makes each button a view of the same fact.
 */
let preferenceCourante: PreferenceTheme = readStoredPreference()
let themeCourant: Theme = resoudre(preferenceCourante)
const abonnes = new Set<() => void>()

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

function lireTheme(): Theme {
  return themeCourant
}

function lirePreference(): PreferenceTheme {
  return preferenceCourante
}

/** While the preference is "Système", a change of the system switches the page. */
let ecouteSysteme: (() => void) | null = null
function suivreLeSysteme(): void {
  ecouteSysteme?.()
  ecouteSysteme = null
  const requete = requeteSysteme()
  if (preferenceCourante !== 'system' || !requete || typeof requete.addEventListener !== 'function') return
  const auChangement = () => basculer(resoudre('system'))
  requete.addEventListener('change', auChangement)
  ecouteSysteme = () => requete.removeEventListener('change', auChangement)
}

/** Applies the stored theme before the first React render (see the
 * synchronous call in main.tsx) - avoids a flash default-theme then
 * stored-theme at load. `data-theme` only for "dark": light is the value the
 * charter's CSS sets on :root (iozykit/css/tokens.css), no need for an
 * attribute for it. index.html starts with the attribute; this call removes it
 * for a stored light choice. */
export function applyStoredTheme(): void {
  preferenceCourante = readStoredPreference()
  themeCourant = resoudre(preferenceCourante)
  appliquerAttribut(themeCourant)
  suivreLeSysteme()
}

/**
 * Switches the theme on screen, as a crossfade when the browser can.
 *
 * <p>Before, every surface switched in one frame while the body took 200 ms
 * - a mixed screen for the time of a blink. The View Transitions API
 * snapshots the screen, applies the attribute, and fades the old snapshot
 * into the new one (240 ms, see index.css). Without the API (Firefox, the
 * test runner), the attribute is applied at once, as before. The reduced
 * motion preference is read here too: the CSS stops the fade, but starting
 * a transition for nothing would still delay the switch by a frame.
 */
function basculer(theme: Theme): void {
  themeCourant = theme
  const appliquer = () => {
    appliquerAttribut(theme)
    for (const rappel of abonnes) rappel()
  }
  const document_ = document as Document & { startViewTransition?: (update: () => void) => unknown }
  const mouvementReduit =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (typeof document_.startViewTransition === 'function' && !mouvementReduit) {
    document_.startViewTransition(appliquer)
  } else {
    appliquer()
  }
}

const VERS_COMPTE: Record<PreferenceTheme, ApparenceCompte> = { system: 'SYSTEM', dark: 'DARK', light: 'LIGHT' }
const DEPUIS_COMPTE: Record<ApparenceCompte, PreferenceTheme> = { SYSTEM: 'system', DARK: 'dark', LIGHT: 'light' }

/**
 * Sets the preference: stored on this device, applied at once, and - unless
 * it comes from the account itself - announced so the shell saves it on the
 * account (see lib/preferencesCompte).
 */
export function setThemePreference(preference: PreferenceTheme, { annoncer = true } = {}): void {
  const changement = preference !== preferenceCourante
  preferenceCourante = preference
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // A browser that refuses storage still switches; it only forgets.
  }
  suivreLeSysteme()
  const theme = resoudre(preference)
  if (theme !== themeCourant) basculer(theme)
  else for (const rappel of abonnes) rappel()
  if (annoncer && changement) annoncerChoix({ appearance: VERS_COMPTE[preference] })
}

/** The account's appearance, written on the device without saving it back. */
export function appliquerApparenceDuCompte(apparence: ApparenceCompte): void {
  setThemePreference(DEPUIS_COMPTE[apparence], { annoncer: false })
}

/** An explicit theme, chosen by the person (the header button). */
export function setTheme(theme: Theme): void {
  setThemePreference(theme)
}

export function toggleTheme(): void {
  setTheme(themeCourant === 'dark' ? 'light' : 'dark')
}

/** The current theme, and the means to change it - from the header (see
 * BoutonTheme) and from the profile. One single source state (this module,
 * localStorage and the DOM attribute): the rest of the theme goes entirely
 * through the CSS tokens, not through conditional JS. */
export function useTheme(): {
  theme: Theme
  preference: PreferenceTheme
  setTheme: (t: Theme) => void
  setPreference: (p: PreferenceTheme) => void
  toggleTheme: () => void
} {
  const theme = useSyncExternalStore(souscrire, lireTheme, () => DEFAULT_THEME)
  const preference = useSyncExternalStore(souscrire, lirePreference, () => DEFAULT_THEME)
  return { theme, preference, setTheme, setPreference: setThemePreference, toggleTheme }
}
