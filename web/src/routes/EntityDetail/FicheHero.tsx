import type { ReactNode } from 'react'
import { Pencil, Star } from 'lucide-react'
import { Jaquette } from '../../components/Jaquette'
import { TierBadge } from '../TierLists/TierBadge'
import type { Rank } from '../../types/tierList'

/**
 * Le haut de la fiche d'une œuvre, d'après la maquette v4.
 *
 * <h2>Ce que ce bloc répond, et dans quel ordre</h2>
 * « Qu'est-ce que c'est ? » (pastilles, titre, auteur), puis « où j'en suis ? »
 * (l'anneau de progression et les trois relevés : mon rang, ma note, l'édition
 * suivie), puis « qu'est-ce que je peux faire ? » (les actions). La version
 * précédente mélangeait les trois : la progression vivait dans une colonne
 * centrale plafonnée à 560px, les actions dans une troisième colonne apparue
 * pour combler un vide, et le rang n'était visible qu'après avoir déroulé la
 * moitié de la page.
 *
 * <h2>Trois relevés, pas trois modules</h2>
 * Rang, note et édition sont ici en LECTURE seule : chacun a déjà son endroit
 * pour être modifié (« Mon suivi » pour les deux premiers, la barre d'édition
 * de « Mes tomes » et le crayon accroché au nom de l'édition pour la
 * dernière). Les répéter en pleine interface de saisie ferait de l'en-tête un
 * formulaire ; les taire obligerait à ouvrir une section pour savoir ce qu'on
 * pense d'une série qu'on a sous les yeux.
 *
 * <h2>Le fond</h2>
 * Un panneau arrondi, pas la bande pleine largeur de la maquette : le contenu
 * de l'application vit dans un conteneur centré (voir AppShell), et en sortir
 * demanderait un `100vw` - qui compte la barre de défilement, et rouvre
 * exactement la classe de débordement horizontal corrigée au Lot 10. Le
 * dégradé et les deux halos sont conservés, en tokens, donc réactifs au thème.
 */
