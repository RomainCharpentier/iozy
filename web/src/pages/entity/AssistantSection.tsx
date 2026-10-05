import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCompleteness } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import type { EditionProgressDto, ExperienceResponse, VariantDto } from '@/common/types/api'
import type { PriceBasis } from '@/common/types/purchaseAnalysis'
import { editionDe, numeroDe } from '@/common/lib/attributsTome'
import { libelleBaseLong } from '@/common/lib/basePrix'
import { formaterEuros } from '@/common/lib/formats'

/**
 * The assistant's answers: two FIXED questions, whose answer is
 * COMPUTED from the data already loaded by the page - never free
 * input, never a call to a language model, never an answer written
 * in advance (source comment of mockup V1.2: "Assistant: contextual,
 * not a chatbot").
 *
 * <h2>Why it lives in the section bar</h2>
 * It used to take a section of its own, squeezed in the right column of
 * "Mes tomes". But its two questions are not about one section: "what am I
 * missing" asks about ownership, "where am I" asks about
 * readings. Mockup v4 therefore takes it out of the sections and puts it at the right of the
 * bar, available whichever section is being looked at. Hence the split into
 * two parts: the BUTTONS (in the bar) and the ANSWER (under the bar).
 *
 * <h2>The second question of mockup V1.2 still cannot be answered</h2>
 * "What looks like my S?" has nothing to compare: no
 * genre/theme field is stored in this backend (same reason as the absence of a
 * "Genre" line in "L'œuvre"). Replaced by "Where am I in my readings?",
 * which can be answered with the real Experiences (user choice of 2026-08-20).
 *
 * <h2>No network call of its own</h2>
 * Completeness goes through the SAME cache key as the page and "Mes tomes"
 * (React Query shares the request), the experiences are already loaded.
 */
export type QuestionAssistant = 'missing' | 'reading'


/** The answer, placed just under the section bar. Separate from the buttons
 *  above because it does not fit in a sticky bar: it takes
 *  several lines, and a bar that grows while sticky would push away the
 *  content being read. */
export function ReponseAssistant({
  entityId,
  entityTitle,
  variants,
  experiences,
  activeGroup,
  question,
}: {
  entityId: string
  entityTitle: string
  variants: VariantDto[]
  experiences: ExperienceResponse[]
  /** null when no edition is displayed (type without volumes, series without
   *  any volume): "what am I missing" then has nothing to count on. */
  activeGroup: EditionProgressDto | null
  question: QuestionAssistant
}) {
  const navigate = useNavigate()
  // Owned and cataloged counts come from the server with the group (see
  // GET /insights/progress/{entityId}): this section used to recount them from
  // the Ownership records, with its own idea of what belongs to the edition.
  const owned = activeGroup?.ownedVolumeNumbers ?? []
  const editionName = activeGroup?.editionName ?? ''

  // Completeness stays, and it is ITS question: what is missing and what it
  // would cost (market price). Progress only knows how to count -
  // the two do not overlap.
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, editionName, owned),
    queryFn: () =>
      getCompleteness(entityTitle, editionName, owned, activeGroup?.cataloguedVolumeNumbers ?? [], entityId),
    enabled: editionName !== '' && question === 'missing',
  })

  return (
    // aria-live: the answer appears without a page change or a focus change - a
    // screen reader must announce it, otherwise the click "does nothing" for it.
    <div
      aria-live="polite"
      className="flex flex-col gap-2 rounded-[20px] border border-surface2 bg-surface p-5 text-sm text-textPrimary shadow-token-sm"
    >
      {question === 'missing' ? (
        <MissingAnswer
          editionName={editionName}
          ownedCount={owned.length}
          isLoading={completenessQuery.isLoading}
          isError={completenessQuery.isError}
          totalVolumes={completenessQuery.data?.totalVolumes ?? null}
          missingVolumeNumbers={completenessQuery.data?.missingVolumeNumbers ?? []}
          cataloguedMissingVolumeNumbers={completenessQuery.data?.cataloguedMissingVolumeNumbers ?? []}
          estimatedCostToComplete={completenessQuery.data?.estimatedCostToComplete ?? null}
          costToCompleteBasis={completenessQuery.data?.costToCompleteBasis ?? null}
          onEvaluateListing={() =>
            navigate('/purchase-analysis', { state: { seriesTitle: entityTitle, editionName } })
          }
        />
      ) : (
        <ReadingAnswer
          experiences={experiences}
          variants={variants}
          ownedVolumes={owned}
          activeGroup={activeGroup}
        />
      )}
    </div>
  )
}

