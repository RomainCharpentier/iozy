interface StatCardProps {
  value: string
  label: string
}

/** Carte KPI - ligne de stats Shelf et grille de la page Stats. */
export function StatCard({ value, label }: StatCardProps) {
  return (
    <div className="rounded-[15px] border border-surface2 bg-surface p-4 text-left">
      <div className="font-display text-2xl font-bold text-textPrimary">{value}</div>
      <div className="text-sm text-textDim">{label}</div>
    </div>
  )
}
