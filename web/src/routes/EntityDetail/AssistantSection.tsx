import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpenCheck, PackageSearch, Sparkles } from 'lucide-react'
import { getCompleteness } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ownedVolumeNumbers, type EditionGroup } from '../../lib/editionGroups'
import type { ExperienceResponse, OwnershipResponse, VariantDto } from '../../types/api'
import type { PriceBasis } from '../../types/purchaseAnalysis'

/**
 * "Assistant" de la fiche (voir la maquette V1.2, section repérée en Lot 6 -
 * commentaire source : "Assistant : contextuel, pas un chatbot"). Deux
 * questions FIXES, dont la réponse est CALCULÉE à partir des données déjà
 * chargées par la fiche - jamais une saisie libre, jamais un appel à un
 * modèle de langage, jamais une réponse rédigée d'avance.
 * <p>
 * La seconde question de la maquette ("Qu'est-ce qui ressemble à mes S ?")
 * n'est pas construite et ne peut pas l'être : aucun champ genre/thème n'est
 * stocké dans ce backend (même raison que l'absence de ligne "Genre" dans
 * "À propos", voir TomesGridSection) - "ressemble à" n'aurait rien à
 * comparer. Remplacée par "Où en suis-je dans mes lectures ?", répondable
 * avec les Experiences réelles (choix utilisateur du 2026-08-20).
 * <p>
 * Aucun appel réseau propre : la complétude passe par la MÊME clé de cache
 * que EditionProgressSection/TomesGridSection (React Query partage la
 * requête), les expériences sont déjà chargées par EntityDetailPage.
 */
export function AssistantSection({
  entityId,
  entityTitle,
  variants,
  ownerships,
  experiences,
  activeGroup,
}: {
  entityId: string
  entityTitle: string
  variants: VariantDto[]
  ownerships: OwnershipResponse[]
  experiences: ExperienceResponse[]
  activeGroup: EditionGroup
}) {
  const navigate = useNavigate()
  const [openQuestion, setOpenQuestion] = useState<'missing' | 'reading' | null>(null)

  const owned = ownedVolumeNumbers(variants, ownerships, activeGroup.sourceEditions)
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entityTitle, activeGroup.edition, owned),
    queryFn: () => getCompleteness(entityTitle, activeGroup.edition, owned, activeGroup.volumeNumbers, entityId),
    enabled: activeGroup.edition !== '' && openQuestion === 'missing',
  })

  const toggle = (question: 'missing' | 'reading') => setOpenQuestion((current) => (current === question ? null : question))

  return (
    <section className="flex flex-col gap-3 border-t border-surface pt-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="shrink-0 text-accentText" />
        <h2 className="font-display text-lg font-semibold text-textPrimary">Assistant</h2>
      </div>
      {/* Dit d'où viennent les réponses AVANT de les afficher : deux
          questions calculées sur les données de cette fiche, pas un
          assistant qui "sait" des choses sur la série. */}
      <p className="text-xs text-textDim">
        Deux questions, répondues à partir de ta collection uniquement.
      </p>

      <div className="flex flex-wrap gap-2">
        <QuestionButton
          icon={<PackageSearch size={15} />}
          label="Que me manque-t-il dans cette série ?"
          isOpen={openQuestion === 'missing'}
          onClick={() => toggle('missing')}
        />
        <QuestionButton
          icon={<BookOpenCheck size={15} />}
          label="Où en suis-je dans mes lectures ?"
          isOpen={openQuestion === 'reading'}
          onClick={() => toggle('reading')}
        />
      </div>

      {openQuestion === 'missing' && (
        <AnswerCard>
          <MissingAnswer
            editionName={activeGroup.edition}
            ownedCount={owned.length}
            isLoading={completenessQuery.isLoading}
            isError={completenessQuery.isError}
            totalVolumes={completenessQuery.data?.totalVolumes ?? null}
            missingVolumeNumbers={completenessQuery.data?.missingVolumeNumbers ?? []}
            cataloguedMissingVolumeNumbers={completenessQuery.data?.cataloguedMissingVolumeNumbers ?? []}
            estimatedCostToComplete={completenessQuery.data?.estimatedCostToComplete ?? null}
            costToCompleteBasis={completenessQuery.data?.costToCompleteBasis ?? null}
            onEvaluateListing={() =>
              navigate('/purchase-analysis', { state: { seriesTitle: entityTitle, editionName: activeGroup.edition } })
            }
          />
        </AnswerCard>
      )}

      {openQuestion === 'reading' && (
        <AnswerCard>
          <ReadingAnswer experiences={experiences} variants={variants} ownedVolumes={owned} activeGroup={activeGroup} />
        </AnswerCard>
      )}
    </section>
  )
}

function QuestionButton({
  icon,
  label,
  isOpen,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-left text-sm font-semibold transition-colors ${
        isOpen ? 'bg-accent text-accentInk' : 'bg-surface text-textPrimary shadow-token-sm'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function AnswerCard({ children }: { children: React.ReactNode }) {
  return (
    // aria-live : la réponse apparaît sans changer de page ni de focus - un
    // lecteur d'écran doit l'annoncer, sinon le clic ne "fait rien" pour lui.
    <div aria-live="polite" className="flex flex-col gap-2 rounded-xl bg-surface p-4 text-sm text-textPrimary">
      {children}
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
  activeGroup: EditionGroup
}) {
  // Un tome lu est une Experience portant un variantId (voir Experience.
  // variantId, ajouté avec le sélecteur de tome) - les expériences SANS tome
  // précisé restent comptées à part : elles concernent la série, pas un
  // tome, et les fondre dans le compteur mentirait sur l'avancement.
  const volumeNumberById = new Map<string, number>()
  for (const variant of variants) {
    const raw = variant.attributes.volumeNumber
    const volumeNumber = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
    const edition = typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
    if (Number.isFinite(volumeNumber) && activeGroup.sourceEditions.includes(edition)) {
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
        Aucune lecture enregistrée pour cette série. Tu peux en ajouter une depuis « Expériences », en bas de cette
        fiche.
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
        <p>Aucune de tes lectures n'indique de tome précis pour cette édition.</p>
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
