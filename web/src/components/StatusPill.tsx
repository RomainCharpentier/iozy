import { Check, Star, Plus } from 'lucide-react'
import type { LookupStatus } from '../types/api'

const CONFIG: Record<LookupStatus, { label: string; icon: typeof Check; className: string }> = {
  OWNED: { label: 'Possédé', icon: Check, className: 'bg-accent text-accentText' },
  WISHLISTED: { label: 'En wishlist', icon: Star, className: 'bg-violet text-textPrimary' },
  UNKNOWN: { label: 'Inconnu', icon: Plus, className: 'bg-surface text-textDim' },
}

/** Statut possédé/wishlisté/inconnu - vérification avant achat (écran Search). */
export function StatusPill({ status }: { status: LookupStatus }) {
  const { label, icon: Icon, className } = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${className}`}>
      <Icon size={14} strokeWidth={2.5} />
      {label}
    </span>
  )
}
