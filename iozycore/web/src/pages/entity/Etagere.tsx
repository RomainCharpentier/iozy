import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, Heart, Plus, Trash2, X } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import { tonDe } from './useTeinteJaquette'
import type { VolumeAffiche } from './GrilleVolumes'
import { ECART_DOS, LARGEUR_DOS, MARGE_ETAGE, coteDeLaCarte, dosParEtage, repartirEnEtages } from './etages'

const HAUTEUR_DOS = 150
/** The cover that opens above a spine. */
const LARGEUR_CARTE = 112

/**
 * The volumes of an edition, standing on shelves - what a collector sees
 * when looking at the real thing.
 *
 * <h2>Why spines, and not tiles</h2>
 * A grid of tiles told the state of a volume by a solid or a dashed
 * border, and a greyed cover, which read as a broken image rather than as a
 * hole (owner's review of 2026-10-31: "ce qui est difficile à comprendre
 * c'est surtout de voir l'état actuel du tome"). On a shelf, the state IS
 * the object: an owned volume is a slice of its cover standing there, a
 * missing one is an empty, dashed slot with its number, a wanted one is
 * that slot with a heart on top. Nothing is written on the volumes.
 *
 * <h2>Shelves, never a wider page</h2>
 * The spines are small, so a shelf holds about forty-seven of them at
 * 1,280 px and thirteen on a phone; a series longer than that gets more
 * shelves, computed from the real width (`ResizeObserver`). A shelf never
 * scrolls sideways and never overflows the window.
 *
 * <h2>A volume opens above the shelf</h2>
 * Hovering a spine, focusing it, or tapping it pulls the volume out: its
 * cover grows above its slot without pushing the neighbours, and the
 * gestures come with it - "Je l'ai" and the heart for a missing volume,
 * the removal (in two gestures, as everywhere) for an owned one. The
 * same gestures as the grid, by the same names: the journeys and the
 * screen readers do not notice the shelf.
 */
