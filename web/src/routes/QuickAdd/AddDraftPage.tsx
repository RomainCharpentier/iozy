import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react'
import { fetchFrenchTitle, searchVolumes } from '../../api/metadata'
import { quickAdd } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { Chip } from '../../components/Chip'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { VolumeSelectionGrid, volumeKey } from './VolumeSelectionGrid'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { isFrenchEnabled, resolvePrimaryTitle, useTitleComposition } from '../../lib/titleLanguage'
import type { DraftLocationState } from './draftState'
import type { VolumeCandidateDto } from '../../types/api'

interface QuickAddOutcome {
  addedCount: number
  alreadyOwnedCount: number
  matchedExistingEntity: boolean
}

/** Résume le résultat d'un ajout (potentiellement plusieurs tomes en un seul
 * clic) en une phrase. alreadyOwnedCount ne bloque jamais l'ajout (voir
 * QuickAddService côté backend, un 2e exemplaire du même tome reste
 * légitime) - "déjà possédé" avertit juste que ce tome précis avait déjà
 * une Ownership active, sans empêcher l'exemplaire d'être ajouté. */
function formatAddResultMessage(outcome: QuickAddOutcome): string {
  const { addedCount, alreadyOwnedCount, matchedExistingEntity } = outcome
  if (addedCount === 0 && alreadyOwnedCount > 0) {
    return alreadyOwnedCount > 1
      ? `Tu possèdes déjà ces ${alreadyOwnedCount} tomes - exemplaires ajoutés quand même.`
      : 'Tu possèdes déjà ce tome (cette édition) - exemplaire ajouté quand même.'
  }
  const suffix = alreadyOwnedCount > 0 ? ` (dont ${alreadyOwnedCount} déjà possédé${alreadyOwnedCount > 1 ? 's' : ''})` : ''
  if (addedCount > 1) return `${addedCount} tomes ajoutés${suffix}.`
  return matchedExistingEntity ? `Nouveau tome ajouté à une fiche existante${suffix}.` : `Ajouté à ta collection${suffix}.`
}

/**
 * Écran 2/2 (voir la maquette V1.2, §494 "Sélection des tomes à
 * l'ajout" - "Quels tomes possèdes-tu ?") : reçoit le candidat déjà
 * confirmé sur SearchPage (voir draftState.ts) via location.state, jamais
 * une nouvelle recherche - la résolution (titre français, jaquette,
 * édition pré-remplie, recherche des tomes réels) reprend ici exactement
 * ce que faisait `pickCandidate` dans l'ancien QuickAddPage.tsx (voir Lot 5,
 * docs/DESIGN_MIGRATION_V1.2.md), au chargement de cet écran plutôt qu'au
 * clic sur la liste.
 */
