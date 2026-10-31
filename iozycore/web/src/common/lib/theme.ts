import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'iozycore.theme'

/** Dark by default (index.html starts with the attribute, so the first paint
 * is dark too) - the app has only known dark so far, a light first load would
 * have been a surprise for no reason. An explicit and persistent choice, never
 * a follow of `prefers-color-scheme` (same logic as the old forced single
 * mode). */
const DEFAULT_THEME: Theme = 'dark'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME
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
let themeCourant: Theme = readStoredTheme()
const abonnes = new Set<() => void>()

function souscrire(rappel: () => void): () => void {
  abonnes.add(rappel)
  return () => abonnes.delete(rappel)
}

function lireTheme(): Theme {
  return themeCourant
}

/** Applies the attribute before the first React render (see the synchronous
 * call in main.tsx) - avoids a flash default-theme then stored-theme at
 * load. `data-theme` only for "dark": light is the value the charter's CSS
 * sets on :root (iozykit/css/tokens.css), no need for an attribute for
 * it. index.html starts with the attribute; this call removes it for a
 * stored light choice. */
export function applyStoredTheme(): void {
  themeCourant = readStoredTheme()
  appliquerAttribut(themeCourant)
}

/**
 * Switches the theme, as a crossfade when the browser can.
 *
 * <p>Before, every surface switched in one frame while the body took 200 ms
 * - a mixed screen for the time of a blink. The View Transitions API
 * snapshots the screen, applies the attribute, and fades the old snapshot
 * into the new one (240 ms, see index.css). Without the API (Firefox, the
 * test runner), the attribute is applied at once, as before. The reduced
 * motion preference is read here too: the CSS stops the fade, but starting
 * a transition for nothing would still delay the switch by a frame.
 */
export function setTheme(theme: Theme): void {
  themeCourant = theme
  window.localStorage.setItem(STORAGE_KEY, theme)
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

export function toggleTheme(): void {
  setTheme(themeCourant === 'dark' ? 'light' : 'dark')
}

/** The current theme, and the means to change it - from the header (see
 * BoutonTheme). One single source state (this module, localStorage and the
 * DOM attribute): the rest of the theme goes entirely through the CSS
 * tokens, not through conditional JS. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const theme = useSyncExternalStore(souscrire, lireTheme, () => DEFAULT_THEME)
  return { theme, setTheme, toggleTheme }
}
