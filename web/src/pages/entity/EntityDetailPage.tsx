import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { getEntity, mergeEntityAttributes, mergeVariantAttributes, quickAdd, renameEntity } from '@/common/api/entities'
import { deleteOwnership, listOwnerships } from '@/common/api/ownerships'
import { rechercherOeuvrePossedee, searchVolumes } from '@/common/api/metadata'
import { findBestCoverMatch, rattraperJaquettes, variantsMissingCover } from '@/common/lib/backfillCovers'
import { listExperiences } from '@/common/api/experiences'
import { listTags } from '@/common/api/tags'
import { relationshipsFrom, relationshipsTo } from '@/common/api/relationships'
import { listEntityTypes } from '@/common/api/entityTypes'
import { getEntityProgress } from '@/common/api/insights'
import { findEdition } from '@/common/api/purchaseAnalysis'
import { getEntityTierSummary } from '@/common/api/tierLists'
import { followEdition, listFollowedEdition, unfollowEdition } from '@/common/api/followedEdition'
import { isSeriesOngoing } from './seriesInfo'
import { queryKeys } from '@/common/lib/queryKeys'
import { indicesDe } from '@/common/lib/indicesOeuvre'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { useWishlist } from '@/common/hooks/useWishlist'
import { useOeuvresSuivies } from '@/common/hooks/useOeuvresSuivies'
import { gradientFor } from '@/common/theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '@/common/lib/coverImage'
import { creatorFrom } from './creatorInfo'
import { libelleExperienceType, libelleSectionExperiences } from '@/common/lib/experiences'
import { buildTiles } from './tomeTiles'
import { numeroDe, variantLabel } from '@/common/lib/attributsTome'
import type { OwnershipResponse } from '@/common/types/api'
import { attributsARecharger, candidatCorrespondant } from './rechargerSource'
import { usePropositionTomes } from './usePropositionTomes'
import { useTeinteJaquette } from './useTeinteJaquette'
import { CLASSE_BANDE_PLEINE_LARGEUR, CLASSE_CONTENU_BANDE } from '@/common/components/layout/AppShell'
import { TierBadge } from '@/common/components/TierBadge'
import { BoutonEnviesHero, BoutonSuivreHero, FicheHero } from './FicheHero'
import { CartesEditions, type EditionAffichee } from './CartesEditions'
import { GrilleTomes, type FiltreTomes } from './GrilleTomes'
import { ChampInspecteur, ColonneSource, InspecteurFiche, RangeeDateDeSortie, RangeeInspecteur, ReleveInspecteur } from './InspecteurFiche'
import { RELEASE_DATE_ATTRIBUTE_KEY } from '@/common/lib/releaseDate'
import { CLES_SOURCE, libelleDe, useBrouillonInspecteur } from './useBrouillonInspecteur'
import { AideFlottante } from './AideFlottante'
import { ReponseAssistant, type QuestionAssistant } from './AssistantSection'
import { useAuth } from '@/common/hooks/useAuth'
import { AddVolumeSection } from './AddVolumeSection'
import { TierSummarySection } from './TierSummarySection'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import { Carte } from '@/common/components/Carte'
import { retourDepuis } from '@/common/lib/retour'
import { useToast } from '@/common/lib/toast'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { invaliderApresPossession } from '@/common/lib/invalidations'

/**
 * La fiche d'une œuvre, d'après la maquette « Fiche série - multi-éditions ».
 *
 * <h2>La page tient en trois bandes</h2>
 * Une bande haute teintée par la jaquette (identité + rangée des éditions),
 * la grille dense des tomes de l'édition affichée, et un inspecteur à trois
 * colonnes (personnel / œuvre / source). Plus d'onglets : tout est là, et
 * c'est la structure de la page qui fait le tri.
 *
 * <h2>Lire, puis modifier</h2>
 * Le bouton pinceau de la maquette bascule toute la fiche entre deux états.
 * Au repos elle se LIT : des relevés compacts, aucun formulaire, aucun « + »
 * qui traîne. En mode édition apparaissent les points d'ajout (suivre une
 * édition, ajouter un tome) et, sous l'inspecteur, les éditeurs complets déjà
 * construits (classements, expériences, tags, informations, relations,
 * suppression). Aucun de ces éditeurs n'a été réécrit pour cette maquette -
 * ils changent de moment d'apparition, pas de comportement.
 *
 * <h2>Afficher une édition n'est pas la suivre</h2>
 * Deux choses distinctes, longtemps confondues dans un seul `useState` :
 * l'édition AFFICHÉE est un état d'écran, l'édition SUIVIE est une donnée
 * persistée (voir com.iozycore.domain.followededition). C'est elle qui décide
 * de ce qu'on ouvre à la prochaine visite.
 */
/** Des valeurs par défaut à identité STABLE : passées au brouillon de
 *  l'inspecteur tant que l'œuvre n'est pas chargée, un `{}` ou `[]` neuf à
 *  chaque rendu relancerait son effet de réinitialisation en boucle. */
