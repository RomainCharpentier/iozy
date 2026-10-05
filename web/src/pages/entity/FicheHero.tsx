import type { ReactNode } from 'react'
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
export function FicheHero({
  teinte,
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
  colleEnHaut = true,
}: {
  teinte: [number, number, number]
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
  /** The band goes up under the header by cancelling the `pt-6` of `<main>`, so
   *  that no background band comes in between. Set to false when something
   *  comes before it in the page (a back link): otherwise it would
   *  go over it. */
  colleEnHaut?: boolean
}) {
  return (
    <section className={`${CLASSE_BANDE_PLEINE_LARGEUR} relative ${colleEnHaut ? '-mt-6' : ''}`}>
      {/* The two layers of the mockup, in order: the vertical gradient
          that sets the mood, then the radial wash that breaks it so that it
          does not look like a flat color. `-z-10` and not `z-0`: they must
          go BEHIND the content without forcing a stacking
          context on it, otherwise the panel of a volume opened further down would go
          under it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[660px]"
        style={{
          background:
            `linear-gradient(178deg, ${tonDe(teinte, 34, 0.2)} 0%, ${tonDe(teinte, 20, 0.3)} 26%,` +
            ` ${tonDe(teinte, 9, 0.45)} 58%, ${tonDe(teinte, 0)} 100%),` +
            ' linear-gradient(180deg, var(--color-surface2) 0%, var(--color-background) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]"
        style={{
          background:
            `radial-gradient(72% 62% at 8% -4%, ${tonDe(teinte, 30, 0.12)} 0%, ${tonDe(teinte, 0, 0.12)} 62%),` +
            ` radial-gradient(56% 54% at 96% 2%, ${tonDe(teinte, 16, 0.4)} 0%, ${tonDe(teinte, 0, 0.4)} 58%)`,
        }}
      />

      <div className={`${CLASSE_CONTENU_BANDE} flex flex-wrap items-start gap-5 pt-6 md:gap-9`}>
        {onCouverture ? (
          <button
            type="button"
            onClick={onCouverture}
            aria-label="Modifier la couverture de la série"
            className="relative aspect-[2/3] w-[clamp(112px,15vw,188px)] shrink-0 overflow-hidden rounded-xl shadow-token-elevated"
          >
            <Jaquette src={couvertureUrl} repli={repliCouverture} className="absolute inset-0 h-full w-full object-cover" />
          </button>
        ) : (
          <div className="relative aspect-[2/3] w-[clamp(112px,15vw,188px)] shrink-0 overflow-hidden rounded-xl shadow-token-elevated">
            <Jaquette src={couvertureUrl} repli={repliCouverture} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}

        <div className="flex min-w-[280px] flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="flex min-w-0 flex-col gap-[7px]">
              {kicker && (
                <span className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">{kicker}</span>
              )}
              <h1 className="font-display text-[clamp(1.9rem,4.4vw,3.125rem)] leading-[1.06] font-semibold tracking-[-0.045em] break-words text-textPrimary">
                {titre}
              </h1>
              {auteur && <span className="text-[15px] text-textDim">{auteur}</span>}
              {(etat || statut || annees) && (
                <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
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
                  {annees && <span className="text-faint">{annees}</span>}
                </div>
              )}
            </div>

            {(onEvaluer || actionEnvies || actionSuivre || onBasculerMode) && (
            <div className="flex shrink-0 items-center gap-2">
              {onBasculerMode && (
                <button
                  type="button"
                  onClick={onBasculerMode}
                  aria-pressed={modeEdition}
                  className={`flex h-11 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                    modeEdition ? 'bg-accent text-accentInk' : 'bg-softBtn text-textDim hover:text-textPrimary'
                  }`}
                >
                  <Pencil size={14} />
                  {modeEdition ? 'Terminer' : 'Éditer'}
                </button>
              )}
              {onEvaluer && (
                <button
                  type="button"
                  onClick={onEvaluer}
                  className="btn-primaire"
                >
                  <Scale size={16} />
                  Évaluer
                </button>
              )}
              {actionEnvies}
              {actionSuivre}
            </div>
            )}
          </div>

          {editions}
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
      className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
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
      className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
        suivie ? 'bg-accentTint text-accentText' : 'bg-surface text-textDim shadow-token-sm hover:text-accentText'
      }`}
    >
      {suivie ? <CalendarCheck size={17} /> : <CalendarPlus size={17} />}
    </button>
  )
}
