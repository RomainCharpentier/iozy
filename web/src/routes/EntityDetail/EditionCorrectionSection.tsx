import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { createEdition, updateEdition } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { MangaEditionDto } from '../../types/purchaseAnalysis'

/**
 * L'automatisation ne sera jamais parfaite (voir audit UX bout en bout) :
 * nombre de tomes/éditeur/statut épuisé peuvent rester inconnus ou faux si
 * aucune source externe n'a la bonne info pour cette édition précise. Avant
 * ce composant, la SEULE façon de renseigner/corriger ces champs était de
 * passer par "Évaluer un achat" (voir EditionReferenceLookup) - aucun accès
 * depuis la fiche Série elle-même, là où l'utilisateur consulte vraiment sa
 * collection.
 * <p>
 * Même table MangaEdition, mêmes endpoints (createEdition/updateEdition) que
 * EditionReferenceLookup - une édition corrigée ici profite aussi à "Évaluer
 * un achat" et inversement, aucune donnée dupliquée. Action secondaire (lien
 * discret "Modifier", repliée par défaut) : ne transforme pas la fiche Série
 * en formulaire d'administration, mais reste accessible en un clic depuis
 * l'endroit où cette info manque concrètement.
 */
export function EditionCorrectionSection({
  entityId,
  entityTitle,
  editionName,
  editionInfo,
}: {
  // Voir migration "Série -> Édition par ID" - transmis à createEdition pour
  // lier directement la nouvelle édition, sans dépendre d'une correspondance
  // de titre qu'un renommage rendrait caduque.
  entityId: string
  entityTitle: string
  editionName: string
  editionInfo: MangaEditionDto | null
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [totalVolumes, setTotalVolumes] = useState('')
  const [publisher, setPublisher] = useState('')
  const [outOfPrint, setOutOfPrint] = useState(false)
  const [betterEditionAnnounced, setBetterEditionAnnounced] = useState(false)
  const [betterEditionNote, setBetterEditionNote] = useState('')

  function openForm() {
    // Pré-rempli depuis ce qui est déjà connu (jamais un formulaire vide
    // quand une valeur existe déjà) - editionInfo est null si cette édition
    // n'a encore jamais été renseignée nulle part (voir TomesGridSection).
    setTotalVolumes(editionInfo?.totalVolumes !== null && editionInfo?.totalVolumes !== undefined ? String(editionInfo.totalVolumes) : '')
    setPublisher(editionInfo?.publisher ?? '')
    setOutOfPrint(editionInfo?.outOfPrint ?? false)
    setBetterEditionAnnounced(editionInfo?.betterEditionAnnounced ?? false)
    setBetterEditionNote(editionInfo?.betterEditionNote ?? '')
    setExpanded(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const parsedTotalVolumes = totalVolumes.trim() ? Number(totalVolumes) : undefined
      const trimmedPublisher = publisher.trim() || undefined
      const trimmedNote = betterEditionNote.trim() || undefined
      return editionInfo
        ? updateEdition(editionInfo.id, {
            totalVolumes: parsedTotalVolumes,
            publisher: trimmedPublisher,
            outOfPrint,
            betterEditionAnnounced,
            betterEditionNote: trimmedNote,
          })
        : createEdition({
            entityId,
            seriesTitle: entityTitle,
            editionName,
            editionTier: 'STANDARD',
            totalVolumes: parsedTotalVolumes,
            publisher: trimmedPublisher,
            outOfPrint,
            betterEditionAnnounced,
            betterEditionNote: trimmedNote,
          })
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.purchaseAnalysis.edition(entityTitle, editionName), saved)
      // Préfixe SANS `volumes` (dernier élément de la clé, variable selon ce
      // qui est possédé) - un tableau vide ici ne matcherait aucune requête
      // réellement en cache, voir queryKeys.purchaseAnalysis.completeness.
      queryClient.invalidateQueries({ queryKey: ['purchaseAnalysis', 'completeness', entityTitle, editionName] })
      setExpanded(false)
    },
  })

  if (!expanded) {
    // Icône seule (plus de libellé "Modifier l'édition" sur sa propre ligne) -
    // pensée pour s'accrocher directement à la ligne compacte "Black Édition
    // · 6 tomes" composée par le parent (voir TomesGridSection), même esprit
    // que la correction de couverture/titre de la fiche (icône crayon
    // directement associée à l'info qu'elle corrige, jamais une ligne à part
    // qui ressemble à une interface de gestion).
    return (
      <button
        type="button"
        onClick={openForm}
        aria-label="Modifier l'édition"
        title="Modifier l'édition"
        className="shrink-0 text-textDim hover:text-textPrimary"
      >
        <Pencil size={13} />
      </button>
    )
  }

  return (
    // w-full + le parent en flex-wrap (voir TomesGridSection) : le formulaire
    // déplié occupe toute la largeur sur sa propre ligne plutôt que de rester
    // coincé dans la même ligne flex que le libellé compact de l'édition.
    <div className="mt-1 flex w-full flex-col gap-2 rounded-lg bg-surface2 p-2.5">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={totalVolumes}
          onChange={(e) => setTotalVolumes(e.target.value)}
          placeholder="Nb de tomes"
          className="w-28 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <input
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          placeholder="Éditeur (ex: Kana)"
          className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-textDim">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={outOfPrint} onChange={(e) => setOutOfPrint(e.target.checked)} />
          Édition épuisée
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={betterEditionAnnounced}
            onChange={(e) => setBetterEditionAnnounced(e.target.checked)}
          />
          Nouvelle édition annoncée
        </label>
      </div>
      {betterEditionAnnounced && (
        <input
          value={betterEditionNote}
          onChange={(e) => setBetterEditionNote(e.target.value)}
          placeholder="Détail (ex: Perfect Edition annoncée pour 2026)"
          className="rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      )}

      {saveMutation.isError && <ErrorBanner message={saveMutation.error.message} />}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={() => setExpanded(false)} className="rounded-lg px-3 py-1.5 text-xs text-textDim">
          Annuler
        </button>
      </div>
    </div>
  )
}
