import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, RefreshCw, Search } from 'lucide-react'
import { fetchFrenchTitle, searchMetadata, searchVolumes } from '../../api/metadata'
import { quickAdd } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Chip } from '../../components/Chip'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { BarcodeLookupField } from './BarcodeLookupField'
import { VolumeSelectionGrid, volumeKey } from './VolumeSelectionGrid'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import { candidateDisplayTitle, isFrenchEnabled, resolvePrimaryTitle, useTitleComposition } from '../../lib/titleLanguage'
import type { MetadataCandidateDto, VolumeCandidateDto } from '../../types/api'

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

interface QuickAddOutcome {
  addedCount: number
  alreadyOwnedCount: number
  matchedExistingEntity: boolean
}

/** Résume le résultat d'un ajout (potentiellement plusieurs tomes en un seul
 * clic - voir addMutation) en une phrase. alreadyOwnedCount ne bloque jamais
 * l'ajout (voir QuickAddService côté backend, un 2e exemplaire du même tome
 * reste légitime) - "déjà possédé" avertit juste que ce tome précis avait
 * déjà une Ownership active, sans empêcher l'exemplaire d'être ajouté. */
function formatAddResultMessage(outcome: QuickAddOutcome): string {
  const { addedCount, alreadyOwnedCount, matchedExistingEntity } = outcome
  if (addedCount === 0 && alreadyOwnedCount > 0) {
    return alreadyOwnedCount > 1
      ? `Tu possèdes déjà ces ${alreadyOwnedCount} tomes - exemplaires ajoutés quand même.`
      : 'Tu possèdes déjà ce tome (cette édition) - exemplaire ajouté quand même.'
  }
  const suffix = alreadyOwnedCount > 0 ? ` (dont ${alreadyOwnedCount} déjà possédé${alreadyOwnedCount > 1 ? 's' : ''})` : ''
  if (addedCount > 1) {
    return `${addedCount} tomes ajoutés${suffix}.`
  }
  return matchedExistingEntity ? `Nouveau tome ajouté à une fiche existante${suffix}.` : `Ajouté à ta collection${suffix}.`
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
  // Réservés au Manga (voir QuickAddService côté backend) : le titre identifie
  // la SÉRIE, volumeNumber+edition identifient le TOME précis qu'on ajoute
  // réellement à l'étagère - deux champs distincts pour ne pas mélanger "je
  // possède Naruto" (faux, personne ne possède "la série" en un bloc) et "je
  // possède le tome 12 de Naruto, édition Kana" (ce qu'on possède vraiment).
  const [volumeNumber, setVolumeNumber] = useState('')
  const [edition, setEdition] = useState('')
  // Sélection visuelle des tomes possédés par jaquette (voir VolumeSelectionGrid,
  // façon Mangacollec) - déclenchée après sélection d'un candidat Manga
  // (voir triggerVolumeSearch). volumeNumber/edition ci-dessus restent
  // disponibles en repli manuel (tome introuvable dans la recherche) et se
  // combinent avec cette sélection au moment de l'ajout (voir addMutation).
  const [volumeCandidates, setVolumeCandidates] = useState<VolumeCandidateDto[]>([])
  // Quota Google Books dépassé sur toutes les clés configurées lors de la
  // dernière recherche (voir VolumesResponseDto) - distingue ce cas d'une
  // série qui n'a réellement aucune édition française, pour ne pas laisser
  // croire à tort qu'il n'y a rien alors que c'est temporaire.
  const [volumesQuotaExceeded, setVolumesQuotaExceeded] = useState(false)
  const [isSearchingVolumes, setIsSearchingVolumes] = useState(false)
  const [selectedVolumeKeys, setSelectedVolumeKeys] = useState<Set<string>>(new Set())
  const [showManualVolumeFields, setShowManualVolumeFields] = useState(false)
  const volumeSearchAbortRef = useRef<AbortController | null>(null)
  // Débounce du déclenchement AUTOMATIQUE de la recherche de tomes après
  // sélection d'un candidat (voir pickCandidate) - évite de payer les 8
  // requêtes Google Books pour chaque candidat survolé/cliqué rapidement
  // avant de s'arrêter sur le bon (vérifié manuellement pendant cette
  // session : c'est exactement ce schéma qui a vidé le quota). N'affecte
  // jamais un déclenchement volontaire (bouton "Actualiser"), toujours immédiat.
  const volumeSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Titre/auteur de la dernière recherche de tomes déclenchée - réutilisés par
  // le bouton "Actualiser" (voir triggerVolumeSearch) sans avoir à re-choisir
  // le candidat. Le résultat est stocké durablement côté backend (voir
  // MetadataSearchService.searchVolumes) : sans ce bouton, un résultat une
  // fois trouvé ne serait plus jamais rafraîchi automatiquement.
  const [lastVolumeSearchParams, setLastVolumeSearchParams] = useState<{
    title: string
    author?: string
    // Déjà connus du candidat sélectionné (voir pickCandidate) - permettent
    // d'écarter un spin-off/side-story connu (voir RelatedSeriesService côté
    // backend), y compris sur "Actualiser"/"Chercher plus d'éditions".
    malId?: string
    originalTitle?: string
  } | null>(null)
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
        const malId = typeof candidate.attributes.malId === 'string' ? candidate.attributes.malId : undefined
        fetchFrenchTitle(entityTypeId, candidate.title, { author, malId, signal: controller.signal })
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
    mutationFn: async (): Promise<QuickAddOutcome> => {
      const manualVolumeNumber = volumeNumber.trim() ? Number(volumeNumber) : undefined
      // Chaque couverture cochée dans la grille devient un ajout, plus
      // éventuellement le tome saisi manuellement (repli "introuvable dans la
      // recherche") en plus - jamais l'un OU l'autre, les deux se combinent.
      const items: Array<{ volumeNumber?: number; edition?: string; volumeImageUrl?: string }> = volumeCandidates
        .filter((v) => selectedVolumeKeys.has(volumeKey(v)))
        .map((v) => ({ volumeNumber: v.volumeNumber, edition: v.edition, volumeImageUrl: v.imageUrl ?? undefined }))
      if (manualVolumeNumber !== undefined) {
        items.push({ volumeNumber: manualVolumeNumber, edition: edition.trim() || undefined })
      }
      if (items.length === 0) {
        items.push({}) // pas de tome précisé (jeu vidéo/jeu de société, ou manga sans tome)
      }

      let addedCount = 0
      let alreadyOwnedCount = 0
      let matchedExistingEntity = false
      // Séquentiel, jamais Promise.all : le premier appel crée l'Entity-série
      // si elle n'existe pas encore côté backend (aucune contrainte unique en
      // base sur entity_type_id+title) - des appels concurrents créeraient
      // potentiellement plusieurs fiches en double pour la même série.
      for (const item of items) {
        const result = await quickAdd({
          entityTypeId: entityTypeId!,
          title: title.trim(),
          condition,
          attributes,
          volumeNumber: item.volumeNumber,
          edition: item.edition,
          volumeImageUrl: item.volumeImageUrl,
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

  /** Cherche les tomes réels (avec jaquette) des éditions françaises de cette
   * série (voir VolumeSelectionGrid) - best-effort, une liste vide laisse
   * simplement les champs manuels comme unique moyen d'ajouter un tome.
   * Résultat stocké durablement côté backend : sans forceRefresh/deepSearch,
   * un appel répété pour la même série ne relance jamais Google Books, il
   * sert la réponse déjà stockée. `deepSearch` (bouton "Chercher plus
   * d'éditions") FUSIONNE avec le résultat déjà connu, il ne le remplace pas
   * - la sélection en cours est donc toujours conservée, comme forceRefresh.
   * `malId`/`originalTitle` (déjà connus du candidat sélectionné) permettent
   * d'écarter un spin-off/side-story connu côté backend - best-effort. */
  function triggerVolumeSearch(
    seriesTitle: string,
    author: string | undefined,
    options?: { forceRefresh?: boolean; deepSearch?: boolean; malId?: string; originalTitle?: string },
  ) {
    const { forceRefresh = false, deepSearch = false, malId, originalTitle } = options ?? {}
    if (!entityTypeId) return
    setLastVolumeSearchParams({ title: seriesTitle, author, malId, originalTitle })
    volumeSearchAbortRef.current?.abort()
    const controller = new AbortController()
    volumeSearchAbortRef.current = controller
    setIsSearchingVolumes(true)
    // Un rafraîchissement manuel ou une recherche approfondie gardent la
    // sélection en cours (l'utilisateur ne fait que vérifier/compléter) -
    // une nouvelle série (recherche initiale) repart en revanche d'une
    // sélection vide.
    if (!forceRefresh && !deepSearch) {
      setVolumeCandidates([])
      setSelectedVolumeKeys(new Set())
    }
    setVolumesQuotaExceeded(false)
    searchVolumes(entityTypeId, seriesTitle, { author, signal: controller.signal, forceRefresh, deepSearch, malId, originalTitle })
      .then((response) => {
        if (controller.signal.aborted) return
        setVolumeCandidates(response.volumes)
        setVolumesQuotaExceeded(response.quotaExceeded)
      })
      .catch(() => {
        // Best-effort par nature : une panne laisse simplement la grille
        // vide, les champs manuels restent utilisables.
      })
      .finally(() => {
        if (volumeSearchAbortRef.current === controller) {
          setIsSearchingVolumes(false)
        }
      })
  }

  function toggleVolumeSelection(key: string) {
    setSelectedVolumeKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function pickCandidate(candidate: MetadataCandidateDto) {
    frenchTitleAbortRef.current?.abort()
    setIsTranslating(false)
    // Annule une recherche de tomes encore en attente pour un candidat
    // précédent (voir le débounce plus bas) - un nouveau choix la rend obsolète.
    if (volumeSearchDebounceRef.current) {
      clearTimeout(volumeSearchDebounceRef.current)
      volumeSearchDebounceRef.current = null
    }

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
    // Pré-remplit l'édition depuis l'éditeur renvoyé par le candidat (ex:
    // Google Books/Open Library sur un scan ISBN renvoient l'édition exacte
    // scannée) - laissé vide pour Jikan/MyAnimeList/BGG/IGDB qui ne connaissent
    // pas d'éditeur français. Simple pré-remplissage, jamais écrasé après coup :
    // rien n'empêche l'utilisateur de le corriger.
    if (typeof candidate.attributes.publisher === 'string') {
      setEdition(candidate.attributes.publisher)
    }
    setShowManualVolumeFields(false)

    const author = typeof candidate.attributes.mangaka === 'string' ? candidate.attributes.mangaka : undefined
    // malId + candidate.title (titre AVANT résolution française, contrairement
    // à resolvedTitle) permettent d'écarter un spin-off/side-story connu côté
    // backend (voir RelatedSeriesService) - best-effort, sans effet si malId
    // est absent (candidat sans identifiant MyAnimeList exploitable).
    const malId = typeof candidate.attributes.malId === 'string' ? candidate.attributes.malId : undefined
    // Recherche avec le titre déjà résolu - correct dans la majorité des cas
    // (beaucoup de titres de mangas restent identiques en VF, ex: "Death
    // Note", "One Piece"). Si le titre français arrive plus tard (voir plus
    // bas) et diffère, la recherche est refaite avec le bon titre : le cas
    // où "L'Attaque des Titans" doit remplacer "Attack on Titan" pour
    // trouver l'édition française sur Google Books.
    //
    // Débounced (pas immédiat) : sans délai, comparer rapidement plusieurs
    // candidats avant de choisir (clics successifs) déclenchait les 8
    // requêtes Google Books pour CHAQUE candidat survolé, jamais retenu ou
    // non - annulé si un autre candidat est choisi entre-temps (voir plus
    // haut), sans impact perçu sur l'UX (la recherche elle-même prend déjà
    // 1-2s).
    if (selectedType?.code === 'MANGA') {
      volumeSearchDebounceRef.current = setTimeout(() => {
        volumeSearchDebounceRef.current = null
        triggerVolumeSearch(resolvedTitle, author, { malId, originalTitle: candidate.title })
      }, 600)
    }

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
      const controller = new AbortController()
      frenchTitleAbortRef.current = controller
      setIsTranslating(true)
      fetchFrenchTitle(entityTypeId, searchTerm, { author, malId, signal: controller.signal })
        .then((frenchTitle) => {
          if (controller.signal.aborted || !frenchTitle) return
          setTitle(frenchTitle)
          setAttributesSourceTitle(frenchTitle)
          if (selectedType?.code === 'MANGA') {
            triggerVolumeSearch(frenchTitle, author, { malId, originalTitle: candidate.title })
          }
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
      // La sélection de tomes/jaquettes a été résolue pour l'ancien titre -
      // un titre retouché à la main invalide cette sélection (plus aucune
      // garantie que ces tomes correspondent encore à ce qui est saisi).
      volumeSearchAbortRef.current?.abort()
      if (volumeSearchDebounceRef.current) {
        clearTimeout(volumeSearchDebounceRef.current)
        volumeSearchDebounceRef.current = null
      }
      setVolumeCandidates([])
      setSelectedVolumeKeys(new Set())
      setIsSearchingVolumes(false)
      setLastVolumeSearchParams(null)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !entityTypeId || blockedByMissingMatch) return
    addMutation.mutate()
  }

  function resetForm() {
    if (volumeSearchDebounceRef.current) {
      clearTimeout(volumeSearchDebounceRef.current)
      volumeSearchDebounceRef.current = null
    }
    setTitle('')
    setAttributes(undefined)
    setAttributesSourceTitle(null)
    setVolumeNumber('')
    setEdition('')
    setVolumeCandidates([])
    setSelectedVolumeKeys(new Set())
    setShowManualVolumeFields(false)
    setLastVolumeSearchParams(null)
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
                      })
                    }
                    disabled={isSearchingVolumes}
                    className="flex items-center gap-1 text-xs text-accent disabled:opacity-50"
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
                      })
                    }
                    disabled={isSearchingVolumes}
                    className="flex items-center gap-1 text-xs text-accent disabled:opacity-50"
                    title="Relance la recherche des tomes/éditions (résultat normalement gardé tel quel)"
                  >
                    <RefreshCw size={12} className={isSearchingVolumes ? 'animate-spin' : ''} />
                    Actualiser
                  </button>
                </div>
              )}
            </div>
            {volumesQuotaExceeded && !isSearchingVolumes && (
              <p className="flex items-center gap-1.5 text-xs text-pink">
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
            onClick={() => setShowManualVolumeFields(true)}
            className="w-fit text-xs text-accent underline"
          >
            + Tome introuvable ci-dessus ? Ajouter manuellement
          </button>
        )}

        {selectedType?.code === 'MANGA' && volumeCandidates.length === 0 && volumesQuotaExceeded && !isSearchingVolumes && (
          // Même esprit que ErrorBanner (bg-pink/10 + AlertTriangle) - pas le
          // composant lui-même, qui n'accepte qu'un message brut, alors qu'il
          // faut ici un lien "Réessayer" cliquable dans le message.
          <div className="flex items-start gap-2 rounded-xl bg-pink/10 px-4 py-3 text-xs text-pink">
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
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
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
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
              />
            </div>
            <div className="flex flex-[2] flex-col gap-1.5">
              <label className="text-sm text-textDim" htmlFor="edition">
                Édition
              </label>
              <input
                id="edition"
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="ex: Kana, Perfect Edition..."
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
                autoComplete="off"
              />
            </div>
          </div>
        )}

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
          {addMutation.isPending
            ? 'Ajout...'
            : selectedVolumeKeys.size > 1
              ? `Ajouter ${selectedVolumeKeys.size} tomes`
              : 'Ajouter'}
        </button>
      </form>

      {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}

      {addMutation.isSuccess && (
        <div className="rounded-xl bg-surface p-3 text-sm text-textPrimary">
          {formatAddResultMessage(addMutation.data)}
          <button type="button" onClick={resetForm} className="ml-2 text-accent underline">
            Ajouter autre chose
          </button>
        </div>
      )}
    </div>
  )
}
