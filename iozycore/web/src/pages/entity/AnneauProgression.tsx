/**
 * The ring around the count, in the vivid tone of the cover (lot 213).
 * Decorative: the count beside it says the same thing in words. Without a
 * known total there is no ring - a ring that guesses would lie.
 */
export function AnneauProgression({ possedes, total, taille = 112 }: { possedes: number; total: number; taille?: number }) {
  const trait = 9
  const rayon = (taille - trait) / 2
  const circonference = 2 * Math.PI * rayon
  const part = total > 0 ? Math.min(1, possedes / total) : 0
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} aria-hidden="true" className="shrink-0 -rotate-90">
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={rayon}
        fill="none"
        strokeWidth={trait}
        className="stroke-[color-mix(in_srgb,var(--color-textPrimary)_18%,transparent)]"
      />
      <circle
        cx={taille / 2}
        cy={taille / 2}
        r={rayon}
        fill="none"
        strokeWidth={trait}
        strokeLinecap="round"
        strokeDasharray={`${circonference * part} ${circonference}`}
        className="iozy-teinte stroke-vive transition-[stroke-dasharray] duration-700 motion-reduce:transition-none"
      />
    </svg>
  )
}
