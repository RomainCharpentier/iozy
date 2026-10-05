import type { PriceBasis } from '@/common/types/purchaseAnalysis'

/**
 * Where a price comes from: how we TELL the user.
 *
 * <h2>Why this question deserves a module</h2>
 * `PriceBasis` distinguishes three origins that do not deserve the same
 * trust at all: a price taken from real listings (`OBSERVED_MARKET`), an
 * estimate produced by the AI and never verified (`AI_ESTIMATED`), and a
 * theoretical reference price computed from the new price
 * (`THEORETICAL_ONLY`).
 *
 * <p>Four screens translated this enum each in their own corner, and one of
 * them only knew two values: `SuggestionsPage` was written before the AI
 * existed and put a "(marché)" on everything that was not theoretical - so on
 * an AI estimate. This is exactly what the guardrail of the feature forbids:
 * data produced by the AI must never be presented as real data. A third value
 * added to the enum can no longer go unnoticed if only one place names it.
 *
 * <p>Two registers, because the surfaces do not have the same room: an aside
 * in parentheses after an amount, or a sentence of the assistant. This is the
 * only thing that separates them - the meaning is written once.
 *
 * <p>`null` (the backend returns it when the cost is zero or unknown, see
 * `CollectionStatus`) is NOT translated by falling back to "theoretical":
 * the caller gets `null` in turn and writes nothing, rather than claiming
 * an origin we do not know.
 */
export function libelleBaseCourt(base: PriceBasis | null): string | null {
  if (base === 'OBSERVED_MARKET') return 'marché'
  if (base === 'AI_ESTIMATED') return 'estimation IA'
  if (base === 'THEORETICAL_ONLY') return 'théorique'
  return null
}

/** The same meaning, in full words, for a sentence (see `libelleBaseCourt`). */
export function libelleBaseLong(base: PriceBasis | null): string | null {
  if (base === 'OBSERVED_MARKET') return 'prix de marché observés'
  if (base === 'AI_ESTIMATED') return 'estimation IA, non vérifiée'
  if (base === 'THEORETICAL_ONLY') return 'prix de référence théorique'
  return null
}
