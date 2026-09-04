import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Languages, Loader2, ScanBarcode, ScanLine, Upload } from 'lucide-react'
import { fetchFrenchTitle, searchMetadata, seriesSansTomesConnues } from '../../api/metadata'
import { searchEntities } from '../../api/entities'
import { useAuth } from '../../lib/useAuth'
import { listAllOwnerships } from '../../api/ownerships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { Chip } from '../../components/Chip'
import { WishlistToggle } from '../../components/WishlistToggle'
import { useWishlist } from '../../lib/useWishlist'
import { useCollecteParTome } from '../../lib/typeDeCollection'
import { ErrorBanner } from '../../components/ErrorBanner'
import { isFrenchEnabled, useTitleComposition, candidateDisplayTitle, resolvePrimaryTitle } from '../../lib/titleLanguage'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import { BarcodeLookupField } from './BarcodeLookupField'
import type { EntityResponse, MetadataCandidateDto } from '../../types/api'
import { TexteCoupe } from '../../components/TexteCoupe'
import { Jaquette } from '../../components/Jaquette'
import { EnTeteSection } from '../../components/EnTeteSection'
import type { EtatRetour } from '../../lib/retour'
import { indicesDe } from '../../lib/indicesOeuvre'

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
 * voir AddVolumeSection) plutôt que de repasser par ce formulaire.
 */
/**
 * Toute fiche ou tout aperçu ouvert depuis cet écran propose d'y revenir (voir
 * retourFiche) - et y revenir doit RETROUVER la recherche, pas une page vide.
 *
 * D'où l'URL complète, `search` compris : c'est elle qui porte le type et le
 * titre cherchés, donc c'est elle qu'il faut rouvrir. Une constante `/add`
 * ramenait bien à l'écran, mais vidé de ce qu'on y avait tapé.
 */
function retourVersRecherche(search: string): EtatRetour {
  return { retour: { to: `/add${search}`, libelle: 'Recherche' } }
}

