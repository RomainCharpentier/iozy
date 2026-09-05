import type { ReactNode } from 'react'
import { Heart, Pencil, Scale } from 'lucide-react'
import { Jaquette } from '@/common/components/Jaquette'
import { CLASSE_BANDE_PLEINE_LARGEUR, CLASSE_CONTENU_BANDE } from '@/common/components/layout/AppShell'
import { tonDe } from './useTeinteJaquette'

/**
 * Le haut de la fiche, d'après la maquette « Fiche série - multi-éditions » :
 * une bande qui traverse tout l'écran, teintée par la jaquette de la série.
 *
 * <h2>Pleine largeur, pour de vrai</h2>
 * La bande sort de la colonne de contenu par la grille de page
 * (`col-span-full`, voir AppShell) et non par un `100vw` - qui compterait la
 * barre de défilement et ferait déborder la page de quinze pixels. Son
 * contenu, lui, revient à la largeur exacte du reste de la page, sans quoi le
 * titre serait décalé par rapport à la grille de tomes juste dessous.
 *
 * <h2>La teinte</h2>
 * Deux couches de dégradés tirées de la couleur moyenne de la jaquette (voir
 * useTeinteJaquette) : chaque série a son ambiance sans qu'on saisisse quoi
 * que ce soit. Quand la jaquette refuse d'être lue - hôte externe sans CORS,
 * cas fréquent - c'est le terracotta de la marque qui sert, et la bande reste
 * exactement celle de la maquette.
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
  modeEdition = false,
  onBasculerMode,
  editions,
  colleEnHaut = true,
}: {
  teinte: [number, number, number]
  /** Le type de collection en petites capitales au-dessus du titre. */
  kicker: string | null
  titre: string
  auteur: string | null
  /** « Terminée » / « En cours », avec sa pastille de couleur. null si le
   *  statut n'est pas connu - on ne l'invente pas. */
  statut: { libelle: string; couleur: string } | null
  annees: string | null
  couvertureUrl: string | null
  repliCouverture: ReactNode
  /** Absent quand il n'y a rien à corriger : sur l'écran d'ajout l'œuvre
   *  n'existe pas encore, sa jaquette vient du candidat choisi. La jaquette
   *  cesse alors d'être un bouton plutôt que d'en rester un qui ne fait rien. */
  onCouverture?: () => void
  /** null pour un type sans notion d'annonce à évaluer, et à l'ajout. */
  onEvaluer?: (() => void) | null
  actionEnvies?: ReactNode
  /**
   * Le passage en mode édition, dans l'en-tête de la fiche - donc sur TOUTE
   * fiche, quel que soit son type.
   *
   * <p>Il vivait dans la rangée « Éditions » (voir CartesEditions), qui n'est
   * rendue que par une œuvre ayant des tomes. Un jeu vidéo, un jeu de société,
   * une série dont aucun tome n'est encore catalogué n'avaient donc AUCUN
   * accès au mode édition - ni renommer, ni recharger depuis la source, ni
   * relations, ni champs techniques, ni supprimer. Le geste ne dépend pas des
   * éditions : il ouvre le catalogue de l'œuvre entière.
   *
   * <p>Nommé, et pas un simple pinceau : « Éditer » dit dans quel espace on
   * entre. Un pictogramme seul laissait deviner, et c'est ce qui avait rendu
   * « Suivre cette édition » introuvable au Lot 36.
   */
  modeEdition?: boolean
  onBasculerMode?: () => void
  /** La rangée « ÉDITIONS · n » (voir CartesEditions), absente pour un type
   *  qui n'a pas d'éditions. */
  editions?: ReactNode
  /** La bande remonte sous l'en-tête en annulant le `pt-6` de `<main>`, pour
   *  qu'aucune bande de fond ne s'intercale. À mettre à false quand quelque
   *  chose la précède dans la page (un lien de retour) : sinon elle lui
   *  passerait par-dessus. */
  colleEnHaut?: boolean
}) {
  return (
    <section className={`${CLASSE_BANDE_PLEINE_LARGEUR} relative ${colleEnHaut ? '-mt-6' : ''}`}>
      {/* Les deux couches de la maquette, dans l'ordre : le dégradé vertical
          qui pose l'ambiance, puis le lavis radial qui la casse pour qu'elle
          ne ressemble pas à un aplat. `-z-10` et non `z-0` : elles doivent
          passer DERRIÈRE le contenu sans lui imposer un contexte
          d'empilement, sinon le panneau d'un tome ouvert plus bas passerait
          dessous. */}
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
              {(statut || annees) && (
                <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
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

            {(onEvaluer || actionEnvies || onBasculerMode) && (
            <div className="flex shrink-0 items-center gap-2">
              {onBasculerMode && (
                <button
                  type="button"
                  onClick={onBasculerMode}
                  aria-pressed={modeEdition}
                  className={`flex h-[42px] items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
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
                  className="flex items-center gap-2.5 rounded-xl bg-accent px-4 py-[11px] text-sm font-semibold whitespace-nowrap text-accentInk shadow-token-accent transition-transform hover:-translate-y-px"
                >
                  <Scale size={16} />
                  Évaluer
                </button>
              )}
              {actionEnvies}
            </div>
            )}
          </div>

          {editions}
        </div>
      </div>
    </section>
  )
}

/** Le bouton « envies » du hero : une icône carrée sur surface, comme la
 *  maquette - le libellé vit dans le `title`/`aria-label`, la rangée d'actions
 *  n'a la place que d'un bouton plein et d'une icône. */
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
      // Le libellé visible n'existe pas : le nom accessible doit donc porter
      // l'ACTION, pas l'état (même règle que WishlistToggle).
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
