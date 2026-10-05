import { useState, type ReactNode } from 'react'
import { Check, CheckCheck, Heart, Plus, Trash2, X } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'

/**
 * A volume as a grid shows it, whatever its origin.
 *
 * <h2>The meeting point of two models</h2>
 * The detail page starts from `TomeTile` (a cataloged Variant, an Ownership, a
 * completeness); the add flow starts from `VolumeCandidateDto` (an external
 * search result, not in the database yet). These two shapes do not have the same
 * fields and do not need to: what a GRID needs to know about a
 * volume is its number, its cover, whether it is already owned, and whether it is
 * highlighted. Each screen translates its own data into this.
 */
export interface VolumeAffiche {
  /** Stable identity in the grid. A series can have a volume 1 per
   *  edition: it is up to the caller to build a key that takes this into account
   *  (see lib/volumeKey). */
  cle: string
  numero: number
  jaquetteUrl: string | null
  /** An active Ownership exists for this volume. True on both screens - and
   *  this is exactly what makes the common grid possible. */
  possede: boolean
  /** This volume is in the wishes. Exclusive with `possede`: wanting and having
   *  are two states of the same object, never two states stacked together. */
  voulu?: boolean
  /** Highlighted: the volume whose panel is open (browse mode), or the
   *  checked volume (selection mode). Two meanings, one visual state. */
  actif: boolean
}

export type FiltreVolumes = 'tous' | 'manquants' | 'possedes'

const FILTRES: { cle: FiltreVolumes; libelle: string }[] = [
  { cle: 'tous', libelle: 'Tous' },
  { cle: 'manquants', libelle: 'Manquants' },
  { cle: 'possedes', libelle: 'Possédés' },
]

/**
 * The volume grid of the application - only one, two modes.
 *
 * <h2>Why a common component, when the gestures differ</h2>
 * `navigation` (detail page) opens the clicked volume; `selection` (add) checks it, and
 * several can be checked. These are two gestures, but **only one thing
 * being looked at**: the list of volumes of an edition, with what I already
 * own of it. Before, each screen redrew its own tile - different ratios
 * (78px auto-fill against fixed 64×96), different fallbacks, different badges -
 * so that a volume did not look the same from one screen to the other even though
 * it is the same object.
 *
 * <p>The mode only changes three things, all visible here: the
 * ARIA semantics of the button, the corner badge, and the presence of the actions on
 * hover. Everything else - measures, numbered fallback, filters, dimming of a
 * missing volume - is common, and this is what guarantees that the two screens can
 * no longer diverge.
 */