/** "12, 14, 15, 16, 20" -> "12, 14 à 16, 20" - a list of 30 raw numbers
 * is not a readable answer, while ranges are. */
function formatVolumeRanges(volumeNumbers: number[]): string {
  const sorted = [...volumeNumbers].sort((a, b) => a - b)
  const parts: string[] = []
  let start = sorted[0]
  let previous = sorted[0]
  for (const current of sorted.slice(1)) {
    if (current === previous + 1) {
      previous = current
      continue
    }
    parts.push(start === previous ? `${start}` : `${start} à ${previous}`)
    start = current
    previous = current
  }
  if (sorted.length > 0) parts.push(start === previous ? `${start}` : `${start} à ${previous}`)
  return parts.join(', ')
}

/** "1 tome" / "5 tomes" - the agreement must follow the computed number, otherwise the
 * answer shows "1 tomes" as soon as only one is missing. */
function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular
}

function MissingAnswer({
  editionName,
  ownedCount,
  isLoading,
  isError,
  totalVolumes,
  missingVolumeNumbers,
  cataloguedMissingVolumeNumbers,
  estimatedCostToComplete,
  costToCompleteBasis,
  onEvaluateListing,
}: {
  editionName: string
  ownedCount: number
  isLoading: boolean
  isError: boolean
  totalVolumes: number | null
  missingVolumeNumbers: number[]
  cataloguedMissingVolumeNumbers: number[]
  estimatedCostToComplete: number | null
  costToCompleteBasis: PriceBasis | null
  onEvaluateListing: () => void
}) {
  const base = libelleBaseLong(costToCompleteBasis)

  // Edition not specified: completeness is ALWAYS computed per edition
  // (two editions of the same series do not have the same number of volumes, see
  // CollectionStatus on the backend side) - without an edition, there is nothing to compare.
  if (editionName === '') {
    return (
      <p className="text-textDim">
        Tes tomes n'ont pas d'édition précisée, et le nombre total de tomes dépend de l'édition — impossible de dire ce
        qui te manque sans elle. Renseigne l'édition sur un tome pour débloquer cette réponse.
      </p>
    )
  }
  if (isLoading) return <p className="text-textDim">Calcul en cours...</p>
  if (isError) return <p className="text-textDim">Impossible de calculer la complétude pour le moment.</p>

  if (totalVolumes === null) {
    return (
      <p className="text-textDim">
        Le nombre total de tomes de l'édition « {editionName} » n'est pas renseigné — je ne peux pas dire ce qui manque
        sans l'inventer. Tu peux le renseigner depuis la ligne d'édition, en haut de cette fiche.
      </p>
    )
  }

  if (missingVolumeNumbers.length === 0) {
    return (
      <p>
        <strong className="font-semibold">Rien.</strong> Tu as les {totalVolumes} tomes de l'édition «{' '}
        {editionName} ».
      </p>
    )
  }

  const purelyVirtualCount = missingVolumeNumbers.length - cataloguedMissingVolumeNumbers.length

  return (
    <>
      <p>
        Il te manque{' '}
        <strong className="font-semibold">
          {missingVolumeNumbers.length} {plural(missingVolumeNumbers.length, 'tome')}
        </strong>{' '}
        sur {totalVolumes} (tu en as {ownedCount}) : {formatVolumeRanges(missingVolumeNumbers)}.
      </p>
      {/* Distinction "already cataloged" / "purely virtual": it exists in
          the backend answer (Tome model != Ownership) and changes what
          the user must do - a cataloged volume is attached, a virtual
          volume must first be created. Shown only when the
          distinction is really filled in. */}
      {cataloguedMissingVolumeNumbers.length > 0 && (
        <p className="text-xs text-textDim">
          {cataloguedMissingVolumeNumbers.length === 1
            ? "L'un d'eux existe déjà comme tome dans ta fiche (tu ne le possèdes simplement plus, ou pas encore)"
            : `${cataloguedMissingVolumeNumbers.length} d'entre eux existent déjà comme tome dans ta fiche (tu ne les possèdes simplement plus, ou pas encore)`}
          {purelyVirtualCount > 0 &&
            (purelyVirtualCount === 1
              ? ", l'autre n'a encore aucune fiche de tome"
              : `, les ${purelyVirtualCount} autres n'ont encore aucune fiche de tome`)}
          .
        </p>
      )}
      {estimatedCostToComplete !== null && (
        <p className="text-xs text-textDim">
          Environ {formaterEuros(estimatedCostToComplete)} pour compléter{base === null ? '.' : ` (${base}).`}
        </p>
      )}
      <button type="button" onClick={onEvaluateListing} className="w-fit text-xs font-semibold text-accentText underline">
        Évaluer une annonce de cette série
      </button>
    </>
  )
}

