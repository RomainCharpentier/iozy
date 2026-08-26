import { Bookmark, Check, Pencil, Plus } from 'lucide-react'

export interface EditionAffichee {
  /** Le nom de l'édition. `''` pour le groupe « édition non précisée », qui
   *  peut être AFFICHÉ mais jamais SUIVI (voir FollowedEdition côté backend). */
  nom: string
  editeur: string | null
  /** Nombre de tomes de l'édition, null tant qu'aucune source ne le connaît. */
  total: number | null
  possedes: number
}

/**
 * La rangée « ÉDITIONS · n » de la maquette : une carte par édition, chacune
 * avec sa propre progression.
 *
 * <h2>Choisir n'est pas suivre</h2>
 * Deux gestes distincts, que la maquette sépare et que l'ancienne fiche
 * confondait en un seul état local :
 * <ul>
 *   <li><b>Choisir</b> (cliquer la carte) ne change que ce qu'on REGARDE - la
 *       grille de tomes en dessous. Volatile, oublié en quittant la page.</li>
 *   <li><b>Suivre</b> (« Suivre cette édition ») déclare celle qu'on
 *       collectionne. C'est une donnée persistée, elle décide de l'édition
 *       ouverte par défaut à la prochaine visite.</li>
 * </ul>
 * D'où deux commandes sur la même carte plutôt qu'un clic qui ferait les deux :
 * comparer trois éditions avant d'en choisir une est le cas normal, et chaque
 * coup d'œil ne doit pas réécrire ce qu'on collectionne.
 */
export function CartesEditions({
  editions,
  editionAffichee,
  editionSuivie,
  onAfficher,
  onSuivre,
  onNePlusSuivre,
  onAjouterEdition,
  modeEdition,
  onBasculerMode,
}: {
  editions: EditionAffichee[]
  editionAffichee: string
  /** null quand l'utilisateur n'a encore rien déclaré. */
  editionSuivie: string | null
  onAfficher: (nom: string) => void
  onSuivre: (nom: string) => void
  onNePlusSuivre: () => void
  onAjouterEdition: () => void
  /** Le mode « pinceau » de la maquette : au repos la fiche se lit, en mode
   *  édition elle montre ses points d'ajout. Évite de saupoudrer la page de
   *  boutons « + » qu'on ne cherche que rarement. */
  modeEdition: boolean
  onBasculerMode: () => void
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          Éditions · {editions.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBasculerMode}
            aria-pressed={modeEdition}
            title={modeEdition ? 'Terminer les modifications' : 'Modifier cette fiche'}
            className={`flex h-[34px] w-[34px] items-center justify-center rounded-[10px] transition-colors ${
              modeEdition ? 'bg-accent text-accentInk' : 'bg-softBtn text-textDim'
            }`}
          >
            <Pencil size={15} />
          </button>
          {modeEdition && (
            <button
              type="button"
              onClick={onAjouterEdition}
              title="Ajouter une édition"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-dashed border-lineStrong text-textDim hover:border-accent hover:text-accentText"
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {editions.map((edition) => {
          const cle = edition.nom || '(non précisée)'
          const affichee = edition.nom === editionAffichee
          const suivie = edition.nom !== '' && edition.nom === editionSuivie
          const pourcentage =
            edition.total !== null && edition.total > 0
              ? Math.round((edition.possedes / edition.total) * 100)
              : null
          return (
            <div
              key={cle}
              className={`flex flex-col gap-2.5 rounded-[14px] p-[13px_15px] transition-shadow ${
                affichee
                  ? 'bg-surface shadow-token-md ring-2 ring-accent ring-inset'
                  : 'bg-surface/70 ring-1 ring-line ring-inset'
              }`}
            >
              <button
                type="button"
                onClick={() => onAfficher(edition.nom)}
                aria-pressed={affichee}
                className="flex flex-col gap-[7px] text-left"
              >
                <span className="flex items-center justify-between gap-2.5">
                  <span className="font-display text-[14.5px] font-medium tracking-[-0.01em] text-textPrimary">
                    {edition.nom || 'Édition non précisée'}
                  </span>
                  {suivie && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accentTint px-2 py-0.5 text-[10.5px] font-semibold tracking-[0.08em] text-accentText uppercase">
                      <Check size={10} strokeWidth={3} />
                      Suivie
                    </span>
                  )}
                </span>
                <span className="text-[12.5px] text-faint">
                  {[edition.editeur, edition.total !== null ? `${edition.total} tomes` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Éditeur et nombre de tomes non renseignés'}
                </span>
                <span className="flex w-full items-center gap-2.5">
                  <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-line">
                    {pourcentage !== null && (
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${pourcentage}%` }}
                      />
                    )}
                  </span>
                  <span
                    className={`font-display text-[12.5px] font-medium whitespace-nowrap ${
                      edition.possedes > 0 ? 'text-accentText' : 'text-faint'
                    }`}
                  >
                    {edition.possedes}/{edition.total ?? '?'}
                  </span>
                </span>
              </button>

              {/* « Suivre » n'a de sens que sur une édition NOMMÉE : le groupe
                  des tomes sans édition précisée n'est pas une édition qu'on
                  peut collectionner, c'est le fourre-tout de ce qu'on ignore. */}
              {modeEdition && edition.nom !== '' && (
                suivie ? (
                  <button
                    type="button"
                    onClick={onNePlusSuivre}
                    className="self-start rounded-full px-2.5 py-1 text-xs text-faint hover:bg-softBtn hover:text-textPrimary"
                  >
                    Ne plus suivre
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSuivre(edition.nom)}
                    className="flex items-center gap-1.5 self-start rounded-full bg-softBtn px-2.5 py-1 text-xs text-textDim hover:bg-accentTint hover:text-accentText"
                  >
                    <Bookmark size={12} />
                    Suivre cette édition
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
