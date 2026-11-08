import { useEffect, useRef } from 'react'
import { mouvementReduit } from '@/common/lib/volJaquette'
import type { Fait } from './faitsDeLOeuvre'

export function FaitsFiche({ faits }: { faits: Fait[] }) {
  if (faits.length === 0) return null
  return (
    <dl className="grid gap-2.5 pt-5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {faits.map(({ libelle, valeur, large }, index) => (
        <div key={`${libelle}-${index}`} className={`min-w-0 rounded-[14px] bg-surface/80 px-4 py-3.5 ${large ? 'sm:col-span-2' : ''}`}>
          <dt className="text-[12.5px] text-faint">{libelle}</dt>
          <dd className="mt-0.5 font-display text-[20px] leading-tight font-semibold break-words text-textPrimary">
            {valeur}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** "8 / 41" and what is missing: the first thing a collector looks for. */
export function CompteTomes({ possedes, total }: { possedes: number; total: number | null }) {
  const manque = total === null ? 0 : Math.max(0, total - possedes)
  const s = possedes > 1 ? 's' : ''
  // The number answers the gesture.
  const nombre = useRef<HTMLElement>(null)
  const avant = useRef(possedes)
  useEffect(() => {
    if (avant.current === possedes) return
    avant.current = possedes
    if (mouvementReduit()) return
    nombre.current?.animate?.([{ transform: 'scale(.92)' }, { transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 300 })
  }, [possedes])
  return (
    <div className="pt-1">
      <div className="flex flex-wrap items-baseline gap-3">
        {total !== null && <span className="sr-only">{`${possedes} tome${s} possédé${s} sur ${total}`}</span>}
        <b ref={nombre} aria-hidden={total !== null} className="inline-block font-display text-[30px] font-semibold text-textPrimary tabular-nums">
          {total === null ? possedes : `${possedes} / ${total}`}
        </b>
        <span className="text-textDim">
          {total === null
            ? `tome${s} dans ta collection, total inconnu`
            : manque > 0
              ? `Il te manque ${manque} tome${manque > 1 ? 's' : ''}.`
              : 'Série complète.'}
        </span>
      </div>
      {total !== null && total > 0 && (
        <div aria-hidden="true" className="mt-2 h-[5px] overflow-hidden rounded-[3px] bg-line">
          <div
            className="h-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.round((possedes * 100) / total))}%` }}
          />
        </div>
      )}
    </div>
  )
}
