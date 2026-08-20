import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, CircleAlert, Loader2, Sparkles } from 'lucide-react'
import { ApiError } from '../../api/client'
import { createEdition, findEdition, suggestEditionReferenceData } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { EDITION_TIERS, EDITION_TIER_LABELS, type EditionTier, type MangaEditionDto } from '../../types/purchaseAnalysis'

const CONFIDENCE_LABELS = { HIGH: 'haute', MEDIUM: 'moyenne', LOW: 'faible' } as const

/**
 * Résout une édition connue par (série, nom d'édition) ; si elle n'existe
 * pas encore (404, pas une vraie erreur), propose une saisie progressive
 * inline plutôt qu'un écran d'administration séparé - la donnée saisie ici
 * est persistée et réutilisée pour toutes les analyses futures référençant
 * cette même édition (voir MangaEditionRepository côté backend).
 * <p>
 * Aucune valeur n'est jamais inventée : tant que rien n'est saisi ici,
 * l'analyse traite l'édition comme inconnue (complétude non calculable,
 * prix théorique indisponible) plutôt que de deviner un nombre de tomes ou
 * un prix neuf.
 */
export function EditionReferenceLookup({
  seriesTitle,
  editionName,
  onResolved,
}: {
  seriesTitle: string
  editionName: string
  onResolved: (edition: MangaEditionDto | null) => void
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [tier, setTier] = useState<EditionTier>('STANDARD')
  const [publisher, setPublisher] = useState('')
  const [totalVolumes, setTotalVolumes] = useState('')
  const [retailPrice, setRetailPrice] = useState('')
  const [outOfPrint, setOutOfPrint] = useState(false)
  const [betterEditionAnnounced, setBetterEditionAnnounced] = useState(false)
  const [betterEditionNote, setBetterEditionNote] = useState('')

  const trimmedSeries = seriesTitle.trim()
  const trimmedEdition = editionName.trim()
  const enabled = trimmedSeries.length > 0 && trimmedEdition.length > 0

  const editionQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(trimmedSeries, trimmedEdition),
    queryFn: () => findEdition(trimmedSeries, trimmedEdition),
    enabled,
    retry: false, // 404 = édition pas encore connue, pas une panne réseau à retenter
  })

  const notFound = editionQuery.isError && editionQuery.error instanceof ApiError && editionQuery.error.status === 404
  const unexpectedError = editionQuery.isError && !notFound

  useEffect(() => {
    if (editionQuery.isSuccess) {
      onResolved(editionQuery.data)
    } else {
      onResolved(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionQuery.isSuccess, editionQuery.data])

  // Phase 2 (assistance IA) - un brouillon à relire, jamais enregistré tout seul :
  // ne fait que pré-remplir les champs ci-dessous, "Enregistrer cette édition"
  // reste l'unique action qui persiste quoi que ce soit.
  const suggestMutation = useMutation({
    mutationFn: () => suggestEditionReferenceData(trimmedSeries, trimmedEdition),
    onSuccess: (suggestion) => {
      if (!suggestion) return
      if (suggestion.tier) setTier(suggestion.tier)
      if (suggestion.publisher) setPublisher(suggestion.publisher)
      if (suggestion.totalVolumes !== null) setTotalVolumes(String(suggestion.totalVolumes))
      if (suggestion.retailPriceNewPerVolume !== null) setRetailPrice(String(suggestion.retailPriceNewPerVolume))
      if (suggestion.outOfPrint !== null) setOutOfPrint(suggestion.outOfPrint)
      if (suggestion.betterEditionAnnounced !== null) setBetterEditionAnnounced(suggestion.betterEditionAnnounced)
      if (suggestion.betterEditionNote) setBetterEditionNote(suggestion.betterEditionNote)
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createEdition({
        seriesTitle: trimmedSeries,
        editionName: trimmedEdition,
        editionTier: tier,
        publisher: publisher.trim() || undefined,
        totalVolumes: totalVolumes.trim() ? Number(totalVolumes) : undefined,
        retailPriceNewPerVolume: retailPrice.trim() ? Number(retailPrice) : undefined,
        outOfPrint,
        betterEditionAnnounced,
        betterEditionNote: betterEditionNote.trim() || undefined,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(queryKeys.purchaseAnalysis.edition(trimmedSeries, trimmedEdition), created)
      onResolved(created)
      setExpanded(false)
    },
  })

  if (!enabled) return null

  if (editionQuery.isLoading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-textDim">
        <Loader2 size={12} className="animate-spin" />
        Vérification de l'édition...
      </p>
    )
  }

  if (editionQuery.isSuccess) {
    const edition = editionQuery.data
    return (
      <p className="flex items-center gap-1.5 text-xs text-accentText">
        <CircleCheck size={13} />
        Édition connue · {EDITION_TIER_LABELS[edition.tier]}
        {edition.totalVolumes !== null && ` · ${edition.totalVolumes} tomes`}
        {edition.retailPriceNewPerVolume !== null && ` · ${edition.retailPriceNewPerVolume} €/tome neuf`}
      </p>
    )
  }

  if (unexpectedError) {
    return <ErrorBanner message="Impossible de vérifier cette édition pour le moment." />
  }

  // notFound === true à partir d'ici.
  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="flex items-center gap-1.5 text-xs text-textDim underline">
        <CircleAlert size={13} />
        Édition inconnue - renseigner ses infos (facultatif, améliore l'analyse)
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => suggestMutation.mutate()}
          disabled={suggestMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-accentText disabled:opacity-50"
        >
          <Sparkles size={13} />
          {suggestMutation.isPending ? "Interrogation de l'IA..." : "Pré-remplir avec l'IA"}
        </button>
      </div>
      {suggestMutation.isSuccess && suggestMutation.data && (
        <p className="rounded-lg bg-accent/10 px-2.5 py-1.5 text-xs text-textDim">
          <span className="font-medium text-accentText">Estimation IA — non vérifiée</span>
          {` (confiance ${CONFIDENCE_LABELS[suggestMutation.data.confidence]})`}
          {suggestMutation.data.rationale && ` · ${suggestMutation.data.rationale}`}
          {' '}Vérifie et corrige les champs ci-dessous avant d'enregistrer.
        </p>
      )}
      {suggestMutation.isSuccess && !suggestMutation.data && (
        <p className="text-xs text-textDim">Aucune suggestion IA disponible pour cette édition.</p>
      )}
      {suggestMutation.isError && <p className="text-xs text-textDim">IA indisponible pour le moment.</p>}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-textDim">Rang de l'édition</span>
        <div className="flex flex-wrap gap-1.5">
          {EDITION_TIERS.map((t) => (
            <Chip key={t} label={EDITION_TIER_LABELS[t]} isActive={tier === t} onClick={() => setTier(t)} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          value={publisher}
          onChange={(e) => setPublisher(e.target.value)}
          placeholder="Éditeur (ex: Kana)"
          className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <input
          type="number"
          min={1}
          value={totalVolumes}
          onChange={(e) => setTotalVolumes(e.target.value)}
          placeholder="Nb de tomes"
          className="w-28 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <input
          type="number"
          min={0}
          step="0.01"
          value={retailPrice}
          onChange={(e) => setRetailPrice(e.target.value)}
          placeholder="Prix neuf/tome €"
          className="w-32 rounded-lg bg-surface px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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

      {createMutation.isError && <ErrorBanner message={createMutation.error.message} />}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
        >
          {createMutation.isPending ? 'Enregistrement...' : 'Enregistrer cette édition'}
        </button>
        <button type="button" onClick={() => setExpanded(false)} className="rounded-lg px-3 py-1.5 text-xs text-textDim">
          Annuler
        </button>
      </div>
    </div>
  )
}