export function SearchPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const titleComposition = useTitleComposition()
  const wishlist = useWishlist()
  // Un visiteur consulte le catalogue et rien d'autre : ni sources externes
  // (elles servent à AJOUTER, et sortent chez un fournisseur), ni état
  // personnel - il ne possède rien, et « Pas encore possédé » sur chaque ligne
  // serait un bruit qui parle de quelqu'un d'autre.
  const { estInvite } = useAuth()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  /**
   * Le type et le titre cherchés vivent dans l'URL.
   *
   * <h2>Pourquoi pas un simple `useState`</h2>
   * Parce qu'un état local meurt avec le composant : ouvrir un résultat puis
   * revenir rendait une page vierge, la recherche perdue. L'URL, elle, survit
   * à l'aller-retour, au F5 et au partage - c'est la règle que ce dépôt s'est
   * déjà donnée au Lot 31 (« quand un écran mérite d'être revu ou envoyé, lui
   * donner une vraie URL »), simplement pas encore appliquée ici.
   *
   * <p>La frappe reste dans un état local : l'URL ne suit qu'après la même
   * temporisation que la requête (voir plus bas), et en `replace` - sinon
   * chaque lettre laisserait une entrée dans l'historique et le bouton
   * Précédent remonterait le mot caractère par caractère.
   */
  const [parametres, setParametres] = useSearchParams()
  const [entityTypeId, setEntityTypeId] = useState<string | undefined>(parametres.get('type') ?? undefined)
  const [title, setTitle] = useState(parametres.get('q') ?? '')
  const [showBarcodeLookup, setShowBarcodeLookup] = useState(false)
  const [frenchTitles, setFrenchTitles] = useState<Record<string, string>>({})

  // La présélection sert le parcours d'AJOUT : les fournisseurs ne
  // s'interrogent que type par type, et arriver sans type choisi aurait
  // demandé un clic avant la première recherche. Elle ne s'applique donc pas à
  // un visiteur, qui ne vient pas ajouter mais REGARDER - et à qui elle
  // masquerait tout le reste du catalogue derrière un type pris au hasard.
  //
  // Elle ne s'applique qu'à l'ARRIVÉE, une seule fois. Elle se rejouait à
  // chaque fois que le type redevenait vide - c'est-à-dire à chaque clic sur
  // « Tout », aussitôt annulé : pour un compte connecté, la puce « Tout »
  // n'a jamais pu rester sélectionnée depuis qu'elle existe (Lot 116).
  const [preselectionFaite, setPreselectionFaite] = useState(parametres.has('type'))
  useEffect(() => {
    if (preselectionFaite) return
    if (!estInvite && !entityTypeId && entityTypesQuery.data && entityTypesQuery.data.length > 0) {
      setEntityTypeId(entityTypesQuery.data[0].id)
      setPreselectionFaite(true)
    }
  }, [preselectionFaite, estInvite, entityTypeId, entityTypesQuery.data])
  function choisirType(id: string | undefined) {
    setPreselectionFaite(true)
    setEntityTypeId(id)
  }

  const selectedType = entityTypesQuery.data?.find((t) => t.id === entityTypeId)
  const parTome = useCollecteParTome(entityTypeId)
  const debouncedTitle = useDebouncedValue(title, 500)

  // L'URL suit la recherche RÉELLEMENT lancée, pas la frappe : même
  // temporisation que la requête, et `replace` pour ne pas empiler une entrée
  // d'historique par lettre.
  useEffect(() => {
    const voulu = new URLSearchParams()
    if (entityTypeId) voulu.set('type', entityTypeId)
    if (debouncedTitle.trim()) voulu.set('q', debouncedTitle.trim())
    if (voulu.toString() !== parametres.toString()) setParametres(voulu, { replace: true })
  }, [entityTypeId, debouncedTitle, parametres, setParametres])
  // Un type sans fournisseur de métadonnées (type personnalisé créé depuis
  // Administration) n'a AUCUNE source externe : ni recherche, ni scan - voir
  // requiresMatch et EntityTypeDto.hasMetadataProvider. Sans ce garde, l'écran
  // lançait une recherche vouée à ne rien trouver, puis affichait "Aucun
  // résultat pour ce titre" - un échec annoncé là où il n'y avait tout
  // simplement rien à chercher.
  const searchEnabled =
    !estInvite && !!entityTypeId && !!selectedType?.hasMetadataProvider && debouncedTitle.trim().length >= 3
  // La recherche LOCALE, elle, ne dépend d'aucun fournisseur : elle interroge
  // le catalogue déjà en base, gratuitement. La brancher sur searchEnabled
  // privait du garde-fou anti-doublon ("Déjà dans ta collection", voir plus
  // bas) exactement les types personnalisés - c'est-à-dire les seuls où
  // AUCUNE déduplication externe ne rattrape le coup derrière.
  //
  // Elle tourne désormais SANS CONDITION, et c'est ce qui fait de cet écran
  // l'entrée du catalogue. Elle exigeait un type ET trois caractères : à
  // l'arrivée, la page était donc vide, et il n'existait nulle part dans
  // l'application de vue sur l'ensemble des œuvres connues - « Ma collection »
  // ne montre que ce qu'on possède ou souhaite (voir correspondAuFiltre). Sans
  // aucun paramètre, l'endpoint rend tout ; type et titre ne font plus que
  // RESTREINDRE.
  const localSearchEnabled = true

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.metadata.search(entityTypeId ?? '', debouncedTitle),
    queryFn: ({ signal }) => searchMetadata(entityTypeId!, debouncedTitle, signal),
    enabled: searchEnabled,
  })
  const localMatchQuery = useQuery({
    queryKey: queryKeys.entities.search({ q: debouncedTitle, entityTypeId }),
    queryFn: () => searchEntities({ q: debouncedTitle, entityTypeId }),
    enabled: localSearchEnabled,
  })
  /**
   * Ce que « Déjà dans IozyCore » a le droit de montrer.
   *
   * Une Entity peut exister sans que rien ne la rattache à l'utilisateur : ni
   * possession, ni tome catalogué, ni envie. Relevé à l'audit - « One Piece »
   * et « One Piece: Strong World » traînaient ainsi, et s'annonçaient comme
   * déjà connues d'IozyCore alors qu'ouvrir leur fiche ne montrait rien.
   *
   * On garde donc une fiche qui a AU MOINS un lien réel : un tome catalogué,
   * une possession, ou une envie. Les autres restent en base - on ne supprime
   * rien dans le dos de l'utilisateur - elles cessent simplement de se
   * présenter comme un résultat.
   */
  const localMatchesBrutes = localMatchQuery.data ?? []
  // Une œuvre connue d'IozyCore n'est pas forcément possédée : une série mise
  // en envies sans être achetée a une fiche et aucune possession. Sans cette
  // vérification, ce bloc affichait « Possédé » sur TOUT résultat local -
  // c'est-à-dire un mensonge sur ses propres envies. Une seule requête pour
  // toute la liste, jamais une par résultat.
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
   * Les œuvres qu'on sait DÉJÀ sans aucun tome, signalées dans la liste.
   *
   * Une seule requête pour toute la page de résultats, et surtout **aucun
   * appel à un fournisseur** : le backend répond depuis le seul cache durable
   * des recherches de tomes (voir `/metadata/volumes/known-empty`). Poser
   * vraiment la question coûterait huit requêtes Google Books PAR œuvre, sur
   * une recherche qui se relance à chaque frappe - le quota n'y survivrait
   * pas.
   *
   * Conséquence assumée, et c'est le compromis choisi : une œuvre jamais
   * ouverte n'est pas signalée. La mention apparaît une fois qu'on a
   * réellement cherché ses tomes et qu'il n'y en avait aucun.
   *
   * Le couple (titre, auteur) envoyé est EXACTEMENT celui que la recherche de
   * tomes utiliserait - titre primaire résolu et mangaka - sans quoi la clé de
   * cache ne correspondrait pas et la mention ne sortirait jamais.
   *
   * <p>Uniquement pour un type qui se collectionne PAR TOME : un jeu vidéo
   * n'a pas de tome, donc « aucun tome connu » n'y signale rien - ça se lisait
   * comme un manque (constaté sur « Hollow Knight »). Et ça évite une requête
   * qui ne pouvait rien rendre.
   */
  const clesInterrogees = (suggestionsQuery.data ?? []).map((candidate) => ({
    title: resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)]),
    author: indicesDe(candidate.attributes).author,
  }))
  const sansTomesQuery = useQuery({
    queryKey: queryKeys.metadata.sansTomes(entityTypeId ?? '', clesInterrogees.map((c) => c.title).join('|')),
    queryFn: () => seriesSansTomesConnues(entityTypeId!, clesInterrogees),
    enabled: !!entityTypeId && parTome && clesInterrogees.length > 0,
  })
  const titresSansTomes = new Set((sansTomesQuery.data ?? []).map((s) => s.title.trim().toLowerCase()))

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
        const { author, malId, titleRomaji } = indicesDe(candidate.attributes)
        fetchFrenchTitle(entityTypeId, candidate.title, { author, malId, titleRomaji, signal: controller.signal })
          .then((frenchTitle) => {
            if (controller.signal.aborted || !frenchTitle) return
            setFrenchTitles((prev) => ({ ...prev, [candidateKey(candidate)]: frenchTitle }))
          })
          .catch(() => {})
      })
    return () => controller.abort()
  }, [suggestionsQuery.data, entityTypeId, titleComposition])

  /**
   * Ouvrir un résultat mène à son APERÇU - la même page que sa fiche, mais
   * lue chez le fournisseur. Rien n'est écrit en base : consulter n'est pas
   * collectionner, et parcourir des résultats ne doit pas remplir le
   * catalogue d'œuvres qu'on ne veut pas.
   *
   * <p>Le titre porté par l'URL est le titre PRIMAIRE, jamais le libellé
   * composé qu'affiche la liste (`candidateDisplayTitle` sert à reconnaître
   * l'œuvre, et sa documentation dit déjà « jamais intégré au titre
   * réellement sauvegardé »). C'est sur lui que l'ajout dédupliquera.
   */
  function ouvrirApercu(candidate: MetadataCandidateDto) {
    if (!entityTypeId) return
    const titre = resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])
    // Le candidat voyage en raccourci pour éviter une seconde recherche à
    // l'arrivée ; l'URL reste seule maîtresse de l'identité (voir
    // ApercuOeuvrePage).
    navigate(`/apercu?type=${encodeURIComponent(entityTypeId)}&titre=${encodeURIComponent(titre)}`, {
      state: { candidat: candidate, ...retourVersRecherche(search) },
    })
  }

  /** Saisie libre : aucun candidat, juste un titre. Même destination. */
  function ouvrirApercuManuel(titreManuel: string) {
    if (!entityTypeId || !titreManuel.trim()) return
    navigate(`/apercu?type=${encodeURIComponent(entityTypeId)}&titre=${encodeURIComponent(titreManuel.trim())}`, {
      state: retourVersRecherche(search),
    })
  }

  function goToEntity(entity: EntityResponse) {
    navigate(`/entity/${entity.id}`, { state: retourVersRecherche(search) })
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
  const requiresMatch = !!selectedType?.hasMetadataProvider

  return (
    <div className="flex flex-col gap-5">
      {/* « Catalogue » et non plus « Rechercher » : l'écran ne part plus d'une
          page vide qu'une saisie remplit, il MONTRE d'emblée les œuvres que
          l'instance connaît, et la saisie ne fait que restreindre. Il reste le
          seul point d'entrée pour ajouter (voir §24 du brief) - chercher chez
          un fournisseur est devenu la seconde moitié de l'écran, pas sa
          raison d'être. */}
      <EnTeteSection niveau={1} titre="Catalogue" />

      {/* Scanner reste ici : c'est la même intention que la recherche, saisie
          autrement. « Analyser une annonce » en est parti - c'est un parcours
          indépendant, qui a désormais sa propre entrée de navigation (étude
          produit du 2026-08-27, §4).

          L'import BGG les a rejoints le 2026-08-29. Il vivait sous
          Administration, ce qui n'a jamais eu de sens : récupérer ses jeux
          depuis BoardGameGeek, c'est AJOUTER à sa collection - la même
          intention que taper un titre ou scanner un code-barres, avec une
          troisième source. Rien d'administratif là-dedans. */}
      {/* Les deux mènent à des écrans d'AJOUT, fermés à un visiteur (voir
          lib/accesInvite) : les lui proposer l'aurait renvoyé ici sans un mot,
          ce qui se lit comme une panne. C'est la règle générale de cette
          visite - on ne montre pas une porte qui rebondit. */}
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
        </div>
      )}

      {entityTypesQuery.isLoading && <p className="text-sm text-textDim">Chargement des types...</p>}
      {entityTypesQuery.isError && <ErrorBanner message={entityTypesQuery.error.message} />}

      <div className="flex flex-wrap gap-2">
        {/* « Tout » d'abord, et il n'existait pas : les puces ne servaient qu'à
            cadrer une recherche chez un fournisseur, qui s'interroge type par
            type. Elles filtrent maintenant aussi le catalogue affiché, et sans
            cette entrée il n'y avait aucun moyen de le voir en entier. */}
        <Chip label="Tout" isActive={!entityTypeId} onClick={() => choisirType(undefined)} />
        {(entityTypesQuery.data ?? []).map((type) => (
          <Chip key={type.id} label={type.label} isActive={entityTypeId === type.id} onClick={() => choisirType(type.id)} />
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

      {/* Deux silences qui se lisaient comme des pannes. Sous « Tout », la
          recherche externe est coupée (un fournisseur s'interroge type par
          type) ; sous trois caractères, elle l'est aussi (quota). Dans les
          deux cas l'écran filtrait le catalogue sans un mot sur ce qu'il ne
          faisait PAS - et « Naruto » tapé sous « Tout » ne proposait rien à
          ajouter, sans dire pourquoi. */}
      {!estInvite && title.trim().length > 0 && !entityTypeId && (
        <p className="text-xs text-textDim">
          Seul le catalogue est parcouru : choisis une catégorie pour chercher aussi chez une source externe.
        </p>
      )}
      {!estInvite && requiresMatch && title.trim().length > 0 && title.trim().length < 3 && (
        <p className="text-xs text-textDim">Trois caractères au moins pour chercher chez une source externe.</p>
      )}

      {/* Type sans fournisseur de métadonnées (personnalisé) : rien à
          chercher, saisie directe vers l'écran de sélection. Annoncé AVANT la
          saisie - sinon l'écran ressemble à une recherche qui ne trouverait
          jamais rien. */}
      {!requiresMatch && entityTypeId && title.trim().length === 0 && (
        <p className="text-xs text-textDim">
          Ce type n'a pas de source externe : saisis le titre, il sera ajouté tel quel.
        </p>
      )}
      {/* Scan masqué pour un type sans fournisseur : le lookup par code-barres
          passe par les mêmes sources externes que la recherche (voir
          MetadataSearchService.lookupByBarcode), il ne peut rien trouver ici. */}
      {!requiresMatch ? null : showBarcodeLookup ? (
        <BarcodeLookupField entityTypeId={entityTypeId ?? ''} onFound={ouvrirApercu} />
      ) : (
        entityTypeId && (
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

      {/* État personnel AVANT les métadonnées (voir §24/§420 du brief) : la
          collection possédée passe en premier groupe, toujours visible avant
          les suggestions externes. */}
      {localMatches.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Sans titre saisi, cette liste EST le catalogue - l'annoncer
              « Déjà dans IozyCore » n'aurait de sens que face à des
              suggestions externes, qui n'apparaissent qu'une fois qu'on
              cherche quelque chose. */}
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">
            {debouncedTitle.trim() ? 'Déjà dans IozyCore' : 'Le catalogue'}
          </span>
          <div className="flex flex-col gap-1.5">
            {localMatches.map((entity) => {
              const possede = entityIdsPossedes.has(entity.id)
              return (
                <div
                  key={entity.id}
                  className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 transition-transform hover:-translate-y-0.5"
                >
                  <button type="button" onClick={() => goToEntity(entity)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                    <TexteCoupe texte={entity.title} className="flex-1 truncate text-sm font-medium text-textPrimary" />
                    {/* Deux états bien distincts : possédée, ou seulement
                        connue (fiche existante sans aucun exemplaire - typique
                        d'une œuvre mise en envies). */}
                    {/* Rien de tout cela pour un visiteur : il ne possède
                        rien, et ces deux pastilles parleraient de la
                        collection de quelqu'un d'autre - ou, pire, de la
                        sienne, qui n'existe pas. */}
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
                  {!estInvite && (
                    <WishlistToggle entityId={entity.id} entityTypeId={entity.entityTypeId} variant="inline" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Après "Déjà dans ta collection", jamais avant : sur un type sans
          fournisseur, ce bouton est le SEUL chemin d'ajout - le placer en
          premier revenait à proposer de créer un doublon avant même d'avoir
          montré que l'œuvre existe déjà. */}
      {!estInvite && !requiresMatch && title.trim().length > 0 && entityTypeId && (
        <button
          type="button"
          onClick={() => ouvrirApercuManuel(title)}
          className="flex w-fit items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk"
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
      {showSearchError && <p className="text-xs text-textDim">La recherche de métadonnées a échoué.</p>}
      {showNoResults && <p className="text-xs text-textDim">Aucun résultat pour ce titre.</p>}

      {showSuggestions && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Suggestions</span>
            {/* Le réglage qui décide de CES titres, à côté d'eux.
                « Ordre des langues de titre » vivait dans Paramètres, sans
                aucun lien depuis l'écran qu'il gouverne (§16 des parcours) :
                on voyait un titre en romaji sans savoir que c'était un choix,
                encore moins où le changer. Le lien ne dit pas « Paramètres »,
                il dit ce qu'on va y régler. */}
            <Link
              to="/settings"
              state={{ retour: { to: '/add', libelle: 'Rechercher' } }}
              className="flex min-h-11 items-center gap-1.5 text-xs font-semibold text-accentText"
            >
              <Languages size={13} />
              Langue des titres
            </Link>
          </div>
          <ul className="flex flex-col gap-1.5">
            {suggestionsQuery.data!.map((candidate) => (
              <li key={candidateKey(candidate)} className="flex items-center gap-2.5 rounded-xl bg-surface p-2.5 transition-transform hover:-translate-y-0.5">
                <button
                  type="button"
                  onClick={() => ouvrirApercu(candidate)}
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
                      className="truncate text-sm font-medium text-textPrimary"
                    />
                    <div className="text-xs text-textDim">{candidateSubtitle(candidate)}</div>
                    {/* Signalé, jamais masqué : l'œuvre reste ajoutable à la
                        main depuis son aperçu (voir AddVolumeSection). La
                        mention évite seulement d'y arriver en s'attendant à
                        une liste de tomes. */}
                    {titresSansTomes.has(
                      resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)])
                        .trim()
                        .toLowerCase(),
                    ) && (
                      <div className="mt-0.5 text-xs text-faint">Aucun tome connu — à saisir à la main</div>
                    )}
                  </div>
                </button>
                {/* Deux issues possibles pour une œuvre trouvée : « je
                    l'achète » (le clic, qui mène à la saisie des tomes
                    possédés) et « je la veux » - la seconde n'existait pas,
                    faute de pouvoir référencer une œuvre sans la posséder. Le
                    backend crée sa fiche catalogue, sans aucune possession. */}
                <WishlistToggle
                  variant="inline"
                  entityTypeId={entityTypeId!}
                  external={{
                    entityTypeId: entityTypeId!,
                    // Le titre PRIMAIRE, pas celui affiché : la ligne montre
                    // « Titre (Autre titre) » pour aider à reconnaître l'œuvre,
                    // mais c'est sur le titre seul que porte la déduplication
                    // côté backend. Envoyer le libellé composé créait une
                    // seconde fiche pour la même œuvre dès qu'un autre chemin
                    // (ouvrir la fiche, ajout rapide) utilisait le titre nu.
                    title: resolvePrimaryTitle(candidate, titleComposition, frenchTitles[candidateKey(candidate)]),
                    // Même règle que partout ailleurs : la
                    // jaquette du candidat est persistée sous la clé
                    // partagée, sans quoi l'œuvre apparaîtrait sans visuel
                    // dans les Envies et dans la liste partagée.
                    attributes: candidate.imageUrl
                      ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl }
                      : candidate.attributes,
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
