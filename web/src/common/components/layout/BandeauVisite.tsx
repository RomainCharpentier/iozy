import { Eye } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * What a visitor must read permanently: <b>what they are looking at</b>, and
 * <b>that they cannot change anything</b>.
 *
 * <h2>Permanent, and not a welcome message</h2>
 * The temptation was to announce the visit once, at the entrance, then to leave
 * room for the content. It does not hold: these screens are exactly those
 * of a personal collection, and nothing tells "the catalog" apart by eye
 * from "an empty collection". Someone who arrives three screens later, or
 * who comes back to a tab left open, would have no way of knowing
 * what they are looking at - nor why a detail page cannot be edited.
 *
 * <h2>It informs, it does not act</h2>
 * The exit lived here, then it moved up into the header: there is now
 * only ONE button to leave, in the same place for an account and for a
 * visitor (see {@code BoutonSortie}). This banner says what we are looking at; the
 * action is elsewhere, where people look for it.
 */
export function BandeauVisite() {
  const { estInvite } = useAuth()
  if (!estInvite) return null

  return (
    <div className="border-b border-line bg-surface2">
      <div className="mx-auto flex w-[min(100%-2rem,1600px)] flex-wrap items-center gap-x-3 gap-y-1.5 py-2 md:w-[min(100%-3rem,1600px)]">
        <Eye size={16} className="shrink-0 text-textDim" aria-hidden="true" />
        <p className="min-w-0 text-sm text-textDim">
          <span className="font-semibold text-textPrimary">Mode visiteur</span> — tu consultes le catalogue
          des œuvres, en lecture seule.
        </p>
      </div>
    </div>
  )
}