export function GrilleVolumes({
  volumes,
  mode,
  onActiver,
  onJeLAi,
  onJeLeVeux,
  onRetirer,
  filtre,
  onFiltre,
  enTete,
  action,
  videMessage,
}: {
  volumes: VolumeAffiche[]
  mode: 'navigation' | 'selection'
  onActiver: (cle: string) => void
  /** The two gestures of a volume, in browse mode. Absent in selection
   *  mode, where checking IS the gesture. */
  onJeLAi?: (cle: string) => void
  onJeLeVeux?: (cle: string) => void
  /** Remove an OWNED volume from the collection - in two gestures (see
   *  TuileVolume): with this prop, activating an owned tile ARMS it instead of
   *  calling `onActiver`, and the tile asks the question. When absent,
   *  activation keeps its previous meaning. */
  onRetirer?: (cle: string) => void
  filtre: FiltreVolumes
  onFiltre: (filtre: FiltreVolumes) => void
  /** What is said on the left of the filters, on the SAME line: the edition
   *  being looked at and its progress. Two title lines above a row
   *  of filters cost about a hundred pixels before the first cover,
   *  for a reminder of what the edition cards already say just
   *  above. */
  enTete?: ReactNode
  /** An action tile at the end of the grid ("ajouter un tome"). */
  action?: { libelle: string; onClick: () => void }
  videMessage?: string
}) {
  // On `volumes` and not on `visibles`: a counter that only counted what
  // is already on screen would always say the total of the current view.
  const possedes = volumes.filter((volume) => volume.possede).length
  // The volume whose tile asks for confirmation before removing it - only one at
  // a time: arming another volume disarms the first.
  const [armee, setArmee] = useState<string | null>(null)
  const comptes: Record<FiltreVolumes, number> = {
    tous: volumes.length,
    manquants: volumes.length - possedes,
    possedes,
  }

  const visibles = volumes.filter((volume) => {
    if (filtre === 'possedes') return volume.possede
    if (filtre === 'manquants') return !volume.possede
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      {/* A single row: what is looked at on the left, how it is filtered on the
          right. It folds by itself when there is not enough room. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {enTete}
        {/* TEXT, not pills in a container: three labels
            separated by dots, the active one in solid ink. And each one carries its
            number, so that the row informs instead of only taking up space -
            one sees how many are missing without having to click.

            A real group of radio buttons despite the look: three views that
            exclude each other, which `aria-pressed` would not say - it would announce
            three independent switches of which two are "inactive". */}
        <div
          role="radiogroup"
          aria-label="Filtrer les tomes"
          className="flex w-fit shrink-0 flex-wrap items-center"
        >
          {FILTRES.map(({ cle, libelle }, index) => {
            const actif = cle === filtre
            const compte = comptes[cle]
            return (
              <span key={cle} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="px-1 text-[12px] text-line select-none">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  aria-label={`${libelle} : ${compte} tome${compte > 1 ? 's' : ''}`}
                  onClick={() => onFiltre(cle)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-lg px-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
                    actif ? 'font-semibold text-textPrimary' : 'text-faint hover:text-textPrimary'
                  }`}
                >
                  {libelle}
                  <span className={`text-[11.5px] tabular-nums ${actif ? 'text-accentText' : 'text-faint'}`}>
                    {compte}
                  </span>
                </button>
              </span>
            )
          })}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="py-6 text-sm text-faint">
          {videMessage ??
            (filtre === 'possedes'
              ? "Aucun tome de cette édition dans ta collection pour l'instant."
              : 'Aucun tome manquant — cette édition est complète.')}
        </p>
      ) : (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(78px,1fr))]">
          {visibles.map((volume) => (
            <TuileVolume
              key={volume.cle}
              volume={volume}
              mode={mode}
              onActiver={() => {
                // An owned volume is only removed on the second gesture: the first
                // arms it (a second tap on the same tile disarms it).
                if (onRetirer && mode === 'navigation' && volume.possede) {
                  setArmee((courante) => (courante === volume.cle ? null : volume.cle))
                  return
                }
                setArmee(null)
                onActiver(volume.cle)
              }}
              onJeLAi={onJeLAi ? () => onJeLAi(volume.cle) : undefined}
              onJeLeVeux={onJeLeVeux ? () => onJeLeVeux(volume.cle) : undefined}
              armee={armee === volume.cle}
              onRetirer={
                onRetirer
                  ? () => {
                      setArmee(null)
                      onRetirer(volume.cle)
                    }
                  : undefined
              }
              onGarder={() => setArmee(null)}
            />
          ))}
          {/* The label is WRITTEN, not only in a `title`: "ajouter"
              must always say where, and a bare "+" at the end of a volume grid
              was confused with an add to the collection while it feeds the
              catalog (product study of 2026-08-27, section 11). */}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="flex aspect-[2/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-lineStrong px-1.5 text-center text-[11px] leading-tight font-medium text-faint transition-colors hover:border-accent hover:bg-accentTint hover:text-accentText"
            >
              <Plus size={15} />
              {action.libelle}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TuileVolume({
  volume,
  mode,
  onActiver,
  onJeLAi,
  onJeLeVeux,
  armee = false,
  onRetirer,
  onGarder,
}: {
  volume: VolumeAffiche
  mode: 'navigation' | 'selection'
  onActiver: () => void
  onJeLAi?: () => void
  onJeLeVeux?: () => void
  /** The tile asks its question "Retirer ?" (see the block at the bottom). */
  armee?: boolean
  onRetirer?: () => void
  onGarder?: () => void
}) {
  const selection = mode === 'selection'
  // In selection, an already owned volume is NOT dimmed: checking it stays
  // legitimate (it is a second copy), and fading it would suggest
  // that it is unavailable. In browse mode, on the contrary, dimming IS
  // the information: it is what shows the holes of a collection.
  // A WANTED volume is not dimmed like a missing one: the decision is made,
  // and fading it would make it less visible than what has not yet been
  // decided. Three states, three treatments.
  const attenue = !selection && !volume.possede && !volume.voulu

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onActiver}
        // Two semantics: a switch in selection (the state matters and
        // must be announced), a simple button in browse mode (it leads elsewhere).
        aria-pressed={selection ? volume.actif : undefined}
        // An owned tile that can be removed unfolds its question: the attribute
        // says it to whoever does not see the screen.
        aria-expanded={!selection && volume.possede && onRetirer ? armee : undefined}
        aria-label={
          selection
            ? `Tome ${volume.numero}${volume.possede ? ', déjà possédé' : ''}`
            : `Tome ${volume.numero}${
                volume.possede ? ', possédé' : volume.voulu ? ', dans mes envies' : ', manquant'
              }`
        }
        className={`relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg bg-handle transition ${
          attenue ? 'opacity-[.42] grayscale-[1] contrast-[.92] ring-1 ring-line ring-inset' : 'shadow-token-sm'
        } ${volume.voulu && !selection ? 'ring-2 ring-accent ring-inset' : ''} ${
          volume.actif ? 'outline-2 outline-offset-2 outline-accent' : armee ? 'outline-2 outline-offset-2 outline-danger' : ''
        }`}
      >
        <Jaquette src={volume.jaquetteUrl} repli={null} className="absolute inset-0 h-full w-full object-cover" />
        {/* The number stays in the tree even under a cover: it is what
            carries the information, and without a cover it is all there is. */}
        <span
          className={`relative font-display text-[17px] font-medium tracking-[0.01em] ${
            volume.jaquetteUrl ? 'sr-only' : 'text-white/90'
          }`}
        >
          {String(volume.numero).padStart(2, '0')}
        </span>

        {/* "Already owned" and "checked" are two distinct pieces of information that
            coexist: re-checking an owned volume signals a 2nd copy.
            Hence two different corners, never a single badge with a double meaning. */}
        {/* The heart SAYS the state, it does not change it: one leaves it through the menu
            below, where the action is named. */}
        {!selection && volume.voulu && (
          <span
            title="Dans mes envies"
            className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accentInk shadow-token-sm"
          >
            <Heart size={11} className="fill-current" />
          </span>
        )}
        {selection && volume.possede && (
          <span
            title="Déjà possédé"
            className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-ok text-background"
          >
            <CheckCheck size={10} strokeWidth={3} />
          </span>
        )}
        {selection && volume.actif && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accentInk">
            <Check size={10} strokeWidth={3} />
          </span>
        )}
      </button>

      {/* The menu of the volume: the two possible gestures on the object really
          concerned. Nothing at all on an ALREADY OWNED volume - wanting what one has
          makes no sense (the backend refuses it with a 409), and having it neither.
          The guard applies to the whole overlay and not only to its buttons:
          empty, it still covered the tile and swallowed on hover the click
          meant for it (found when checking live).

          Mouse only, and inert outside hover: these buttons must neither
          intercept a click meant for the tile, nor get into the tab
          order. Keyboard and touch go through the tile: a missing
          volume is added in one gesture, an owned volume arms its question
          "Retirer ?" (see the block at the bottom). */}
      {!selection && !volume.possede && (onJeLAi || onJeLeVeux) && (
        <div
          className={`pointer-events-none absolute inset-0 grid overflow-hidden rounded-lg opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 ${
            onJeLAi && onJeLeVeux ? 'grid-rows-2' : 'grid-rows-1'
          }`}
        >
          {onJeLAi && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={onJeLAi}
              title={`J'ai le tome ${volume.numero}`}
              className="flex items-center justify-center gap-1 bg-scrim text-[11px] font-medium text-white hover:bg-ok hover:text-background"
            >
              <Check size={13} strokeWidth={2.5} />
              Je l&apos;ai
            </button>
          )}
          {onJeLeVeux && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={onJeLeVeux}
              title={
                volume.voulu
                  ? `Retirer le tome ${volume.numero} de mes envies`
                  : `Je veux le tome ${volume.numero}`
              }
              className="flex items-center justify-center gap-1 border-t border-white/25 bg-scrim text-[11px] font-medium text-white hover:bg-accent hover:text-accentInk"
            >
              <Heart size={12} className={volume.voulu ? 'fill-current' : undefined} />
              {volume.voulu ? 'Retirer' : 'Je le veux'}
            </button>
          )}
        </div>
      )}

      {/* The question of an owned volume, asked on the tile itself. A tap
          used to remove a copy at once - its acquisition date with it -
          recoverable for six seconds through "Annuler": with a finger, on a grid
          of seventy-four cells, the easiest gesture to do without
          meaning to. The first tap arms, and two real buttons, named,
          reachable by finger as well as by keyboard, do the rest; adding
          destroys nothing and stays a single gesture (batch 148). */}
      {!selection && volume.possede && onRetirer && armee && (
        <div className="absolute inset-0 grid grid-rows-2 overflow-hidden rounded-lg">
          <button
            type="button"
            onClick={onRetirer}
            aria-label={`Retirer le tome ${volume.numero} de ma collection`}
            className="flex items-center justify-center gap-1 bg-scrim text-[11px] font-medium text-white hover:bg-danger hover:text-dangerInk"
          >
            <Trash2 size={12} />
            Retirer
          </button>
          <button
            type="button"
            onClick={onGarder}
            aria-label={`Garder le tome ${volume.numero}`}
            className="flex items-center justify-center gap-1 border-t border-white/25 bg-scrim text-[11px] font-medium text-white hover:bg-ok hover:text-background"
          >
            <X size={12} />
            Garder
          </button>
        </div>
      )}
    </div>
  )
}