export function Etagere({
  volumes,
  mode,
  teinte,
  edition,
  onJeLAi,
  onJeLeVeux,
  onRetirer,
  action,
}: {
  volumes: VolumeAffiche[]
  /** `consultation`: the catalog seen by a visitor - spines, no gesture. */
  mode: 'navigation' | 'consultation'
  /** The tint of the series, for an owned volume that has no cover yet. */
  teinte?: [number, number, number]
  /** Named next to an owned volume ("Tome 3 · Glénat"). */
  edition?: string
  onJeLAi?: (cle: string) => void
  onJeLeVeux?: (cle: string) => void
  onRetirer?: (cle: string) => void
  /** A button after the shelves ("Ajouter un tome"). */
  action?: { libelle: string; onClick: () => void }
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)
  // The volume pulled out by a tap or the keyboard - one at a time. The
  // mouse goes through :hover and needs no state.
  const [ouvert, setOuvert] = useState<string | null>(null)
  // The owned volume whose removal is being confirmed - one at a time.
  const [armee, setArmee] = useState<string | null>(null)

  useLayoutEffect(() => {
    const element = conteneur.current
    if (!element) return
    setLargeur(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver((entrees) => {
      for (const entree of entrees) setLargeur(entree.contentRect.width)
    })
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  // A tap elsewhere puts the volume back on the shelf.
  useEffect(() => {
    if (!ouvert) return
    const fermer = (evenement: PointerEvent) => {
      const cible = evenement.target as Element | null
      if (cible?.closest('[data-dos-ouvert="true"]')) return
      setOuvert(null)
      setArmee(null)
    }
    document.addEventListener('pointerdown', fermer)
    return () => document.removeEventListener('pointerdown', fermer)
  }, [ouvert])

  const etages = repartirEnEtages(volumes, dosParEtage(largeur))
  const gestes = mode === 'navigation'

  return (
    <div ref={conteneur} className="flex flex-col gap-6">
      {etages.map((etage, index) => (
        <div key={index} className="flex flex-col">
          <div
            className="flex items-end"
            style={{ gap: ECART_DOS, paddingLeft: MARGE_ETAGE, paddingRight: MARGE_ETAGE, paddingTop: 28, height: HAUTEUR_DOS + 28 }}
          >
            {etage.map((volume, index) => (
              <Dos
                key={volume.cle}
                volume={volume}
                gestes={gestes}
                teinte={teinte}
                edition={edition}
                cote={coteDeLaCarte(index, etage.length)}
                ouvert={ouvert === volume.cle}
                armee={armee === volume.cle}
                onOuvrir={() => {
                  setOuvert((courant) => (courant === volume.cle ? null : volume.cle))
                  setArmee(null)
                }}
                onJeLAi={onJeLAi ? () => onJeLAi(volume.cle) : undefined}
                onJeLeVeux={onJeLeVeux ? () => onJeLeVeux(volume.cle) : undefined}
                onArmer={onRetirer ? () => setArmee(volume.cle) : undefined}
                onGarder={() => setArmee(null)}
                onRetirer={
                  onRetirer
                    ? () => {
                        setArmee(null)
                        setOuvert(null)
                        onRetirer(volume.cle)
                      }
                    : undefined
                }
              />
            ))}
          </div>
          {/* The plank: a surface with a line of light on top and a shadow
              underneath, in the colors of the theme. */}
          <div
            aria-hidden="true"
            className="h-3 rounded-[3px] bg-gradient-to-b from-surface2 to-surface shadow-token-md ring-1 ring-line"
          />
          <div aria-hidden="true" className="compteur flex justify-between px-5 pt-1.5 text-[11px] text-faint">
            <span>{etage[0]?.numero}</span>
            {etage.length > 1 && <span>{etage[etage.length - 1]?.numero}</span>}
          </div>
        </div>
      ))}
      {action && (
        <button type="button" onClick={action.onClick} className="btn-secondaire w-fit">
          <Plus size={15} />
          {action.libelle}
        </button>
      )}
    </div>
  )
}

const PLACEMENT_CARTE = {
  gauche: 'left-0 origin-bottom-left',
  centre: 'left-1/2 -translate-x-1/2 origin-bottom',
  droite: 'right-0 origin-bottom-right',
} as const

const PLACEMENT_PILULE = {
  gauche: 'left-0',
  centre: 'left-1/2 -translate-x-1/2',
  droite: 'right-0',
} as const

function Dos({
  volume,
  gestes,
  teinte,
  edition,
  cote,
  ouvert,
  armee,
  onOuvrir,
  onJeLAi,
  onJeLeVeux,
  onArmer,
  onGarder,
  onRetirer,
}: {
  volume: VolumeAffiche
  gestes: boolean
  teinte?: [number, number, number]
  edition?: string
  cote: 'gauche' | 'centre' | 'droite'
  ouvert: boolean
  armee: boolean
  onOuvrir: () => void
  onJeLAi?: () => void
  onJeLeVeux?: () => void
  onArmer?: () => void
  onGarder: () => void
  onRetirer?: () => void
}) {
  const { numero, jaquetteUrl, possede, voulu } = volume
  const etat = possede ? 'possédé' : voulu ? 'dans mes envies' : 'manquant'
  const numeroAffiche = String(numero).padStart(2, '0')
  // A visitor has no collection: every volume of the edition stands there,
  // with its cover when the catalogue has one, never as a hole. The name
  // says nothing personal either (same rule as the grid's consultation tile).
  const present = possede || !gestes
  // The slot of a missing volume: dashed, faint; of a wanted one: dashed, accent.
  const forme = present
    ? 'bg-surface2 ring-1 ring-lineStrong ring-inset'
    : voulu
      ? 'border-[1.5px] border-dashed border-accent bg-accentTint'
      : 'border-[1.5px] border-dashed border-lineStrong bg-surface/40'
  const couleurNumero = present ? 'text-textPrimary' : voulu ? 'text-accentText' : 'text-faint'

  return (
    <div
      className="group relative shrink-0"
      style={{ width: LARGEUR_DOS, height: HAUTEUR_DOS }}
      data-dos-ouvert={ouvert ? 'true' : undefined}
    >
      <button
        type="button"
        onClick={gestes ? onOuvrir : undefined}
        aria-label={gestes ? `Tome ${numero}, ${etat}` : `Tome ${numero}`}
        aria-expanded={gestes ? ouvert : undefined}
        className={`relative block h-full w-full overflow-hidden rounded-t-[3px] rounded-b-[1px] transition duration-150 ${forme} ${
          gestes ? 'group-hover:-translate-y-0.5' : ''
        }`}
        style={present && !jaquetteUrl && teinte ? { background: tonDe(teinte, 100, 0.35) } : undefined}
      >
        {present && jaquetteUrl ? (
          // A slice of the cover, cropped near its left edge: the colors of
          // the real book, not its text. The gradient rounds the spine.
          <>
            <img
              src={jaquetteUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute top-0 h-full max-w-none object-cover"
              style={{ width: 100, left: -26 }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/30"
            />
          </>
        ) : (
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 bottom-2 flex justify-center font-display text-[11px] font-medium ${couleurNumero} [writing-mode:vertical-rl] rotate-180`}
          >
            {numeroAffiche}
          </span>
        )}
      </button>
      {gestes && voulu && (
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 flex h-[18px] w-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accentInk shadow-token-sm"
        >
          <Heart size={9} className="fill-current" />
        </span>
      )}

      {/* The volume pulled out of the shelf: its cover above the slot, the
          gestures under it. Invisible and inert until hover, focus or tap;
          `group-hover` only applies where a pointer can hover (Tailwind
          wraps it in `@media (hover: hover)`), the tap state covers touch. */}
      <div
        className={`pointer-events-none absolute bottom-0 z-10 scale-75 opacity-0 transition duration-200 ease-[var(--ease-sortie)] group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 ${
          PLACEMENT_CARTE[cote]
        } ${ouvert ? 'pointer-events-auto scale-100 opacity-100' : ''}`}
        style={{ width: LARGEUR_CARTE }}
      >
        <div className="aspect-[2/3] w-full overflow-hidden rounded-md bg-surface2 shadow-token-elevated ring-1 ring-line">
          <Jaquette
            src={jaquetteUrl}
            className="h-full w-full object-cover"
            repli={
              <span
                className={`flex h-full w-full items-center justify-center font-display text-[32px] font-medium ${couleurNumero}`}
                style={present && teinte ? { background: tonDe(teinte, 100, 0.35) } : undefined}
              >
                {numeroAffiche}
              </span>
            }
          />
        </div>
        {gestes && (
          <div className={`absolute top-full mt-2 flex items-center gap-1 rounded-full bg-surface p-1 whitespace-nowrap shadow-token-elevated ring-1 ring-line ${PLACEMENT_PILULE[cote]}`}>
            {possede ? (
              armee ? (
                <>
                  <button
                    type="button"
                    onClick={onRetirer}
                    aria-label={`Confirmer le retrait du tome ${numero}`}
                    className="pilule-action bg-danger text-dangerInk"
                  >
                    <Trash2 size={13} />
                    Retirer
                  </button>
                  <button type="button" onClick={onGarder} aria-label={`Garder le tome ${numero}`} className="pilule-action text-textDim">
                    <X size={13} />
                    Garder
                  </button>
                </>
              ) : (
                <>
                  <span className="px-2.5 text-[12px] font-semibold text-textPrimary">
                    Tome {numero}
                    {edition ? <span className="font-normal text-textDim"> · {edition}</span> : null}
                  </span>
                  {onArmer && (
                    <button
                      type="button"
                      onClick={onArmer}
                      title={`Retirer le tome ${numero} de ma collection`}
                      aria-label={`Retirer le tome ${numero} de ma collection`}
                      className="pilule-icone text-textDim hover:text-dangerText"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </>
              )
            ) : (
              <>
                {onJeLAi && (
                  <button
                    type="button"
                    onClick={onJeLAi}
                    title={`J'ai le tome ${numero}`}
                    aria-label={`J'ai le tome ${numero}`}
                    className="pilule-action bg-accent text-accentInk"
                  >
                    <Check size={13} strokeWidth={3} />
                    Je l&apos;ai
                  </button>
                )}
                {onJeLeVeux && (
                  <button
                    type="button"
                    onClick={onJeLeVeux}
                    title={voulu ? `Retirer le tome ${numero} de mes envies` : `Je veux le tome ${numero}`}
                    aria-label={voulu ? `Retirer le tome ${numero} de mes envies` : `Je veux le tome ${numero}`}
                    className="pilule-icone text-accentText"
                  >
                    <Heart size={14} className={voulu ? 'fill-current' : undefined} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
