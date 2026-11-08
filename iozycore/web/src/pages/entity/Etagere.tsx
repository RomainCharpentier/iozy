import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import { mouvementReduit } from '@/common/lib/volJaquette'
import { tonDe } from '@/common/lib/teinte/useTeinteJaquette'
import type { VolumeAffiche } from './GrilleVolumes'
import { ECART_DOS, MARGE_ETAGE, dosParEtage, formatEtagere, plageDeTomes, positionTranche, repartirEnEtages } from './etages'

/**
 * The volumes of an edition, standing on shelves - what a collector sees
 * when looking at the real thing.
 *
 * <h2>Why spines, and not tiles</h2>
 * A grid of tiles told the state of a volume by a solid or a dashed border,
 * which read as a broken image rather than as a hole. On a shelf, the state IS
 * the object: an owned volume is a slice of its cover standing there, a missing
 * one is an empty slot with its number, a wanted one is that slot ringed.
 *
 * <h2>Pick, then act, and nothing moves</h2>
 * A click PICKS a spine, Shift+click takes a range, Escape releases all. The bar
 * above the shelves has its place reserved, so picking never shifts the shelves
 * under the pointer. At rest it says how to pick, and hovering a spine only
 * previews it there: the cover no longer opens over the volumes one is aiming
 * at. It sticks under the header while something is picked, so that the gestures
 * stay in reach on the tenth shelf.
 *
 * <h2>The gesture is seen</h2>
 * A volume that was just added comes down into its slot and the plank takes the
 * weight: the place it fills is what the page is about.
 */
