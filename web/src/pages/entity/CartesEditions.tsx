import { Bookmark, Check, Plus } from 'lucide-react'

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
  sensProgression = 'possession',
}: {
  editions: EditionAffichee[]
  editionAffichee: string
  /** null quand l'utilisateur n'a encore rien déclaré, et sur l'écran d'ajout
   *  où l'œuvre n'existe pas encore : on ne suit pas une édition d'une série
   *  qu'on n'a pas. */
  editionSuivie?: string | null
  onAfficher: (nom: string) => void
  onSuivre?: (nom: string) => void
  onNePlusSuivre?: () => void
  onAjouterEdition?: () => void
  /** L'espace « Éditer » : au repos la fiche se LIT, et aucune action de
   *  catalogue n'y apparaît. Ajouter une édition ou un tome relève de la
   *  connaissance catalographique, pas de la collection personnelle (étude
   *  produit du 2026-08-27, §10) - ces actions vivent donc toutes derrière
   *  cette bascule, jamais saupoudrées dans la page. Absent des écrans qui
   *  n'ont rien à modifier : le bouton disparaît au lieu de rester inerte. */
  modeEdition?: boolean
  /** Ce que la jauge d'une carte COMPTE. Sur la fiche, des tomes possédés ;
   *  à l'ajout, des tomes cochés. Même dessin, deux sens - et le sens doit
   *  être dit au lecteur d'écran, à qui « 3/27 » ne suffit pas. */
  sensProgression?: 'possession' | 'selection'
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          Éditions · {editions.length}
        </span>
        {/* Le passage en mode édition a quitté cette rangée pour l'en-tête de
            la fiche (voir FicheHero) : il ouvre le catalogue de l'ŒUVRE, pas
            celui de ses éditions, et cette rangée n'existe pas sur un type qui
            n'en a aucune. Ne reste ici que ce qui parle vraiment d'éditions. */}
        {modeEdition && (
          <div className="flex items-center gap-2">
            {onAjouterEdition && (
              // « Ajouter » doit toujours dire OÙ (§11) : un « + » nu ne
              // distinguait pas ce geste de catalogue d'un ajout à la
              // collection.
              <button
                type="button"
                onClick={onAjouterEdition}
                className="flex h-[34px] items-center gap-1.5 rounded-[10px] border border-dashed border-lineStrong px-3 text-[12.5px] font-medium text-textDim hover:border-accent hover:text-accentText"
              >
                <Plus size={14} />
                Ajouter une édition
              </button>
            )}
          </div>
        )}
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
                {/* Ce qu'on sait de l'édition - son ÉDITEUR et son nombre de
                    tomes, pas son nom, qui est juste au-dessus. D'où
                    « Détails à renseigner » et non « Édition à renseigner » :
                    le second, posé sous « Crunchyroll », se lisait comme une
                    contradiction (on nomme l'édition ET on dit qu'elle est à
                    renseigner). Le crayon de correction est dans « L'œuvre ». */}
                <span className="text-[12.5px] text-faint">
                  {[edition.editeur, edition.total !== null ? `${edition.total} tomes` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Détails à renseigner'}
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
                    {/* Pas de « 2/? » : un ratio dont le dénominateur est
                        inconnu se lit comme une donnée manquante alors que le
                        numérateur, lui, est parfaitement su. On affiche
                        simplement ce qu'on a. Le total d'une édition n'est
                        connu que renseigné (voir MangaEdition) - le déduire du
                        nombre de tomes qu'une recherche a RAMENÉS
                        empoisonnerait le moteur de complétude, qui s'en sert
                        ensuite pour dire ce qui manque et ce qu'il en coûte. */}
                    <span aria-hidden="true">
                      {edition.total !== null
                        ? `${edition.possedes}/${edition.total}`
                        : `${edition.possedes} tome${edition.possedes > 1 ? 's' : ''}`}
                    </span>
                    <span className="sr-only">
                      {edition.possedes} tome{edition.possedes > 1 ? 's' : ''}{' '}
                      {sensProgression === 'selection' ? 'sélectionné' : 'possédé'}
                      {edition.possedes > 1 ? 's' : ''}
                      {edition.total !== null ? ` sur ${edition.total}` : ''}
                    </span>
                  </span>
                </span>
              </button>

              {/* « Suivre » n'a de sens que sur une édition NOMMÉE : le groupe
                  des tomes sans édition précisée n'est pas une édition qu'on
                  peut collectionner, c'est le fourre-tout de ce qu'on ignore. */}
              {/* Plus derrière le pinceau : suivre une édition est la
                  décision principale de cette rangée, et la cacher derrière un
                  mode d'édition la rendait introuvable - la donnée persistée
                  côté backend n'avait aucun chemin évident pour être posée.
                  Affiché dès qu'il y a un CHOIX réel : avec une seule édition,
                  déclarer laquelle on collectionne ne veut rien dire. */}
              {editions.length > 1 && onSuivre && onNePlusSuivre && edition.nom !== '' && (
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
