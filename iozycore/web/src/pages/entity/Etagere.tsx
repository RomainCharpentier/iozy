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
 * <h2>Pick, then act</h2>
 * The first version put the gestures in a card that opened under the
 * mouse: pretty, and "pas pratique" (owner, 2026-11-01) - the pill moved
 * with every spine, closed when the pointer left a 22 px target, and
 * thirty volumes meant thirty precise hovers. Now a click PICKS a spine
 * (a second click releases it, Shift+click takes a range, Escape releases
 * all), and one bar above the shelves carries the gestures for the whole
 * selection: "Je l'ai", the heart, the removal in two gestures as
 * everywhere. The bar sticks under the header, so it stays in reach on
 * the tenth shelf. Hovering only previews the cover above its slot.
 * The gestures keep the names of the grid: the journeys and the screen
 * readers do not notice the shelf.
 */
export function Etagere({
  volumes,
  mode,
  teinte,
  edition,
  onJeLAi,
  onJeLesAi,
  onJeLeVeux,
  onJeLesVeux,
  onRetirer,
  action,
}: {
  volumes: VolumeAffiche[]
  /** `consultation`: the catalog seen by a visitor - spines, no gesture. */
  mode: 'navigation' | 'consultation'
  /** The tint of the series, for an owned volume that has no cover yet. */
  teinte?: [number, number, number]
  /** Named under the picked volume ("manquant · Glénat"). */
  edition?: string
  onJeLAi?: (cle: string) => void
  /** Several volumes at once (a range picked with Shift). Without it, the
   *  shelf calls `onJeLAi` once per volume. */
  onJeLesAi?: (cles: string[]) => void
  onJeLeVeux?: (cle: string) => void
  /** Several volumes INTO the wishes at once; leaving them goes one by one. */
  onJeLesVeux?: (cles: string[]) => void
  onRetirer?: (cle: string) => void
  /** A button after the shelves ("Ajouter un tome"). */
  action?: { libelle: string; onClick: () => void }
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)
  // The spines picked by a click. The bar lists them in shelf order.
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())
  // The last spine picked without Shift: a Shift+click takes the range from it.
  const ancre = useRef<string | null>(null)
  // The removal of the picked owned volumes is being confirmed.
  const [armee, setArmee] = useState(false)

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

  // Escape puts every volume back on the shelf.
  useEffect(() => {
    if (selection.size === 0) return
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key !== 'Escape') return
      setSelection(new Set())
      setArmee(false)
    }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [selection.size])

  const etages = repartirEnEtages(volumes, dosParEtage(largeur))
  const gestes = mode === 'navigation'
  // In shelf order, and only what the filter still shows: a volume hidden
  // since it was picked gets no gesture.
  const choisis = gestes ? volumes.filter((volume) => selection.has(volume.cle)) : []

  function choisir(cle: string, plage: boolean) {
    setArmee(false)
    const depart = ancre.current
    if (!plage) ancre.current = cle
    setSelection((courante) => {
      const suivante = new Set(courante)
      if (plage && depart !== null) {
        const a = volumes.findIndex((volume) => volume.cle === depart)
        const b = volumes.findIndex((volume) => volume.cle === cle)
        if (a >= 0 && b >= 0) {
          for (let index = Math.min(a, b); index <= Math.max(a, b); index++) suivante.add(volumes[index].cle)
          return suivante
        }
      }
      if (suivante.has(cle)) suivante.delete(cle)
      else suivante.add(cle)
      return suivante
    })
  }

  function vider() {
    setSelection(new Set())
    setArmee(false)
  }

  return (
    <div ref={conteneur} className="flex flex-col gap-6">
      {choisis.length > 0 && (
        <BarreSelection
          choisis={choisis}
          teinte={teinte}
          edition={edition}
          armee={armee}
          onArmer={() => setArmee(true)}
          onGarder={() => setArmee(false)}
          onVider={vider}
          onJeLAi={
            onJeLAi
              ? (cles) => {
                  if (cles.length > 1 && onJeLesAi) onJeLesAi(cles)
                  else for (const cle of cles) onJeLAi(cle)
                  vider()
                }
              : undefined
          }
          onJeLeVeux={
            onJeLeVeux
              ? (cles, ajout) => {
                  if (ajout && cles.length > 1 && onJeLesVeux) onJeLesVeux(cles)
                  else for (const cle of cles) onJeLeVeux(cle)
                  vider()
                }
              : undefined
          }
          onRetirer={
            onRetirer
              ? (cles) => {
                  for (const cle of cles) onRetirer(cle)
                  vider()
                }
              : undefined
          }
        />
      )}
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
                cote={coteDeLaCarte(index, etage.length)}
                choisi={selection.has(volume.cle)}
                onChoisir={(plage) => choisir(volume.cle, plage)}
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

function etatDe(volume: VolumeAffiche): string {
  return volume.possede ? 'possédé' : volume.voulu ? 'dans mes envies' : 'manquant'
}

function pluriel(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? 's' : ''}`
}

/**
 * The bar of the picked volumes: what is picked, and the gestures that
 * apply to it. Each gesture is named for ONE volume ("J'ai le tome 2") or
 * for the lot ("J'ai ces 3 tomes"): the name says what will happen.
 *
 * <p>Sticky under the header (56 px on a phone, 64 px on a desktop): the
 * tenth shelf is far from the top, the bar must not be. While a removal
 * waits for its confirmation, only the question is shown: on a phone the
 * row has no room for the other gestures next to it.
 */
function BarreSelection({
  choisis,
  teinte,
  edition,
  armee,
  onArmer,
  onGarder,
  onVider,
  onJeLAi,
  onJeLeVeux,
  onRetirer,
}: {
  choisis: VolumeAffiche[]
  teinte?: [number, number, number]
  edition?: string
  armee: boolean
  onArmer: () => void
  onGarder: () => void
  onVider: () => void
  onJeLAi?: (cles: string[]) => void
  /** `ajout`: the volumes go INTO the wishes (false: they leave them). */
  onJeLeVeux?: (cles: string[], ajout: boolean) => void
  onRetirer?: (cles: string[]) => void
}) {
  const un = choisis.length === 1 ? choisis[0] : null
  const manquants = choisis.filter((volume) => !volume.possede)
  const possedes = choisis.filter((volume) => volume.possede)
  const voulus = manquants.filter((volume) => volume.voulu)
  // All the missing ones are wanted: the heart takes them out of the
  // wishes. Otherwise it puts in those that are not there yet.
  const tousVoulus = manquants.length > 0 && voulus.length === manquants.length
  const ciblesEnvie = tousVoulus ? manquants : manquants.filter((volume) => !volume.voulu)

  // Each gesture is named after ITS targets, not after the pick: with an
  // owned and a missing volume picked, "Je l'ai" concerns one volume and
  // says which ("J'ai le tome 11"), the trash the other one.
  const nomAjout = manquants.length === 1 ? `J'ai le tome ${manquants[0].numero}` : `J'ai ces ${manquants.length} tomes`
  const nomRetrait =
    possedes.length === 1 ? `Retirer le tome ${possedes[0].numero} de ma collection` : `Retirer ces ${possedes.length} tomes de ma collection`
  const nomConfirmation =
    possedes.length === 1 ? `Confirmer le retrait du tome ${possedes[0].numero}` : `Confirmer le retrait de ${possedes.length} tomes`
  const nomGarder = possedes.length === 1 ? `Garder le tome ${possedes[0].numero}` : `Garder ces ${possedes.length} tomes`

  const titre = un ? `Tome ${un.numero}` : pluriel(choisis.length, 'tome')
  const detail = un
    ? `${etatDe(un)}${edition ? ` · ${edition}` : ''}`
    : [
        possedes.length > 0 && pluriel(possedes.length, 'possédé'),
        manquants.length - voulus.length > 0 && pluriel(manquants.length - voulus.length, 'manquant'),
        voulus.length > 0 && pluriel(voulus.length, 'envie'),
      ]
        .filter(Boolean)
        .join(' · ')

  return (
    <div
      role="toolbar"
      aria-label="Tomes choisis"
      className="entree-douce sticky top-[60px] z-10 flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-2.5 shadow-token-elevated ring-1 ring-line md:top-[72px]"
    >
      {un && (
        <div className="h-[42px] w-[28px] shrink-0 overflow-hidden rounded-[3px] bg-surface2 ring-1 ring-line">
          <Jaquette
            src={un.jaquetteUrl}
            className="h-full w-full object-cover"
            repli={
              <span
                className="flex h-full w-full items-center justify-center font-display text-[11px] font-medium text-textDim"
                style={un.possede && teinte ? { background: tonDe(teinte, 100, 0.35) } : undefined}
              >
                {String(un.numero).padStart(2, '0')}
              </span>
            }
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-textPrimary">{titre}</div>
        <div className="truncate text-[12px] text-textDim">{detail}</div>
      </div>

      {armee ? (
        <>
          <button
            type="button"
            onClick={() => onRetirer?.(possedes.map((volume) => volume.cle))}
            aria-label={nomConfirmation}
            className="pilule-action bg-danger text-dangerInk"
          >
            <Trash2 size={13} />
            Retirer
          </button>
          <button type="button" onClick={onGarder} aria-label={nomGarder} className="pilule-action text-textDim">
            <X size={13} />
            Garder
          </button>
        </>
      ) : (
        <>
          {onJeLAi && manquants.length > 0 && (
            <button
              type="button"
              onClick={() => onJeLAi(manquants.map((volume) => volume.cle))}
              title={nomAjout}
              aria-label={nomAjout}
              className="pilule-action bg-accent text-accentInk"
            >
              <Check size={13} strokeWidth={3} />
              {manquants.length > 1 ? 'Je les ai' : "Je l'ai"}
            </button>
          )}
          {onJeLeVeux && manquants.length > 0 && (
            <button
              type="button"
              onClick={() => onJeLeVeux(ciblesEnvie.map((volume) => volume.cle), !tousVoulus)}
              title={nomDuCoeur(ciblesEnvie, tousVoulus)}
              aria-label={nomDuCoeur(ciblesEnvie, tousVoulus)}
              className="pilule-icone text-accentText"
            >
              <Heart size={14} className={tousVoulus ? 'fill-current' : undefined} />
            </button>
          )}
          {onRetirer && possedes.length > 0 && (
            <button
              type="button"
              onClick={onArmer}
              title={nomRetrait}
              aria-label={nomRetrait}
              className="pilule-icone text-textDim hover:text-dangerText"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button type="button" onClick={onVider} title="Reposer les tomes" aria-label="Reposer les tomes" className="pilule-icone text-textDim">
            <X size={14} />
          </button>
        </>
      )}
    </div>
  )
}

function nomDuCoeur(cibles: VolumeAffiche[], tousVoulus: boolean): string {
  if (cibles.length === 1) {
    return tousVoulus ? `Retirer le tome ${cibles[0].numero} de mes envies` : `Je veux le tome ${cibles[0].numero}`
  }
  return tousVoulus ? `Retirer ces ${cibles.length} tomes de mes envies` : `Je veux ces ${cibles.length} tomes`
}

const PLACEMENT_CARTE = {
  gauche: 'left-0 origin-bottom-left',
  centre: 'left-1/2 -translate-x-1/2 origin-bottom',
  droite: 'right-0 origin-bottom-right',
} as const

function Dos({
  volume,
  gestes,
  teinte,
  cote,
  choisi,
  onChoisir,
}: {
  volume: VolumeAffiche
  gestes: boolean
  teinte?: [number, number, number]
  cote: 'gauche' | 'centre' | 'droite'
  choisi: boolean
  /** `plage`: Shift was held - take every spine from the last pick to this one. */
  onChoisir: (plage: boolean) => void
}) {
  const { numero, jaquetteUrl, possede, voulu } = volume
  const numeroAffiche = String(numero).padStart(2, '0')
  // A visitor has no collection: every volume of the edition stands there,
  // with its cover when the catalogue has one, never as a hole. The name
  // says nothing personal either (same rule as the grid's consultation tile).
  const present = possede || !gestes
  // The slot of a missing volume: dashed, faint; of a wanted one: dashed, accent.
  const forme = present
    ? 'bg-surface2'
    : voulu
      ? 'border-[1.5px] border-dashed border-accent bg-accentTint'
      : 'border-[1.5px] border-dashed border-lineStrong bg-surface/40'
  // A picked spine stands out of the row, ringed in the accent color.
  const anneau = choisi
    ? '-translate-y-1.5 ring-2 ring-accent ring-offset-2 ring-offset-background'
    : present
      ? 'ring-1 ring-lineStrong ring-inset'
      : ''
  const couleurNumero = present ? 'text-textPrimary' : voulu ? 'text-accentText' : 'text-faint'

  return (
    <div className="group relative shrink-0" style={{ width: LARGEUR_DOS, height: HAUTEUR_DOS }}>
      <button
        type="button"
        onClick={gestes ? (evenement) => onChoisir(evenement.shiftKey) : undefined}
        aria-label={gestes ? `Tome ${numero}, ${etatDe(volume)}` : `Tome ${numero}`}
        aria-pressed={gestes ? choisi : undefined}
        className={`relative block h-full w-full overflow-hidden rounded-t-[3px] rounded-b-[1px] transition duration-150 ${forme} ${anneau} ${
          gestes && !choisi ? 'group-hover:-translate-y-0.5' : ''
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
      {/* The badge on top: the pick first, the wish otherwise. */}
      {gestes && (choisi || voulu) && (
        <span
          aria-hidden="true"
          className={`absolute left-1/2 flex h-[18px] w-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accentInk shadow-token-sm ${
            choisi ? '-top-3.5' : '-top-2'
          }`}
        >
          {choisi ? <Check size={10} strokeWidth={3} /> : <Heart size={9} className="fill-current" />}
        </span>
      )}

      {/* The preview: the cover above its slot while the mouse or the focus
          is on the spine. Inert, always: it never takes the pointer, so
          nothing closes or moves under the hand. `group-hover` only applies
          where a pointer can hover (Tailwind wraps it in `@media (hover:
          hover)`); a finger picks the spine and sees the cover in the bar.
          `z-[5]`: above the neighbouring spines, under the sticky header
          and the bar (both `z-10`) - a focused spine scrolled under the
          header painted its preview over the theme button. Focus counts
          only when it is visible (the keyboard): after a tap or a click
          the spine keeps the focus, and the preview stayed open over its
          neighbours on a phone, where the bar already shows the cover. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-0 z-[5] scale-75 opacity-0 transition duration-200 ease-[var(--ease-sortie)] group-hover:scale-100 group-hover:opacity-100 group-has-[:focus-visible]:scale-100 group-has-[:focus-visible]:opacity-100 ${PLACEMENT_CARTE[cote]}`}
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
      </div>
    </div>
  )
}