const VIDE: Record<string, unknown> = {}
const AUCUN: string[] = []
/** Les rouages qu'un manga peut compléter même absents (voir useBrouillonInspecteur). */
const CLES_SOURCE_MANGA = CLES_SOURCE.map((c) => c.cle)

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // D'où l'on vient, quand l'écran précédent a pris la peine de le dire (voir
  // retourFiche). Absent sur une fiche rechargée ou reçue par lien : le
  // raccourci disparaît alors, la page reste entière.
  const retour = retourDepuis(useLocation().state)
  const wishlist = useWishlist()
  const suivis = useOeuvresSuivies()

  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [modeEdition, setModeEdition] = useState(false)
  /** « Terminer » a été demandé alors que le brouillon de l'inspecteur a
   *  changé : la sortie attend qu'on enregistre ou qu'on abandonne. */
  const [sortieDemandee, setSortieDemandee] = useState(false)
  // Une visite ne modifie rien : les points d'entrée d'édition ne sont pas
  // désactivés, ils n'existent pas. Tous sont facultatifs par construction, et
  // ne pas les passer suffit à les retirer - « Éditer » emporte au passage
  // toutes les sections de catalogue, qui vivent derrière `modeEdition`.
  //
  // Les gestes plus fins (cocher un tome, suivre une édition) restent en place
  // et se heurtent au refus du serveur, expliqué en une phrase par
  // lib/useRefusDeVisite : les masquer un par un dans une quarantaine
  // d'endroits revenait à parier qu'aucun ne serait oublié.
  const { estInvite, compte } = useAuth()
  const toast = useToast()
  const [filtre, setFiltre] = useState<FiltreTomes>('tous')
  const [question, setQuestion] = useState<QuestionAssistant | null>(null)
  const [ajoutTomeOuvert, setAjoutTomeOuvert] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [editingCover, setEditingCover] = useState(false)
  const [coverUrlInput, setCoverUrlInput] = useState('')

  const entityQuery = useQuery({ queryKey: queryKeys.entities.detail(entityId), queryFn: () => getEntity(entityId) })
  const ownershipsQuery = useQuery({ queryKey: queryKeys.ownerships(entityId), queryFn: () => listOwnerships(entityId) })
  const experiencesQuery = useQuery({ queryKey: queryKeys.experiences(entityId), queryFn: () => listExperiences(entityId) })
  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const relFromQuery = useQuery({ queryKey: queryKeys.relationships.from(entityId), queryFn: () => relationshipsFrom(entityId) })
  const relToQuery = useQuery({ queryKey: queryKeys.relationships.to(entityId), queryFn: () => relationshipsTo(entityId) })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const tierSummaryQuery = useQuery({
    queryKey: queryKeys.tierLists.entitySummary(entityId),
    queryFn: () => getEntityTierSummary(entityId),
  })
  const followedQuery = useQuery({
    queryKey: queryKeys.followedEdition(entityId),
    queryFn: () => listFollowedEdition(entityId),
  })

  /**
   * « Je l'ai » sur un tome manquant - un clic, rien à remplir.
   *
   * Le panneau du tome ne s'ouvre plus sur ce chemin : il n'existait là que
   * pour porter le formulaire d'état et de prix, qui a disparu (voir le lot
   * précédent). Il reste la surface d'un tome POSSÉDÉ, où il gère un
   * exemplaire réel - prix payé, note, vendu/perdu, exemplaires passés.
   *
   * `quickAdd` retrouve ou crée le tome par (titre, numéro, édition), comme
   * partout ailleurs : rien de neuf n'est inventé ici.
   */
  const ajoutTome = useMutation({
    mutationFn: async (tome: {
      entityTypeId: string
      titre: string
      numero: number
      edition?: string
      /** Renseignés uniquement quand cet ajout ANNULE un retrait : on rend
       *  alors l'exemplaire tel qu'il était, pas un neuf daté d'aujourd'hui. */
      condition?: string
      acquiredAt?: string
      purchasePrice?: number
    }) => {
      const resultat = await quickAdd({
        entityTypeId: tome.entityTypeId,
        title: tome.titre,
        condition: tome.condition ?? 'NEW',
        volumeNumber: tome.numero,
        edition: tome.edition,
        acquiredAt: tome.acquiredAt,
        purchasePrice: tome.purchasePrice,
      })

      // La possession est écrite : l'écran le montre TOUT DE SUITE. Ce qui
      // suit (la jaquette) est une recherche chez des fournisseurs, de deux
      // à trente secondes selon leur humeur - la tuile restait « manquante »
      // tout ce temps, et le parcours E2E l'a mesuré (2026-09-05).
      invaliderApresPossession(queryClient)

      // La jaquette du tome, cherchée tout de suite - et sans rien demander.
      //
      // `quickAdd` n'en enregistre une que si l'appelant lui en donne : un tome
      // ajouté d'un clic depuis la grille naissait donc sans image, alors que
      // ceux venus d'une proposition en avaient une. Constaté sur Death Note.
      //
      // Best-effort par nature : quota dépassé, fournisseur muet ou aucune
      // correspondance laissent simplement le tome sans jaquette - jamais une
      // erreur à l'écran pour un ajout qui, lui, a réussi. Le rattrapage
      // groupé reste disponible depuis Ma collection (voir backfillCovers).
      if (resultat.variantId) {
        try {
          const trouves = await searchVolumes(tome.entityTypeId, tome.titre)
          const correspondance = findBestCoverMatch(trouves.volumes, {
            attributes: { volumeNumber: tome.numero, edition: tome.edition },
          })
          if (correspondance?.imageUrl) {
            await mergeVariantAttributes(resultat.entityId, resultat.variantId, {
              coverImageUrl: correspondance.imageUrl,
            })
          }
        } catch {
          // Voir ci-dessus : l'ajout prime, la jaquette est un bonus.
        }
      }
      return resultat
    },
    onSuccess: () => invaliderApresPossession(queryClient),
  })

  /**
   * Cliquer un tome POSSÉDÉ le repasse en manquant.
   *
   * C'est le geste inverse de « Je l'ai », et le seul moyen restant de sortir
   * du troisième état depuis que le panneau du tome a disparu (décision
   * utilisateur du 2026-08-27 : ne garder que possédé / envie / manquant, plus
   * une note au niveau du groupe).
   *
   * Supprime l'Ownership plutôt que de la marquer vendue : « vendu » et
   * « perdu » ont été retirés avec le panneau, il ne reste donc qu'un sens à
   * ce geste - je ne l'ai plus.
   */
  /** Le numéro d'un tome depuis l'identifiant de sa variante - l'annulation
   *  d'un retrait doit rajouter LE MÊME tome, et `quick-add` le désigne par son
   *  numéro. Passe par `numeroDe`, seule lecture d'un sac d'attributs (Lot 62). */
  function numeroDeVariant(variantId: string | null): number | null {
    if (!variantId) return null
    const variante = entity?.variants.find((v) => v.id === variantId)
    return variante ? numeroDe(variante) : null
  }

  /**
   * Retirer un tome, avec la possibilité de revenir en arrière.
   *
   * <p>Le retrait SUPPRIME l'Ownership : ni « vendu » ni « perdu » ne subsistent
   * depuis le Lot 55, donc rien n'en garde trace. Un clic de trop sur une tuile
   * effaçait ainsi la date d'acquisition réelle, et la seule façon de revenir
   * en arrière - recliquer - en fabriquait une neuve, datée d'aujourd'hui.
   * Constaté le 2026-08-28 sur un tome passé du 26/08 au 28/08.
   *
   * <p>Même convention que les envies (voir useWishlist) : un message bref et
   * « Annuler ». L'annulation rend l'exemplaire tel qu'il était - sa date, son
   * état, son prix d'achat. Sa note éventuelle, elle, ne repasse pas : le champ
   * a perdu son écran au Lot 55 et `quick-add` ne le porte pas.
   */
  const retraitTome = useMutation({
    mutationFn: async (retires: OwnershipResponse[]) => {
      for (const possession of retires) {
        await deleteOwnership(possession.id)
      }
      return retires
    },
    onSuccess: (retires, _variables) => {
      invaliderApresPossession(queryClient)
      const premier = retires[0]
      if (!premier || !entity) return
      const numero = numeroDeVariant(premier.variantId)
      if (numero === null) return
      toast(retires.length > 1 ? `${retires.length} exemplaires retirés` : 'Tome retiré', {
        label: 'Annuler',
        onAction: () =>
          ajoutTome.mutate({
            entityTypeId: entity.entityTypeId,
            titre: entity.title,
            numero,
            edition: groupeActif?.editionName || undefined,
            condition: premier.condition,
            acquiredAt: premier.acquiredAt,
            purchasePrice: premier.purchasePrice ?? undefined,
          }),
      })
    },
  })

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameEntity(entityId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingTitle(false)
    },
  })
  /**
   * « Recharger depuis la source » pour CETTE œuvre : ses informations, puis
   * les jaquettes de ses tomes.
   *
   * <h2>Un seul geste, parce que c'est une seule question</h2>
   * « Redemande à la source ce qu'elle sait. » Le rattrapage de jaquettes
   * existait déjà ici, mais les attributs de l'œuvre (mangaka, statut, nombre
   * de tomes, jaquette de série) n'étaient recopiés qu'À L'AJOUT et plus
   * jamais - une série en cours gardait éternellement le nombre de tomes du
   * jour où on l'a ajoutée. Deux boutons côte à côte pour « recharger » et
   * « recharger aussi » n'auraient aidé personne (demande utilisateur du
   * 2026-08-27 : « je veux un bouton pour recharger les images ou les infos
   * api »).
   *
   * <h2>L'ordre compte</h2>
   * Les informations d'abord : si la source nous apprend le mangaka, la
   * recherche de tomes qui suit s'en sert pour viser juste. Les jaquettes de
   * tomes passent par le même rattrapage que Ma collection, à une série près.
   */
  const rechargerMutation = useMutation({
    mutationFn: async () => {
      const oeuvre = entityQuery.data!
      let infos = 0
      let sansCorrespondance = false
      let fournisseurMuet = false
      let attributs = oeuvre.attributes

      let candidats = null
      try {
        candidats = await rechercherOeuvrePossedee(oeuvre.entityTypeId, oeuvre.title)
      } catch {
        // Une source qui ne répond pas n'est PAS une œuvre inconnue - même
        // distinction qu'au lot 58, côté serveur. Les jaquettes sont tentées
        // quand même : elles ne dépendent pas des mêmes fournisseurs.
        fournisseurMuet = true
      }

      if (candidats) {
        const candidat = candidatCorrespondant(candidats, oeuvre)
        if (!candidat) {
          sansCorrespondance = true
        } else {
          const aEcrire = attributsARecharger(candidat, oeuvre)
          if (Object.keys(aEcrire).length > 0) {
            // origine=source : le serveur retient les clés saisies à la main
            // et ne les réécrit pas, même si ce filtre-ci était contourné.
            await mergeEntityAttributes(entityId, aEcrire, 'source')
            infos = Object.keys(aEcrire).length
            attributs = { ...attributs, ...aEcrire }
          }
        }
      }

      // La liste des tomes aussi, en forçant la source (Lot 121) : le cache
      // durable ne se périme jamais, et une liste enregistrée pendant qu'un
      // fournisseur se taisait resterait à jamais incomplète - « Ajouter un
      // tome » ne proposerait jamais ceux qui manquent. Une source qui ne
      // répond pas ne fait pas échouer le reste du rechargement.
      try {
        await searchVolumes(oeuvre.entityTypeId, oeuvre.title, { ...indicesDe(attributs), forceRefresh: true })
        await queryClient.invalidateQueries({ queryKey: queryKeys.tomesProposes(oeuvre.entityTypeId, oeuvre.title) })
      } catch {
        fournisseurMuet = true
      }

      const jaquettes = await rattraperJaquettes(
        { ...oeuvre, attributes: attributs },
        oeuvre.entityTypeId,
        searchVolumes,
        (id, variantId, url) => mergeVariantAttributes(id, variantId, { coverImageUrl: url }),
      )

      return {
        infos,
        sansCorrespondance,
        trouvees: jaquettes.trouvees,
        fournisseurMuet: fournisseurMuet || jaquettes.fournisseurMuet,
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) }),
  })

  const coverMutation = useMutation({
    mutationFn: (url: string) => mergeEntityAttributes(entityId, { [COVER_IMAGE_ATTRIBUTE_KEY]: url }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingCover(false)
    },
  })
  const suivreMutation = useMutation({
    mutationFn: (nom: string) => followEdition(entityId, nom),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.followedEdition(entityId) }),
  })
  const nePlusSuivreMutation = useMutation({
    mutationFn: () => unfollowEdition(entityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.followedEdition(entityId) }),
  })

  // Tout ce qui suit vit AVANT les retours anticipés : un Hook ne peut pas
  // être appelé conditionnellement.
  const entity = entityQuery.data ?? null
  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity?.entityTypeId)
  const isManga = entityType?.code === 'MANGA'
  const couvertureUrl = entity ? coverImageUrlFrom(entity.attributes) : null
  const teinte = useTeinteJaquette(couvertureUrl)

  /**
   * « X tomes possédés sur Y », demandé au serveur.
   *
   * <h2>Le dernier des trois calculs</h2>
   * Cette page regroupait les tomes par édition, relisait les Ownership pour
   * savoir lesquels sont possédés, puis renvoyait tout ça à la complétude pour
   * obtenir un total. Trois dérivations pour une question que
   * `CollectionProgressService` répond déjà - et dont l'absence d'UNE règle (un
   * tome catalogué sans édition rejoint l'unique édition nommée de la série) a
   * produit deux divergences réelles, aux lots 31 et 49. Ma collection a cessé
   * de recalculer au lot 51 ; c'était la dernière.
   *
   * <p>Lancée en parallèle de la fiche (aucun `enabled` sur le type) : elle ne
   * dépend que de l'identifiant, déjà dans l'URL. L'attendre ne coûte donc rien
   * de plus que la plus lente des deux requêtes - et ne rien afficher tant
   * qu'on ne sait pas est la règle du lot 47.
   */
  const progressQuery = useQuery({
    queryKey: queryKeys.insights.progressOf(entityId),
    queryFn: () => getEntityProgress(entityId),
  })

  const groupes = isManga ? (progressQuery.data?.editions ?? []) : []
  const editionSuivie = followedQuery.data?.[0]?.editionName ?? null
  // L'édition ouverte par défaut est celle qu'on SUIT - c'est tout l'intérêt
  // de l'avoir persistée. À défaut, la première du catalogue.
  const groupeActif =
    groupes.find((g) => g.editionName === editionAffichee) ??
    groupes.find((g) => g.editionName === editionSuivie) ??
    groupes[0]

  // Une fiche peut exister sans le moindre tome - ajoutée en envies, ou
  // créée par un ajout qui n'a rien trouvé. C'est le même « quels tomes
  // possèdes-tu ? » que l'aperçu, donc le même hook (voir
  // usePropositionTomes) : une seule implémentation pour les deux écrans.
  const proposition = usePropositionTomes({
    entityTypeId: entity?.entityTypeId ?? '',
    titre: entity?.title ?? '',
    attributs: entity?.attributes ?? {},
    entityId,
    modeEdition,
    // `progressQuery.isSuccess` autant que le décompte : les Hooks tournent
    // AUSSI pendant que la progression est en vol, où `groupes` est encore
    // vide - sans cette garde, une série qui a douze tomes déclencherait une
    // recherche de tomes chez les fournisseurs à chaque ouverture de fiche.
    actif: !!entity && isManga && progressQuery.isSuccess && groupes.length === 0,
  })

  const editionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', groupeActif?.editionName ?? ''),
    queryFn: () => findEdition(entity!.title, groupeActif!.editionName, entityId),
    enabled: !!entity && !!groupeActif && groupeActif.editionName !== '',
    retry: false,
  })
  const editionInfo = editionInfoQuery.isSuccess ? editionInfoQuery.data : null

  // La progression fait partie de ce qu'on attend : sans elle, la grille dirait
  // « aucun tome » à une série qui en a douze (voir lot 47).
  // Avant les gardes ci-dessous, comme tout Hook : la page ne rend rien tant
  // que l'œuvre n'est pas là, et le brouillon se réinitialise dès qu'elle
  // arrive (voir useBrouillonInspecteur).
  const brouillon = useBrouillonInspecteur({
    entityId,
    entityTitle: entity?.title ?? '',
    attributes: entity?.attributes ?? VIDE,
    champsSaisis: entity?.champsSaisis ?? AUCUN,
    customFieldKeys: entityType?.customFieldKeys ?? AUCUN,
    clesSourceProposees: isManga ? CLES_SOURCE_MANGA : AUCUN,
    edition:
      groupeActif && groupeActif.editionName !== ''
        ? { nom: groupeActif.editionName, info: editionInfoQuery.isSuccess ? editionInfoQuery.data : null }
        : null,
  })

  if (entityQuery.isPending || progressQuery.isPending) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (progressQuery.isError) return <ErrorBanner message={progressQuery.error.message} />
  if (!entity) return null

  const totalTomes = groupeActif?.totalVolumes ?? null
  const tuiles = groupeActif ? buildTiles(groupeActif, entity.variants) : []

  const auteur = creatorFrom(entity.attributes)
  const ongoing = isSeriesOngoing(entity.attributes)
  const startYear = typeof entity.attributes.startYear === 'string' ? entity.attributes.startYear : null
  const endYear = typeof entity.attributes.endYear === 'string' ? entity.attributes.endYear : null
  const annees = startYear ? (endYear ? `${startYear} → ${endYear}` : ongoing ? `Depuis ${startYear}` : startYear) : null
  const generalRank = tierSummaryQuery.data?.generalRank ?? null
  const notes = experiences.map((e) => e.rating).filter((r): r is number => r !== null)
  const meilleureNote = notes.length > 0 ? Math.max(...notes) : null
  // Le cœur de la bande haute ne vaut que pour une œuvre qui se possède d'une
  // seule pièce. Pour un manga, la série est un GROUPE : on ne veut pas
  // « Naruto », on veut le tome 47 - et c'est la grille qui le dit.
  const remarques = typeof entity.attributes.note === 'string' ? entity.attributes.note : ''

  /**
   * Un seul « Éditer » pour toute la page (demande utilisateur du
   * 2026-09-04) : il ouvre les éditeurs personnels - classement, note et
   * lectures, tags - et transforme les champs de l'inspecteur en champs de
   * saisie, à la même place (voir useBrouillonInspecteur). Le brouillon
   * repart de la base à chaque sortie du mode.
   */
  function basculerModeEdition() {
    if (!modeEdition) {
      setModeEdition(true)
      return
    }
    // « Terminer » avec un brouillon modifié : on ne jette rien sans le
    // dire. Un panneau en ligne sous l'inspecteur, même idiome que les
    // suppressions (voir EntityTypesPage) - pas de window.confirm.
    if (brouillon.modifie) {
      setSortieDemandee(true)
      return
    }
    setModeEdition(false)
  }
  function terminerEdition() {
    brouillon.annuler()
    setSortieDemandee(false)
    setModeEdition(false)
  }
  const jaquettesManquantes = variantsMissingCover(entity).length
  const dansEnvies = !!wishlist.entryFor(entityId)
  const suivie = suivis.estSuivie(entityId)
  const possedee = ownerships.some((o) => o.status === 'OWNED')
  // Un seul état à la fois (Possédé / Suivi / Envie). Suivie l'emporte à
  // l'affichage : on suit ce qu'on collectionne encore, même avec des tomes en
  // main ; puis possédée ; puis voulue.
  const etatCollection = suivie
    ? { libelle: 'Suivie', couleur: 'var(--color-accentText)' }
    : possedee
      ? { libelle: 'Possédée', couleur: 'var(--color-ok)' }
      : dansEnvies
        ? { libelle: 'Dans mes envies', couleur: 'var(--color-warning)' }
        : null
  const tomesVoulus = wishlist.variantsVoulus

  // `totalVolumes` SEUL, jamais le nombre de tomes catalogués en repli : ce
  // repli-là annonçait « 2 tomes possédés sur 2 » à quelqu'un dont l'édition
  // n'a jamais été renseignée - une collection déclarée complète alors que
  // l'application ne sait rien de sa taille. Il contredisait le commentaire de
  // CartesEditions juste à côté (« le déduire du nombre de tomes qu'une
  // recherche a RAMENÉS empoisonnerait le moteur de complétude ») et la
  // documentation de EditionAffichee.total (« null tant qu'aucune source ne le
  // connaît »). Trouvé par le parcours de bout en bout du parcours 8.
  const editionsAffichees: EditionAffichee[] = groupes.map((groupe) => ({
    nom: groupe.editionName,
    editeur: groupe.editionName === groupeActif?.editionName ? (editionInfo?.publisher ?? null) : null,
    total: groupe.totalVolumes ?? null,
    possedes: groupe.ownedVolumeNumbers.length,
  }))

  async function basculerEnvies() {
    const entree = wishlist.entryFor(entityId)
    if (entree) wishlist.remove(entree.id, { entityId })
    else await wishlist.addAsync({ entityId })
  }

  /**
   * « Je le veux » / « Retirer » sur UN tome de l'édition affichée.
   *
   * Le tome est désigné par son numéro et non par son identifiant : sur une
   * fiche, la plupart des tomes manquants sont déduits du total de l'édition
   * et ne sont catalogués nulle part. C'est le backend qui les fait exister au
   * passage (voir TomeResolver), sans jamais créer de possession.
   */
  function basculerEnvieDuTome(numero: number) {
    const tuile = tuiles.find((t) => t.volumeNumber === numero)
    const entree = tuile?.variant ? wishlist.entryForVariant(tuile.variant.id) : undefined
    const cible = { entityId, volumeNumber: numero, edition: groupeActif?.editionName || undefined }
    if (entree) wishlist.remove(entree.id, cible)
    else wishlist.add(cible)
  }

  return (
    <>
      {/* Avant le hero, donc la bande ne colle plus au haut : sans ça elle
          remonterait par-dessus ce lien (voir FicheHero.colleEnHaut). */}
      {retour && (
        <Link
          to={retour.to}
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary"
        >
          <ArrowLeft size={15} />
          {retour.libelle}
        </Link>
      )}

      <FicheHero
        colleEnHaut={!retour}
        teinte={teinte}
        kicker={entityType?.label ?? null}
        titre={entity.title}
        auteur={auteur}
        statut={
          ongoing === null
            ? null
            : ongoing
              ? { libelle: 'En cours', couleur: 'var(--color-warning)' }
              : { libelle: 'Terminée', couleur: 'var(--color-ok)' }
        }
        annees={annees}
        couvertureUrl={couvertureUrl}
        repliCouverture={
          <div className="absolute inset-0" style={{ background: gradientFor(entity.title) }} aria-hidden="true" />
        }
        onCouverture={
          estInvite
            ? undefined
            : () => {
                setCoverUrlInput(couvertureUrl ?? '')
                setEditingCover(true)
              }
        }
        onEvaluer={
          groupeActif && !estInvite
            ? () =>
                navigate('/purchase-analysis', {
                  state: {
                    seriesTitle: entity.title,
                    editionName: groupeActif.editionName,
                    // L'analyse n'est plus une destination de la navigation
                    // (lot 137) : elle dit d'où l'on vient, et c'est ici.
                    retour: { to: `/entity/${entityId}`, libelle: entity.title },
                  },
                })
            : null
        }
        actionEnvies={
          isManga || estInvite ? null : (
            <BoutonEnviesHero dedans={dansEnvies} onBasculer={() => void basculerEnvies()} disabled={wishlist.isPending} />
          )
        }
        actionSuivre={
          estInvite ? null : (
            <BoutonSuivreHero suivie={suivie} onBasculer={() => suivis.basculer(entityId)} disabled={suivis.isPending} />
          )
        }
        etat={etatCollection}
        modeEdition={modeEdition}
        onBasculerMode={estInvite ? undefined : basculerModeEdition}
        editions={
          groupes.length > 0 ? (
            <CartesEditions
              editions={editionsAffichees}
              editionAffichee={groupeActif?.editionName ?? ''}
              editionSuivie={editionSuivie}
              onAfficher={(nom) => setEditionAffichee(nom)}
              onSuivre={(nom) => suivreMutation.mutate(nom)}
              onNePlusSuivre={() => nePlusSuivreMutation.mutate()}
              onAjouterEdition={() => setAjoutTomeOuvert(true)}
              modeEdition={modeEdition}
            />
          ) : (
            // Rien au catalogue : ce sont les éditions proposées par le
            // fournisseur, et la jauge compte ce qu'on coche.
            proposition.cartesEditions
          )
        }
      />

      {/* Renommage et couverture : deux corrections rares, sur la bande, juste
          sous ce qu'elles modifient. Elles ne méritent pas un champ permanent. */}
      {(editingTitle || editingCover) && (
        <div className={`${CLASSE_BANDE_PLEINE_LARGEUR} relative`}>
          <div className={`${CLASSE_CONTENU_BANDE} flex flex-col gap-2 pt-4`}>
            {editingTitle && (
              <ChampCorrection
                valeur={titleInput}
                onChange={setTitleInput}
                placeholder="Nom de la série"
                enCours={renameMutation.isPending}
                onValider={() => titleInput.trim() && renameMutation.mutate(titleInput.trim())}
                onAnnuler={() => setEditingTitle(false)}
              />
            )}
            {editingCover && (
              <ChampCorrection
                valeur={coverUrlInput}
                onChange={setCoverUrlInput}
                placeholder="URL de la jaquette (ex: https://...)"
                enCours={coverMutation.isPending}
                onValider={() => coverUrlInput.trim() && coverMutation.mutate(coverUrlInput.trim())}
                onAnnuler={() => setEditingCover(false)}
              />
            )}
            {renameMutation.isError && <ErrorBanner message={renameMutation.error.message} />}
            {coverMutation.isError && <ErrorBanner message={coverMutation.error.message} />}
          </div>
        </div>
      )}

      {proposition.section}

      {groupeActif && (
        <>
          <GrilleTomes
            titre={groupeActif.editionName || 'Édition non précisée'}
            plusieursEditions={groupes.length > 1}
            filtre={filtre}
            onFiltre={setFiltre}
            tuiles={tuiles}
            onChoisirTome={(numero) => {
              // Un seul geste, dans les deux sens : le tome entre dans la
              // collection ou en sort. Plus de surface intermédiaire.
              const tuile = tuiles.find((t) => t.volumeNumber === numero)
              if (tuile?.status === 'owned' && tuile.variant) {
                retraitTome.mutate(ownerships.filter((o) => o.variantId === tuile.variant!.id))
              } else {
                ajoutTome.mutate({ entityTypeId: entity.entityTypeId, titre: entity.title, numero, edition: groupeActif?.editionName || undefined })
              }
            }}
            onJeLAi={(numero) =>
              ajoutTome.mutate({ entityTypeId: entity.entityTypeId, titre: entity.title, numero, edition: groupeActif?.editionName || undefined })
            }
            tomesVoulus={tomesVoulus}
            onBasculerEnvie={basculerEnvieDuTome}
            modeEdition={modeEdition}
            onAjouterTome={() => setAjoutTomeOuvert(true)}
          />

          <div className="pt-4 empty:hidden">
            <AddVolumeSection
              entityId={entityId}
              entityTypeId={entity.entityTypeId}
              title={entity.title}
              ouvert={ajoutTomeOuvert}
              onFermer={() => setAjoutTomeOuvert(false)}
            />
          </div>
        </>
      )}

      <div className="pt-6">
        <InspecteurFiche
          teinte={teinte}
          personnel={
            <>
              <ReleveInspecteur
                libelle="Tier list">
                {generalRank ? (
                  <span className="flex items-center gap-2.5">
                    <span className="text-[13.5px] text-textPrimary">
                      {entityType?.label ? `${entityType.label} — général` : 'Classement général'}
                    </span>
                    <TierBadge rank={generalRank} size="compact" />
                  </span>
                ) : (
                  <span className="text-[13.5px] text-faint">Non classée</span>
                )}
              </ReleveInspecteur>
              {/* La note VIT sur une expérience (voir Experience.rating) : c'est
                  le même éditeur qui la porte, et proposer deux points d'entrée
                  pour la même donnée reviendrait à en inventer une seconde. */}
              <ReleveInspecteur
                libelle="Ma note">
                {meilleureNote !== null ? (
                  <span className="font-display text-[23px] leading-tight font-semibold tracking-[-0.02em] text-accentText">
                    {meilleureNote} / 10
                  </span>
                ) : (
                  <span className="text-[13.5px] text-faint">Pas encore notée</span>
                )}
              </ReleveInspecteur>
              <ReleveInspecteur libelle="Mes remarques">
                {modeEdition ? (
                  <textarea
                    value={brouillon.attributs.valeur('note')}
                    onChange={(e) => brouillon.attributs.saisir('note', e.target.value)}
                    rows={3}
                    placeholder="Ce que tu veux retenir sur cette série…"
                    aria-label="Mes remarques"
                    className="w-full rounded-xl bg-surface px-3 py-2 text-[13.5px] text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
                  />
                ) : remarques ? (
                  <span className="text-[13.5px] whitespace-pre-line text-textPrimary">{remarques}</span>
                ) : (
                  <span className="text-[13.5px] text-faint">Aucune</span>
                )}
              </ReleveInspecteur>
              <ReleveInspecteur
                libelle={libelleSectionExperiences(entityType?.allowedExperienceTypes ?? [])}>
                {experiences.length === 0 ? (
                  <span className="text-[13.5px] text-faint">Aucune enregistrée</span>
                ) : (
                  <span className="flex flex-col gap-0.5">
                    {experiences.slice(0, 4).map((experience) => {
                      const tome = entity.variants.find((v) => v.id === experience.variantId)
                      return (
                        <span key={experience.id} className="text-[13.5px] text-textPrimary">
                          · {tome ? variantLabel(tome) : entity.variants.length > 0 ? 'Série entière' : libelleExperienceType(experience.experienceType)}
                        </span>
                      )
                    })}
                    {experiences.length > 4 && (
                      <span className="text-[13.5px] text-faint">· et {experiences.length - 4} autres</span>
                    )}
                  </span>
                )}
              </ReleveInspecteur>
              {/* Les tags flottaient sous les trois relevés, sans intitulé : ils
                  n'avaient donc pas de quoi porter leur propre point d'entrée. */}
              <ReleveInspecteur
                libelle="Tags">
                <div className="flex flex-wrap items-center gap-1.5">
                  {entity.tagIds.length === 0 ? (
                    <span className="text-[13.5px] text-faint">Aucun tag</span>
                  ) : (
                    (tagsQuery.data ?? [])
                      .filter((tag) => entity.tagIds.includes(tag.id))
                      .map((tag) => (
                        <span key={tag.id} className="rounded-full bg-softBtn px-2.5 py-1 text-xs whitespace-nowrap text-textDim">
                          {tag.label}
                        </span>
                      ))
                  )}
                </div>
              </ReleveInspecteur>
            </>
          }
          oeuvre={
            modeEdition ? (
              // Les MÊMES rangées qu'en lecture, en champs de saisie - toutes,
              // même vides, c'est là qu'on complète ce que la source n'a pas
              // donné (demande utilisateur du 2026-09-05). Le statut se saisit
              // dans la colonne SOURCE (« Statut source »), d'où il vient.
              <div className="flex flex-col">
                {brouillon.attributs.clesOeuvre.map((cle) => (
                  <RangeeInspecteur key={cle} libelle={libelleDe(cle)} saisie saisi={brouillon.attributs.saisi(cle)}>
                    <ChampInspecteur
                      id={`oeuvre-${cle}`}
                      type={cle === RELEASE_DATE_ATTRIBUTE_KEY ? 'date' : 'text'}
                      ariaLabel={libelleDe(cle)}
                      valeur={brouillon.attributs.valeur(cle)}
                      onChange={(v) => brouillon.attributs.saisir(cle, v)}
                    />
                  </RangeeInspecteur>
                ))}
                {brouillon.edition && (
                  <>
                    <div className="pt-3 pb-1 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
                      Édition « {brouillon.edition.nom} »
                    </div>
                    <RangeeInspecteur libelle="Éditeur" saisie>
                      <ChampInspecteur
                        id="edition-publisher"
                        valeur={brouillon.edition.publisher}
                        onChange={(publisher) => brouillon.edition?.modifier({ publisher })}
                        placeholder="Éditeur (ex: Kana)"
                      />
                    </RangeeInspecteur>
                    <RangeeInspecteur libelle="Nombre de tomes" saisie>
                      <ChampInspecteur
                        id="edition-total"
                        type="number"
                        valeur={brouillon.edition.totalVolumes}
                        onChange={(totalVolumes) => brouillon.edition?.modifier({ totalVolumes })}
                        placeholder="Nb de tomes"
                      />
                    </RangeeInspecteur>
                    <RangeeInspecteur libelle="Disponibilité" saisie>
                      <label className="flex items-center gap-2 text-[13px] text-textPrimary">
                        <input
                          type="checkbox"
                          checked={brouillon.edition.outOfPrint}
                          onChange={(e) => brouillon.edition?.modifier({ outOfPrint: e.target.checked })}
                        />
                        Édition épuisée
                      </label>
                    </RangeeInspecteur>
                    <RangeeInspecteur libelle="À venir" saisie>
                      <span className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-[13px] text-textPrimary">
                          <input
                            type="checkbox"
                            checked={brouillon.edition.betterEditionAnnounced}
                            onChange={(e) => brouillon.edition?.modifier({ betterEditionAnnounced: e.target.checked })}
                          />
                          Nouvelle édition annoncée
                        </label>
                        {brouillon.edition.betterEditionAnnounced && (
                          <ChampInspecteur
                            id="edition-note"
                            valeur={brouillon.edition.betterEditionNote}
                            onChange={(betterEditionNote) => brouillon.edition?.modifier({ betterEditionNote })}
                            placeholder="Détail (ex: Perfect Edition annoncée pour 2026)"
                          />
                        )}
                      </span>
                    </RangeeInspecteur>
                  </>
                )}
              </div>
            ) : (
            <div className="flex flex-col">
              {/* « Auteur » coiffait le studio d'un jeu vidéo : le mot suit l'attribut lu (voir creatorFrom). */}
              {auteur && (
                <RangeeInspecteur libelle={isManga ? 'Mangaka' : entityType?.code === 'VIDEO_GAME' ? 'Studio' : 'Auteur'}>
                  {auteur}
                </RangeeInspecteur>
              )}
              {ongoing !== null && (
                <RangeeInspecteur libelle="Statut">
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{ color: ongoing ? 'var(--color-warning)' : 'var(--color-ok)' }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ongoing ? 'var(--color-warning)' : 'var(--color-ok)' }}
                    />
                    {ongoing ? 'En cours' : 'Terminée'}
                  </span>
                </RangeeInspecteur>
              )}
              {editionInfo?.publisher && <RangeeInspecteur libelle="Éditeur">{editionInfo.publisher}</RangeeInspecteur>}
              {totalTomes !== null && <RangeeInspecteur libelle="Nombre de tomes">{totalTomes}</RangeeInspecteur>}
              <RangeeDateDeSortie attributs={entity.attributes} />
            </div>
            )
          }
          source={
            <>
              <ColonneSource attributs={entity.attributes} brouillon={modeEdition ? brouillon.attributs : undefined} />
              <span className="text-xs text-faint">
                Relations :{' '}
                {relFromQuery.data?.length || relToQuery.data?.length
                  ? `${(relFromQuery.data?.length ?? 0) + (relToQuery.data?.length ?? 0)} enregistrée(s)`
                  : 'aucune'}
              </span>
            </>
          }
        />
        {modeEdition && sortieDemandee && brouillon.modifie && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface2 px-4 py-3">
            <span className="text-sm text-textPrimary">Des modifications ne sont pas enregistrées.</span>
            <button
              type="button"
              onClick={() => void brouillon.enregistrer().then(terminerEdition)}
              disabled={brouillon.enCours}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
            >
              {brouillon.enCours ? 'Enregistrement...' : 'Enregistrer et terminer'}
            </button>
            <button type="button" onClick={terminerEdition} className="px-2 py-2 text-sm text-dangerText">
              Abandonner
            </button>
            <button type="button" onClick={() => setSortieDemandee(false)} className="px-2 py-2 text-sm text-textDim">
              Continuer d’éditer
            </button>
          </div>
        )}
        {modeEdition && (
          <div className="flex flex-wrap items-center gap-3 pt-3">
            <button
              type="button"
              onClick={() => void brouillon.enregistrer()}
              disabled={brouillon.enCours || !brouillon.modifie}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
            >
              {brouillon.enCours ? 'Enregistrement...' : 'Enregistrer la fiche'}
            </button>
            <button
              type="button"
              onClick={brouillon.annuler}
              disabled={brouillon.enCours || !brouillon.modifie}
              className="px-2 py-2 text-sm text-textDim disabled:opacity-50"
            >
              Annuler
            </button>
            <span className="text-xs text-textDim">
              Ce que tu saisis est marqué et n’est plus écrasé par « Recharger depuis la source ». Un champ vidé est
              retiré.
            </span>
          </div>
        )}
        {brouillon.erreur && <ErrorBanner message={brouillon.erreur} />}
      </div>

      {/* Les éditeurs personnels - classement, note et lectures, tags -
          s'ouvrent tous avec le mode édition, juste sous l'inspecteur, en
          pleine largeur parce qu'une colonne de 240 px ne peut pas accueillir
          un formulaire. Un seul « Éditer » pour toute la page (demande
          utilisateur du 2026-09-04) : plus de « Modifier » par relevé. */}
      {modeEdition && !estInvite && (
        <div className="flex flex-col gap-4 pt-4">
          <Carte>
            <TierSummarySection
              entityId={entityId}
              entityTitle={entity.title}
              entityTypeLabel={entityType?.label ?? null}
              coverImageUrl={couvertureUrl}
            />
          </Carte>
          <Carte>
            <ExperiencesSection
              entityId={entityId}
              experiences={experiences}
              allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
              variants={entity.variants}
            />
          </Carte>
          <Carte>
            <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data ?? []} />
          </Carte>
        </div>
      )}

      {/* Le CATALOGUE : ce que l'œuvre et son édition SONT, et les gestes qui
          les font exister ou disparaître. Sous le même « Éditer » que les
          éditeurs personnels ci-dessus, depuis le 2026-09-04. */}
      {modeEdition && (
        <div className="flex flex-col gap-5 pt-6">
          {/* Les informations de l'œuvre et de son édition ne sont plus ici :
              elles se saisissent dans l'inspecteur lui-même, à la place où on
              les lit (demande utilisateur du 2026-09-05). */}
          <Carte>
            <RelationshipsSection
              entityId={entityId}
              relationshipsFrom={relFromQuery.data ?? []}
              relationshipsTo={relToQuery.data ?? []}
            />
          </Carte>
          {/* Toujours là, contrairement à l'ancien bouton de jaquettes qui
              n'apparaissait qu'en cas de manque : une œuvre dont toutes les
              images sont en place a quand même des informations à redemander
              (un tome de plus paru, un statut qui passe à « terminée »). Le
              décompte des jaquettes manquantes reste annoncé quand il y en a,
              c'est ce qui se voit à l'œil. */}
          {/* Administrateur seulement (demande du 2026-09-04) : c'est lui qui
              répond des données uniformes de l'instance et des quotas des
              fournisseurs. Le serveur ignore le rechargement forcé pour les
              autres comptes. */}
          {compte?.admin && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => rechargerMutation.mutate()}
                disabled={rechargerMutation.isPending}
                className="flex min-h-11 w-fit items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {rechargerMutation.isPending ? 'Rechargement...' : 'Recharger depuis la source'}
              </button>
              {jaquettesManquantes > 0 && !rechargerMutation.isPending && (
                <span className="text-[13px] text-textDim">
                  {jaquettesManquantes} jaquette{jaquettesManquantes > 1 ? 's' : ''} manquante
                  {jaquettesManquantes > 1 ? 's' : ''}
                </span>
              )}
              {rechargerMutation.isSuccess && (
                <span className="text-[13px] text-textDim">{resumeRechargement(rechargerMutation.data)}</span>
              )}
            </div>
          )}
          {rechargerMutation.isError && <ErrorBanner message={rechargerMutation.error.message} />}

          {/* Les corrections d'identité restent avec le reste des éditeurs ;
              ce qui DÉTRUIT vit en dessous, dans un bloc qui le dit. */}
          <button
            type="button"
            onClick={() => {
              setTitleInput(entity.title)
              setEditingTitle(true)
            }}
            className="w-fit text-[13px] text-textDim underline"
          >
            Renommer la série
          </button>

          {/* Séparé visuellement et nommé, en bas de l'espace d'édition
              (étude produit du 2026-08-27, §3) : une action définitive ne
              doit pas se trouver par accident au milieu de corrections
              banales. La confirmation, elle, vit dans le bouton lui-même. */}
          <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-danger/30 bg-dangerTint p-4">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-dangerText uppercase">
              Zone sensible
            </span>
            <p className="text-[13px] text-textDim">
              Supprimer la fiche efface la série du catalogue. Contrairement à « vendu » ou « perdu », qui
              gardent une trace, c&apos;est définitif - et refusé tant qu&apos;un exemplaire ou une lecture y
              est rattaché.
            </p>
            <DeleteEntitySection entityId={entityId} entityTitle={entity.title} />
          </div>
        </div>
      )}

      <AideFlottante
        titreSerie={entity.title}
        /* Les questions dépendent de ce que le type PERMET. « Que me
           manque-t-il ? » se calcule sur la complétude d'une édition : posée
           sur un jeu vidéo, elle répondait « Tes tomes n'ont pas d'édition
           précisée… Renseigne l'édition sur un tome », c'est-à-dire du
           vocabulaire manga devant une œuvre qui n'a ni tome ni édition.
           Et « mes lectures » ne vaut que pour ce qui se lit - le type
           déclare lui-même ses expériences (voir EntityType.allowedExperienceTypes). */
        questions={[
          ...(groupeActif ? [{ cle: 'missing' as const, libelle: 'Que me manque-t-il ?' }] : []),
          { cle: 'reading' as const, libelle: libelleQuestionExperiences(entityType?.allowedExperienceTypes ?? []) },
        ]}
        question={question}
        onQuestion={setQuestion}
        reponse={
          question ? (
            <ReponseAssistant
              entityId={entityId}
              entityTitle={entity.title}
              variants={entity.variants}
              experiences={experiences}
              activeGroup={groupeActif ?? null}
              question={question}
            />
          ) : null
        }
      />
    </>
  )
}

