import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Scale, ScanBarcode, ScanLine } from 'lucide-react'
import { fetchFrenchTitle, searchMetadata } from '../../api/metadata'
import { searchEntities } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { isFrenchEnabled, useTitleComposition, candidateDisplayTitle } from '../../lib/titleLanguage'
import { BarcodeLookupField } from './BarcodeLookupField'
import type { DraftLocationState } from './draftState'
import type { EntityResponse, MetadataCandidateDto } from '../../types/api'

/** ex: "Manga · 1999 · MYANIMELIST" - voir le commentaire d'usage dans le rendu
 * de la liste de suggestions. mediaType/startYear sont absents pour les
 * sources qui ne les fournissent pas (BGG/IGDB) ou pour un candidat qui n'a
 * pas ce champ renseigné (ex: MAL n'a pas toujours une start_date) - le
 * séparateur ` · ` n'est alors mis qu'entre les parties réellement présentes. */
function candidateSubtitle(candidate: MetadataCandidateDto): string {
  const mediaType = candidate.attributes.mediaType
  const startYear = candidate.attributes.startYear
  return [typeof mediaType === 'string' ? mediaType : null, typeof startYear === 'string' ? startYear : null, candidate.source]
    .filter((part): part is string => !!part)
    .join(' · ')
}

function candidateKey(candidate: MetadataCandidateDto): string {
  return `${candidate.source}-${candidate.externalId}`
}

/**
 * Écran 1/2 (voir la maquette V1.2, §420 - "Recherche + Ajout, un seul
 * point d'entrée") : recherche + liste de résultats GROUPÉS (déjà dans ta
 * collection avant tout - état personnel avant métadonnées, voir §24 du
 * brief de migration), le clic sur un résultat mène à l'écran 2
 * (AddDraftPage, "quels tomes possèdes-tu ?") plutôt que de tout gérer sur
 * la même page (voir l'ancien QuickAddPage.tsx, remplacé par ce découpage -
 * Lot 5, docs/DESIGN_MIGRATION_V1.2.md). Un résultat "déjà possédé" ouvre
 * directement sa fiche (le parcours contextuel d'ajout de tome y vit déjà,
 * voir VolumeInteractionPanel) plutôt que de repasser par ce formulaire.
 */
