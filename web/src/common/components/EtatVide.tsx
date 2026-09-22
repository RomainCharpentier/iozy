import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CLASSE_CARTE } from './Carte'

/**
 * Un écran qui n'a rien à montrer, et qui le dit avec une forme.
 *
 * <h2>Le défaut</h2>
 * Chaque écran écrivait son vide à sa manière : une phrase grise, une carte
 * avec une phrase, un simple « Aucun résultat » de 12 px. Un état vide est
 * pourtant l'un des écrans les plus vus d'une collection qui commence, et
 * le premier que voit quelqu'un qu'on invite. Une icône dans une pastille
 * teintée, un titre en police de titrage, une phrase qui dit par où sortir,
 * et l'action quand il y en a une - la même forme partout.
 *
 * <h2>Ce qu'il ne fait pas</h2>
 * Il ne se substitue pas au silence : un panneau qui n'a rien à dire
 * disparaît (règle du lot 142). Il sert quand l'écran DOIT rester et
 * expliquer pourquoi il est vide.
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
  /** Sans carte ni pastille pleine taille : pour un vide au milieu d'une liste. */
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
