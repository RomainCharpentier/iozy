import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type TransitionEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles, X } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import type { EtatImage, ImageTuile, Teinte, Tuile } from './mur'

/** The fill of each colour of the palette, and the same colour as text on a dark ground. */
const FOND: Record<Teinte, string> = {
  ocre: 'bg-murOcre',
  vert: 'bg-murVert',
  rose: 'bg-murRose',
  bleu: 'bg-murBleu',
  orange: 'bg-murOrange',
}
const ENCRE_CLAIRE: Record<Teinte, string> = {
  ocre: 'text-murOcre',
  vert: 'text-murVert',
  rose: 'text-murRose',
  bleu: 'text-murBleu',
  orange: 'text-murOrange',
}

/** What each state does to a cover: an idea keeps its colours under its tint. */
const FILTRE: Record<EtatImage, string> = {
  possede: 'none',
  idee: 'contrast(1.05)',
  aAcheter: 'brightness(0.42) saturate(0.85)',
  aVenir: 'grayscale(1) brightness(0.5)',
}

const COLONNES: Record<Tuile['largeur'], string> = { 1: 'col-span-1', 2: 'col-span-2', 3: 'col-span-3' }
const RANGEES: Record<Tuile['hauteur'], string> = { 1: 'row-span-1', 2: 'row-span-2' }

function mouvementAutorise(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches
}

/** True once the element has entered the screen; where there is no observer, at once. */
function useVu<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [vu, setVu] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVu(true)
          observateur.disconnect()
        }
      },
      { rootMargin: '0px 0px -4% 0px' },
    )
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])
  return [ref, vu] as const
}

/** One cover of a tile: the image full bleed, its state, its tint, its figure. */
function Image({ image, teinte, grande }: { image: ImageTuile; teinte: Teinte; grande: boolean }) {
  return (
    <span className="relative min-w-0 flex-1 overflow-hidden">
      <span className="absolute inset-0" style={{ filter: FILTRE[image.etat] }}>
        <Jaquette
          src={image.src}
          className="mur-image h-full w-full object-cover"
          repli={
            <span className="mur-image flex h-full w-full items-end bg-surface2 p-3 font-display text-sm leading-tight font-bold text-textDim">
              {image.titre}
            </span>
          }
        />
      </span>
      {image.etat === 'idee' && (
        <>
          <span aria-hidden="true" className={`mur-teinte mur-teinte--blancs absolute inset-0 ${FOND[teinte]}`} />
          <span aria-hidden="true" className={`mur-teinte absolute inset-0 ${FOND[teinte]}`} />
        </>
      )}
      {image.chiffre && (
        <span
          aria-hidden="true"
          className={`absolute bottom-2 left-3 font-display leading-[0.85] font-bold tracking-[-0.05em] [text-shadow:0_2px_16px_rgb(0_0_0/0.75)] ${ENCRE_CLAIRE[teinte]} ${
            grande ? 'text-[4.5rem]' : 'text-[2.5rem]'
          }`}
        >
          {image.chiffre}
        </span>
      )}
    </span>
  )
}

/** The size of the big figure of a block, so a long amount still fits its square. */
function tailleDuGrand(grand: string, large: boolean): string {
  if (grand.length <= 3) return large ? 'text-[4rem]' : 'text-[3.25rem]'
  if (grand.length <= 7) return large ? 'text-[3.25rem]' : 'text-[2rem]'
  return large ? 'text-[2.25rem]' : 'text-[1.5rem]'
}