export function SearchPage() {
  const navigate = useNavigate()
  const titleComposition = useTitleComposition()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [showBarcodeLookup, setShowBarcodeLookup] = useState(false)
  const [frenchTitles, setFrenchTitles] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!entityTypeId && entityTypesQuery.data && entityTypesQuery.data.length > 0) {
      setEntityTypeId(entityTypesQuery.data[0].id)
    }
  }, [entityTypeId, entityTypesQuery.data])

  const selectedType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)
  const debouncedTitle = useDebouncedValue(title, 500)
  const searchEnabled = !!entityTypeId && debouncedTitle.trim().length >= 3

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId ?? '', debouncedTitle),
    queryFn: ({ signal }) => searchMetadata(entityTypeId!, debouncedTitle, signal),
    enabled: searchEnabled,
  })
  const localMatchQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: debouncedTitle, entityTypeId }),
    queryFn: () => searchEntities({ q: debouncedTitle, entityTypeId }),
    enabled: searchEnabled,
  })
  const localMatches = localMatchQuery.data ?? []

  // Résout un titre français pour les 6 premières suggestions affichées -
  // voir l'ancien QuickAddPage.tsx pour le même mécanisme et son
  // raisonnement complet (cache 24h côté backend, capé pour contenir le
  // nombre d'appels externes).
  useEffect(() => {
    setFrenchTitles({})
    if (!isFrenchEnabled(titleComposition) || !entityTypeId || !suggestionsQuery.data || suggestionsQuery.data.length === 0) {
      return
    }
    const controller = new AbortController()
    suggestionsQuery.data
      .filter((c) => c.source === 'JIKAN' || c.source === 'MYANIMELIST')
      .slice(0, 6)
      .forEach((candidate) => {
        const author = typeof candidate.attributes.mangaka === 'string' ? candidate.attributes.mangaka : undefined
        const malId = typeof candidate.attributes.malId === 'string' ? candidate.attributes.malId : undefined
        const titleRomaji = typeof candidate.attributes.titleRomaji === 'string' ? candidate.attributes.titleRomaji : undefined
        fetchFrenchTitle(entityTypeId, candidate.title, { author, malId, titleRomaji, signal: controller.signal })
          .then((frenchTitle) => {
            if (controller.signal.aborted || !frenchTitle) return
            setFrenchTitles((prev) => ({ ...prev, [candidateKey(candidate)]: frenchTitle }))
          })
          .catch(() => {})
      })
    return () => controller.abort()
  }, [suggestionsQuery.data, entityTypeId, titleComposition])

  function goToDraft(candidate: MetadataCandidateDto) {
    const state: DraftLocationState = { entityTypeId: entityTypeId!, candidate }
    navigate('/add/draft', { state })
  }

  function goToEntity(entity: EntityResponse) {
    navigate(`/entity/${entity.id}`)
  }

  const showSearching = searchEnabled && suggestionsQuery.isFetching
  const showSuggestions = searchEnabled && !suggestionsQuery.isFetching && suggestionsQuery.isSuccess && suggestionsQuery.data.length > 0
  const showNoResults =
    searchEnabled &&
    !suggestionsQuery.isFetching &&
    suggestionsQuery.isSuccess &&
    suggestionsQuery.data.length === 0 &&
    localMatches.length === 0
  const showSearchError = searchEnabled && !suggestionsQuery.isFetching && suggestionsQuery.isError
  // Type personnalisé (jamais de fournisseur - voir hasMetadataProvider) :
  // aucune recherche externe possible, saisie libre directe vers l'écran 2.
  const requiresMatch = !!selectedType?.hasMetadataProvider

  return (
    <div className="flex flex-col gap-5">
      {/* "Rechercher" (maquette V1.2 §420) - seul point d'entrée pour ajouter
          à la collection (voir §24 du brief). */}
      <h1 className="font-display text-2xl font-bold text-textPrimary">Rechercher</h1>

      <div className="flex flex-wrap gap-2">
        <Link
          to="/scan"
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <ScanLine size={16} />
          Scanner
        </Link>
        <Link
          to="/purchase-analysis"
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <Scale size={16} />
          Évaluer une annonce
        </Link>
      </div>

      {entityTypesQuery.isLoading && <p className="text-sm text-textDim">Chargement des types...</p>}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

      <div className="flex flex-wrap gap-2">
        {(entityTypesQuery.data ?? []).map((type) => (
          <Chip key={type.id} label={type.label} isActive={entityTypeId === type.id} onClick={() => setEntityTypeId(type.id)} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-textDim" htmlFor="title">
          Titre
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Un titre, un auteur…"
          autoComplete="off"
          className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* Type sans fournisseur de métadonnées (personnalisé) : rien à
          chercher, saisie directe vers l'écran de sélection. */}
      {!requiresMatch && title.trim().length > 0 && entityTypeId && (
        <button
          type="button"
          onClick={() => navigate('/add/draft', { state: { entityTypeId, candidate: null, manualTitle: title.trim() } satisfies DraftLocationState })}
          className="flex w-fit items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentText"
        >
          Ajouter « {title.trim()} »
        </button>
      )}

      {showBarcodeLookup ? (
        <BarcodeLookupField entityTypeId={entityTypeId ?? ''} onFound={goToDraft} />
      ) : (
        entityTypeId && (
          <button
            type="button"
            onClick={() => setShowBarcodeLookup(true)}
            className="flex w-fit items-center gap-1.5 text-xs text-textDim underline"
          >
            <ScanBarcode size={13} />
            Scanner un code-barres / ISBN
          </button>
        )
      )}

      {/* État personnel AVANT les métadonnées (voir §24/§420 du brief) : la
          collection possédée passe en premier groupe, toujours visible avant
          les suggestions externes. */}
      {localMatches.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Déjà dans ta collection</span>
          <div className="flex flex-col gap-1.5">
            {localMatches.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => goToEntity(entity)}
                className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 text-left transition-transform hover:-translate-y-0.5"
              >
                <span className="flex-1 truncate text-sm font-medium text-textPrimary">{entity.title}</span>
                <span className="shrink-0 rounded-full bg-accentTint px-2.5 py-1 text-xs font-semibold text-accentText">Possédé</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showSearching && (
        <p className="flex items-center gap-1.5 text-xs text-textDim">
          <Loader2 size={12} className="animate-spin" />
          Recherche...
        </p>
      )}
      {showSearchError && <p className="text-xs text-textDim">La recherche de métadonnées a échoué.</p>}
      {showNoResults && <p className="text-xs text-textDim">Aucun résultat pour ce titre.</p>}

      {showSuggestions && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Suggestions</span>
          <ul className="flex flex-col gap-1.5">
            {suggestionsQuery.data!.map((candidate) => (
              <li key={candidateKey(candidate)}>
                <button
                  type="button"
                  onClick={() => goToDraft(candidate)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-surface p-2.5 text-left transition-transform hover:-translate-y-0.5"
                >
                  {candidate.imageUrl ? (
                    <img src={candidate.imageUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="h-16 w-11 shrink-0 rounded bg-surface2" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <div className="truncate text-sm font-medium text-textPrimary">
                      {candidateDisplayTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])}
                    </div>
                    <div className="text-xs text-textDim">{candidateSubtitle(candidate)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
