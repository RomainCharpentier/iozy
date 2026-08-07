import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { fetchFrenchTitle, searchMetadata } from '../../api/metadata'
import { quickAdd } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { BarcodeLookupField } from './BarcodeLookupField'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import { candidateDisplayTitle, isFrenchEnabled, resolvePrimaryTitle, useTitleComposition } from '../../lib/titleLanguage'
import type { MetadataCandidateDto } from '../../types/api'

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

/** Clé stable identifiant un candidat dans les maps de state (frenchTitles) -
 * même convention que la key React de la liste de suggestions. */
function candidateKey(candidate: MetadataCandidateDto): string {
  return `${candidate.source}-${candidate.externalId}`
}

export function QuickAddPage() {
  const queryClient = useQueryClient()
  // Réglage utilisateur (voir Réglages > Titre des mangas, lib/titleLanguage.ts) -
  // si "Français" n'est pas activé dans la composition, aucune recherche de
  // titre français n'est jamais déclenchée (ni pour la liste ni à la
  // sélection) : zéro appel externe en plus.
  const titleComposition = useTitleComposition()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [condition, setCondition] = useState<Condition>('NEW')
  const [attributes, setAttributes] = useState<Record<string, unknown> | undefined>(undefined)
  // Titre depuis lequel `attributes` a été rempli - si le titre est retouché
  // manuellement après avoir choisi un candidat, les attributs sont
  // considérés périmés (même règle que côté iOS).
  const [attributesSourceTitle, setAttributesSourceTitle] = useState<string | null>(null)
  // Recherche best-effort d'un titre d'édition française (Google Books) après
  // sélection d'un candidat Jikan/MyAnimeList - voir pickCandidate. Le ref
  // permet d'annuler une recherche devenue obsolète (nouveau candidat choisi,
  // ou titre retouché à la main avant que la réponse n'arrive).
  const [isTranslating, setIsTranslating] = useState(false)
  const frenchTitleAbortRef = useRef<AbortController | null>(null)
  // Titres français déjà résolus pour la LISTE de suggestions (pas seulement
  // pour le candidat choisi) - voir l'effet ci-dessous. Clé = candidateKey().
  const [frenchTitles, setFrenchTitles] = useState<Record<string, string>>({})

  // Type par défaut = le premier de la liste chargée (les types ne sont
  // plus codés en dur, la liste est vide un court instant au chargement).
  useEffect(() => {
    if (!entityTypeId && entityTypesQuery.data && entityTypesQuery.data.length > 0) {
      setEntityTypeId(entityTypesQuery.data[0].id)
    }
  }, [entityTypeId, entityTypesQuery.data])

  const selectedType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)

  // Délai plus long que les recherches "locales" (SearchPage/RelationshipsSection,
  // 300ms) : celles-ci ne coûtent rien (recherche SQL sur ta propre collection),
  // alors que chaque recherche ici appelle une API externe (Jikan/MAL/BGG/IGDB).
  // 500ms + un minimum de 3 caractères réduit nettement les recherches
  // intermédiaires tapées "en passant" avant que le mot ne soit terminé (ex:
  // taper "naruto" sans s'arrêter ne devrait déclencher qu'une seule requête,
  // pas une par pause de frappe) - le cache backend (voir MetadataSearchService)
  // absorbe le reste des cas résiduels.
  const debouncedTitle = useDebouncedValue(title, 500)
  const searchEnabled = !!entityTypeId && debouncedTitle.trim().length >= 3 && debouncedTitle !== attributesSourceTitle

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId ?? '', debouncedTitle),
    // `signal` vient de TanStack Query : si une frappe plus récente rend cette
    // requête obsolète avant qu'elle ne réponde, elle est annulée côté client
    // plutôt que de laisser une réponse tardive écraser un résultat plus récent.
    queryFn: ({ signal }) => searchMetadata(entityTypeId!, debouncedTitle, signal),
    enabled: searchEnabled,
  })

  // Résout un titre français pour chaque suggestion Jikan/MyAnimeList
  // affichée (pas seulement celle qu'on finira par choisir - voir
  // pickCandidate qui réutilise ces résultats sans refaire l'appel).
  // Capé aux 6 premières suggestions pour contenir le nombre d'appels
  // externes (jusqu'à ~5 requêtes Open Library en cascade par candidat -
  // voir OpenLibraryFrenchTitleProvider côté backend, cache 24h derrière) ;
  // au-delà, le titre français est cherché à la sélection comme avant. La
  // liste s'affiche immédiatement en anglais/romaji et se met à jour
  // progressivement candidat par candidat, sans bloquer l'affichage initial.
  useEffect(() => {
    setFrenchTitles({})
    if (!isFrenchEnabled(titleComposition) || !entityTypeId || !suggestionsQuery.data || suggestionsQuery.data.length === 0) {
      return
    }
    const controller = new AbortController()

    suggestionsQuery.data
      .filter((candidate) => candidate.source === 'JIKAN' || candidate.source === 'MYANIMELIST')
      .slice(0, 6)
      .forEach((candidate) => {
        const author = typeof candidate.attributes.mangaka === 'string' ? candidate.attributes.mangaka : undefined
        fetchFrenchTitle(entityTypeId, candidate.title, author, controller.signal)
          .then((frenchTitle) => {
            if (controller.signal.aborted || !frenchTitle) return
            setFrenchTitles((prev) => ({ ...prev, [candidateKey(candidate)]: frenchTitle }))
          })
          .catch(() => {
            // Best-effort par nature (voir fetchFrenchTitle) : une panne sur
            // un candidat ne doit affecter que celui-ci, jamais la liste entière.
          })
      })

    return () => controller.abort()
  }, [suggestionsQuery.data, entityTypeId, titleComposition])

  const addMutation = useMutation({
    mutationFn: quickAdd,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  function pickCandidate(candidate: MetadataCandidateDto) {
    frenchTitleAbortRef.current?.abort()
    setIsTranslating(false)

    // Titre déjà résolu selon la composition (voir Réglages > Titre des
    // mangas) : si "Français" n'est pas activé, c'est définitif (romaji/anglais
    // uniquement, jamais d'appel réseau). Sinon, réutilise un titre français
    // déjà résolu pour la liste (voir l'effet plus haut) si disponible.
    const resolvedTitle = resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])
    setTitle(resolvedTitle)
    // La jaquette voyage à part sur MetadataCandidateDto (imageUrl) plutôt
    // que dans `attributes` - on la glisse sous une clé dédiée pour qu'elle
    // soit persistée avec le reste des attributs pré-remplis, sans pour
    // autant polluer la liste affichée à l'utilisateur (voir COVER_IMAGE_ATTRIBUTE_KEY).
    setAttributes(
      candidate.imageUrl
        ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl }
        : candidate.attributes,
    )
    setAttributesSourceTitle(resolvedTitle)

    // Rien de plus à faire si "Français" n'est pas activé (aucun appel
    // externe dans ce cas), ni si le titre français est déjà connu (appliqué
    // ci-dessus).
    if (!isFrenchEnabled(titleComposition) || frenchTitles[candidateKey(candidate)]) {
      return
    }

    // Sinon (candidat au-delà des 6 premiers de la liste, ou résolution pas
    // encore arrivée), même recherche best-effort (Open Library, puis Google
    // Books en repli) déclenchée à la sélection - uniquement pour les
    // candidats Jikan/MyAnimeList : ce sont les seuls dont le titre est
    // romaji/anglais (jamais français). Un candidat Google Books/Open
    // Library (scan ISBN) a déjà renvoyé l'édition exacte scannée - pas la
    // peine de le retraduire. Le mangaka (author) améliore nettement la
    // précision de la recherche (voir OpenLibraryFrenchTitleProvider) - une
    // recherche par titre seul remonte surtout du merchandising francophone
    // (agendas, goodies).
    //
    // On envoie bien `candidate.title` (déjà l'anglais si disponible),
    // jamais le romaji `originalTitle` : vérifié manuellement que combiner
    // l'auteur avec le romaji complet ne matche jamais une édition française
    // (le texte français ne contient évidemment aucun mot japonais), alors
    // qu'un mot anglais distinctif (ex: "Titan") le retrouve souvent.
    if (entityTypeId && (candidate.source === 'JIKAN' || candidate.source === 'MYANIMELIST')) {
      const searchTerm = candidate.title
      const author = typeof candidate.attributes.mangaka === 'string' ? candidate.attributes.mangaka : undefined
      const controller = new AbortController()
      frenchTitleAbortRef.current = controller
      setIsTranslating(true)
      fetchFrenchTitle(entityTypeId, searchTerm, author, controller.signal)
        .then((frenchTitle) => {
          if (controller.signal.aborted || !frenchTitle) return
          setTitle(frenchTitle)
          setAttributesSourceTitle(frenchTitle)
        })
        .catch(() => {
          // Best-effort : une panne ne doit jamais bloquer l'ajout, le titre
          // anglais/romaji déjà choisi reste utilisable tel quel.
        })
        .finally(() => {
          if (frenchTitleAbortRef.current === controller) {
            setIsTranslating(false)
          }
        })
    }
  }

  function handleTitleChange(value: string) {
    frenchTitleAbortRef.current?.abort()
    setIsTranslating(false)
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

          {showSearching && (
            <p className="flex items-center gap-1.5 text-xs text-textDim">
              <Loader2 size={12} className="animate-spin" />
              Recherche...
            </p>
          )}
          {isTranslating && (
            <p className="flex items-center gap-1.5 text-xs text-textDim">
              <Loader2 size={12} className="animate-spin" />
              Recherche du titre français...
            </p>
          )}
          {showNoResults && <p className="text-xs text-textDim">Aucun résultat pour ce titre.</p>}
          {showSearchError && <p className="text-xs text-textDim">La recherche de métadonnées a échoué.</p>}

          {showSuggestions && (
            <ul className="flex flex-col gap-1 rounded-xl bg-surface p-2">
              {suggestionsQuery.data!.map((candidate) => (
                <li key={`${candidate.source}-${candidate.externalId}`}>
                  <button
                    type="button"
                    onClick={() => pickCandidate(candidate)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-textPrimary hover:bg-surface2"
                  >
                    {/* Jaquette réelle si la source en fournit une - aide à
                        distinguer visuellement des titres identiques/proches
                        (ex: un manga et son adaptation en film) en un coup
                        d'œil, avant même de lire le sous-titre. */}
                    {candidate.imageUrl ? (
                      <img
                        src={candidate.imageUrl}
                        alt=""
                        className="h-12 w-9 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="h-12 w-9 shrink-0 rounded bg-surface2" />
                    )}
                    {/* divs plutôt que des span empilés en flex : un span reste
                        "inline" au sens du copier-coller (le texte des deux
                        lignes se concatène sans espace, même si l'affichage à
                        l'écran est correctement séparé visuellement) - un div
                        est nativement en bloc, donc copié avec un vrai retour
                        à la ligne entre le titre et le sous-titre. */}
                    <div className="flex min-w-0 flex-col">
                      <div className="truncate">
                        {candidateDisplayTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])}
                      </div>
                      {/* Un même titre peut désigner plusieurs œuvres distinctes
                          (ex: le manga "Naruto" et un one-shot pilote également
                          titré "Naruto") - type + année + source lèvent l'ambiguïté
                          sans avoir à ouvrir chaque candidat. */}
                      <div className="text-xs text-textDim">{candidateSubtitle(candidate)}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {attributes &&
            attributesSourceTitle === title &&
            Object.keys(attributes).filter((key) => key !== COVER_IMAGE_ATTRIBUTE_KEY).length > 0 && (
              <div className="rounded-xl bg-surface p-3 text-sm text-textDim">
                <p className="mb-1 font-medium text-textPrimary">Attributs pré-remplis</p>
                <ul className="flex flex-col gap-0.5">
                  {Object.entries(attributes)
                    .filter(([key]) => key !== COVER_IMAGE_ATTRIBUTE_KEY)
                    .map(([key, value]) => (
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
          disabled={!title.trim() || !entityTypeId || blockedByMissingMatch || addMutation.isPending || isTranslating}
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
