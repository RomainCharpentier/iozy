import { CheckCheck, Check, Minus, TriangleAlert, X } from 'lucide-react'
import type { Verdict } from '@/common/types/purchaseAnalysis'

// Record<Verdict, {label, icon, className}> - EXCELLENTE/BONNE AFFAIRE share the existing `accent` token (told apart
// by icon/label, see the 🟢🟢 vs 🟢 pictogram of the specification);
// PRIX CORRECT uses --color-warning with ITS ink (warningInk); CHER is
// a MUTED danger (tinted background + danger text) rather than a
// full fill, which sets it apart from À ÉVITER while keeping the severity order -
// it used `pink`, a legacy token that is not theme-reactive, with textPrimary:
// 2.26:1 in dark. À ÉVITER keeps the full fill.
// See index.css for the palette.
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
