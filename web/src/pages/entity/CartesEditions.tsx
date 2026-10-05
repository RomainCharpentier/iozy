import { Bookmark, Check, Plus } from 'lucide-react'

export interface EditionAffichee {
  /** The name of the edition. `''` for the "edition not specified" group, which
   *  can be DISPLAYED but never FOLLOWED (see FollowedEdition on the backend side). */
  nom: string
  editeur: string | null
  /** Number of volumes of the edition, null as long as no source knows it. */
  total: number | null
  possedes: number
}

/**
 * The "ÉDITIONS · n" row of the mockup: one card per edition, each
 * with its own progress.
 *
 * <h2>Choosing is not following</h2>
 * Two separate gestures, which the mockup separates and which the old page
 * merged into a single local state:
 * <ul>
 *   <li><b>Choose</b> (click the card) only changes what is being LOOKED AT - the
 *       volume grid below. Volatile, forgotten when leaving the page.</li>
 *   <li><b>Follow</b> ("Suivre cette édition") declares the one being
 *       collected. It is persisted data, it decides which edition is
 *       opened by default on the next visit.</li>
 * </ul>
 * Hence two controls on the same card rather than one click doing both:
 * comparing three editions before choosing one is the normal case, and each
 * glance must not rewrite what is being collected.
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
  /** null when the user has not declared anything yet, and on the add screen
   *  where the work does not exist yet: one does not follow an edition of a series
   *  one does not have. */
  editionSuivie?: string | null
  onAfficher: (nom: string) => void
  onSuivre?: (nom: string) => void
  onNePlusSuivre?: () => void
  onAjouterEdition?: () => void
  /** The "Éditer" space: at rest the page is READ, and no catalog
   *  action appears on it. Adding an edition or a volume is part of
   *  cataloging knowledge, not of the personal collection (product
   *  study of 2026-08-27, section 10) - so these actions all live behind
   *  this switch, never sprinkled in the page. Absent from screens that
   *  have nothing to change: the button disappears instead of staying inert. */
  modeEdition?: boolean
  /** What the gauge of a card COUNTS. On the detail page, owned volumes;
   *  when adding, checked volumes. Same drawing, two meanings - and the meaning must
   *  be told to the screen reader, for whom "3/27" is not enough. */
  sensProgression?: 'possession' | 'selection'
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">
          Éditions · {editions.length}
        </span>
        {/* The switch to edit mode left this row for the header of
            the detail page (see FicheHero): it opens the catalog of the WORK, not
            that of its editions, and this row does not exist on a type that has
            none. Only what really speaks about editions stays here. */}
        {modeEdition && (
          <div className="flex items-center gap-2">
            {onAjouterEdition && (
              // "Ajouter" must always say WHERE (section 11): a bare "+" did not
              // tell this catalog gesture apart from an add to the
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
                {/* What is known about the edition - its PUBLISHER and its number of
                    volumes, not its name, which is just above. Hence
                    "Détails à renseigner" and not "Édition à renseigner":
                    the second one, placed under "Crunchyroll", read like a
                    contradiction (the edition is named AND said to need
                    filling in). The correction pencil is in "L'œuvre". */}
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
                    {/* No "2/?": a ratio whose denominator is
                        unknown reads like missing data while the
                        numerator is perfectly known. We simply show
                        what we have. The total of an edition is only
                        known when filled in (see MangaEdition) - deducing it from the
                        number of volumes a search BROUGHT BACK
                        would poison the completeness engine, which then uses it
                        to say what is missing and what it costs. */}
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

              {/* "Suivre" only makes sense on a NAMED edition: the group
                  of volumes without a specified edition is not an edition one can
                  collect, it is the catch-all of what we do not know. */}
              {/* No longer behind the pencil: following an edition is the
                  main decision of this row, and hiding it behind an edit
                  mode made it impossible to find - the data persisted
                  on the backend side had no obvious path to be set.
                  Shown as soon as there is a real CHOICE: with a single edition,
                  declaring which one is collected means nothing. */}
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
