import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CLASSE_CARTE } from './Carte'

/**
 * A screen that has nothing to show, and says so with a shape.
 *
 * <h2>The flaw</h2>
 * Each screen wrote its empty state in its own way: a gray sentence, a card
 * with a sentence, a simple 12 px "Aucun résultat". An empty state is
 * yet one of the most seen screens of a collection that is starting, and
 * the first one seen by someone who is invited. An icon in a tinted
 * pill, a title in the heading font, a sentence that says the way out,
 * and the action when there is one - the same shape everywhere.
 *
 * <h2>What it does not do</h2>
 * It does not replace silence: a panel that has nothing to say
 * disappears (rule of batch 142). It is used when the screen MUST stay and
 * explain why it is empty.
 */
export function EtatVide({
  icone: Icone,
  titre,
  detail,
  action,
  compact = false,
}: {
  icone: LucideIcon
  titre: string
  detail?: ReactNode
  action?: ReactNode
  /** Without a card or full-size pill: for an empty state in the middle of a list. */
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2 text-sm text-textDim">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-faint">
          <Icone size={16} />
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-textPrimary">{titre}</span>
          {detail && <span className="block text-xs">{detail}</span>}
        </span>
      </div>
    )
  }
  return (
    <div className={`${CLASSE_CARTE} flex flex-col items-center gap-3 text-center`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accentTint text-accentText">
        <Icone size={22} />
      </span>
      <p className="font-display text-base font-semibold text-textPrimary">{titre}</p>
      {detail && <p className="max-w-sm text-sm text-textDim">{detail}</p>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
