import type { ReactNode, RefObject } from 'react'
import { Heart, Pencil, Scale, CalendarCheck, CalendarPlus } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_BANDE_PLEINE_LARGEUR, CLASSE_CONTENU_BANDE } from '@/common/components/layout/AppShell'
import { tonDe } from './useTeinteJaquette'

/**
 * The top of the detail page, after the mockup "Fiche série - multi-éditions":
 * a band that crosses the whole screen, tinted by the cover of the series.
 *
 * <h2>Really full width</h2>
 * The band leaves the content column through the page grid
 * (`col-span-full`, see AppShell) and not through a `100vw` - which would count the
 * scrollbar and make the page overflow by fifteen pixels. Its
 * content, however, goes back to the exact width of the rest of the page, otherwise the
 * title would be shifted compared to the volume grid just below.
 *
 * <h2>The tint</h2>
 * Two layers of gradients taken from the average color of the cover (see
 * useTeinteJaquette): each series has its own mood without the user entering anything
 * at all. When the cover refuses to be read - external host without CORS,
 * a frequent case - the brand terracotta is used, and the band stays
 * exactly the one of the mockup.
 */
/** Large enough to be looked at, and it stays in sight along the shelves. */
const CLASSE_JAQUETTE =
  'relative w-[56%] overflow-hidden rounded-xl shadow-token-elevated md:sticky md:top-20 md:w-full'

export function FicheHero({
  teinte,
  teinteSeconde = teinte,
  kicker,
  titre,
  auteur,
  statut,
  annees,
  couvertureUrl,
  repliCouverture,
  onCouverture,
  onEvaluer,
  actionEnvies,
  actionSuivre,
  etat = null,
  modeEdition = false,
  onBasculerMode,
  editions,
  aspectClassName = 'aspect-[2/3]',
  grandeJaquette = false,
  faits,
  refJaquette,
  children,
}: {
  teinte: [number, number, number]
  /** A second color of the cover, for the other side of the band. */
  teinteSeconde?: [number, number, number]
  /** The collection type in small caps above the title. */
  kicker: string | null
  titre: string
  auteur: string | null
  /** "Terminée" / "En cours", with its color pill. null if the
   *  status is not known - we do not invent it. */
  statut: { libelle: string; couleur: string } | null
  annees: string | null
  couvertureUrl: string | null
  repliCouverture: ReactNode
  /** Absent when there is nothing to fix: on the add screen the work
   *  does not exist yet, its cover comes from the chosen candidate. The cover
   *  then stops being a button rather than staying one that does nothing. */
  onCouverture?: () => void
  /** null for a type without the notion of a listing to evaluate, and when adding. */
  onEvaluer?: (() => void) | null
  actionEnvies?: ReactNode
  /** The "Suivre" button (see BoutonSuivreHero); absent when visiting. */
  actionSuivre?: ReactNode
  /** What the work is for the collection - Followed, Owned, In my wishes:
   *  one state at a time; null when it is none of these. */
  etat?: { libelle: string; couleur: string } | null
  /**
   * The switch to edit mode, in the header of the detail page - so on EVERY
   * detail page, whatever its type.
   *
   * <p>It used to live in the "Éditions" row (see CartesEditions), which is only
   * rendered for a work that has volumes. A video game, a board game,
   * a series with no volume cataloged yet therefore had NO
   * access to edit mode - no rename, no reload from the source, no
   * relationships, no technical fields, no delete. The gesture does not depend on
   * editions: it opens the catalog of the whole work.
   *
   * <p>Named, and not a simple brush: "Éditer" says which space is
   * being entered. A pictogram alone left people guessing, and that is what had made
   * "Suivre cette édition" impossible to find in Batch 36.
   */
  modeEdition?: boolean
  onBasculerMode?: () => void
  /** The "ÉDITIONS · n" row (see CartesEditions), absent for a type
   *  that has no editions. */
  editions?: ReactNode
  /** The format of the type: a game box is not a manga. */
  aspectClassName?: string
  /** A work without volumes: its cover and its facts are the page. */
  grandeJaquette?: boolean
  /** What stands under the title: the count of volumes, or the facts of a game. */
  faits?: ReactNode
  refJaquette?: RefObject<HTMLElement | null>
  /** The rest of the page, in the column next to the cover. */
  children?: ReactNode
}) {
  return (
    // No stacking context here: the dialogs of the page live in this band and
    // must still cover the header. The background comes first in the DOM and
    // the content is positioned, which is enough to paint it on top.
    // `[&~*]:relative`: the background runs on under the next blocks, which
    // must paint above it. A block that is not positioned paints under a
    // positioned band. `.fixed` keeps its own position.
    <section className={`${CLASSE_BANDE_PLEINE_LARGEUR} relative [&~*:not(.fixed)]:relative`}>
      {/* The colors of the series, side to side, fading down into the color of
          the page in both themes (the mask ends on the page itself, so no edge
          shows). A blurred cover was tried here: its dark areas left gray
          patches, on a white page above all. The dark theme takes less of the
          color, for the text above it to stay readable. */}
      <div
        aria-hidden="true"
        data-teinte-fiche=""
        className="pointer-events-none absolute inset-x-0 -top-[68px] h-[760px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)] [[data-theme=dark]_&]:opacity-40"
        style={{ background: `linear-gradient(90deg, ${tonDe(teinte, 100, 0.05)}, ${tonDe(teinteSeconde, 100, 0.05)})` }}
      />

      <div
        className={`${CLASSE_CONTENU_BANDE} relative grid grid-cols-1 items-start gap-5 pt-3 md:gap-8 ${
          grandeJaquette
            ? 'md:grid-cols-[clamp(240px,36vw,520px)_minmax(0,1fr)]'
            : 'md:grid-cols-[clamp(220px,25vw,340px)_minmax(0,1fr)]'
        }`}
      >
        {onCouverture ? (
          <button
            type="button"
            onClick={onCouverture}
            aria-label="Modifier la couverture de la série"
            data-cible-vol=""
            ref={refJaquette as RefObject<HTMLButtonElement | null>}
            className={`${CLASSE_JAQUETTE} ${aspectClassName}`}
            style={{ boxShadow: `0 26px 60px -18px ${tonDe(teinte, 80, 0.2)}` }}
          >
            <Jaquette src={couvertureUrl} repli={repliCouverture} className="absolute inset-0 h-full w-full object-cover" />
          </button>
        ) : (
          <div
            data-cible-vol=""
            ref={refJaquette as RefObject<HTMLDivElement | null>}
            className={`${CLASSE_JAQUETTE} ${aspectClassName}`}
            style={{ boxShadow: `0 26px 60px -18px ${tonDe(teinte, 80, 0.2)}` }}
          >
            <Jaquette src={couvertureUrl} repli={repliCouverture} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}

        <div data-colonne-fiche="" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="flex min-w-0 flex-col gap-[7px]">
              {kicker && (
                <span className="text-[11px] font-semibold tracking-[0.14em] text-textPrimary uppercase">{kicker}</span>
              )}
              <h1 className="font-display text-[clamp(1.9rem,4.4vw,3.125rem)] leading-[1.06] font-semibold tracking-[-0.045em] break-words text-textPrimary">
                {titre}
              </h1>
              {(etat || statut || annees || auteur) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-textDim">
                  {auteur && <span>{auteur}</span>}
                  {etat && (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
                      style={{ color: etat.couleur, background: `color-mix(in srgb, ${etat.couleur} 14%, transparent)` }}
                    >
                      {etat.libelle}
                    </span>
                  )}
                  {statut && (
                    <span className="inline-flex items-center gap-[7px] font-medium" style={{ color: statut.couleur }}>
                      <span
                        aria-hidden="true"
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ background: statut.couleur }}
                      />
                      {statut.libelle}
                    </span>
                  )}
                  {annees && <span>{annees}</span>}
                </div>
              )}
            </div>

            {(onEvaluer || actionEnvies || actionSuivre || onBasculerMode) && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {onBasculerMode && (
                <button
                  type="button"
                  onClick={onBasculerMode}
                  aria-pressed={modeEdition}
                  className={`flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    modeEdition ? 'bg-accent text-accentInk' : 'bg-surface text-textPrimary shadow-token-sm hover:text-accentText'
                  }`}
                >
                  <Pencil size={14} />
                  {modeEdition ? 'Terminer' : 'Éditer'}
                </button>
              )}
              {/* A secondary button, named in full: a bare "Évaluer" in the
                  accent color read as THE action of the page, while it is an
                  occasional tool about a listing found elsewhere. On an owned
                  series, the frequent gestures are on the volume tiles
                  (UI review of 2026-10-13). */}
              {onEvaluer && (
                <button
                  type="button"
                  onClick={onEvaluer}
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-surface px-3.5 text-[13px] font-semibold whitespace-nowrap text-textPrimary shadow-token-sm transition-colors hover:text-accentText"
                >
                  <Scale size={14} />
                  Évaluer une annonce
                </button>
              )}
              {actionEnvies}
              {actionSuivre}
            </div>
            )}
          </div>

          {faits}
          {editions}
          {children}
        </div>
      </div>
    </section>
  )
}