/** A block of colour: a figure and a few words, a way into the page that says more. */
function Pave({ tuile }: { tuile: Tuile }) {
  const pave = tuile.pave!
  const contenu = (
    <>
      <span aria-hidden="true" className={`font-display leading-[0.9] font-bold tracking-[-0.05em] ${tailleDuGrand(pave.grand, tuile.largeur > 1)}`}>
        {pave.grand}
      </span>
      <span aria-hidden="true" className="text-[13px] leading-snug font-semibold">
        {pave.petit}
      </span>
    </>
  )
  const classes = `mur-pave flex h-full w-full flex-col justify-between p-3.5 text-murEncre ${FOND[tuile.teinte]}`
  return tuile.lien ? (
    <Link to={tuile.lien} aria-label={`${pave.grand} ${pave.petit}`} className={classes}>
      {contenu}
    </Link>
  ) : (
    <p className={classes}>
      <span className="sr-only">{`${pave.grand} ${pave.petit}`}</span>
      {contenu}
    </p>
  )
}

/**
 * One tile of the wall.
 *
 * <h2>Front and back</h2>
 * The front is the cover, and a click on it (or a tap, or Enter) turns the tile
 * over: the back says why the tile is there, links to the work by its title,
 * and offers its one action ("J'ai le tome 108", "Ajouter à mes envies"). Only
 * one tile is turned at a time (the wall decides). The round button, Escape or
 * a click outside the tile turns it back; a click on the back itself does not,
 * so a second click (to read, or a double click) never undoes the first. The
 * focus follows: onto the back when it opens, back onto the cover when it
 * closes.
 *
 * <h2>The back exists only while it is seen</h2>
 * Hidden by `backface-visibility`, a back that stayed in the page would still
 * be reached by Tab: buttons nobody sees. So it is made when the tile turns,
 * and removed once the half-turn back has ended (at once without motion).
 */
