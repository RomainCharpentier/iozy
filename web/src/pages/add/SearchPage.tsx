import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Camera, Languages, Loader2, ScanBarcode, ScanLine, SearchX, Upload } from 'lucide-react'
import { fetchFrenchTitle, searchMetadata, seriesSansTomesConnues } from '@/common/api/metadata'
import { searchEntities } from '@/common/api/entities'
import { listTags } from '@/common/api/tags'
import { useAuth } from '@/common/hooks/useAuth'
import { listAllOwnerships } from '@/common/api/ownerships'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { useDebouncedValue } from '@/common/hooks/useDebouncedValue'
import { Chip } from '@/common/components/Chip'
import { WishlistToggle } from '@/common/components/WishlistToggle'
import { useWishlist } from '@/common/hooks/useWishlist'
import { useCollecteParTome } from '@/common/lib/typeDeCollection'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { isFrenchEnabled, useTitleComposition, candidateDisplayTitle, resolvePrimaryTitle } from '@/common/lib/titleLanguage'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '@/common/lib/coverImage'
import { BarcodeLookupField } from './BarcodeLookupField'
import type { EntityResponse, MetadataCandidateDto } from '@/common/types/api'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { Jaquette } from '@/common/components/Jaquette'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import type { EtatRetour } from '@/common/lib/retour'
import { indicesDe } from '@/common/lib/indicesOeuvre'
import { nomDeSource } from '@/common/lib/sources'
import { EtatVide } from '@/common/components/EtatVide'

/** e.g. "Manga · 1999 · MYANIMELIST" - see the usage comment in the rendering
 * of the suggestions list. mediaType/startYear are missing for
 * sources that do not provide them (BGG/IGDB) or for a candidate that does not
 * have this field filled in (e.g. MAL does not always have a start_date) - the
 * separator ` · ` is then only placed between the parts that are really present. */
function candidateSubtitle(candidate: MetadataCandidateDto): string {
  const mediaType = candidate.attributes.mediaType
  const startYear = candidate.attributes.startYear
  return [typeof mediaType === 'string' ? mediaType : null, typeof startYear === 'string' ? startYear : null, nomDeSource(candidate.source)]
    .filter((part): part is string => !!part)
    .join(' · ')
}

function candidateKey(candidate: MetadataCandidateDto): string {
  return `${candidate.source}-${candidate.externalId}`
}

/**
 * Screen 1/2 (see mockup V1.2, §420 - "Search + Add, a single
 * entry point"): search + list of GROUPED results (already in your
 * collection first - personal state before metadata, see §24 of the
 * migration brief), a click on a result leads to screen 2
 * (AddDraftPage, "which volumes do you own?") rather than managing everything on
 * the same page (see the old QuickAddPage.tsx, replaced by this split -
 * Batch 5, docs/DESIGN_MIGRATION_V1.2.md). An "already owned" result opens
 * its detail page directly (the contextual add-volume flow already lives there,
 * see AddVolumeSection) rather than going through this form again.
 */
/**
 * Every detail page or preview opened from this screen offers to come back here (see
 * retourFiche) - and coming back must FIND the search again, not an empty page.
 *
 * Hence the full URL, `search` included: it carries the type and the
 * title searched, so it is what must be reopened. A constant `/add`
 * did bring back the screen, but emptied of what had been typed.
 */
function retourVersRecherche(search: string): EtatRetour {
  // Named after the screen it goes back to: this screen is titled
  // "Catalogue", and so is its navigation entry.
  return { retour: { to: `/add${search}`, libelle: 'Catalogue' } }
}

