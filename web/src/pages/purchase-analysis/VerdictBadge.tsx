import { CheckCheck, Check, Minus, TriangleAlert, X } from 'lucide-react'
import type { Verdict } from '@/common/types/purchaseAnalysis'

// Record<Verdict, {label, icon, className}> - EXCELLENTE/BONNE AFFAIRE partagent le token `accent` existant (différenciés
// par icône/libellé, voir le pictogramme 🟢🟢 vs 🟢 du cahier des charges) ;
// PRIX CORRECT utilise --color-warning avec SON encre (warningInk) ; CHER est
// un danger ATTÉNUÉ (fond teinté + texte danger) plutôt qu'un remplissage
// plein, ce qui le distingue d'À ÉVITER tout en gardant l'ordre de gravité -
// il utilisait `pink`, un token hérité non thème-réactif, avec textPrimary :
// 2.26:1 en sombre. À ÉVITER garde le remplissage plein.
// Voir index.css pour la palette.
const CONFIG: Record<Verdict, { label: string; icon: typeof Check; className: string }> = {
  EXCELLENT_DEAL: { label: 'Excellente affaire', icon: CheckCheck, className: 'bg-accent text-accentInk' },
  GOOD_DEAL: { label: 'Bonne affaire', icon: Check, className: 'bg-accent text-accentInk' },
  FAIR_PRICE: { label: 'Prix correct', icon: Minus, className: 'bg-warning text-warningInk' },
  EXPENSIVE: { label: 'Cher', icon: TriangleAlert, className: 'bg-dangerTint text-dangerText' },
  AVOID: { label: 'À éviter', icon: X, className: 'bg-danger text-dangerInk' },
}

export function VerdictBadge({ verdict, score }: { verdict: Verdict; score?: number }) {
  const { label, icon: Icon, className } = CONFIG[verdict]
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${className}`}>
      <Icon size={18} strokeWidth={2.5} />
      {label}
      {score !== undefined && <span className="font-normal opacity-80">· {score}/100</span>}
    </span>
  )
}
