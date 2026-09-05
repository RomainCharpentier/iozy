import type { ReactNode } from 'react'

/**
 * La surface de contenu de la maquette v4 : coins à 20px, fond `surface`,
 * ombre douce, respiration interne de 24px.
 *
 * <h2>Une constante ET un composant</h2>
 * La constante sert là où la carte est déjà un autre élément (un `<section>`,
 * un `<article>`, un bouton-carte) et où l'envelopper d'un `<div>` ajouterait
 * un nœud pour rien. Le composant sert partout ailleurs. Les deux disent la
 * même chose - c'est le but : le dépôt comptait seize écritures différentes de
 * « une carte » (`p-2`, `p-3`, `p-4`, `p-5`, `p-6`, avec ou sans ombre), donc
 * seize cartes qui ne se ressemblaient pas tout à fait.
 *
 * <h2>La bordure, absente de la maquette, est gardée</h2>
 * La maquette n'existe qu'en thème clair, où l'ombre suffit à décoller la
 * carte du fond. En thème sombre l'ombre est du noir sur du presque-noir : il
 * ne reste que l'écart `surface` / `background`, et une carte posée sur une
 * autre disparaît. La bordure `surface2` est ce qui la fait tenir dans les
 * deux thèmes - invisible en clair, structurante en sombre.
 */
export const CLASSE_CARTE = 'rounded-[20px] border border-surface2 bg-surface p-5 shadow-token-sm sm:p-6'

/** Même carte, en zone de danger : pas d'ombre ni de bordure, un fond teinté
 *  qui signale à lui seul qu'on n'est plus dans le contenu ordinaire (voir la
 *  maquette v4, bloc « Supprimer cette fiche »). */
export const CLASSE_CARTE_DANGER = 'rounded-[20px] bg-dangerTint p-5'

export function Carte({
  children,
  ton = 'neutre',
  className = '',
}: {
  children: ReactNode
  ton?: 'neutre' | 'danger'
  className?: string
}) {
  return <div className={`${ton === 'danger' ? CLASSE_CARTE_DANGER : CLASSE_CARTE} ${className}`}>{children}</div>
}