export function SearchPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const titleComposition = useTitleComposition()
  const wishlist = useWishlist()
  // A visitor browses the catalogue and nothing else: no external sources
  // (they serve to ADD, and go out to a provider), no personal state
  // either - they own nothing, and "Pas encore possédé" on every row
  // would be noise that talks about someone else.
  const { estInvite } = useAuth()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  /**
   * The type and the title searched live in the URL.
   *
   * <h2>Why not a simple `useState`</h2>
   * Because a local state dies with the component: opening a result then
   * coming back gave a blank page, the search lost. The URL survives
   * the round trip, F5 and sharing - this is the rule this repo already gave
   * itself in Batch 31 ("when a screen deserves to be seen again or sent, give it
   * a real URL"), simply not yet applied here.
   *
   * <p>Typing stays in a local state: the URL only follows after the same
   * delay as the query (see below), and with `replace` - otherwise
   * each letter would leave an entry in the history and the Back button
   * would go back through the word character by character.
   */
  const [parametres, setParametres] = useSearchParams()
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(parametres.get('type') ?? undefined)
  const [title, setTitle] = useState(parametres.get('q') ?? '')
  // A tag describes a WORK and lives in the shared catalogue: so it is here,
  // in front of the whole catalogue, that it filters most naturally - My
  // collection only filtered what we own (batch 143). Only one at a time,
  // like the server parameter.
  const [tagId, setTagId] = useState<string | undefined>(parametres.get('tag') ?? undefined)
  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const tags = tagsQuery.data ?? []
  const [showBarcodeLookup, setShowBarcodeLookup] = useState(false)
  // The French titles found, kept with the suggestions and the composition
  // they were asked for: another list, or another composition, reads an empty
  // map at once, with no reset in an effect.
  const [frenchTitlesFound, setFrenchTitlesFound] = useState<{
    suggestions: unknown
    composition: unknown
    titles: Record<string, string>
  }>({ suggestions: undefined, composition: undefined, titles: {} })

  // We arrive on "Tout", for everyone (batch 139, request from
  // the user: "you must first select Tout instead of Manga").
  // The first type of the instance was preselected for a signed-in account
  // - arriving ready to search at a provider, which is queried
  // type by type - but it is the CATALOGUE that we open, and it then showed
  // only one universe taken for the others. The type is chosen when
  // searching, and the sentence under the field says so at the useful moment.
  function choisirType(id: string | undefined) {
    setEntityTypeId(id)
  }

  const selectedType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)
  const debouncedTitle = useDebouncedValue(title, 500)
  /**
   * The categories to search in: the one that is chosen, or ALL
   * those that have a source when none is (batch 145).
   *
   * <p>Under "Tout", the external search was cut off - "a provider
   * is queried type by type" - and the screen said so in one sentence. A
   * title typed with no category therefore only found the catalogue: "Injustice"
   * only answered after choosing "Jeu vidéo", while we do not
   * always know in advance which universe the thing we search belongs to. Each source
   * is still queried type by type; it is the screen that queries
   * all of them, and presents them by category.
   */
  const typesCherches = useMemo(
    () => (entityTypeId ? (selectedType ? [selectedType] : []) : (entityTypesQuery.data ?? [])).filter((t) => t.hasMetadataProvider),
    [entityTypeId, selectedType, entityTypesQuery.data],
  )
  const typeManga = typesCherches.find((t) => t.code === 'MANGA')
  // The collection BY VOLUME (the preview that lists volumes) only concerns
  // manga: only for it do we ask the server for the series it
  // already knows to have no volume.
  const parTome = useCollecteParTome(typeManga?.id ?? null)

  // The URL follows the search that was ACTUALLY run, not the typing: same
  // delay as the query, and `replace` so as not to stack one history entry
  // per letter.
  useEffect(() => {
    const voulu = new URLSearchParams()
    if (entityTypeId) voulu.set('type', entityTypeId)
    if (tagId) voulu.set('tag', tagId)
    if (debouncedTitle.trim()) voulu.set('q', debouncedTitle.trim())
    if (voulu.toString() !== parametres.toString()) setParametres(voulu, { replace: true })
  }, [entityTypeId, tagId, debouncedTitle, parametres, setParametres])
  // A type with no metadata provider (custom type created from
  // Administration) has NO external source: no search, no scan - see
  // requiresMatch and EntityTypeDto.hasMetadataProvider. Without this guard, the screen
  // ran a search doomed to find nothing, then displayed "Aucun
  // résultat pour ce titre" - a failure announced where there was quite
  // simply nothing to search.
  const searchEnabled = !estInvite && typesCherches.length > 0 && debouncedTitle.trim().length >= 3
  // The LOCAL search, for its part, does not depend on any provider: it queries
  // the catalogue already in the database, for free. Tying it to searchEnabled
  // deprived of the anti-duplicate safeguard ("Déjà dans ta collection", see below)
  // exactly the custom types - that is, the only ones where
  // NO external deduplication catches the problem afterwards.
  //
  // It now runs UNCONDITIONALLY, and that is what makes this screen
  // the entry to the catalogue. It required a type AND three characters: on
  // arrival, the page was therefore empty, and nowhere in
  // the app was there a view of all the known works - "Ma collection"
  // only shows what we own or wish for (see correspondAuFiltre). With
  // no parameter, the endpoint returns everything; type and title now only
  // RESTRICT.
  const localSearchEnabled = true

  // One query PER category searched, in parallel: only one under a
  // chosen category, one per source under "Tout". Each keeps its cache
  // key (type, title): choosing "Manga" afterwards relaunches nothing.
  const recherches = useQueries({
    queries: typesCherches.map((type) => ({
      queryKey: queryKeys.metadata.search(type.id, debouncedTitle),
      queryFn: ({ signal }: { signal?: AbortSignal }) => searchMetadata(type.id, debouncedTitle, signal),
      enabled: searchEnabled,
    })),
  })
  const groupes = typesCherches.map((type, i) => ({ type, requete: recherches[i] }))
  const groupeManga = groupes.find((g) => g.type.code === 'MANGA')
  const suggestionsManga = groupeManga?.requete.data
  const frenchTitles =
    frenchTitlesFound.suggestions === suggestionsManga && frenchTitlesFound.composition === titleComposition
      ? frenchTitlesFound.titles
      : {}
  const localMatchQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: debouncedTitle, entityTypeId, tagId }),
    queryFn: () => searchEntities({ q: debouncedTitle, entityTypeId, tagId }),
    enabled: localSearchEnabled,
  })
  /**
   * What "Déjà dans IozyCore" is allowed to show.
   *
   * An Entity can exist with nothing linking it to the user: no
   * ownership, no catalogued volume, no wish. Found in the audit - "One Piece"
   * and "One Piece: Strong World" were lying around like this, and presented themselves as
   * already known to IozyCore although opening their page showed nothing.
   *
   * So we keep a page that has AT LEAST one real link: a catalogued volume,
   * an ownership, or a wish. The others stay in the database - we delete
   * nothing behind the user's back - they simply stop
   * presenting themselves as a result.
   */
  const localMatchesBrutes = localMatchQuery.data ?? []
  // A work known to IozyCore is not necessarily owned: a series put
  // on the wishlist without being bought has a page and no ownership. Without this
  // check, this block displayed "Possédé" on EVERY local result -
  // that is, a lie about one's own wishes. One single query for
  // the whole list, never one per result.
  const ownershipsQuery = useQuery({
    queryKey: queryKeys.allOwnerships,
    queryFn: listAllOwnerships,
    enabled: localSearchEnabled,
  })
  const entityIdsPossedes = new Set(
    (ownershipsQuery.data ?? []).filter((o) => o.status === 'OWNED').map((o) => o.entityId),
  )
  const idsEnEnvies = new Set(wishlist.entries.map((e) => e.entityId))
  const localMatches = localMatchesBrutes.filter(
    (entity) => entity.variants.length > 0 || entityIdsPossedes.has(entity.id) || idsEnEnvies.has(entity.id),
  )

  /**
   * The works we ALREADY know to have no volume, flagged in the list.
   *
   * One single query for the whole results page, and above all **no
   * call to a provider**: the backend answers from the durable cache alone
   * of volume searches (see `/metadata/volumes/known-empty`). Really asking
   * the question would cost eight Google Books requests PER work, on
   * a search that relaunches at each keystroke - the quota would not
   * survive it.
   *
   * Accepted consequence, and it is the chosen trade-off: a work never
   * opened is not flagged. The mention appears once its volumes have
   * really been searched and there were none.
   *
   * The (title, author) pair sent is EXACTLY the one the volume search would
   * use - resolved primary title and mangaka - otherwise the
   * cache key would not match and the mention would never show up.
   *
   * <p>Only for a type that is collected BY VOLUME: a video game
   * has no volume, so "no known volume" flags nothing there - it read
   * as something missing (seen on "Hollow Knight"). And it avoids a query
   * that could return nothing.
   */
  const clesInterrogees = (suggestionsManga ?? []).map((candidate) => ({
    title: resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)]),
    author: indicesDe(candidate.attributes).author,
  }))
  const sansTomesQuery = useQuery({
    queryKey: queryKeys.metadata.sansTomes(typeManga?.id ?? '', clesInterrogees.map((c) => c.title).join('|')),
    queryFn: () => seriesSansTomesConnues(typeManga!.id, clesInterrogees),
    enabled: !!typeManga && parTome && clesInterrogees.length > 0,
  })
  const titresSansTomes = new Set((sansTomesQuery.data ?? []).map((s) => s.title.trim().toLowerCase()))

  // Resolves a French title for the first 6 suggestions displayed -
  // see the old QuickAddPage.tsx for the same mechanism and its
  // full reasoning (24h cache on the backend, capped to limit the
  // number of external calls).
  // French titles only concern manga (Jikan/MyAnimeList/AniList
  // do not give them): it is the Manga group that is read, whether it is alone
  // or among the categories searched under "Tout".
  const typeMangaId = typeManga?.id
  useEffect(() => {
    if (!isFrenchEnabled(titleComposition) || !typeMangaId || !suggestionsManga || suggestionsManga.length === 0) {
      return
    }
    const controller = new AbortController()
    suggestionsManga
      .filter((c) => c.source === 'JIKAN' || c.source === 'MYANIMELIST' || c.source === 'ANILIST')
      .slice(0, 6)
      .forEach((candidate) => {
        const { author, malId, titleRomaji } = indicesDe(candidate.attributes)
        fetchFrenchTitle(typeMangaId, candidate.title, { author, malId, titleRomaji, signal: controller.signal })
          .then((frenchTitle) => {
            if (controller.signal.aborted || !frenchTitle) return
            setFrenchTitlesFound((prev) => ({
              suggestions: suggestionsManga,
              composition: titleComposition,
              titles: {
                ...(prev.suggestions === suggestionsManga && prev.composition === titleComposition ? prev.titles : {}),
                [candidateKey(candidate)]: frenchTitle,
              },
            }))
          })
          .catch(() => {})
      })
    return () => controller.abort()
  }, [suggestionsManga, typeMangaId, titleComposition])

  /**
   * Opening a result leads to its PREVIEW - the same page as its detail page, but
   * read from the provider. Nothing is written to the database: browsing is not
   * collecting, and going through results must not fill the
   * catalogue with works we do not want.
   *
   * <p>The title carried by the URL is the PRIMARY title, never the composed
   * label that the list displays (`candidateDisplayTitle` serves to recognise
   * the work, and its documentation already says "never built into the title
   * actually saved"). The add will deduplicate on it.
   */
  function ouvrirApercu(candidate: MetadataCandidateDto, typeId: string) {
    const titre = resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])
    // The candidate travels as a shortcut to avoid a second search on
    // arrival; the URL alone remains master of the identity (see
    // ApercuOeuvrePage). The type is the one of the GROUP where the result was
    // found: under "Tout", it is not the one of the screen.
    navigate(`/apercu?type=${encodeURIComponent(typeId)}&titre=${encodeURIComponent(titre)}`, {
      state: { candidat: candidate, ...retourVersRecherche(search) },
    })
  }

  /** Free entry: no candidate, just a title. Same destination. */
  function ouvrirApercuManuel(titreManuel: string) {
    if (!entityTypeId || !titreManuel.trim()) return
    navigate(`/apercu?type=${encodeURIComponent(entityTypeId)}&titre=${encodeURIComponent(titreManuel.trim())}`, {
      state: retourVersRecherche(search),
    })
  }

  function goToEntity(entity: EntityResponse) {
    navigate(`/entity/${entity.id}`, { state: retourVersRecherche(search) })
  }

  const showSearching = searchEnabled && groupes.some((g) => g.requete.isFetching)
  // A group shows as soon as it has answered with something; the others
  // do not wait for the slowest source.
  const groupesAvecResultats = searchEnabled
    ? groupes.filter((g) => !g.requete.isFetching && g.requete.isSuccess && g.requete.data.length > 0)
    : []
  const groupesEnEchec = searchEnabled ? groupes.filter((g) => !g.requete.isFetching && g.requete.isError) : []
  const showNoResults =
    searchEnabled &&
    groupes.length > 0 &&
    groupes.every((g) => !g.requete.isFetching && g.requete.isSuccess && g.requete.data.length === 0) &&
    localMatches.length === 0
  const requiresMatch = !!selectedType?.hasMetadataProvider
  // The barcode lookup only knows books (Open Library and Google Books answer
  // by ISBN, see MetadataSearchService.lookupByBarcode): offered under "Jeu
  // vidéo", it sent a manga ISBN with the wrong type and answered "Aucune
  // correspondance" to a code that exists.
  const scanPossible = requiresMatch && selectedType?.code === 'MANGA'

  /**
   * The catalog list came back EMPTY, and nothing else will fill the screen.
   *
   * <p>Only once the query has answered for what is typed now: while the
   * title is still settling (debounce) or the query runs, it is "loading",
   * not "nothing". And only when no external search runs: when one does,
   * its own "Aucun résultat pour ce titre" (or its suggestions) speaks.
   */
  const catalogueVide =
    !searchEnabled &&
    debouncedTitle === title &&
    localMatchQuery.isSuccess &&
    !localMatchQuery.isFetching &&
    localMatches.length === 0
  const titreCherche = debouncedTitle.trim() !== ''
  const messageCatalogueVide = titreCherche
    ? 'Aucune œuvre ne correspond à cette recherche.'
    : tagId
      ? 'Aucune œuvre ne correspond à ces filtres.'
      : selectedType
        ? 'Aucune œuvre de ce type dans le catalogue.'
        : 'Le catalogue est encore vide.'

  return (
    <div className="flex flex-col gap-5">
      {/* "Catalogue" and no longer "Rechercher": the screen no longer starts from an
          empty page that typing fills, it SHOWS the works the
          instance knows right away, and typing only restricts. It stays the
          only entry point to add (see §24 of the brief) - searching at
          a provider has become the second half of the screen, not its
          reason for being. */}
      <EnTeteSection niveau={1} titre="Catalogue" />

      {/* Scanning stays here: it is the same intention as searching, entered
          differently. "Analyser une annonce" left it - it is an
          independent flow, which now has its own navigation entry (product
          study of 2026-08-27, §4).

          The BGG import joined them on 2026-08-29. It lived under
          Administration, which never made sense: getting one's games
          from BoardGameGeek is ADDING to one's collection - the same
          intention as typing a title or scanning a barcode, with a
          third source. Nothing administrative there.

          The import from a photo of the shelf (batch 147) is the fourth:
          the original mockup already planned "photo" among the ways
          to add, the reading engine existed for listings, only the door
          was missing. */}
      {/* Both lead to ADD screens, closed to a visitor (see
          lib/accesInvite): offering them would have sent them back here without a word,
          which reads as a breakdown. It is the general rule of this
          visit - we do not show a door that bounces. */}
      {!estInvite && (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/scan"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
          >
            <ScanLine size={16} />
            Scanner
          </Link>
          <Link
            to="/import-bgg"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
          >
            <Upload size={16} />
            Importer depuis BGG
          </Link>
          <Link
            to="/import-photo"
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
          >
            <Camera size={16} />
            Importer depuis une photo
          </Link>
        </div>
      )}

      {entityTypesQuery.isLoading && <p className="text-sm text-textDim">Chargement des types...</p>}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

      <div className="flex flex-wrap gap-2">
        {/* "Tout" first, and it did not exist: the chips only served to
            frame a search at a provider, which is queried type by
            type. They now also filter the catalogue displayed, and without
            this entry there was no way to see it in full. */}
        <Chip label="Tout" isActive={!entityTypeId} onClick={() => choisirType(undefined)} />
        {(entityTypesQuery.data ?? []).map((type) => (
          <Chip key={type.id} label={type.label} isActive={entityTypeId === type.id} onClick={() => choisirType(type.id)} />
        ))}
      </div>

      {/* The tags, only if there are any: an empty row would be the filter
          that never filters anything. A click sets the tag, a second removes it;
          it combines with the type and the title, and it also applies to a visitor
          - tags describe works, not a collection. */}
      {tags.length > 0 && (
        <div role="group" aria-label="Filtrer par tag" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Tag</span>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              label={tag.label}
              isActive={tagId === tag.id}
              onClick={() => setTagId(tagId === tag.id ? undefined : tag.id)}
            />
          ))}
        </div>
      )}

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
          className="champ"
        />
      </div>

      {/* A silence that read as a breakdown: under three characters, the
          external search is cut off (quota), and the screen filtered the
          catalogue without a word about what it was NOT doing. Under "Tout",
          it no longer is (batch 145): all the sources are queried. */}
      {!estInvite && typesCherches.length > 0 && title.trim().length > 0 && title.trim().length < 3 && (
        <p className="text-xs text-textDim">Trois caractères au moins pour chercher chez une source externe.</p>
      )}

      {/* Type with no metadata provider (custom): nothing to
          search, direct entry to the selection screen. Announced BEFORE the
          typing - otherwise the screen looks like a search that would
          never find anything. */}
      {!requiresMatch && entityTypeId && title.trim().length === 0 && (
        <p className="text-xs text-textDim">
          Ce type n'a pas de source externe : saisis le titre, il sera ajouté tel quel.
        </p>
      )}
      {/* Scan only under Manga: the barcode lookup goes through the book
          sources (see MetadataSearchService.lookupByBarcode), it cannot find
          a game, nor anything for a type with no provider. */}
      {!scanPossible ? null : showBarcodeLookup ? (
        <BarcodeLookupField entityTypeId={entityTypeId ?? ''} onFound={(candidate) => ouvrirApercu(candidate, entityTypeId ?? '')} />
      ) : (
        (
          <button
            type="button"
            onClick={() => setShowBarcodeLookup(true)}
            className="flex min-h-11 w-fit items-center gap-1.5 text-xs text-textDim underline"
          >
            <ScanBarcode size={13} />
            Scanner un code-barres / ISBN
          </button>
        )
      )}

      {/* Personal state BEFORE the metadata (see §24/§420 of the brief): the
          owned collection comes as the first group, always visible before
          the external suggestions. */}
      {localMatches.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* With no title typed, this list IS the catalogue - announcing it
              "Déjà dans IozyCore" would only make sense against external
              suggestions, which only appear once we
              search for something. */}
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">
            {debouncedTitle.trim() ? 'Déjà dans IozyCore' : 'Le catalogue'}
          </span>
          <div className="flex flex-col gap-1.5">
            {localMatches.map((entity) => {
              const possede = entityIdsPossedes.has(entity.id)
              return (
                <div
                  key={entity.id}
                  className="ligne-differee flex items-center gap-2.5 rounded-xl bg-surface px-2.5 py-1 transition-transform hover:-translate-y-0.5"
                >
                  {/* The button takes the full height of the row (44 px at least):
                      it only measured its line of text, 24 px, and the rest of the
                      card did not respond to a finger. The title can take two
                      lines rather than being cut at ten characters on a phone -
                      it is what tells one row from its neighbour. */}
                  <button type="button" onClick={() => goToEntity(entity)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1 text-left">
                    <TexteCoupe texte={entity.title} className="line-clamp-2 flex-1 text-sm font-medium text-textPrimary" />
                    {/* Two clearly distinct states: owned, or only
                        known (existing page with no copy - typical
                        of a work put on the wishlist). */}
                    {/* None of this for a visitor: they own
                        nothing, and these two badges would speak of
                        someone else's collection - or, worse, of their
                        own, which does not exist. */}
                    {estInvite ? null : possede ? (
                      <span className="shrink-0 rounded-full bg-accentTint px-2.5 py-1 text-xs font-semibold text-accentText">
                        Possédé
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-surface2 px-2.5 py-1 text-xs font-semibold text-textDim">
                        Pas encore possédé
                      </span>
                    )}
                  </button>
                  {/* No heart on what we already own: wanting a game we have
                      makes no sense, and the "Possédé" badge already says it all. */}
                  {!estInvite && !possede && (
                    <WishlistToggle entityId={entity.id} entityTypeId={entity.entityTypeId} variant="inline" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {catalogueVide && (
        <EtatVide
          compact
          icone={SearchX}
          titre={messageCatalogueVide}
          detail={titreCherche ? "Vérifie l'orthographe, ou essaie un autre mot du titre." : undefined}
        />
      )}

      {/* After "Déjà dans ta collection", never before: on a type with no
          provider, this button is the ONLY way to add - placing it
          first amounted to offering to create a duplicate before even having
          shown that the work already exists. */}
      {!estInvite && !requiresMatch && title.trim().length > 0 && entityTypeId && (
        <button
          type="button"
          onClick={() => ouvrirApercuManuel(title)}
          className="btn-primaire w-fit"
        >
          Ajouter « {title.trim()} »
        </button>
      )}

      {showSearching && (
        <p className="flex items-center gap-1.5 text-xs text-textDim">
          <Loader2 size={12} className="animate-spin" />
          Recherche...
        </p>
      )}
      {groupesEnEchec.map((g) => (
        <p key={g.type.id} className="text-xs text-textDim">
          La recherche de métadonnées a échoué{typesCherches.length > 1 ? ` pour ${g.type.label}` : ''}.
        </p>
      ))}
      {showNoResults && (
        <EtatVide
          compact
          icone={SearchX}
          titre="Aucun résultat pour ce titre."
          detail="Vérifie l'orthographe, ou essaie un autre mot du titre."
        />
      )}

      {groupesAvecResultats.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Suggestions</span>
            {/* The setting that decides THESE titles, next to them.
                "Ordre des langues de titre" lived in Settings, with no
                link from the screen it governs (§16 of the journeys):
                we saw a title in romaji without knowing it was a choice,
                still less where to change it. The link does not say "Paramètres",
                it says what we are going to set there. */}
            <Link
              to="/profile"
              // The setting lives in "Cet appareil", at the bottom of Profil (batch
              // 140): we go there directly, not to the top of a page to
              // scroll.
              state={{ focusAppareil: true }}
              className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accentText"
            >
              <Languages size={13} />
              Langue des titres
            </Link>
          </div>
          {/* One group per category searched, named only when there are
              several: under "Manga", the word would repeat the chip. */}
          {groupesAvecResultats.map(({ type, requete }) => (
            <section key={type.id} aria-label={type.label} className="flex flex-col gap-1.5">
              {typesCherches.length > 1 && (
                <h2 className="text-xs font-medium text-textDim">{type.label}</h2>
              )}
              <ul className="flex flex-col gap-1.5">
                {requete.data!.map((candidate) => (
                  <li key={candidateKey(candidate)} className="ligne-differee flex items-center gap-2.5 rounded-xl bg-surface p-2.5 transition-transform hover:-translate-y-0.5">
                    <button
                      type="button"
                      onClick={() => ouvrirApercu(candidate, type.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <Jaquette
                        src={candidate.imageUrl}
                        className="h-16 w-11 shrink-0 rounded object-cover"
                        repli={<span className="h-16 w-11 shrink-0 rounded bg-surface2" />}
                      />
                      <div className="flex min-w-0 flex-col">
                        <TexteCoupe
                          as="div"
                          texte={candidateDisplayTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])}
                          className="line-clamp-2 text-sm font-medium text-textPrimary"
                        />
                        <div className="text-xs text-textDim">{candidateSubtitle(candidate)}</div>
                        {/* Flagged, never hidden: the work can still be added by
                            hand from its preview (see AddVolumeSection). The
                            mention only avoids arriving there expecting
                            a list of volumes. Only applies to manga. */}
                        {type.code === 'MANGA' &&
                          titresSansTomes.has(
                            resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])
                              .trim()
                              .toLowerCase(),
                          ) && (
                            <div className="mt-0.5 text-xs text-faint">Aucun tome connu — à saisir à la main</div>
                          )}
                      </div>
                    </button>
                    {/* Two possible outcomes for a work found: "I
                        buy it" (the click, which leads to entering the owned
                        volumes) and "I want it" - the second did not exist,
                        for lack of a way to reference a work without owning it. The
                        backend creates its catalogue page, with no ownership. */}
                    <WishlistToggle
                      variant="inline"
                      entityTypeId={type.id}
                      external={{
                        entityTypeId: type.id,
                        // The PRIMARY title, not the displayed one: the row shows
                        // "Titre (Autre titre)" to help recognise the work,
                        // but deduplication relies on the title alone
                        // on the backend. Sending the composed label created a
                        // second page for the same work as soon as another path
                        // (opening the detail page, quick add) used the bare title.
                        title: resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)]),
                        // Same rule as everywhere else: the
                        // candidate's cover is persisted under the shared
                        // key, otherwise the work would appear with no image
                        // in the Wishlist and in the shared list.
                        attributes: candidate.imageUrl
                          ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl }
                          : candidate.attributes,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
