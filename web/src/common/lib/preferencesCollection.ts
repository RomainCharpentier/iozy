import { useEffect, useState } from 'react'

/**
 * Ce que l'utilisateur a choisi de voir dans Ma collection, retenu d'une
 * visite à l'autre.
 *
 * <h2>Trois filtres, deux vues, deux tris - et une seule page</h2>
 * L'étude produit du 2026-08-27 supprime la séparation « Collection » /
 * « Envies » : ce sont deux lectures du même endroit, et chacune raisonne sur
 * les tomes qu'un groupe contient. Le filtre, le mode de vue et le tri sont
 * mémorisés parce qu'ils décrivent une HABITUDE - quelqu'un qui range par
 * date de venue ne veut pas le redemander à chaque ouverture.
 *
 * <p>En local et non côté serveur : c'est un réglage d'affichage propre à cet
 * appareil, comme le thème et la composition des titres (voir lib/theme et
 * lib/titleLanguage, dont ce module reprend le patron).
 */
export type FiltreCollection = 'tout' | 'possedes' | 'envies'
export type VueCollection = 'groupee' | 'plate'
export type TriCollection = 'recent' | 'titre'

interface PreferencesCollection {
  filtre: FiltreCollection
  vue: VueCollection
  tri: TriCollection
}

const CLE = 'iozycore.preferencesCollection'

/** « Groupée » par défaut : une carte par série est la lecture qui tient sur
 *  un écran, et celle que la page a toujours eue. */
const DEFAUT: PreferencesCollection = { filtre: 'tout', vue: 'groupee', tri: 'recent' }

const FILTRES: FiltreCollection[] = ['tout', 'possedes', 'envies']
const VUES: VueCollection[] = ['groupee', 'plate']
const TRIS: TriCollection[] = ['recent', 'titre']

/** Valide champ par champ plutôt qu'en bloc : un réglage ajouté plus tard ne
 *  doit pas faire retomber les autres sur leur défaut. */
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
    // Navigation privée, stockage refusé : la page reste utilisable, elle
    // oublie simplement le choix à la prochaine ouverture.
  }
  window.dispatchEvent(new CustomEvent(CLE))
}

/**
 * Les préférences, et de quoi les modifier. Deux écrans les partagent (Ma
 * collection et la vue d'une catégorie) : ils lisent le même réglage et se
 * suivent, au lieu de repartir chacun de son propre défaut.
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

/** Modifie les préférences hors composant (le cœur des en-têtes, qui emmène
 *  sur Ma collection filtrée par Envies). */
export function definirPreferencesCollection(partielles: Partial<PreferencesCollection>): void {
  ecrire({ ...lire(), ...partielles })
}
