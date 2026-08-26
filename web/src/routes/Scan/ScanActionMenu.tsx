import { BookPlus, ExternalLink, ListPlus, SkipForward, X } from 'lucide-react'
import { useModalA11y } from '../../lib/useModalA11y'
import { WishlistToggle } from '../../components/WishlistToggle'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import type { EntityResponse, MetadataCandidateDto } from '../../types/api'
import { Jaquette } from '../../components/Jaquette'

/** Ce qu'un scan vient d'identifier, avant toute écriture. */
export interface ScanCandidate {
  code: string
  candidate: MetadataCandidateDto
  /** Le type de collection scanné - permet de mettre en envies une œuvre encore inconnue. */
  entityTypeId: string
  volumeNumber?: number
  edition?: string
  /** L'œuvre a déjà une fiche IozyCore (recherche locale par titre) - null sinon.
   * Avoir une fiche ne veut pas dire la posséder : une œuvre mise en envies en a
   * une sans aucun exemplaire. */
  existingEntity: EntityResponse | null
}

/**
 * Menu contextuel ouvert après CHAQUE scan reconnu : le scan n'écrit plus
 * rien de lui-même.
 * <p>
 * Il ajoutait auparavant chaque tome reconnu directement, sans demander - un
 * geste irréversible (l'exemplaire est créé) déclenché par un simple passage
 * de code-barres devant la caméra, y compris sur un tome scanné par erreur ou
 * déjà possédé. Le "· déjà possédé" ajouté plus tôt ne faisait que constater
 * l'ajout après coup.
 * <p>
 * Les actions proposées sont exactement celles que l'app sait faire d'un
 * code-barres, jamais une de plus : ajouter avec l'état choisi, ouvrir l'ajout
 * détaillé pour préciser édition et tome, la mettre en envies, ouvrir sa fiche
 * si elle en a déjà une, ou passer. « Ajouter aux envies » vaut pour TOUT livre
 * scanné, y compris inconnu : scanner en boutique une œuvre qu'on ne prend pas
 * aujourd'hui est justement le cas d'usage. Le backend crée alors sa fiche
 * catalogue, sans aucune possession.
 * <p>
 * Même patron que TierPicker : bottom-sheet en mobile, boîte centrée en
 * desktop, Escape / piège de focus / focus rendu au déclencheur via
 * useModalA11y.
 */
export function ScanActionMenu({
  pending,
  busy,
  onAdd,
  onOpenDraft,
  onOpenEntity,
  onSkip,
}: {
  pending: ScanCandidate
  busy: boolean
  onAdd: () => void
  onOpenDraft: () => void
  onOpenEntity: (entityId: string) => void
  onSkip: () => void
}) {
  const containerRef = useModalA11y<HTMLDivElement>(true, onSkip)
  const { candidate, entityTypeId, volumeNumber, edition, existingEntity } = pending

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onSkip} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-action-title"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-x-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-[360px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-surface2"
      >
        <div className="flex items-start gap-3 border-b border-surface2 p-4">
          <Jaquette
            src={candidate.imageUrl}
            className="h-20 w-14 shrink-0 rounded-lg object-cover"
            repli={<span className="h-20 w-14 shrink-0 rounded-lg bg-surface2" />}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span id="scan-action-title" className="font-display text-sm font-semibold text-textPrimary">
              {candidate.title}
            </span>
            <span className="text-xs text-textDim">
              {volumeNumber !== undefined ? `Tome ${volumeNumber}` : 'Numéro de tome non détecté'}
              {edition && ` · ${edition}`}
            </span>
            {/* Fait vérifiable : une fiche existe. Dire « déjà dans ta
                collection » serait faux pour une œuvre seulement mise en
                envies, qui a une fiche et zéro exemplaire. */}
            {existingEntity && <span className="text-xs text-accentText">Déjà connu d'IozyCore</span>}
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Fermer sans rien faire"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy}
            className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm font-semibold text-textPrimary hover:bg-rowHover disabled:opacity-50"
          >
            <BookPlus size={16} className="shrink-0 text-accentText" />
            {busy ? 'Ajout en cours...' : 'Ajouter à ma collection'}
          </button>

          {/* Le tome n'est deviné qu'à partir du titre, sans garantie (voir
              parseVolumeNumberFromTitle) - l'ajout détaillé est la sortie
              quand le scan n'a pas su, ou quand l'édition proposée est fausse. */}
          <button
            type="button"
            onClick={onOpenDraft}
            disabled={busy}
            className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm text-textPrimary hover:bg-rowHover disabled:opacity-50"
          >
            <ListPlus size={16} className="shrink-0 text-textDim" />
            Choisir l'édition et les tomes
          </button>

          {/* Proposé pour toute œuvre scannée : celle qui a déjà une fiche
              par son identité interne, celle qui n'en a pas via sa référence
              externe, que le backend résout ou crée - sans possession. */}
          <div className="px-1 py-1">
            {existingEntity ? (
              <WishlistToggle entityId={existingEntity.id} entityTypeId={entityTypeId} />
            ) : (
              <WishlistToggle
                entityTypeId={entityTypeId}
                external={{
                  entityTypeId,
                  title: candidate.title,
                  // Même clé de jaquette que l'ajout normal, sinon l'œuvre
                  // arriverait sans visuel dans les Envies.
                  attributes: candidate.imageUrl
                    ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl }
                    : candidate.attributes,
                }}
              />
            )}
          </div>

          {existingEntity && (
            <button
              type="button"
              onClick={() => onOpenEntity(existingEntity.id)}
              disabled={busy}
              className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm text-textPrimary hover:bg-rowHover disabled:opacity-50"
            >
              <ExternalLink size={16} className="shrink-0 text-textDim" />
              Ouvrir la fiche de « {existingEntity.title} »
            </button>
          )}

          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="flex items-center gap-2.5 rounded-lg border-t border-surface2 px-3 py-3 text-left text-sm text-textDim hover:bg-rowHover disabled:opacity-50"
          >
            <SkipForward size={16} className="shrink-0" />
            Passer ce tome
          </button>
        </div>
      </div>
    </>
  )
}
