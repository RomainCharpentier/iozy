import { useEffect, useState } from 'react'
import { ElementManquant } from '@/common/components/ElementManquant'
import { Jaquette } from '@/common/components/Jaquette'
import type { WorkElementDto } from '@/common/types/api'
import type { GesteJeLAi } from './elementsOeuvre'

/**
 * The elements of a work: the volumes of a series, the games of a licence, the
 * expansions of a box, or the work itself (lot 213).
 *
 * <h2>The shape says the state</h2>
 * What is owned shows its cover (its own, or the work's); what is missing is an
 * outline in the vivid tone that breathes (ElementManquant). No word of state
 * under any element: the accessible name says what it is and what a click does.
 *
 * <h2>Two gestures, and only two</h2>
 * A click on a missing element: "je l'ai", at once - adding destroys nothing.
 * A click on an owned element arms its removal in place ("Retirer Tome 3" and
 * "Garder" on the tile itself); only the second click removes. Escape, or
 * arming another tile, disarms it. Never a dialog.
 *
 * <h2>The shape of an element</h2>
 * The one the type declares (`forme`, an aspect class). A type that declares
 * none - a custom type as created - shows each element as its whole cover, in
 * its own proportions, never cropped.
 */
export function GrilleElements({
  elements,
  forme,
  jaquetteOeuvre,
  gesteDe,
  onJeLAi,
  onRetirer,
  immobile,
  consultation,
  enCours,
}: {
  elements: WorkElementDto[]
  /** Aspect class of the type, or null: the whole cover. */
  forme: string | null
  jaquetteOeuvre: string | null
  /** What a click on an element not owned does; null = no gesture. */
  gesteDe: (element: WorkElementDto) => GesteJeLAi
  onJeLAi: (element: WorkElementDto) => void
  /** Absent: owned elements are not removable here (a visitor). */
  onRetirer?: (element: WorkElementDto) => void
  /** Paused or dropped: what is missing does not breathe. */
  immobile: boolean
  /** A visitor: elements of the catalog, nobody's collection - no state at all. */
  consultation: boolean
  /** Keys of the elements whose gesture is running. */
  enCours: ReadonlySet<string>
}) {
  const [armee, setArmee] = useState<string | null>(null)

  useEffect(() => {
    if (!armee) return
    const surTouche = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setArmee(null)
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  }, [armee])

  const colonnes = colonnesPour(forme)

  return (
    <ul className={`grid gap-2.5 ${colonnes}`} aria-label="Éléments de l’œuvre">
      {elements.map((element) => {
        const visible = element.number !== null ? String(element.number) : element.label
        const jaquette = element.coverImageUrl ?? jaquetteOeuvre
        const tuile = (
          <TuileJaquette forme={forme} jaquette={jaquette} visible={visible} estompee={false} />
        )

        if (consultation) {
          return (
            <li key={element.key} className="relative">
              <span className="sr-only">{element.label}</span>
              <div aria-hidden="true">
                <TuileJaquette forme={forme} jaquette={jaquette} visible={visible} estompee={false} />
              </div>
            </li>
          )
        }

        if (element.state === 'OWNED') {
          const armeeIci = armee === element.key
          return (
            <li key={element.key} className="relative">
              <button
                type="button"
                aria-label={element.label}
                title={element.label}
                aria-expanded={onRetirer ? armeeIci : undefined}
                disabled={!onRetirer}
                onClick={() => setArmee(armeeIci ? null : element.key)}
                className="block w-full rounded-xl text-left transition-transform duration-300 hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none disabled:cursor-default disabled:hover:translate-y-0"
              >
                {tuile}
              </button>
              {armeeIci && onRetirer && (
                <div className="iozy-verre iozy-verre--fort absolute inset-x-1 bottom-1 flex flex-col gap-1 rounded-lg p-1.5">
                  <button
                    type="button"
                    autoFocus
                    disabled={enCours.has(element.key)}
                    onClick={() => {
                      setArmee(null)
                      onRetirer(element)
                    }}
                    className="min-h-11 rounded-md bg-danger px-2 text-xs font-semibold text-dangerInk disabled:opacity-60"
                  >
                    Retirer {element.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => setArmee(null)}
                    className="min-h-11 rounded-md px-2 text-xs font-semibold text-textPrimary"
                  >
                    Garder
                  </button>
                </div>
              )}
            </li>
          )
        }

        const geste = gesteDe(element)
        const contenu = (
          <>
            {forme === null && (
              // The shape of a custom element is its cover, drawn faintly
              // under the outline so the missing one keeps the same size.
              <span aria-hidden="true" className="block w-full opacity-[0.15]">
                <TuileJaquette forme={null} jaquette={jaquetteOeuvre} visible="" estompee />
              </span>
            )}
            <span className={forme === null ? 'absolute bottom-2 left-2' : ''}>{visible}</span>
          </>
        )
        if (!geste) {
          return (
            <li key={element.key} className="relative">
              <span
                role="img"
                aria-label={element.label}
                className={`iozy-manque iozy-teinte relative flex items-end overflow-hidden rounded-xl p-2 font-display font-bold ${
                  immobile ? 'animate-none!' : ''
                } ${forme ?? 'p-0'}`}
              >
                {contenu}
              </span>
            </li>
          )
        }
        return (
          <li key={element.key} className="relative">
            <ElementManquant
              libelle={element.label}
              onJeLAi={() => {
                if (!enCours.has(element.key)) onJeLAi(element)
              }}
              immobile={immobile}
              className={`w-full ${forme ?? 'p-0'} ${enCours.has(element.key) ? 'cursor-wait' : ''}`}
            >
              {contenu}
            </ElementManquant>
          </li>
        )
      })}
    </ul>
  )
}

/** The columns follow the shape: a square box needs more room than a pocket volume. */
function colonnesPour(forme: string | null): string {
  if (forme === 'aspect-square') return '[grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]'
  if (forme === 'aspect-[16/9]') return '[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]'
  if (forme === 'aspect-[3/4]') return '[grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]'
  if (forme === null) return 'items-start [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]'
  return '[grid-template-columns:repeat(auto-fill,minmax(78px,1fr))]'
}

function TuileJaquette({
  forme,
  jaquette,
  visible,
  estompee,
}: {
  forme: string | null
  jaquette: string | null
  visible: string
  estompee: boolean
}) {
  const repli = (
    <span
      className={`flex w-full items-end rounded-xl bg-[color-mix(in_srgb,var(--color-textPrimary)_10%,transparent)] p-2 ${forme ?? 'aspect-[2/3]'}`}
    />
  )
  return (
    <span className={`relative block overflow-hidden rounded-xl shadow-token-sm ${forme ?? ''}`}>
      <Jaquette
        src={jaquette}
        repli={repli}
        className={forme ? 'absolute inset-0 h-full w-full object-cover' : 'block h-auto w-full'}
      />
      {!estompee && visible && (
        <span className="absolute bottom-1.5 left-2 font-display text-[15px] font-bold text-white [text-shadow:0_1px_6px_#000]">
          {visible}
        </span>
      )}
    </span>
  )
}