/**
 * L'intitulé de la question d'avancement, dans le vocabulaire du type.
 *
 * Un type déclare ses expériences (« Read », « Play », « Watch »…) : c'est la
 * seule source qui sache si l'on LIT, JOUE ou REGARDE cette œuvre. À défaut,
 * une formulation neutre - jamais « mes lectures » posé au hasard devant un
 * jeu vidéo.
 */
function libelleQuestionExperiences(typesDExperience: string[]): string {
  // Les codes réellement livrés par ce catalogue : READ (manga), PLAYED (jeu
  // de société), FINISHED (jeu vidéo), plus ABANDONED/IN_PROGRESS partagés.
  // Ces derniers décrivent un ÉTAT, pas un geste - ils ne nomment donc rien,
  // et la formulation neutre prend le relais plutôt qu'un mot inventé.
  const codes = typesDExperience.map((t) => t.toUpperCase())
  if (codes.includes('READ')) return 'Où en suis-je dans mes lectures ?'
  if (codes.includes('PLAYED')) return 'Où en suis-je dans mes parties ?'
  if (codes.includes('WATCHED')) return 'Où en suis-je dans mes visionnages ?'
  return 'Où en suis-je ?'
}

/**
 * Ce que le rechargement a donné, en une phrase.
 *
 * Trois cas se ressemblent à l'écran et appellent trois gestes différents :
 * la source n'a pas répondu (réessayer), elle a répondu mais ne connaît pas
 * cette œuvre (rien à attendre d'un second clic), elle a répondu et tout était
 * déjà à jour. Les confondre sous un « rien trouvé » était exactement le
 * défaut du lot 58.
 */
