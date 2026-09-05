import { useSyncExternalStore } from 'react'

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

/**
 * UN seul état, hors de React, et tous les composants le lisent.
 *
 * <h2>Pourquoi plus un `useState` par composant</h2>
 * Le hook gardait son propre état, relu dans le localStorage au montage. Tant
 * qu'un seul interrupteur existait (Paramètres), personne ne le voyait. Le
 * bouton de l'en-tête (lot 138) est rendu DEUX fois - par l'en-tête desktop et
 * par l'en-tête mobile, dont l'un est masqué par CSS - et deux états privés
 * auraient divergé au premier clic : l'icône de l'autre barre aurait montré
 * l'ancien mode, et son clic suivant l'aurait « rebasculé » vers celui qu'on
 * venait de quitter. Un magasin unique, souscrit par `useSyncExternalStore`,
 * fait de chaque bouton une vue du même fait.
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

/** Applique l'attribut avant le premier rendu React (voir l'appel synchrone
 * dans main.tsx) - évite un flash thème-par-défaut puis thème-stocké au
 * chargement. `data-theme` uniquement pour "dark" : le clair reste la valeur
 * de base de :root dans index.css, pas besoin d'un attribut pour lui. */
export function applyStoredTheme(): void {
  themeCourant = readStoredTheme()
  appliquerAttribut(themeCourant)
}

export function setTheme(theme: Theme): void {
  themeCourant = theme
  appliquerAttribut(theme)
  window.localStorage.setItem(STORAGE_KEY, theme)
  for (const rappel of abonnes) rappel()
}

export function toggleTheme(): void {
  setTheme(themeCourant === 'dark' ? 'light' : 'dark')
}

/** Le thème courant, et de quoi le changer - depuis l'en-tête (voir
 * BoutonTheme). Un seul état source (ce module, le localStorage et l'attribut
 * DOM) : le reste du thème passe entièrement par les tokens CSS, pas par du
 * JS conditionnel. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const theme = useSyncExternalStore(souscrire, lireTheme, () => DEFAULT_THEME)
  return { theme, setTheme, toggleTheme }
}
