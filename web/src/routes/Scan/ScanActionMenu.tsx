import { BookPlus, ExternalLink, ListPlus, SkipForward, X } from 'lucide-react'
import { useModalA11y } from '../../lib/useModalA11y'
import type { EntityResponse, MetadataCandidateDto } from '../../types/api'

/** Ce qu'un scan vient d'identifier, avant toute écriture. */
export interface ScanCandidate {
  code: string
  candidate: MetadataCandidateDto
  volumeNumber?: number
  edition?: string
  /** L'œuvre existe déjà dans la collection (recherche locale par titre) - null sinon. */
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
 * détaillé pour préciser édition et tome, ouvrir la fiche quand l'œuvre est
 * déjà là, ou passer. "Ajouter à la liste d'envies" n'y figure pas
 * volontairement : une entrée de wishlist référence une œuvre EXISTANTE
 * (POST /wishlist exige un entityId, voir Lot 28), et un livre scanné qui
 * n'est pas encore dans la collection n'en a pas.
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
  const { candidate, volumeNumber, edition, existingEntity } = pending

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
          {candidate.imageUrl ? (
            <img src={candidate.imageUrl} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="h-20 w-14 shrink-0 rounded-lg bg-surface2" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span id="scan-action-title" className="font-display text-sm font-semibold text-textPrimary">
              {candidate.title}
            </span>
            <span className="text-xs text-textDim">
              {volumeNumber !== undefined ? `Tome ${volumeNumber}` : 'Numéro de tome non détecté'}
              {edition && ` · ${edition}`}
            </span>
            {existingEntity && <span className="text-xs text-accentText">Déjà dans ta collection</span>}
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Fermer sans rien faire"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
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
