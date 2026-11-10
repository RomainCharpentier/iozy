import { useEffect, useState } from 'react'

/**
 * What the user chose to see in Ma collection, remembered from one visit to
 * the next.
 *
 * <p>The filter and the view describe a HABIT: nobody wants to ask for them again
 * at each opening.
 *
 * <p>Local and not on the server side: it is a display setting specific to
 * this device, like the theme and the composition of titles (see lib/theme and
 * lib/titleLanguage, whose pattern this module follows).
 */
export type FiltreCollection = 'tout' | 'completer' | 'suivies' | 'envies'
/** How the rooms of Ma collection are drawn: shelves with spines, or small covers. */
export type AffichageCollection = 'etageres' | 'compact' | 'lignes'

interface PreferencesCollection {
  filtre: FiltreCollection
  affichage: AffichageCollection
}

const CLE = 'iozycore.preferencesCollection'

const DEFAUT: PreferencesCollection = { filtre: 'tout', affichage: 'etageres' }

const FILTRES: FiltreCollection[] = ['tout', 'completer', 'suivies', 'envies']
const AFFICHAGES: AffichageCollection[] = ['etageres', 'compact', 'lignes']

/** Validates field by field rather than as a block: a setting added later
 *  must not make the others fall back to their default. */
function lire(): PreferencesCollection {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<PreferencesCollection> | null
    if (!brut || typeof brut !== 'object') return DEFAUT
    return {
      filtre: FILTRES.includes(brut.filtre as FiltreCollection) ? (brut.filtre as FiltreCollection) : DEFAUT.filtre,
      affichage: AFFICHAGES.includes(brut.affichage as AffichageCollection)
        ? (brut.affichage as AffichageCollection)
        : DEFAUT.affichage,
    }
  } catch {
    return DEFAUT
  }
}

function ecrire(preferences: PreferencesCollection): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(preferences))
  } catch {
    // Private browsing, storage refused: the page stays usable, it simply
    // forgets the choice at the next opening.
  }
  window.dispatchEvent(new CustomEvent(CLE))
}

/**
 * The preferences, and the means to change them. Two screens share them (Ma
 * collection and the view of a category): they read the same setting and
 * follow each other, instead of each starting from its own default.
 */
export function usePreferencesCollection(): PreferencesCollection & {
  definir: (partielles: Partial<PreferencesCollection>) => void
} {
  const [preferences, setPreferences] = useState(lire)

  useEffect(() => {
    const auChangement = () => setPreferences(lire())
    window.addEventListener(CLE, auChangement)
    window.addEventListener('storage', auChangement)
    return () => {
      window.removeEventListener(CLE, auChangement)
      window.removeEventListener('storage', auChangement)
    }
  }, [])

  return {
    ...preferences,
    definir: (partielles) => ecrire({ ...lire(), ...partielles }),
  }
}

/** Changes the preferences outside a component (the heart of the headers, which
 *  leads to Ma collection filtered by Envies). */
export function definirPreferencesCollection(partielles: Partial<PreferencesCollection>): void {
  ecrire({ ...lire(), ...partielles })
}