function ReadingAnswer({
  experiences,
  variants,
  ownedVolumes,
  activeGroup,
}: {
  experiences: ExperienceResponse[]
  variants: VariantDto[]
  ownedVolumes: number[]
  /** null for a type without the notion of volume: readings always exist,
   *  they are simply not attached to any number. */
  activeGroup: EditionProgressDto | null
}) {
  // A read volume is an Experience carrying a variantId (see Experience.
  // variantId, added with the volume selector) - experiences WITHOUT a
  // specified volume are counted apart: they concern the series, not a
  // volume, and merging them into the counter would lie about progress.
  const volumeNumberById = new Map<string, number>()
  for (const variant of variants) {
    // The number is read STRICTLY as everywhere else (see attributsTome):
    // this loop alone accepted a number written as text, so that a volume
    // entered that way would have been counted here and invisible in the grid.
    const volumeNumber = numeroDe(variant)
    if (volumeNumber !== null && activeGroup?.sourceEditions.includes(editionDe(variant))) {
      volumeNumberById.set(variant.id, volumeNumber)
    }
  }

  const withVolume = experiences.filter((e) => e.variantId !== null && volumeNumberById.has(e.variantId))
  const withoutVolume = experiences.filter((e) => e.variantId === null)
  const readVolumes = [...new Set(withVolume.map((e) => volumeNumberById.get(e.variantId as string) as number))]
  const ratings = experiences.map((e) => e.rating).filter((r): r is number => r !== null)
  const averageRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null

  const latest = [...withVolume].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  const unreadOwned = ownedVolumes.filter((v) => !readVolumes.includes(v))

  if (experiences.length === 0) {
    return (
      <p className="text-textDim">
        Aucune lecture enregistrée pour cette série. Tu peux en ajouter une depuis « Expériences », dans « Mon
        suivi ».
      </p>
    )
  }

  return (
    <>
      {/* Deliberately NOT a "read out of owned" ratio: a volume read then
          resold would show "3 volumes out of the 1 you own". What
          is left to read is said further down, based on the volumes really
          owned. */}
      {readVolumes.length > 0 ? (
        <p>
          Tu as lu{' '}
          <strong className="font-semibold">
            {readVolumes.length} {plural(readVolumes.length, 'tome')}
          </strong>{' '}
          de cette édition : {formatVolumeRanges(readVolumes)}.
        </p>
      ) : (
        <p>
          {activeGroup
            ? "Aucune de tes lectures n'indique de tome précis pour cette édition."
            : "Tes lectures ne se rattachent à aucun tome — ce type de collection n'en a pas."}
        </p>
      )}
      {latest && (
        <p className="text-xs text-textDim">
          Dernière lecture datée : tome {volumeNumberById.get(latest.variantId as string)}, le{' '}
          {new Date(latest.occurredAt).toLocaleDateString('fr-FR')}.
        </p>
      )}
      {unreadOwned.length > 0 && (
        <p className="text-xs text-textDim">
          {plural(unreadOwned.length, 'Tome possédé', 'Tomes possédés')} sans lecture enregistrée :{' '}
          {formatVolumeRanges(unreadOwned)}.
        </p>
      )}
      {averageRating !== null && (
        <p className="text-xs text-textDim">
          Note moyenne : {averageRating.toFixed(1)}/10 sur {ratings.length} {plural(ratings.length, 'lecture notée', 'lectures notées')}.
        </p>
      )}
      {withoutVolume.length > 0 && (
        <p className="text-xs text-textDim">
          {withoutVolume.length} {plural(withoutVolume.length, 'lecture enregistrée', 'lectures enregistrées')} sans tome
          précisé — {plural(withoutVolume.length, 'comptée', 'comptées')} pour la série, pas pour un tome.
        </p>
      )}
    </>
  )
}
