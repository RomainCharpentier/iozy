import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchMetadata } from '../../api/metadata'
import { quickAdd } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { BarcodeLookupField } from './BarcodeLookupField'
import type { MetadataCandidateDto } from '../../types/api'

export function QuickAddPage() {
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [condition, setCondition] = useState<Condition>('NEW')
  const [attributes, setAttributes] = useState<Record<string, unknown> | undefined>(undefined)
  // Titre depuis lequel `attributes` a été rempli - si le titre est retouché
  // manuellement après avoir choisi un candidat, les attributs sont
  // considérés périmés (même règle que côté iOS).
  const [attributesSourceTitle, setAttributesSourceTitle] = useState<string | null>(null)

  // Type par défaut = le premier de la liste chargée (les types ne sont
  // plus codés en dur, la liste est vide un court instant au chargement).
  useEffect(() => {
    if (!entityTypeId && entityTypesQuery.data && entityTypesQuery.data.length > 0) {
      setEntityTypeId(entityTypesQuery.data[0].id)
    }
  }, [entityTypeId, entityTypesQuery.data])

  const selectedType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)

  const debouncedTitle = useDebouncedValue(title, 300)
  const searchEnabled = !!entityTypeId && debouncedTitle.trim().length >= 2 && debouncedTitle !== attributesSourceTitle

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId ?? '', debouncedTitle),
    queryFn: () => searchMetadata(entityTypeId!, debouncedTitle),
    enabled: searchEnabled,
  })

  const addMutation = useMutation({
    mutationFn: quickAdd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  function pickCandidate(candidate: MetadataCandidateDto) {
    setTitle(candidate.title)
    setAttributes(candidate.attributes)
    setAttributesSourceTitle(candidate.title)
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    if (value !== attributesSourceTitle) {
      setAttributes(undefined)
      setAttributesSourceTitle(null)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !entityTypeId || blockedByMissingMatch) return
    addMutation.mutate({ entityTypeId, title: title.trim(), condition, attributes })
  }

  function resetForm() {
    setTitle('')
    setAttributes(undefined)
    setAttributesSourceTitle(null)
  }

  // Retour visuel pendant/après la recherche de métadonnées (Jikan/BGG/IGDB)
  // - sans ça, une recherche qui ne trouve rien (fournisseur en panne, pas de
  // correspondance...) est invisible et donne l'impression qu'aucune
  // recherche n'a lieu, contrairement au champ code-barres qui affiche
  // toujours un état explicite.
  const showSearching = searchEnabled && suggestionsQuery.isFetching
  const showSuggestions = searchEnabled && !suggestionsQuery.isFetching && suggestionsQuery.isSuccess && suggestionsQuery.data.length > 0
  const showNoResults =
    searchEnabled && !suggestionsQuery.isFetching && suggestionsQuery.isSuccess && suggestionsQuery.data.length === 0
  const showSearchError = searchEnabled && !suggestionsQuery.isFetching && suggestionsQuery.isError

  // Un type avec fournisseur (Manga/Jeu vidéo/Jeu de société) exige d'avoir
  // choisi une suggestion (recherche ou code-barres) avant de valider - un
  // type personnalisé (jamais de fournisseur) reste en saisie libre, sinon
  // il deviendrait définitivement impossible d'y ajouter quoi que ce soit.
  const requiresMatch = !!selectedType?.hasMetadataProvider
  const hasVerifiedMatch = attributesSourceTitle !== null && attributesSourceTitle === title
  const blockedByMissingMatch = requiresMatch && title.trim().length > 0 && !hasVerifiedMatch

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Ajout rapide</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {entityTypesQuery.isLoading && <p className="text-sm text-textDim">Chargement des types...</p>}
        {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

        <div className="flex flex-wrap gap-2">
          {(entityTypesQuery.data ?? []).map((type) => (
            <Chip
              key={type.id}
              label={type.label}
              isActive={entityTypeId === type.id}
              onClick={() => setEntityTypeId(type.id)}
            />
          ))}
        </div>

        <div className="relative flex flex-col gap-1.5">
          <label className="text-sm text-textDim" htmlFor="title">
            Titre
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="ex: Death Note"
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
            autoComplete="off"
          />

          {showSearching && <p className="text-xs text-textDim">Recherche...</p>}
          {showNoResults && <p className="text-xs text-textDim">Aucun résultat pour ce titre.</p>}
          {showSearchError && <p className="text-xs text-textDim">La recherche de métadonnées a échoué.</p>}

          {showSuggestions && (
            <ul className="flex flex-col gap-1 rounded-xl bg-surface p-2">
              {suggestionsQuery.data!.map((candidate) => (
                <li key={`${candidate.source}-${candidate.externalId}`}>
                  <button
                    type="button"
                    onClick={() => pickCandidate(candidate)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-textPrimary hover:bg-surface2"
                  >
                    {candidate.title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {attributes && attributesSourceTitle === title && Object.keys(attributes).length > 0 && (
            <div className="rounded-xl bg-surface p-3 text-sm text-textDim">
              <p className="mb-1 font-medium text-textPrimary">Attributs pré-remplis</p>
              <ul className="flex flex-col gap-0.5">
                {Object.entries(attributes).map(([key, value]) => (
                  <li key={key}>
                    {key} : {String(value)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-textDim">État</span>
          <div className="flex gap-2">
            {CONDITIONS.map((c) => (
              <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
            ))}
          </div>
        </div>

        {selectedType?.code === 'MANGA' && entityTypeId && (
          <BarcodeLookupField entityTypeId={entityTypeId} onFound={pickCandidate} />
        )}

        {blockedByMissingMatch && (
          <p className="text-xs text-textDim">
            Ce type nécessite de choisir une suggestion ci-dessus (ou via le code-barres) avant de valider.
          </p>
        )}

        <button
          type="submit"
          disabled={!title.trim() || !entityTypeId || blockedByMissingMatch || addMutation.isPending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentText disabled:opacity-50"
        >
          {addMutation.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
      </form>

      {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}

      {addMutation.isSuccess && (
        <div className="rounded-xl bg-surface p-3 text-sm text-textPrimary">
          {addMutation.data.matchedExistingEntity
            ? 'Nouvel exemplaire ajouté à une fiche existante.'
            : 'Ajouté à ta collection.'}
          <button type="button" onClick={resetForm} className="ml-2 text-accent underline">
            Ajouter autre chose
          </button>
        </div>
      )}
    </div>
  )
}
