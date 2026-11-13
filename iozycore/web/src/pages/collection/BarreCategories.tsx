import { useEffect, useRef, useState } from 'react'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import type { EntityTypeDto } from '@/common/types/api'
import { mouvementReduit } from '@/common/lib/volJaquette'

/**
 * The categories of My collection, always in reach: the bar stays under the
 * header and lights up the room being read. Only there with two rooms or more.
 */
export function BarreCategories({
  salles,
  colonne = false,
}: {
  salles: { entityType: EntityTypeDto; nombre: number }[]
  /** The index of the poster column (lot 226): one row per room, its count in big. */
  colonne?: boolean
}) {
  const barre = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const ids = salles.map((salle) => salle.entityType.id).join('|')

  // A click names the room, even when the page cannot scroll far enough to bring it under the bar.
  const choisie = useRef(false)
  const delaiChoix = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(delaiChoix.current), [])

  useEffect(() => {
    const liste = ids.split('|')
    const allumer = () => {
      if (choisie.current) return
      // The column does not sit above the rooms: the line under the top bar marks the room read.
      const repere = colonne ? 160 : (barre.current?.getBoundingClientRect().bottom ?? 0) + 60
      let courante: string | null = null
      for (const id of liste) {
        const salle = document.getElementById(`salle-${id}`)
        if (salle && salle.getBoundingClientRect().top <= repere) courante = id
      }
      setActive(courante ?? liste[0] ?? null)
    }
    allumer()
    window.addEventListener('scroll', allumer, { passive: true })
    window.addEventListener('resize', allumer)
    return () => {
      window.removeEventListener('scroll', allumer)
      window.removeEventListener('resize', allumer)
    }
  }, [ids, colonne])

  return (
    <nav ref={barre} aria-label="Catégories" className={colonne ? 'flex flex-col border-t border-ligneVerre' : 'salle-barre defilement-discret'}>
      {salles.map(({ entityType, nombre }) => {
        const courante = entityType.id === active
        return (
          <button
            key={entityType.id}
            type="button"
            aria-current={courante ? 'true' : undefined}
            onClick={() => {
              setActive(entityType.id)
              choisie.current = true
              window.clearTimeout(delaiChoix.current)
              delaiChoix.current = window.setTimeout(() => {
                choisie.current = false
              }, 900)
              document
                .getElementById(`salle-${entityType.id}`)
                ?.scrollIntoView({ behavior: mouvementReduit() ? 'auto' : 'smooth', block: 'start' })
            }}
            className={
              colonne
                ? `flex min-h-11 items-baseline gap-4 border-b border-ligneVerre py-3 text-left transition-colors ${courante ? 'text-vive' : 'text-textPrimary hover:text-vive'}`
                : 'salle-categorie'
            }
            style={{ '--u': getEntityTypeVisual(entityType).color } as React.CSSProperties}
          >
            {colonne ? (
              <>
                <span className="font-display text-outil font-bold tracking-[-0.05em] tabular-nums">{nombre}</span>
                <span className="text-section font-semibold">{entityType.label}</span>
              </>
            ) : (
              <>
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--u)]" />
                {entityType.label}
                <i className="font-sans text-[13px] font-normal text-faint not-italic">{nombre}</i>
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
