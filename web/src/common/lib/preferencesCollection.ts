import { useEffect, useState } from 'react'

/**
 * What the user chose to see in Ma collection, remembered from one visit to
 * the next.
 *
 * <h2>Three filters, two views, two sorts - and one single page</h2>
 * The product study of 2026-08-27 removes the "Collection" / "Envies"
 * separation: they are two readings of the same place, and each one reasons
 * on the volumes that a group contains. The filter, the view mode and the
 * sort are remembered because they describe a HABIT - someone who sorts by
 * date of arrival does not want to ask for it again at each opening.
 *
 * <p>Local and not on the server side: it is a display setting specific to
 * this device, like the theme and the composition of titles (see lib/theme and
 * lib/titleLanguage, whose pattern this module follows).
 */
export type FiltreCollection = 'tout' | 'possedes' | 'suivies' | 'envies'
export type VueCollection = 'groupee' | 'plate'
export type TriCollection = 'recent' | 'titre'

interface PreferencesCollection {
  filtre: FiltreCollection
  vue: VueCollection
  tri: TriCollection
}

const CLE = 'iozycore.preferencesCollection'

/** "Grouped" by default: one card per series is the reading that fits on a
 *  screen, and the one the page has always had. */
const DEFAUT: PreferencesCollection = { filtre: 'tout', vue: 'groupee', tri: 'recent' }

const FILTRES: FiltreCollection[] = ['tout', 'possedes', 'suivies', 'envies']
const VUES: VueCollection[] = ['groupee', 'plate']
const TRIS: TriCollection[] = ['recent', 'titre']

/** Validates field by field rather than as a block: a setting added later
 *  must not make the others fall back to their default. */
function lire(): PreferencesCollection {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? 'null') as Partial<PreferencesCollection> | null
    if (!brut || typeof brut !== 'object') return DEFAUT
    return {
      filtre: FILTRES.includes(brut.filtre as FiltreCollection) ? (brut.filtre as FiltreCollection) : DEFAUT.filtre,
      vue: VUES.includes(brut.vue as VueCollection) ? (brut.vue as VueCollection) : DEFAUT.vue,
      tri: TRIS.includes(brut.tri as TriCollection) ? (brut.tri as TriCollection) : DEFAUT.tri,
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
