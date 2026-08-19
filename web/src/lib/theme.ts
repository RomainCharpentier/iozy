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
export function applyStoredTheme(): void {
  const theme = readStoredTheme()
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : undefined
}

/** Hook de bascule thème clair/sombre - utilisé depuis Paramètres (voir
 * SettingsPage). Un seul état source (localStorage + attribut DOM), jamais
 * dupliqué en contexte React : peu de composants en ont besoin (le reste du
 * thème passe entièrement par les tokens CSS, pas par du JS conditionnel). */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : undefined
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return {
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
  }
}
