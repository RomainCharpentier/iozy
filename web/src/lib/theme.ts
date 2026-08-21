import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'iozycore.theme'

/** Sombre par défaut (voir index.css) - l'app n'a connu que le sombre
 * jusqu'ici, un premier chargement clair aurait surpris sans raison. Choix
 * explicite et persistant, jamais un suivi de `prefers-color-scheme` (même
 * logique que l'ancien mode unique forcé). */
const DEFAULT_THEME: Theme = 'dark'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME
}

/** Applique l'attribut avant le premier rendu React (voir l'appel synchrone
 * dans main.tsx) - évite un flash thème-par-défaut puis thème-stocké au
 * chargement. `data-theme` uniquement pour "dark" : le clair reste la valeur
 * de base de :root dans index.css, pas besoin d'un attribut pour lui. */
/**
 * Pose l'attribut pour le sombre, le RETIRE pour le clair.
 *
 * Affecter `undefined` à `dataset.theme` ne supprime pas l'attribut : il le
 * fixe à la chaîne `"undefined"`. Le clair fonctionnait quand même, par
 * accident - `[data-theme="dark"]` ne correspond simplement pas à
 * `"undefined"` - mais le DOM portait un attribut qui ne veut rien dire, et
 * tout futur sélecteur du genre `:root:not([data-theme])` aurait échoué sans
 * raison visible.
 */
function appliquerAttribut(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.dataset.theme = 'dark'
  } else {
    delete document.documentElement.dataset.theme
  }
}

export function applyStoredTheme(): void {
  const theme = readStoredTheme()
  appliquerAttribut(theme)
}

/** Hook de bascule thème clair/sombre - utilisé depuis Paramètres (voir
 * SettingsPage). Un seul état source (localStorage + attribut DOM), jamais
 * dupliqué en contexte React : peu de composants en ont besoin (le reste du
 * thème passe entièrement par les tokens CSS, pas par du JS conditionnel). */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    appliquerAttribut(theme)
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}