export function FicheHero({
  titre,
  onModifierTitre,
  auteur,
  couvertureUrl,
  repliCouverture,
  onModifierCouverture,
  pastilles,
  progression,
  rang,
  rangLibelle,
  note,
  edition,
  actions,
  aide,
  complements,
}: {
  titre: string
  onModifierTitre: () => void
  auteur: string | null
  couvertureUrl: string | null
  /** Ce qui s'affiche quand la jaquette manque ou ne répond plus (voir
   *  Jaquette, qui gère l'échec de chargement lui-même). */
  repliCouverture: ReactNode
  onModifierCouverture: () => void
  /** Type de collection, statut de publication, année : déjà mises en forme
   *  par la page, seule à savoir ce qui est réellement connu. */
  pastilles: ReactNode
  /** null quand la notion de tome n'existe pas pour ce type. L'anneau, lui,
   *  n'apparaît que si le total de l'édition est connu : jamais un anneau à
   *  0 % qui ferait croire à une collection vide alors qu'on ignore le total. */
  progression: { possedes: number; total: number | null } | null
  rang: Rank | null
  /** L'univers dans lequel ce rang est posé (« Manga »), accolé à la pastille. */
  rangLibelle: string | null
  note: number | null
  edition: { nom: string; total: number | null; correction: ReactNode } | null
  actions: ReactNode
  /** La phrase qui explique l'action principale. Elle existait déjà sous
   *  « Évaluer une annonce » avant la v4, et la maquette la garde : posée au
   *  milieu d'une fiche de série possédée, cette action ne dit ni de quelle
   *  annonce il s'agit, ni ce que la série vient y faire. */
  aide?: ReactNode
  /** Ce qui pend sous les actions et peut se déplier (avertissements
   *  d'édition, « je cherche une meilleure édition ») : hors de la rangée
   *  d'actions, pour qu'un formulaire ouvert ne la disloque pas. */
  complements?: ReactNode
}) {
  const pourcentage =
    progression && progression.total !== null && progression.total > 0
      ? Math.round((progression.possedes / progression.total) * 100)
      : null
  const manquants =
    progression && progression.total !== null ? Math.max(progression.total - progression.possedes, 0) : null

  const releves = [
    rang !== null ? (
      // La pastille SEULE ne dit pas dans quoi on est classé : « B » ne veut
      // rien dire tant qu'on ne sait pas « B en Manga ». La maquette accole
      // toujours l'univers à la lettre.
      <Releve key="rang" libelle="Mon rang">
        <span className="flex items-center gap-2">
          <TierBadge rank={rang} size="compact" />
          {rangLibelle && <span className="text-sm font-medium text-textPrimary">{rangLibelle}</span>}
        </span>
      </Releve>
    ) : null,
    note !== null ? (
      <Releve key="note" libelle="Ma note">
        <span className="flex items-center gap-1.5">
          <Star size={15} className="fill-accent text-accent" />
          <span className="font-display text-base font-bold text-textPrimary">
            {note}
            <span className="font-body font-normal text-faint">/10</span>
          </span>
        </span>
      </Releve>
    ) : null,
    edition ? (
      <Releve key="edition" libelle="Édition suivie">
        <span className="flex items-center gap-1.5 text-sm font-medium text-textPrimary">
          {edition.nom}
          {edition.total !== null ? ` · ${edition.total} t.` : ''}
          {edition.correction}
        </span>
      </Releve>
    ) : null,
  ].filter((releve) => releve !== null)

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-surface2 to-background px-4 py-6 sm:px-7 sm:py-8">
      {/* Les deux halos de la maquette, en tokens plutôt qu'en hexadécimal :
          ils doivent pâlir avec le thème sombre, sans quoi un voile terracotta
          à 14 % vire au brun sur un fond presque noir. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 70% at 22% 20%, var(--color-accentTint) 0%, transparent 62%),' +
            ' radial-gradient(50% 60% at 85% 10%, var(--color-universeVioletTint) 0%, transparent 60%)',
        }}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8 md:gap-11">
        <div className="relative aspect-[2/3] w-32 shrink-0 overflow-hidden rounded-[20px] shadow-token-elevated sm:w-40 md:w-[236px]">
          <Jaquette src={couvertureUrl} repli={repliCouverture} className="absolute inset-0 h-full w-full object-cover" />
          <button
            type="button"
            onClick={onModifierCouverture}
            aria-label="Modifier la couverture de la série"
            className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-scrim text-white"
          >
            <Pencil size={13} />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {pastilles ? <div className="flex flex-wrap items-center gap-2">{pastilles}</div> : null}

          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2.5">
              {/* Un clamp plus prudent que les 46-68px de la maquette : elle
                  n'affiche que « Death Note », et cette application a déjà eu
                  à encaisser des titres de série de plus de soixante
                  caractères (voir « tenir le choc des titres longs »). */}
              <h1 className="min-w-0 font-display text-[clamp(1.75rem,4.6vw,2.85rem)] leading-[1.05] font-bold tracking-[-0.04em] break-words text-textPrimary">
                {titre}
              </h1>
              <button
                type="button"
                onClick={onModifierTitre}
                aria-label="Modifier le nom de la série"
                className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-softBtn text-textDim"
              >
                <Pencil size={14} />
              </button>
            </div>
            {auteur ? (
              <p className="text-base text-textDim">
                par <span className="font-semibold text-textPrimary">{auteur}</span>
              </p>
            ) : null}
          </div>

          {progression || releves.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
              {progression ? (
                <div className="flex items-center gap-4">
                  {pourcentage !== null && (
                    <div
                      className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(var(--color-accent) 0turn ${pourcentage / 100}turn, var(--color-line) ${pourcentage / 100}turn 1turn)`,
                      }}
                    >
                      <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-surface font-display text-[17px] font-bold text-textPrimary shadow-token-sm">
                        {pourcentage}%
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5">
                    <p className="font-display text-xl font-bold text-textPrimary">
                      {progression.possedes}
                      <span className="font-body font-normal text-faint">
                        {progression.total !== null
                          ? ` / ${progression.total} tomes`
                          : ` tome${progression.possedes > 1 ? 's' : ''} possédé${progression.possedes > 1 ? 's' : ''}`}
                      </span>
                    </p>
                    {manquants !== null && (
                      <p className="text-[13.5px] text-textDim">
                        {manquants === 0
                          ? 'Série complète dans ta collection'
                          : `${manquants} manquant${manquants > 1 ? 's' : ''} dans ta collection`}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {progression && releves.length > 0 ? (
                <span aria-hidden="true" className="hidden h-13 w-px bg-line sm:block" />
              ) : null}

              {releves.length > 0 ? <div className="flex flex-wrap items-start gap-x-7 gap-y-4">{releves}</div> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">{actions}</div>
          {/* Les compléments AVANT la phrase d'aide : la maquette met
              « Chercher une meilleure édition → » sur la rangée d'actions
              elle-même, puis l'aide dessous. Ici le lien vit sur sa propre
              ligne parce qu'il se déplie en formulaire - le mettre dans la
              rangée disloquerait celle-ci à l'ouverture - mais il garde sa
              place AVANT l'aide. */}
          {complements ? <div className="flex flex-col gap-2">{complements}</div> : null}
          {aide ? <p className="max-w-[62ch] text-[13px] leading-relaxed text-faint">{aide}</p> : null}
        </div>
      </div>
    </section>
  )
}

function Releve({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-faint">{libelle}</span>
      <span className="flex min-h-[26px] items-center">{children}</span>
    </div>
  )
}