/** The "wishes" button of the hero: a square icon on a surface, like the
 *  mockup - the label lives in the `title`/`aria-label`, the action row
 *  only has room for one full button and one icon. */
export function BoutonEnviesHero({
  dedans,
  onBasculer,
  disabled,
}: {
  dedans: boolean
  onBasculer: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onBasculer}
      disabled={disabled}
      // There is no visible label: the accessible name must therefore carry
      // the ACTION, not the state (same rule as WishlistToggle).
      aria-label={dedans ? 'Retirer de mes envies' : 'Ajouter à mes envies'}
      aria-pressed={dedans}
      title={dedans ? 'Retirer de mes envies' : 'Ajouter à mes envies'}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
        dedans ? 'bg-accentTint text-accentText' : 'bg-surface text-textDim shadow-token-sm hover:text-accentText'
      }`}
    >
      <Heart size={17} className={dedans ? 'fill-current' : undefined} />
    </button>
  )
}

/** The "Suivre" button of the hero: same shape as the wishes button, a
 *  calendar as icon - following means waiting for releases. The accessible
 *  name carries the ACTION; the state is read in the pill of the title. */
export function BoutonSuivreHero({
  suivie,
  onBasculer,
  disabled,
}: {
  suivie: boolean
  onBasculer: () => void
  disabled?: boolean
}) {
  const libelle = suivie ? 'Ne plus suivre cette œuvre' : 'Suivre cette œuvre'
  return (
    <button
      type="button"
      onClick={onBasculer}
      disabled={disabled}
      aria-label={libelle}
      aria-pressed={suivie}
      title={libelle}
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
        suivie ? 'bg-accentTint text-accentText' : 'bg-surface text-textPrimary shadow-token-sm hover:text-accentText'
      }`}
    >
      {suivie ? <CalendarCheck size={14} /> : <CalendarPlus size={14} />}
      {suivie ? 'Suivie' : 'Suivre'}
    </button>
  )
}
