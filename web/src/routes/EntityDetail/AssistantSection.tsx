import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import type { EditionProgressDto, ExperienceResponse, VariantDto } from '../../types/api'
import type { PriceBasis } from '../../types/purchaseAnalysis'
import { editionDe, numeroDe } from '../../lib/attributsTome'

/**
 * Les réponses de l'assistant : deux questions FIXES, dont la réponse est
 * CALCULÉE à partir des données déjà chargées par la page - jamais une saisie
 * libre, jamais un appel à un modèle de langage, jamais une réponse rédigée
 * d'avance (commentaire source de la maquette V1.2 : « Assistant : contextuel,
 * pas un chatbot »).
 *
 * <h2>Pourquoi il vit dans la barre de sections</h2>
 * Il occupait avant une section à part, coincée dans la colonne de droite de
 * « Mes tomes ». Mais ses deux questions ne portent pas sur une section : « que
 * me manque-t-il » interroge la possession, « où en suis-je » interroge les
 * lectures. La maquette v4 le sort donc des sections et le pose à droite de la
 * barre, disponible quelle que soit celle qu'on regarde. D'où la découpe en
 * deux morceaux : les BOUTONS (dans la barre) et la RÉPONSE (sous la barre).
 *
 * <h2>La seconde question de la maquette V1.2 n'est toujours pas répondable</h2>
 * « Qu'est-ce qui ressemble à mes S ? » n'a rien à comparer : aucun champ
 * genre/thème n'est stocké dans ce backend (même raison que l'absence de ligne
 * « Genre » dans « L'œuvre »). Remplacée par « Où en suis-je dans mes lectures ? »,
 * répondable avec les Experiences réelles (choix utilisateur du 2026-08-20).
 *
 * <h2>Aucun appel réseau propre</h2>
 * La complétude passe par la MÊME clé de cache que la page et « Mes tomes »
 * (React Query partage la requête), les expériences sont déjà chargées.
 */
export type QuestionAssistant = 'missing' | 'reading'


/** La réponse, posée juste sous la barre de sections. Séparée des boutons
 *  ci-dessus parce qu'elle ne tient pas dans une barre collante : elle fait
 *  plusieurs lignes, et une barre qui grandit en collant repousserait le
 *  contenu qu'on est en train de lire. */
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
  /** null quand aucune édition n'est affichée (type sans tome, série sans
   *  aucun tome) : « que me manque-t-il » n'a alors rien sur quoi compter. */
  activeGroup: EditionProgressDto | null
  question: QuestionAssistant
}) {
  const navigate = useNavigate()
  // Possédés et catalogués viennent du serveur avec le groupe (voir
  // GET /insights/progress/{entityId}) : cette section les recomptait à partir
  // des Ownership, avec sa propre idée de ce qui appartient à l'édition.
  const owned = activeGroup?.ownedVolumeNumbers ?? []
  const editionName = activeGroup?.editionName ?? ''

  // La complétude reste, et c'est SA question : ce qui manque et ce que ça
  // coûterait (prix du marché). La progression, elle, ne sait que compter -
  // les deux ne se recouvrent pas.
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, editionName, owned),
    queryFn: () =>
      getCompleteness(entityTitle, editionName, owned, activeGroup?.cataloguedVolumeNumbers ?? [], entityId),
    enabled: editionName !== '' && question === 'missing',
  })

  return (
    // aria-live : la réponse apparaît sans changer de page ni de focus - un
    // lecteur d'écran doit l'annoncer, sinon le clic ne « fait rien » pour lui.
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

/** "12, 14, 15, 16, 20" -> "12, 14 à 16, 20" - une liste de 30 numéros bruts
 * n'est pas une réponse lisible, alors que des plages le sont. */
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

/** "1 tome" / "5 tomes" - l'accord doit suivre le nombre calculé, sinon la
 * réponse affiche "1 tomes" dès qu'il n'en manque qu'un. */
function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular
}

function basisLabel(basis: PriceBasis | null): string {
  if (basis === 'OBSERVED_MARKET') return 'prix de marché observés'
  if (basis === 'AI_ESTIMATED') return 'estimation IA, non vérifiée'
  return 'prix de référence théorique'
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
  // Édition non précisée : la complétude est TOUJOURS calculée par édition
  // (deux éditions d'une même série n'ont pas le même nombre de tomes, voir
  // CollectionStatus côté backend) - sans édition, il n'y a rien à comparer.
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
      {/* Distinction "déjà catalogué" / "purement virtuel" : elle existe dans
          la réponse backend (modèle Tome != Ownership) et change ce que
          l'utilisateur doit faire - un tome catalogué se rattache, un tome
          virtuel doit d'abord être créé. Affichée seulement quand la
          distinction est réellement renseignée. */}
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
          Environ {estimatedCostToComplete.toFixed(2)} € pour compléter ({basisLabel(costToCompleteBasis)}).
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
  /** null pour un type sans notion de tome : les lectures existent toujours,
   *  elles ne se rattachent simplement a aucun numero. */
  activeGroup: EditionProgressDto | null
}) {
  // Un tome lu est une Experience portant un variantId (voir Experience.
  // variantId, ajouté avec le sélecteur de tome) - les expériences SANS tome
  // précisé restent comptées à part : elles concernent la série, pas un
  // tome, et les fondre dans le compteur mentirait sur l'avancement.
  const volumeNumberById = new Map<string, number>()
  for (const variant of variants) {
    // Le numéro se lit STRICTEMENT comme partout ailleurs (voir attributsTome) :
    // cette boucle acceptait seule un numéro écrit en texte, si bien qu'un tome
    // ainsi saisi aurait été compté ici et invisible dans la grille.
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
      {/* Volontairement PAS un ratio "lus sur possédés" : un tome lu puis
          revendu ferait afficher "3 tomes sur les 1 que tu possèdes". Ce
          qu'il reste à lire est dit plus bas, à partir des tomes réellement
          possédés. */}
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
