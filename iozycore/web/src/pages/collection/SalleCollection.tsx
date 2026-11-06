import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Jaquette } from '@/common/components/Jaquette'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { gradientFor } from '@/common/theme/gradient'
import type { AffichageCollection } from '@/common/lib/preferencesCollection'
import type { EntityTypeDto } from '@/common/types/api'
import {
  couperEnRangees,
  couperLeLot,
  ECART_LOT,
  largeurObjet,
  mesuresDeLaSalle,
  positionDeLaTranche,
  rangerLaSalle,
  ratioDeLAspect,
  type DosSalle,
  type MesuresSalle,
  type SectionSalle,
  type SegmentPiste,
} from './salles'
import type { ShelfTile } from './shelfTiles'

/** One work on its shelf. */
export interface ObjetSalle {
  tuile: ShelfTile
  /** Wanted and not owned: a faded cover and a heart. A work that is only followed has neither. */
  envie: boolean
  /** Decides the empty bar of the compact view. */
  aDesTomes: boolean
  /** The spines, at the cap of the room that draws them. */
  dosPour: (dosMax: number) => DosSalle[]
  piste: SegmentPiste[] | null
  /** The consoles it stands under; empty: "Console à préciser". */
  consoles: string[]
  /** Null: "Éditeur inconnu". */
  editeur: string | null
}

type ObjetPlace = Omit<ObjetSalle, 'dosPour'> & { dos: DosSalle[] }

/**
 * One category of My collection: its color, its name and its shelves.
 *
 * <h2>Shelves, computed from the real width</h2>
 * A shelf holds what fits and spreads over the width, so that a simple
 * collection (a game is one cover, no spines) fills it as well as a long
 * series does. The width of an object is known in advance, not measured: all
 * the shelves of a room are decided before the first paint.
 *
 * <h2>A shelf page can hold 300 series</h2>
 * A shelf far from the screen is not rendered (`content-visibility`, see
 * index.css), so that a long category costs what the screen shows.
 */