export function Etagere({
  volumes,
  mode,
  teinte,
  jaquetteSerie,
  onJeLAi,
  onJeLesAi,
  onJeLeVeux,
  onJeLesVeux,
  onRetirer,
  action,
  reglage,
}: {
  volumes: VolumeAffiche[]
  /** `consultation`: the catalog seen by a visitor - spines, no gesture. */
  mode: 'navigation' | 'consultation'
  /** The tint of the series, for an owned volume whose cover is unknown. */
  teinte?: [number, number, number]
  /** The cover of the series, for an owned volume that has none of its own. */
  jaquetteSerie?: string | null
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
  /** What stays at the right of the bar at rest: the shelf / grid switch. */
  reglage?: ReactNode
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)
  const [selection, setSelection] = useState<ReadonlySet<string>>(() => new Set())
  // The last spine picked without Shift: a Shift+click takes the range from it.
  const ancre = useRef<string | null>(null)
  // The removal of the picked owned volumes is being confirmed.
  const [armee, setArmee] = useState(false)
  const [survole, setSurvole] = useState<VolumeAffiche | null>(null)

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

  // What changed since the last render: a slot that just became a volume.
  const possedesAvant = useRef<Map<string, boolean> | null>(null)
  useLayoutEffect(() => {
    const avant = possedesAvant.current
    possedesAvant.current = new Map(volumes.map((volume) => [volume.cle, volume.possede]))
    const racine = conteneur.current
    if (!avant || !racine || mouvementReduit()) return
    let rang = 0
    for (const volume of volumes) {
      if (!volume.possede || avant.get(volume.cle) !== false) continue
      const dos = racine.querySelector<HTMLElement>(`[data-dos-cle="${CSS.escape(volume.cle)}"]`)
      if (!dos || typeof dos.animate !== 'function') continue
      const delai = rang * 70
      dos.animate(
        [
          { transform: 'translateY(-46px) rotate(-2.5deg)', opacity: 0 },
          { transform: 'translateY(3px)', opacity: 1, offset: 0.72 },
          { transform: 'none' },
        ],
        { duration: 520, delay: delai, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' },
      )
      dos
        .closest('[data-etage]')
        ?.querySelector('[data-planche-etage]')
        ?.animate([{ transform: 'none' }, { transform: 'translateY(2px)' }, { transform: 'none' }], {
          duration: 260,
          delay: delai + 340,
        })
      rang++
    }
  }, [volumes])

  const { dos, hauteur } = formatEtagere(largeur)
  const etages = repartirEnEtages(volumes, dosParEtage(largeur, dos))
  const gestes = mode === 'navigation'
  // In shelf order, and only what is still there.
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
    <div ref={conteneur} className="flex flex-col">
      <div className={`z-10 mb-2.5 min-h-[104px] sm:min-h-[60px] ${choisis.length > 0 ? 'sticky top-3 lg:top-[90px]' : 'relative'}`}>
        {choisis.length > 0 ? (
          <BarreChoix
            choisis={choisis}
            armee={armee}
            onArmer={() => setArmee(true)}
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
        ) : (
          <div className="flex min-h-[60px] items-center justify-between gap-3">
            <Apercu volume={survole} gestes={gestes} jaquetteSerie={jaquetteSerie} />
            {reglage}
          </div>
        )}
      </div>

      {etages.map((etage, index) => (
        <div key={index} data-etage="" className="mb-[22px] flex flex-col">
          <div className="flex items-end" style={{ gap: ECART_DOS, paddingInline: MARGE_ETAGE, height: hauteur }}>
            {etage.map((volume) => (
              <Dos
                key={volume.cle}
                volume={volume}
                gestes={gestes}
                teinte={teinte}
                jaquetteSerie={jaquetteSerie}
                largeur={dos}
                hauteur={hauteur}
                choisi={selection.has(volume.cle)}
                onChoisir={(plage) => choisir(volume.cle, plage)}
                onSurvol={() => setSurvole(volume)}
              />
            ))}
          </div>
          {/* The plank: a surface with a line of light on top and a shadow
              underneath, in the colors of the theme. */}
          <div
            aria-hidden="true"
            data-planche-etage=""
            className="h-2.5 rounded-[2px] bg-gradient-to-b from-surface2 to-surface shadow-token-md ring-1 ring-lineStrong"
          />
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

function phraseDeLEtat(volume: VolumeAffiche): string {
  return volume.possede ? 'dans ta collection' : volume.voulu ? 'dans tes envies' : 'manquant'
}

/** The bar at rest: how to pick, and what the pointer is on. An inert preview, never a gesture. */
function Apercu({
  volume,
  gestes,
  jaquetteSerie,
}: {
  volume: VolumeAffiche | null
  gestes: boolean
  jaquetteSerie?: string | null
}) {
  if (!volume) {
    return gestes ? <p className="min-w-0 text-[13.5px] text-textDim">Clique un tome, Maj+clic pour une plage.</p> : <span />
  }
  const image = volume.jaquetteUrl ?? (volume.possede || !gestes ? jaquetteSerie : null)
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-[13.5px] text-textDim">
      {image && (
        <span className="h-12 w-8 shrink-0 overflow-hidden rounded-[3px] bg-surface2">
          <Jaquette src={image} className="h-full w-full object-cover" repli={null} />
        </span>
      )}
      <span className="min-w-0 truncate">
        <b className="font-semibold text-textPrimary">Tome {volume.numero}</b>
        {gestes && ` · ${phraseDeLEtat(volume)}`}
      </span>
    </div>
  )
}

/**
 * The gestures of what is picked, named after what they will do. A pick that
 * holds a missing volume acts on the missing ones; removing only comes on a pick
 * of owned volumes, and takes a second gesture.
 */
function BarreChoix({
  choisis,
  armee,
  onArmer,
  onVider,
  onJeLAi,
  onJeLeVeux,
  onRetirer,
}: {
  choisis: VolumeAffiche[]
  armee: boolean
  onArmer: () => void
  onVider: () => void
  onJeLAi?: (cles: string[]) => void
  /** `ajout`: the volumes go INTO the wishes (false: they leave them). */
  onJeLeVeux?: (cles: string[], ajout: boolean) => void
  onRetirer?: (cles: string[]) => void
}) {
  const manquants = choisis.filter((volume) => !volume.possede)
  const possedes = choisis.filter((volume) => volume.possede)
  // All the missing ones are wanted: the gesture takes them out of the wishes.
  const tousVoulus = manquants.length > 0 && manquants.every((volume) => volume.voulu)
  const ciblesEnvie = tousVoulus ? manquants : manquants.filter((volume) => !volume.voulu)
  const plusieurs = manquants.length > 1

  const titre = `${choisis.length > 1 ? 'Tomes' : 'Tome'} ${plageDeTomes(choisis.map((volume) => volume.numero))}`

  return (
    <div
      role="toolbar"
      aria-label="Tomes choisis"
      className="entree-douce flex min-h-[104px] flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-[14px] bg-surface2 py-2 pr-2 pl-3 shadow-token-elevated sm:min-h-[60px] sm:pl-4 max-sm:[&_button]:px-2.5 max-sm:[&_button]:text-[13px]"
    >
      <b className="min-w-0 truncate text-[14px] font-semibold text-textPrimary">{titre}</b>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={onVider} aria-label="Reposer les tomes" className="btn-secondaire">
          Reposer
        </button>
        {onRetirer && manquants.length === 0 && possedes.length > 0 && (
          <button
            type="button"
            onClick={armee ? () => onRetirer(possedes.map((volume) => volume.cle)) : onArmer}
            aria-label={
              armee
                ? possedes.length === 1
                  ? `Confirmer le retrait du tome ${possedes[0].numero}`
                  : `Confirmer le retrait de ${possedes.length} tomes`
                : possedes.length === 1
                  ? `Retirer le tome ${possedes[0].numero} de ma collection`
                  : `Retirer ces ${possedes.length} tomes de ma collection`
            }
            className={armee ? 'btn-primaire' : 'btn-secondaire'}
          >
            {armee ? 'Confirmer le retrait' : 'Retirer'}
          </button>
        )}
        {onJeLeVeux && manquants.length > 0 && (
          <button
            type="button"
            onClick={() => onJeLeVeux(ciblesEnvie.map((volume) => volume.cle), !tousVoulus)}
            aria-label={nomDeLEnvie(ciblesEnvie, tousVoulus)}
            className="btn-secondaire"
          >
            {tousVoulus ? 'Ne plus vouloir' : plusieurs ? 'Je les veux' : 'Je le veux'}
          </button>
        )}
        {onJeLAi && manquants.length > 0 && (
          <button
            type="button"
            onClick={() => onJeLAi(manquants.map((volume) => volume.cle))}
            aria-label={plusieurs ? `J'ai ces ${manquants.length} tomes` : `J'ai le tome ${manquants[0].numero}`}
            className="btn-primaire"
          >
            {plusieurs ? `J'ai ces ${manquants.length} tomes` : "Je l'ai"}
          </button>
        )}
      </div>
    </div>
  )
}

function nomDeLEnvie(cibles: VolumeAffiche[], tousVoulus: boolean): string {
  if (cibles.length === 1) {
    return tousVoulus ? `Retirer le tome ${cibles[0].numero} de mes envies` : `Je veux le tome ${cibles[0].numero}`
  }
  return tousVoulus ? `Retirer ces ${cibles.length} tomes de mes envies` : `Je veux ces ${cibles.length} tomes`
}

function Dos({
  volume,
  gestes,
  teinte,
  jaquetteSerie,
  largeur,
  hauteur,
  choisi,
  onChoisir,
  onSurvol,
}: {
  volume: VolumeAffiche
  gestes: boolean
  teinte?: [number, number, number]
  jaquetteSerie?: string | null
  largeur: number
  hauteur: number
  choisi: boolean
  /** `plage`: Shift was held - take every spine from the last pick to this one. */
  onChoisir: (plage: boolean) => void
  onSurvol: () => void
}) {
  const { numero, jaquetteUrl, possede, voulu } = volume
  // A visitor has no collection: every volume of the edition stands there,
  // with its cover when the catalogue has one, never as a hole. The name
  // says nothing personal either.
  const present = possede || !gestes
  const forme = present
    ? 'bg-surface2 shadow-[inset_-1px_0_0_rgba(0,0,0,.28),inset_1px_0_0_rgba(255,255,255,.12)]'
    : voulu
      ? 'bg-accentTint ring-2 ring-accentText ring-inset'
      : 'bg-surface/40 ring-1 ring-lineStrong ring-inset'
  const tranche = present ? (jaquetteUrl ?? jaquetteSerie ?? null) : null

  return (
    <button
      type="button"
      data-dos-cle={volume.cle}
      onClick={gestes ? (evenement) => onChoisir(evenement.shiftKey) : undefined}
      onPointerEnter={onSurvol}
      onFocus={onSurvol}
      aria-label={gestes ? `Tome ${numero}, ${etatDe(volume)}` : `Tome ${numero}`}
      aria-pressed={gestes ? choisi : undefined}
      className={`relative block shrink-0 overflow-hidden rounded-t-[2px] rounded-b-[1px] transition-transform duration-200 ${forme} ${
        choisi ? '-translate-y-[9px] outline-2 outline-offset-1 outline-accentText' : gestes ? 'hover:-translate-y-[5px]' : ''
      }`}
      style={{
        width: largeur,
        height: hauteur,
        ...(present && !tranche && teinte ? { background: tonDe(teinte, 100, 0.35) } : {}),
      }}
    >
      {tranche && (
        // A slice of the cover: the colors of the real book, not its text.
        <img
          src={tranche}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${positionTranche(numero, Boolean(jaquetteUrl))}% 50%` }}
        />
      )}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-1.5 text-center font-display text-[10px] font-semibold ${
          present ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]' : voulu ? 'text-accentText' : 'text-faint'
        }`}
      >
        {numero}
      </span>
    </button>
  )
}
