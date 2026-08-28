import type { PriceBasis } from '../types/purchaseAnalysis'

/**
 * D'où vient un prix : comment on le DIT à l'utilisateur.
 *
 * <h2>Pourquoi cette question mérite un module</h2>
 * `PriceBasis` distingue trois origines qui n'engagent pas du tout la même
 * confiance : un prix relevé sur de vraies annonces (`OBSERVED_MARKET`), une
 * estimation produite par l'IA et jamais vérifiée (`AI_ESTIMATED`), et un
 * prix de référence théorique calculé à partir du prix neuf
 * (`THEORETICAL_ONLY`).
 *
 * <p>Quatre écrans traduisaient cet enum chacun dans son coin, et l'un d'eux
 * n'en connaissait que deux valeurs : `SuggestionsPage` a été écrite avant que
 * l'IA existe et posait un « (marché) » sur tout ce qui n'était pas théorique
 * - donc sur une estimation IA. C'est exactement ce que le garde-fou de la
 * fonctionnalité interdit : une donnée produite par l'IA ne doit jamais être
 * présentée comme une donnée réelle. Une troisième valeur ajoutée à l'enum ne
 * peut plus passer inaperçue si un seul endroit la nomme.
 *
 * <p>Deux registres, parce que les surfaces n'ont pas la même place : une
 * incise entre parenthèses derrière un montant, ou une phrase de l'assistant.
 * C'est la seule chose qui les sépare - le sens, lui, est écrit une fois.
 *
 * <p>`null` (le backend le rend quand le coût est nul ou inconnu, voir
 * `CollectionStatus`) ne se traduit PAS par un repli sur « théorique » :
 * l'appelant reçoit `null` à son tour et n'écrit rien, plutôt que d'affirmer
 * une origine qu'on ne connaît pas.
 */
export function libelleBaseCourt(base: PriceBasis | null): string | null {
  if (base === 'OBSERVED_MARKET') return 'marché'
  if (base === 'AI_ESTIMATED') return 'estimation IA'
  if (base === 'THEORETICAL_ONLY') return 'théorique'
  return null
}

/** Le même sens, en toutes lettres, pour une phrase (voir `libelleBaseCourt`). */
export function libelleBaseLong(base: PriceBasis | null): string | null {
  if (base === 'OBSERVED_MARKET') return 'prix de marché observés'
  if (base === 'AI_ESTIMATED') return 'estimation IA, non vérifiée'
  if (base === 'THEORETICAL_ONLY') return 'prix de référence théorique'
  return null
}
