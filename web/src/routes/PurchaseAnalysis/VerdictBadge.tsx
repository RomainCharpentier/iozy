import { CheckCheck, Check, Minus, TriangleAlert, X } from 'lucide-react'
import type { Verdict } from '../../types/purchaseAnalysis'

// Même patron que StatusPill.tsx (Record<Status, {label, icon, className}>).
// EXCELLENTE/BONNE AFFAIRE partagent le token `accent` existant (différenciés
// par icône/libellé, voir le pictogramme 🟢🟢 vs 🟢 du cahier des charges) ;
// PRIX CORRECT introduit --color-warning, CHER réutilise `pink`, À ÉVITER
// introduit --color-danger - décision de palette validée avec l'utilisateur
// (voir index.css).
const CONFIG: Record<Verdict, { label: string; icon: typeof Check; className: string }> = {
  EXCELLENT_DEAL: { label: 'Excellente affaire', icon: CheckCheck, className: 'bg-accent text-accentText' },
  GOOD_DEAL: { label: 'Bonne affaire', icon: Check, className: 'bg-accent text-accentText' },
  FAIR_PRICE: { label: 'Prix correct', icon: Minus, className: 'bg-warning text-accentText' },
  EXPENSIVE: { label: 'Cher', icon: TriangleAlert, className: 'bg-pink text-textPrimary' },
  AVOID: { label: 'À éviter', icon: X, className: 'bg-danger text-textPrimary' },
}

export function VerdictBadge({ verdict, score }: { verdict: Verdict; score?: number }) {
  const { label, icon: Icon, className } = CONFIG[verdict]
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${className}`}>
      <Icon size={18} strokeWidth={2.5} />
      {label}
      {score !== undefined && <span className="font-normal opacity-80">· {score}/100</span>}
    </span>
  )
}