export function AddDraftPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const titleComposition = useTitleComposition()
  const state = location.state as DraftLocationState | null

  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const selectedType = entityTypesQuery.data?.find((t) => t.id === state?.entityTypeId)

  const [title, setTitle] = useState(state?.candidate ? '' : (state?.manualTitle ?? ''))
  const [attributes, setAttributes] = useState<Record<string, unknown> | undefined>(undefined)
  const [isTranslating, setIsTranslating] = useState(false)
  const frenchTitleAbortRef = useRef<AbortController | null>(null)

  const [condition, setCondition] = useState<Condition>('NEW')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [volumeNumber, setVolumeNumber] = useState('')
  const [edition, setEdition] = useState('')
  const [manualVolumes, setManualVolumes] = useState<Array<{ volumeNumber: number; edition: string }>>([])
  const [volumeCandidates, setVolumeCandidates] = useState<VolumeCandidateDto[]>([])
  const [volumesQuotaExceeded, setVolumesQuotaExceeded] = useState(false)
  const [isSearchingVolumes, setIsSearchingVolumes] = useState(false)
  const [selectedVolumeKeys, setSelectedVolumeKeys] = useState<Set<string>>(new Set())
  const [showManualVolumeFields, setShowManualVolumeFields] = useState(false)
  const volumeSearchAbortRef = useRef<AbortController | null>(null)
  const [lastVolumeSearchParams, setLastVolumeSearchParams] = useState<{
    title: string
    author?: string
    malId?: string
    originalTitle?: string
    titleRomaji?: string
  } | null>(null)

  function triggerVolumeSearch(
    seriesTitle: string,
    author: string | undefined,
    options?: { forceRefresh?: boolean; deepSearch?: boolean; malId?: string; originalTitle?: string; titleRomaji?: string },
  ) {
    const { forceRefresh = false, deepSearch = false, malId, originalTitle, titleRomaji } = options ?? {}
    if (!state?.entityTypeId) return
    setLastVolumeSearchParams({ title: seriesTitle, author, malId, originalTitle, titleRomaji })
    volumeSearchAbortRef.current?.abort()
    const controller = new AbortController()
    volumeSearchAbortRef.current = controller
    setIsSearchingVolumes(true)
    if (!forceRefresh && !deepSearch) {
      setVolumeCandidates([])
      setSelectedVolumeKeys(new Set())
    }
    setVolumesQuotaExceeded(false)
    searchVolumes(state.entityTypeId, seriesTitle, { author, signal: controller.signal, forceRefresh, deepSearch, malId, originalTitle, titleRomaji })
      .then((response) => {
        if (controller.signal.aborted) return
        setVolumeCandidates(response.volumes)
        setVolumesQuotaExceeded(response.quotaExceeded)
      })
      .catch(() => {})
      .finally(() => {
        if (volumeSearchAbortRef.current === controller) setIsSearchingVolumes(false)
      })
  }

  // Résolution au chargement de l'écran - reprend exactement pickCandidate
  // de l'ancien QuickAddPage.tsx (voir le commentaire de fonction ci-dessus) :
  // titre résolu selon Réglages > Titre des mangas, jaquette, édition
  // pré-remplie depuis l'éditeur du candidat (jamais pour Jikan - "publisher"
  // y désigne la revue de sérialisation japonaise, pas un éditeur français),
  // recherche des tomes réels (débounce 600ms), puis résolution française
  // asynchrone si besoin (best-effort, ne bloque jamais l'ajout).
  useEffect(() => {
    if (!state?.candidate || !entityTypesQuery.data) return
    const candidate = state.candidate
    const type = entityTypesQuery.data.find((t) => t.id === state.entityTypeId)

    const resolvedTitle = resolvePrimaryTitle(candidate, titleComposition, undefined)
    setTitle(resolvedTitle)
    setAttributes(candidate.imageUrl ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl } : candidate.attributes)
    if (candidate.source !== 'JIKAN' && typeof candidate.attributes.publisher === 'string') {
      setEdition(candidate.attributes.publisher)
    }

    const author = typeof candidate.attributes.mangaka === 'string' ? candidate.attributes.mangaka : undefined
    const malId = typeof candidate.attributes.malId === 'string' ? candidate.attributes.malId : undefined
    const titleRomaji = typeof candidate.attributes.titleRomaji === 'string' ? candidate.attributes.titleRomaji : undefined

    if (type?.code === 'MANGA') {
      triggerVolumeSearch(resolvedTitle, author, { malId, originalTitle: candidate.title, titleRomaji })
    }

    if (!isFrenchEnabled(titleComposition) || (candidate.source !== 'JIKAN' && candidate.source !== 'MYANIMELIST')) {
      return
    }
    const controller = new AbortController()
    frenchTitleAbortRef.current = controller
    setIsTranslating(true)
    fetchFrenchTitle(state.entityTypeId, candidate.title, { author, malId, titleRomaji, signal: controller.signal })
      .then((frenchTitle) => {
        if (controller.signal.aborted || !frenchTitle || frenchTitle === resolvedTitle) return
        setTitle(frenchTitle)
        if (type?.code === 'MANGA') triggerVolumeSearch(frenchTitle, author, { malId, originalTitle: candidate.title, titleRomaji })
      })
      .catch(() => {})
      .finally(() => {
        if (frenchTitleAbortRef.current === controller) setIsTranslating(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityTypesQuery.data])

  const addMutation = useMutation({
    mutationFn: async (): Promise<QuickAddOutcome> => {
      const manualVolumeNumber = volumeNumber.trim() ? Number(volumeNumber) : undefined
      const items: Array<{ volumeNumber?: number; edition?: string; volumeImageUrl?: string }> = volumeCandidates
        .filter((v) => selectedVolumeKeys.has(volumeKey(v)))
        .map((v) => ({ volumeNumber: v.volumeNumber, edition: v.edition, volumeImageUrl: v.imageUrl ?? undefined }))
      for (const manual of manualVolumes) {
        items.push({ volumeNumber: manual.volumeNumber, edition: manual.edition || undefined })
      }
      if (manualVolumeNumber !== undefined) {
        items.push({ volumeNumber: manualVolumeNumber, edition: edition.trim() || undefined })
      }
      if (items.length === 0) items.push({})

      const parsedPurchasePrice = purchasePrice.trim() ? Number(purchasePrice) : undefined
      let addedCount = 0
      let alreadyOwnedCount = 0
      let matchedExistingEntity = false
      for (const item of items) {
        const result = await quickAdd({
          entityTypeId: state!.entityTypeId,
          title: title.trim(),
          condition,
          attributes,
          volumeNumber: item.volumeNumber,
          edition: item.edition,
          volumeImageUrl: item.volumeImageUrl,
          purchasePrice: parsedPurchasePrice,
        })
        matchedExistingEntity = matchedExistingEntity || result.matchedExistingEntity
        if (result.matchedExistingVariant) alreadyOwnedCount++
        else addedCount++
      }
      return { addedCount, alreadyOwnedCount, matchedExistingEntity }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  function queueManualVolume() {
    const parsed = Number(volumeNumber.trim())
    if (!volumeNumber.trim() || !Number.isInteger(parsed) || parsed <= 0) return
    setManualVolumes((prev) => [...prev, { volumeNumber: parsed, edition: edition.trim() }])
    setVolumeNumber('')
  }

  function removeManualVolume(index: number) {
    setManualVolumes((prev) => prev.filter((_, i) => i !== index))
  }

  function toggleVolumeSelection(key: string) {
    setSelectedVolumeKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Pas de state reçu (accès direct à l'URL, ou rechargement de page - voir
  // draftState.ts, jamais persisté) : rien à afficher, retour à la
  // recherche plutôt qu'un écran cassé.
  if (!state) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-textDim">Aucune sélection en cours.</p>
        <button type="button" onClick={() => navigate('/add')} className="w-fit text-sm font-semibold text-accentText">
          Retour à la recherche
        </button>
      </div>
    )
  }

  const pickedCoverUrl = attributes ? coverImageUrlFrom(attributes) : null
  const pickedAuthor = attributes ? creatorFrom(attributes) : null
  const totalVolumesToAdd = selectedVolumeKeys.size + manualVolumes.length + (volumeNumber.trim() ? 1 : 0)

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={() => navigate('/add')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Recherche
      </button>

      <div className="flex items-center gap-3">
        {pickedCoverUrl ? (
          <img src={pickedCoverUrl} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="h-20 w-14 shrink-0 rounded-lg bg-surface2" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate font-display text-xl font-bold text-textPrimary">{title || '…'}</h1>
          {pickedAuthor && <p className="truncate text-sm text-textDim">{pickedAuthor}</p>}
          {isTranslating && (
            <p className="flex items-center gap-1.5 text-xs text-textDim">
              <Loader2 size={11} className="animate-spin" />
              Recherche du titre français...
            </p>
          )}
        </div>
      </div>

      {selectedType?.code === 'MANGA' && <p className="text-sm text-textDim">Quels tomes possèdes-tu ?</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim() || isTranslating) return
          addMutation.mutate()
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">État</span>
          <div className="flex gap-2">
            {CONDITIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-textDim" htmlFor="purchasePrice">
            Prix d'achat (optionnel)
          </label>
          <input
            id="purchasePrice"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="ex: 6.90"
            className="w-32 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {selectedType?.code === 'MANGA' && isSearchingVolumes && (
          <p className="flex items-center gap-1.5 text-xs text-textDim">
            <Loader2 size={12} className="animate-spin" />
            Recherche des tomes disponibles...
          </p>
        )}

        {selectedType?.code === 'MANGA' && volumeCandidates.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-textDim">
                Tomes possédés {selectedVolumeKeys.size > 0 && `(${selectedVolumeKeys.size} sélectionné${selectedVolumeKeys.size > 1 ? 's' : ''})`}
              </span>
              {lastVolumeSearchParams && (
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      triggerVolumeSearch(lastVolumeSearchParams.title, lastVolumeSearchParams.author, {
                        deepSearch: true,
                        malId: lastVolumeSearchParams.malId,
                        originalTitle: lastVolumeSearchParams.originalTitle,
                        titleRomaji: lastVolumeSearchParams.titleRomaji,
                      })
                    }
                    disabled={isSearchingVolumes}
                    className="flex items-center gap-1 text-xs text-accentText disabled:opacity-50"
                    title="Cherche des éditions plus rares (star edition, collector, intégrale...) en plus de celles déjà trouvées"
                  >
                    <Search size={12} />
                    Chercher plus d'éditions
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      triggerVolumeSearch(lastVolumeSearchParams.title, lastVolumeSearchParams.author, {
                        forceRefresh: true,
                        malId: lastVolumeSearchParams.malId,
                        originalTitle: lastVolumeSearchParams.originalTitle,
                        titleRomaji: lastVolumeSearchParams.titleRomaji,
                      })
                    }
                    disabled={isSearchingVolumes}
                    className="flex items-center gap-1 text-xs text-accentText disabled:opacity-50"
                    title="Relance la recherche des tomes/éditions (résultat normalement gardé tel quel)"
                  >
                    <RefreshCw size={12} className={isSearchingVolumes ? 'animate-spin' : ''} />
                    Actualiser
                  </button>
                </div>
              )}
            </div>
            {volumesQuotaExceeded && !isSearchingVolumes && (
              <p className="flex items-center gap-1.5 text-xs text-dangerText">
                <AlertTriangle size={12} className="shrink-0" />
                Quota Google Books dépassé - la dernière action n'a pas pu aboutir, réessaie plus tard.
              </p>
            )}
            <VolumeSelectionGrid volumes={volumeCandidates} selectedKeys={selectedVolumeKeys} onToggle={toggleVolumeSelection} />
          </div>
        )}

        {selectedType?.code === 'MANGA' && volumeCandidates.length > 0 && !showManualVolumeFields && (
          <button
            type="button"
            onClick={() => {
              if (!edition.trim() && volumeCandidates[0]) setEdition(volumeCandidates[0].edition)
              setShowManualVolumeFields(true)
            }}
            className="w-fit text-xs text-accentText underline"
          >
            + Tome introuvable ci-dessus ? Ajouter manuellement
          </button>
        )}

        {selectedType?.code === 'MANGA' && volumeCandidates.length === 0 && volumesQuotaExceeded && !isSearchingVolumes && (
          <div className="flex items-start gap-2 rounded-xl bg-dangerTint px-4 py-3 text-xs text-dangerText">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Quota Google Books dépassé pour le moment - impossible de vérifier s'il existe des éditions françaises.{' '}
              {lastVolumeSearchParams && (
                <button
                  type="button"
                  onClick={() =>
                    triggerVolumeSearch(lastVolumeSearchParams.title, lastVolumeSearchParams.author, {
                      forceRefresh: true,
                      malId: lastVolumeSearchParams.malId,
                      originalTitle: lastVolumeSearchParams.originalTitle,
                      titleRomaji: lastVolumeSearchParams.titleRomaji,
                    })
                  }
                  className="underline"
                >
                  Réessayer
                </button>
              )}{' '}
              ou ajoute le tome manuellement ci-dessous.
            </span>
          </div>
        )}

        {selectedType?.code === 'MANGA' && (volumeCandidates.length === 0 || showManualVolumeFields) && !isSearchingVolumes && (
          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
            {/* min-w-0 : sans lui, ces colonnes gardent min-width:auto et ne peuvent
            pas descendre sous la largeur intrinsèque de leur champ (~175 px chacun).
            Deux champs côte à côte imposaient alors 510 px, et l'écran débordait
            horizontalement sur un téléphone. */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="text-sm text-textDim" htmlFor="volumeNumber">
                  Tome n°
                </label>
                <input
                  id="volumeNumber"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={volumeNumber}
                  onChange={(e) => setVolumeNumber(e.target.value)}
                  placeholder="ex: 12"
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
              <div className="flex min-w-0 flex-[2] flex-col gap-1.5">
                <label className="text-sm text-textDim" htmlFor="edition">
                  Édition
                </label>
                <input
                  id="edition"
                  value={edition}
                  onChange={(e) => setEdition(e.target.value)}
                  placeholder="ex: Kana, Perfect Edition..."
                  className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={queueManualVolume}
                disabled={!volumeNumber.trim()}
                title="Ajouter ce tome à la liste sans valider tout de suite - pratique pour en enchaîner plusieurs (ex: T4 et T5 d'une même édition)"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface2 text-textPrimary disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>

            {manualVolumes.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {manualVolumes.map((manual, index) => (
                  <li
                    key={`${manual.volumeNumber}-${manual.edition}-${index}`}
                    className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs text-textPrimary"
                  >
                    T. {manual.volumeNumber}
                    {manual.edition && ` · ${manual.edition}`}
                    <button
                      type="button"
                      onClick={() => removeManualVolume(index)}
                      aria-label={`Retirer le tome ${manual.volumeNumber} de la liste`}
                      className="text-textDim hover:text-textPrimary"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!title.trim() || addMutation.isPending || isTranslating}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {addMutation.isPending ? 'Ajout...' : totalVolumesToAdd > 1 ? `Ajouter ${totalVolumesToAdd} tomes` : 'Ajouter'}
        </button>
      </form>

      {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}

      {addMutation.isSuccess && (
        <div className="rounded-xl bg-surface p-3 text-sm text-textPrimary">
          {formatAddResultMessage(addMutation.data)}
          <button type="button" onClick={() => navigate('/add')} className="ml-2 text-accentText underline">
            Ajouter autre chose
          </button>
        </div>
      )}
    </div>
  )
}
