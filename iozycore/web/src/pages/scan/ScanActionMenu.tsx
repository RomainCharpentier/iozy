import { BookPlus, ExternalLink, ListPlus, SkipForward, X } from 'lucide-react'
import { useModalA11y } from '@/common/hooks/useModalA11y'
import { WishlistToggle } from '@/common/components/WishlistToggle'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '@/common/lib/coverImage'
import type { EntityResponse, MetadataCandidateDto } from '@/common/types/api'
import { Jaquette } from '@/common/components/Jaquette'

/** What a scan has just identified, before any write. */
export interface ScanCandidate {
  code: string
  candidate: MetadataCandidateDto
  /** The collection type that was scanned - lets us wish a work that is still unknown. */
  entityTypeId: string
  volumeNumber?: number
  edition?: string
  /** The work already has an IozyCore detail page (local search by title) - null otherwise.
    * Having a page does not mean owning it: a work added to the wishlist has
    * one with no copy at all. */
  existingEntity: EntityResponse | null
}

/**
  * Context menu opened after EVERY recognised scan: the scan no longer writes
  * anything by itself.
  * <p>
  * It used to add each recognised volume directly, without asking - an
  * irreversible action (the copy is created) triggered by a barcode simply
  * passing in front of the camera, even for a volume scanned by mistake or
  * already owned. The "· already owned" mark added earlier only noted
  * the add after the fact.
  * <p>
  * The proposed actions are exactly what the app can do with a
  * barcode, never one more: add with the chosen condition, open the detailed add
  * to set edition and volume, add it to the wishlist, open its detail page
  * if it already has one, or skip. "Add to wishlist" applies to ANY scanned
  * book, even an unknown one: scanning in a shop a work we do not buy
  * today is exactly the use case. The backend then creates its catalogue
  * page, with no ownership.
  * <p>
  * Same pattern as TierPicker: bottom sheet on mobile, centred box on
  * desktop, Escape / focus trap / focus returned to the trigger via
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
      <div className="voile-entree fixed inset-0 z-40 bg-black/45" onClick={onSkip} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-action-title"
        className="feuille-entree fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-t-2xl bg-surface shadow-token-elevated md:inset-x-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-[360px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-surface2"
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
            {/* Verifiable fact: a page exists. Saying "already in your
                    collection" would be false for a work only added to the
                    wishlist, which has a page and zero copies. */}
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

          {/* The volume is only guessed from the title, with no guarantee (read by the backend
                  from the book title) - the detailed add is the way out
                  when the scan could not tell, or when the proposed edition is wrong. */}
          <button
            type="button"
            onClick={onOpenDraft}
            disabled={busy}
            className="flex items-center gap-2.5 rounded-lg px-3 py-3 text-left text-sm text-textPrimary hover:bg-rowHover disabled:opacity-50"
          >
            <ListPlus size={16} className="shrink-0 text-textDim" />
            Choisir l'édition et les tomes
          </button>

          {/* Offered for every scanned work: one that already has a page goes
                  by its internal identity, one that has none goes by its external
                  reference, which the backend resolves or creates - without ownership. */}
          <div className="px-1 py-1">
            {existingEntity ? (
              <WishlistToggle entityId={existingEntity.id} entityTypeId={entityTypeId} />
            ) : (
              <WishlistToggle
                entityTypeId={entityTypeId}
                external={{
                  entityTypeId,
                  title: candidate.title,
                  // Same cover key as the normal add, otherwise the work
                  // would arrive with no image in the Wishlist.
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