function resumeRechargement(resultat: {
  infos: number
  trouvees: number
  sansCorrespondance: boolean
  fournisseurMuet: boolean
}): string {
  const faits = [
    resultat.infos > 0
      ? `${resultat.infos} information${resultat.infos > 1 ? 's' : ''} mise${resultat.infos > 1 ? 's' : ''} à jour`
      : null,
    resultat.trouvees > 0
      ? `${resultat.trouvees} jaquette${resultat.trouvees > 1 ? 's' : ''} retrouvée${resultat.trouvees > 1 ? 's' : ''}`
      : null,
  ].filter((fait): fait is string => fait !== null)

  if (faits.length > 0) {
    // Ce qui a été fait prime, même si une source est restée muette à côté :
    // l'utilisateur voit le résultat, et le reste se retentera.
    const reste = resultat.fournisseurMuet ? " Une source n'a pas répondu - réessaie pour le reste." : ''
    return `${faits.join(', ')}.${reste}`
  }
  if (resultat.fournisseurMuet) return "Le fournisseur n'a pas répondu - réessaie plus tard."
  if (resultat.sansCorrespondance) return "La source ne connaît pas cette œuvre sous ce titre."
  return 'Tout était déjà à jour.'
}

function ChampCorrection({
  valeur,
  onChange,
  placeholder,
  enCours,
  onValider,
  onAnnuler,
}: {
  valeur: string
  onChange: (valeur: string) => void
  placeholder: string
  enCours: boolean
  onValider: () => void
  onAnnuler: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-sm text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
      />
      <button
        type="button"
        onClick={onValider}
        disabled={!valeur.trim() || enCours}
        className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
      >
        Enregistrer
      </button>
      <button type="button" onClick={onAnnuler} className="shrink-0 rounded-lg px-2 py-2 text-sm text-textDim">
        Annuler
      </button>
    </div>
  )
}