export function SalleCollection({
  entityType,
  objets,
  affichage,
  nommee,
  lienRayon,
  onOuvrir,
}: {
  entityType: EntityTypeDto
  objets: ObjetSalle[]
  affichage: AffichageCollection
  /** With a single category owned, the name of the room would only repeat the page. */
  nommee: boolean
  /** How many works its shelf page holds. Absent: this IS the shelf page. */
  lienRayon?: number
  onOuvrir: (entityId: string, jaquette: HTMLElement | null) => void
}) {
  const visual = getEntityTypeVisual(entityType)
  const contenu = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(0)

  useLayoutEffect(() => {
    const element = contenu.current
    if (!element) return
    setLargeur(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observateur = new ResizeObserver((entrees) => {
      for (const entree of entrees) setLargeur(entree.contentRect.width)
    })
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  const ratio = ratioDeLAspect(visual.aspectClassName)
  const mesures = useMemo(() => mesuresDeLaSalle(affichage, largeur), [affichage, largeur])
  const sections = useMemo(
    () =>
      rangerLaSalle(
        entityType.code,
        objets.map((objet): ObjetPlace => ({ ...objet, dos: objet.dosPour(mesures.dosMax) })),
      ),
    [entityType.code, objets, mesures.dosMax],
  )

  return (
    <section
      id={`salle-${entityType.id}`}
      aria-label={entityType.label}
      className="salle"
      style={{ '--u': visual.color } as React.CSSProperties}
    >
      <div className="salle-tete empty:hidden">
        {nommee && <h2 className="salle-titre font-display font-semibold text-textPrimary">{entityType.label}</h2>}
        {lienRayon !== undefined && (
          <Link
            to={`/collection/${entityType.id}`}
            className="ml-auto flex min-h-11 items-center gap-1 text-sm font-semibold whitespace-nowrap text-textDim hover:text-textPrimary"
          >
            Tout voir
            {lienRayon > objets.length && <span className="font-normal text-faint">{lienRayon}</span>}
            <ChevronRight size={15} />
          </Link>
        )}
      </div>
      <div ref={contenu} className="salle-consoles">
        {sections.map((section) => (
          <SectionEtageres
            key={section.console ?? ''}
            section={section}
            largeur={largeur}
            ratio={ratio}
            mesures={mesures}
            affichage={affichage}
            onOuvrir={onOuvrir}
          />
        ))}
      </div>
    </section>
  )
}

/** What stands on a shelf: one object, or the run of a publisher under its label. */
interface ElementRangee {
  cle: string
  largeur: number
  /** Null: an object alone. Empty: a publisher going on from the previous shelf. */
  editeur: string | null
  objets: ObjetPlace[]
}

/** The height of the label of a publisher, above its covers. */
function hauteurEtiquette(affichage: AffichageCollection): number {
  return affichage === 'compact' ? 22 : 28
}

function SectionEtageres({
  section,
  largeur,
  ratio,
  mesures,
  affichage,
  onOuvrir,
}: {
  section: SectionSalle<ObjetPlace>
  largeur: number
  ratio: number
  mesures: MesuresSalle
  affichage: AffichageCollection
  onOuvrir: (entityId: string, jaquette: HTMLElement | null) => void
}) {
  const largeurDe = (objet: ObjetPlace) => largeurObjet(ratio, objet.dos.length, mesures)
  const largeurDuLot = (lot: ObjetPlace[]) =>
    lot.reduce((total, objet) => total + largeurDe(objet), 0) + ECART_LOT * (lot.length - 1)

  // In compact, a console takes the room it needs, so that several share a line.
  const naturelle =
    section.lots.reduce((total, lot) => total + largeurDuLot(lot.objets), 0) + mesures.ecart * (section.lots.length - 1)
  const large =
    affichage === 'compact' && section.console !== null && largeur > 0 ? Math.min(naturelle, largeur) : largeur

  const elements: ElementRangee[] = section.lots.flatMap((lot) =>
    lot.editeur === null
      ? lot.objets.map((objet) => ({ cle: objet.tuile.key, largeur: largeurDe(objet), editeur: null, objets: [objet] }))
      : couperLeLot(lot.objets, largeurDe, large).map((morceau, index) => ({
          cle: `${lot.editeur}-${index}`,
          largeur: largeurDuLot(morceau),
          editeur: index === 0 ? lot.editeur : '',
          objets: morceau,
        })),
  )
  const rangees = couperEnRangees(elements, (element) => element.largeur, large, mesures.ecart)
  const Etiquette = section.console === null ? 'h3' : 'h4'

  return (
    <section
      className="salle-console"
      // A minimum: a console with one cover keeps its name on one line.
      style={affichage === 'compact' && section.console !== null && large > 0 ? { minWidth: large } : undefined}
    >
      {section.console !== null && <h3 className="salle-nom-console font-display font-semibold">{section.console}</h3>}
      {rangees.map((rangee, index) => {
        const tete = rangee.objets.some((element) => element.editeur !== null) ? hauteurEtiquette(affichage) : 0
        return (
          <div
            key={index}
            data-rangee=""
            className="salle-rangee"
            style={
              {
                '--h': `${mesures.hauteur}px`,
                '--w': `${mesures.dos}px`,
                '--tete': `${tete}px`,
                columnGap: mesures.ecart,
                justifyContent: rangee.etalee ? 'space-between' : 'flex-start',
              } as React.CSSProperties
            }
          >
            <span data-planche="" aria-hidden="true" className="salle-planche" />
            {rangee.objets.map((element) =>
              element.editeur === null ? (
                <Objet
                  key={element.cle}
                  objet={element.objets[0]}
                  ratio={ratio}
                  mesures={mesures}
                  affichage={affichage}
                  onOuvrir={onOuvrir}
                />
              ) : (
                <div key={element.cle} className="salle-lot" style={{ width: element.largeur }}>
                  {element.editeur === '' ? (
                    <span aria-hidden="true" className="salle-editeur" />
                  ) : (
                    <Etiquette className="salle-editeur" title={element.editeur}>
                      {element.editeur}
                    </Etiquette>
                  )}
                  <div className="flex" style={{ columnGap: ECART_LOT }}>
                    {element.objets.map((objet) => (
                      <Objet
                        key={objet.tuile.key}
                        objet={objet}
                        ratio={ratio}
                        mesures={mesures}
                        affichage={affichage}
                        onOuvrir={onOuvrir}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )
      })}
    </section>
  )
}

function Objet({
  objet,
  ratio,
  mesures,
  affichage,
  onOuvrir,
}: {
  objet: ObjetPlace
  ratio: number
  mesures: MesuresSalle
  affichage: AffichageCollection
  onOuvrir: (entityId: string, jaquette: HTMLElement | null) => void
}) {
  const { tuile, envie, dos, piste, aDesTomes } = objet
  const face = useRef<HTMLSpanElement>(null)
  const compact = affichage === 'compact'
  return (
    <button
      type="button"
      data-oeuvre={tuile.entityId}
      onClick={() => onOuvrir(tuile.entityId, face.current)}
      title={tuile.title}
      aria-label={[tuile.title, tuile.subtitle, tuile.signal].filter(Boolean).join(', ')}
      className={`salle-objet ${envie ? 'salle-objet-envie' : ''}`}
      style={{ width: largeurObjet(ratio, dos.length, mesures) }}
    >
      <span className="salle-objets">
        <span
          ref={face}
          data-face=""
          className="salle-face"
          style={{ aspectRatio: ratio, background: gradientFor(tuile.gradientKey ?? tuile.title) }}
        >
          <Jaquette
            src={tuile.imageUrl}
            className="absolute inset-0 h-full w-full object-cover"
            // Compact has no title under the cover: without a cover, the work would be a flat color.
            repli={compact ? <span className="salle-repli">{tuile.title}</span> : null}
          />
        </span>
        {dos.map((volume) => (
          <Dos key={volume.numero} volume={volume} jaquetteSerie={tuile.imageUrl} />
        ))}
      </span>
      {compact && aDesTomes && (
        <span data-piste="" className={`salle-piste ${piste ? '' : 'salle-piste-nue'}`}>
          {piste?.map((segment) => (
            <i key={segment.debut} style={{ left: `${segment.debut}%`, width: `max(3px, ${segment.largeur}%)` }} />
          ))}
        </span>
      )}
      {!compact && (
        <span className="mt-[18px] block min-w-0">
          <b className="block truncate text-[13.5px] font-semibold text-textPrimary">{tuile.title}</b>
          {tuile.signal && <small className="block truncate text-xs font-semibold text-accentText">{tuile.signal}</small>}
        </span>
      )}
      {envie && (
        <span aria-hidden="true" className="salle-coeur">
          <Heart size={14} className="fill-current" />
        </span>
      )}
    </button>
  )
}

/** A slice of the real cover when the volume is here, an empty slot when it is not. */
function Dos({ volume, jaquetteSerie }: { volume: DosSalle; jaquetteSerie: string | null }) {
  const tranche = volume.etat === 'possede' ? (volume.jaquetteUrl ?? jaquetteSerie) : null
  return (
    <span data-dos="" className={`salle-dos salle-dos-${volume.etat}`}>
      {tranche && (
        <img
          src={tranche}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${positionDeLaTranche(volume.numero, Boolean(volume.jaquetteUrl))}% 50%` }}
        />
      )}
    </span>
  )
}
