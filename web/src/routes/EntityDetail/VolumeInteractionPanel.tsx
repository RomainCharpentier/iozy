import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Pencil } from 'lucide-react'
import { mergeVariantAttributes } from '../../api/entities'
import { searchVolumes } from '../../api/metadata'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { findBestCoverMatch } from '../Shelf/backfillCovers'
import { AddOwnershipForm } from './AddOwnershipForm'
import { OwnershipDetails } from './OwnershipDetails'
import type { TomeTile } from './TomesGridSection'
import type { OwnershipResponse, VariantDto } from '../../types/api'

/** Correction de la jaquette du TOME (Variant) - jamais mélangée avec "Ma
 * copie" (voir OwnershipDetails) : la jaquette appartient au catalogue, pas
 * à un exemplaire précis (voir "Tome vs Ownership, ne plus mélanger dans la
 * même UI"). Même mutation/recherche automatique que l'ancien
 * OwnershipsSection, juste déplacée au bon endroit - `findBestCoverMatch`
 * peut donc rester exigeant (même volumeNumber, puis même édition) au lieu
 * de se rabattre sur le premier résultat venu, `variant` porte déjà tout ce
 * qu'il faut pour matcher correctement. */
function VariantCoverEditor({
  entityId,
  entityTypeId,
  entityTitle,
  variant,
  currentUrl,
}: {
  entityId: string
  entityTypeId: string
  entityTitle: string
  variant: VariantDto
  currentUrl: string | null
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const saveMutation = useMutation({
    mutationFn: (coverImageUrl: string) => mergeVariantAttributes(entityId, variant.id, { coverImageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditing(false)
    },
  })

  const searchMutation = useMutation({
    mutationFn: async () => {
      const response = await searchVolumes(entityTypeId, entityTitle, { forceRefresh: true })
      if (response.quotaExceeded) throw new Error('Quota Google Books dépassé - réessaie plus tard.')
      const match = findBestCoverMatch(response.volumes, variant)
      if (!match?.imageUrl) throw new Error('Aucune jaquette trouvée pour ce tome sur Google Books.')
      await mergeVariantAttributes(entityId, variant.id, { coverImageUrl: match.imageUrl })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditing(false)
    },
  })

  if (!editing) {
    return (
      <button type="button" onClick={() => { setUrlInput(currentUrl ?? ''); setEditing(true) }} className="flex w-fit items-center gap-1 text-xs text-textDim hover:text-textPrimary">
        <Pencil size={11} />
        {currentUrl ? 'Modifier la couverture' : 'Ajouter une couverture'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-surface2 p-2.5">
      <div className="flex items-center gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="URL de l'image (ex: https://...)"
          autoFocus
          className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          type="button"
          onClick={() => urlInput.trim() && saveMutation.mutate(urlInput.trim())}
          disabled={!urlInput.trim() || saveMutation.isPending}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
        >
          Enregistrer
        </button>
        <button type="button" onClick={() => setEditing(false)} className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim">
          Annuler
        </button>
      </div>
      <button
        type="button"
        onClick={() => searchMutation.mutate()}
        disabled={searchMutation.isPending}
        className="w-fit text-xs text-accent underline disabled:opacity-50"
      >
        {searchMutation.isPending ? 'Recherche...' : 'Rechercher automatiquement sur Google Books'}
      </button>
      {searchMutation.isError && <p className="text-xs text-textDim">{searchMutation.error.message}</p>}
    </div>
  )
}

/**
 * Surface contextuelle UNIQUE pour l'interaction avec un tome (voir la
 * refonte demandée : plus de bloc ajouté plus bas dans la page à chaque
 * clic). Un seul panneau, son contenu change selon `activeTile` plutôt que
 * d'empiler plusieurs UI. Drawer à droite sur desktop (>= 768px, même
 * breakpoint que DesktopHeader), bottom-sheet sur mobile - un seul
 * composant, comportement responsive uniquement via les classes Tailwind
 * (voir "éviter la sur-abstraction").
 */
export function VolumeInteractionPanel({
  activeTile,
  onClose,
  entityId,
  entityTypeId,
  entityTitle,
  editionName,
  ownerships,
}: {
  activeTile: TomeTile | null
  onClose: () => void
  entityId: string
  entityTypeId: string
  entityTitle: string
  editionName: string
  ownerships: OwnershipResponse[]
}) {
  // Escape desktop - nettoyage au démontage/fermeture (voir "ne pas coder de
  // focus trap custom complexe", juste Escape + clic sur l'overlay).
  useEffect(() => {
    if (!activeTile) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeTile, onClose])

  if (!activeTile) return null

  const coverUrl = activeTile.variant ? coverImageUrlFrom(activeTile.variant.attributes) : null
  const variantOwnerships = activeTile.variant
    ? ownerships.filter((o) => o.variantId === activeTile.variant!.id && o.status === 'OWNED')
    : []

  return (
    <>
      {/* Overlay cliquable-pour-fermer UNIQUEMENT sur mobile (bottom-sheet
          bloquant tout l'écran, patron standard). Sur desktop le drawer est
          non-modal (voir la spec "overlay, non-modal acceptable") : pas
          d'overlay du tout, sinon il capte les clics sur la grille de tomes
          en dessous et empêche de passer directement d'un tome à un autre
          (bug trouvé en testant en direct - un clic sur un autre tome
          fermait le panneau au lieu de changer son contenu). */}
      <div className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Tome ${activeTile.volumeNumber}`}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl md:inset-x-auto md:right-0 md:top-16 md:bottom-0 md:max-h-none md:w-[min(420px,90vw)] md:rounded-none md:rounded-l-2xl md:border-l md:border-surface2"
      >
        <div className="flex items-start gap-3 border-b border-surface2 p-4">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-24 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-surface2 font-display text-lg font-semibold text-textDim">
              {activeTile.volumeNumber}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-1">
            <h2 className="font-display text-lg font-bold text-textPrimary">Tome {activeTile.volumeNumber}</h2>
            {editionName && <p className="text-sm text-textDim">{editionName}</p>}
            <span
              className={`mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                activeTile.status === 'owned' ? 'bg-accent text-accentText' : 'bg-surface2 text-textDim'
              }`}
            >
              {activeTile.status === 'owned' ? 'Possédé' : 'Manquant'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1.5 text-textDim hover:bg-surface2 hover:text-textPrimary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Correction catalogue (Tome/Variant) - jamais mélangée avec "Ma
              copie" ci-dessous (Ownership). Seulement quand un Variant existe
              réellement (catalogué manquant ou possédé) - rien à corriger
              pour un tome purement virtuel. */}
          {activeTile.variant && (
            <VariantCoverEditor
              entityId={entityId}
              entityTypeId={entityTypeId}
              entityTitle={entityTitle}
              variant={activeTile.variant}
              currentUrl={coverUrl}
            />
          )}

          {activeTile.status === 'owned' ? (
            <OwnershipDetails ownerships={variantOwnerships} entityId={entityId} />
          ) : (
            <AddOwnershipForm
              entityId={entityId}
              entityTypeId={entityTypeId}
              entityTitle={entityTitle}
              volumeNumber={activeTile.volumeNumber}
              edition={editionName}
            />
          )}
        </div>
      </div>
    </>
  )
}