export function TuileMur({
  tuile,
  rang,
  ouverte,
  basculer,
  agir,
  actionEnCours,
}: {
  tuile: Tuile
  rang: number
  ouverte: boolean
  basculer: (cle: string | null) => void
  agir: (tuile: Tuile) => void
  actionEnCours: boolean
}) {
  const [ref, vu] = useVu<HTMLLIElement>()
  const recto = useRef<HTMLButtonElement>(null)
  const dos = useRef<HTMLDivElement>(null)
  const [dosMonte, setDosMonte] = useState(ouverte)
  const [etaitOuverte, setEtaitOuverte] = useState(ouverte)
  if (etaitOuverte !== ouverte) {
    setEtaitOuverte(ouverte)
    if (ouverte) setDosMonte(true)
    else if (!mouvementAutorise()) setDosMonte(false)
  }

  // The focus follows the turn, but never scrolls the page: the tile is where
  // the click was, and a page that jumps under the pointer loses it.
  useEffect(() => {
    if (ouverte && dosMonte) dos.current?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true })
  }, [ouverte, dosMonte])

  const placement = `${COLONNES[tuile.largeur]} ${RANGEES[tuile.hauteur]}`
  const style = { '--rang': rang } as CSSProperties
  const classeCase = `mur-case relative ${vu ? 'mur-case--vue' : ''} ${placement}`

  if (tuile.genre === 'PAVE') {
    return (
      <li ref={ref} style={style} className={classeCase}>
        <Pave tuile={tuile} />
      </li>
    )
  }
  if (tuile.genre === 'AJOUTER') {
    return (
      <li ref={ref} style={style} className={classeCase}>
        <Link
          to={tuile.lien}
          aria-label="Ajouter une œuvre"
          className="flex h-full w-full flex-col justify-end bg-surface p-3.5 text-textDim transition-colors hover:text-textPrimary"
        >
          <Plus aria-hidden="true" size={44} strokeWidth={1.5} />
          <span className="mt-1 text-[13px] font-semibold">Ajouter</span>
        </Link>
      </li>
    )
  }
  if (tuile.genre === 'ATTENTE') {
    return (
      <li ref={ref} style={style} className={classeCase} aria-hidden="true">
        <span className={`mur-attente flex h-full w-full items-center justify-center ${FOND[tuile.teinte]}`}>
          <Sparkles size={22} className="text-murEncre" />
        </span>
      </li>
    )
  }

  const grande = tuile.hauteur === 2
  const idDos = `dos-${tuile.cle}`

  function finDeRotation(event: TransitionEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && event.propertyName === 'transform' && !ouverte) setDosMonte(false)
  }

  function remettre() {
    basculer(null)
    recto.current?.focus({ preventScroll: true })
  }

  function touche(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === 'Escape' && ouverte) {
      event.stopPropagation()
      remettre()
    }
  }

  return (
    <li ref={ref} style={style} className={`${classeCase} mur-scene`} onKeyDown={touche} data-tuile={tuile.cle}>
      <div className={`mur-carte absolute inset-0 ${ouverte ? 'mur-carte--retournee' : ''}`} onTransitionEnd={finDeRotation}>
        <button
          ref={recto}
          type="button"
          tabIndex={ouverte ? -1 : 0}
          aria-hidden={ouverte || undefined}
          aria-expanded={ouverte}
          aria-controls={dosMonte ? idDos : undefined}
          aria-label={`${tuile.titre} : ${tuile.etat}`}
          onClick={() => basculer(tuile.cle)}
          className="mur-face mur-recto absolute inset-0 flex cursor-pointer overflow-hidden bg-surface2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-textPrimary"
        >
          {tuile.images.map((image) => (
            <Image key={image.cle} image={image} teinte={tuile.teinte} grande={grande} />
          ))}
          <span
            aria-hidden="true"
            className={`mur-nom absolute top-0 left-0 max-w-[calc(100%-2.75rem)] truncate bg-[rgb(22_18_15/0.88)] px-2.5 py-1.5 text-[12px] font-bold ${ENCRE_CLAIRE[tuile.teinte]}`}
          >
            {tuile.titre}
          </span>
        </button>

        {dosMonte && (
          <div
            ref={dos}
            id={idDos}
            role="group"
            aria-label={tuile.titre}
            className={`mur-face mur-dos absolute inset-0 flex flex-col overflow-hidden text-murEncre ${FOND[tuile.teinte]} ${
              grande ? 'gap-2.5 p-6' : 'gap-1.5 p-3'
            }`}
          >
            <Link
              to={tuile.lien}
              tabIndex={ouverte ? 0 : -1}
              className={`line-clamp-2 font-display leading-tight font-bold underline-offset-2 hover:underline ${
                grande ? 'pr-10 text-[1.75rem] tracking-[-0.02em]' : 'pr-9 text-[15px]'
              }`}
            >
              {tuile.titre}
            </Link>
            <p className={`leading-snug font-semibold ${grande ? 'text-base' : 'text-[13px]'}`}>{tuile.etat}</p>
            {tuile.detail && (
              <p
                className={`mur-dos-detail leading-snug ${
                  grande ? 'line-clamp-6 text-base' : tuile.largeur > 1 ? 'line-clamp-3 text-[12.5px]' : 'line-clamp-2 text-[12.5px]'
                }`}
              >
                {tuile.detail}
              </p>
            )}
            {tuile.action && (
              <button
                type="button"
                tabIndex={ouverte ? 0 : -1}
                disabled={actionEnCours}
                onClick={() => agir(tuile)}
                className={`mt-auto inline-flex items-center self-start rounded-[10px] bg-murEncre font-bold whitespace-nowrap transition-transform active:scale-[0.97] disabled:opacity-60 ${ENCRE_CLAIRE[tuile.teinte]} ${
                  grande ? 'min-h-11 px-4 text-sm' : 'min-h-9 px-2.5 text-[12px]'
                }`}
              >
                {tuile.action.libelle}
              </button>
            )}
          </div>
        )}
      </div>

      {ouverte && (
        <button
          type="button"
          onClick={remettre}
          aria-label={`Remettre ${tuile.titre}`}
          className="mur-tourner absolute top-1.5 right-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(22_18_15/0.82)] text-[#f4eee7] hover:bg-[rgb(22_18_15/0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4eee7]"
        >
          <X aria-hidden="true" size={16} />
        </button>
      )}
    </li>
  )
}
