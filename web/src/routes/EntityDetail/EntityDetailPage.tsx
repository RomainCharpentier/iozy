import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { getEntity, mergeEntityAttributes, mergeVariantAttributes, quickAdd, renameEntity } from '../../api/entities'
import { deleteOwnership, listOwnerships } from '../../api/ownerships'
import { rechercherOeuvrePossedee, searchVolumes } from '../../api/metadata'
import { findBestCoverMatch, rattraperJaquettes, variantsMissingCover } from '../Shelf/backfillCovers'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { getEntityProgress } from '../../api/insights'
import { findEdition } from '../../api/purchaseAnalysis'
import { getEntityTierSummary } from '../../api/tierLists'
import { followEdition, listFollowedEdition, unfollowEdition } from '../../api/followedEdition'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { useWishlist } from '../../lib/useWishlist'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { buildTiles } from '../../lib/tomeTiles'
import { numeroDe, variantLabel } from '../../lib/attributsTome'
import type { OwnershipResponse } from '../../types/api'
import { attributsARecharger, candidatCorrespondant } from './rechargerSource'
import { usePropositionTomes } from './usePropositionTomes'
import { useTeinteJaquette } from '../../lib/useTeinteJaquette'
import { CLASSE_BANDE_PLEINE_LARGEUR, CLASSE_CONTENU_BANDE } from '../../components/layout/AppShell'
import { TierBadge } from '../TierLists/TierBadge'
import { BoutonEnviesHero, FicheHero } from './FicheHero'
import { CartesEditions, type EditionAffichee } from './CartesEditions'
import { GrilleTomes, type FiltreTomes } from './GrilleTomes'
import { ColonneSource, InspecteurFiche, RangeeInspecteur, ReleveInspecteur } from './InspecteurFiche'
import { AideFlottante } from './AideFlottante'
import { ReponseAssistant, type QuestionAssistant } from './AssistantSection'
import { useAuth } from '../../lib/useAuth'
import { AddVolumeSection } from './AddVolumeSection'
import { TierSummarySection } from './TierSummarySection'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { EntityInfoSection } from './EntityInfoSection'
import { EditionCorrectionSection } from './EditionCorrectionSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import { Carte } from '../../components/Carte'
import { retourDepuis } from '../../lib/retour'
import { useToast } from '../../lib/toast'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { invaliderApresPossession } from '../../lib/invalidations'

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

  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [modeEdition, setModeEdition] = useState(false)
  // Une visite ne modifie rien : les points d'entrée d'édition ne sont pas
  // désactivés, ils n'existent pas. Tous sont facultatifs par construction, et
  // ne pas les passer suffit à les retirer - « Éditer » emporte au passage
  // toutes les sections de catalogue, qui vivent derrière `modeEdition`.
  //
  // Les gestes plus fins (cocher un tome, suivre une édition) restent en place
  // et se heurtent au refus du serveur, expliqué en une phrase par
  // lib/useRefusDeVisite : les masquer un par un dans une quarantaine
  // d'endroits revenait à parier qu'aucun ne serait oublié.
  const { estInvite } = useAuth()
  const toast = useToast()
  const [filtre, setFiltre] = useState<FiltreTomes>('tous')
  const [question, setQuestion] = useState<QuestionAssistant | null>(null)
  const [ajoutTomeOuvert, setAjoutTomeOuvert] = useState(false)
  // Un seul éditeur personnel ouvert à la fois : ce sont trois relevés voisins
  // dans la même colonne, en ouvrir plusieurs repousserait celui qu'on lit.
  const [editeurPersonnel, setEditeurPersonnel] = useState<'tier' | 'experiences' | 'tags' | null>(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [editingCover, setEditingCover] = useState(false)
  const [remarquesInput, setRemarquesInput] = useState<string | null>(null)
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
   * La note de l'utilisateur sur l'ŒUVRE.
   *
   * Elle vivait sur chaque exemplaire (`ownership.note`), avec le prix payé et
   * les statuts vendu/perdu. Tout cela est parti avec le panneau du tome ; la
   * note, elle, reste - mais attachée au GROUPE, ce qu'on écrit d'une série
   * n'ayant presque jamais trait à un exemplaire précis (décision utilisateur
   * du 2026-08-27).
   *
   * Stockée dans les attributs de l'Entity : pas de migration pour un texte
   * libre, et le même chemin que le titre ou la jaquette.
   */
  const remarquesMutation = useMutation({
    mutationFn: (note: string) => mergeEntityAttributes(entityId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setRemarquesInput(null)
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
            await mergeEntityAttributes(entityId, aEcrire)
            infos = Object.keys(aEcrire).length
            attributs = { ...attributs, ...aEcrire }
          }
        }
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
  const jaquettesManquantes = variantsMissingCover(entity).length
  const dansEnvies = !!wishlist.entryFor(entityId)
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
                  state: { seriesTitle: entity.title, editionName: groupeActif.editionName },
                })
            : null
        }
        actionEnvies={
          isManga || estInvite ? null : (
            <BoutonEnviesHero dedans={dansEnvies} onBasculer={() => void basculerEnvies()} disabled={wishlist.isPending} />
          )
        }
        modeEdition={modeEdition}
        onBasculerMode={estInvite ? undefined : () => setModeEdition((v) => !v)}
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
                libelle="Tier list"
                ouvert={editeurPersonnel === 'tier'}
                onModifier={estInvite ? undefined : () => setEditeurPersonnel((v) => (v === 'tier' ? null : 'tier'))}
              >
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
                libelle="Ma note"
                ouvert={editeurPersonnel === 'experiences'}
                onModifier={estInvite ? undefined : () => setEditeurPersonnel((v) => (v === 'experiences' ? null : 'experiences'))}
              >
                {meilleureNote !== null ? (
                  <span className="font-display text-[23px] leading-tight font-semibold tracking-[-0.02em] text-accentText">
                    {meilleureNote} / 10
                  </span>
                ) : (
                  <span className="text-[13.5px] text-faint">Pas encore notée</span>
                )}
              </ReleveInspecteur>
              <ReleveInspecteur
                libelle="Mes remarques"
                ouvert={remarquesInput !== null}
                onModifier={() => setRemarquesInput((v) => (v === null ? remarques : null))}
              >
                {remarquesInput !== null ? (
                  <span className="flex flex-col gap-2 pt-1">
                    <textarea
                      value={remarquesInput}
                      onChange={(e) => setRemarquesInput(e.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="Ce que tu veux retenir sur cette série…"
                      className="w-full rounded-xl bg-surface px-3 py-2 text-[13.5px] text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
                    />
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remarquesMutation.mutate(remarquesInput.trim())}
                        disabled={remarquesMutation.isPending}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemarquesInput(null)}
                        className="text-xs text-textDim"
                      >
                        Annuler
                      </button>
                    </span>
                  </span>
                ) : remarques ? (
                  <span className="text-[13.5px] whitespace-pre-line text-textPrimary">{remarques}</span>
                ) : (
                  <span className="text-[13.5px] text-faint">Aucune</span>
                )}
              </ReleveInspecteur>
              <ReleveInspecteur
                libelle="Lectures"
                ouvert={editeurPersonnel === 'experiences'}
                onModifier={estInvite ? undefined : () => setEditeurPersonnel((v) => (v === 'experiences' ? null : 'experiences'))}
              >
                {experiences.length === 0 ? (
                  <span className="text-[13.5px] text-faint">Aucune enregistrée</span>
                ) : (
                  <span className="flex flex-col gap-0.5">
                    {experiences.slice(0, 4).map((experience) => {
                      const tome = entity.variants.find((v) => v.id === experience.variantId)
                      return (
                        <span key={experience.id} className="text-[13.5px] text-textPrimary">
                          · {tome ? variantLabel(tome) : 'Série entière'}
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
                libelle="Tags"
                ouvert={editeurPersonnel === 'tags'}
                onModifier={estInvite ? undefined : () => setEditeurPersonnel((v) => (v === 'tags' ? null : 'tags'))}
              >
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
            <div className="flex flex-col">
              {auteur && <RangeeInspecteur libelle={isManga ? 'Mangaka' : 'Auteur'}>{auteur}</RangeeInspecteur>}
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
              {groupeActif && groupeActif.editionName !== '' && (
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <EditionCorrectionSection
                    entityId={entityId}
                    entityTitle={entity.title}
                    editionName={groupeActif.editionName}
                    editionInfo={editionInfo}
                  />
                </div>
              )}
            </div>
          }
          source={
            <>
              <ColonneSource attributs={entity.attributes} />
              <span className="text-xs text-faint">
                Relations :{' '}
                {relFromQuery.data?.length || relToQuery.data?.length
                  ? `${(relFromQuery.data?.length ?? 0) + (relToQuery.data?.length ?? 0)} enregistrée(s)`
                  : 'aucune'}
              </span>
            </>
          }
        />
      </div>

      {/* L'éditeur du relevé qu'on vient de désigner, et lui seul - ouvert
          juste sous l'inspecteur, en pleine largeur parce qu'une colonne de
          240 px ne peut pas accueillir un formulaire. Le point d'entrée reste
          sur la ligne concernée : c'est là qu'on lit l'information, c'est là
          qu'on demande à la changer. */}
      {editeurPersonnel && (
        <div className="pt-4">
          <Carte>
            {editeurPersonnel === 'tier' && (
              <TierSummarySection
                entityId={entityId}
                entityTitle={entity.title}
                entityTypeLabel={entityType?.label ?? null}
                coverImageUrl={couvertureUrl}
              />
            )}
            {editeurPersonnel === 'experiences' && (
              <ExperiencesSection
                entityId={entityId}
                experiences={experiences}
                allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
                variants={entity.variants}
              />
            )}
            {editeurPersonnel === 'tags' && (
              <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data ?? []} />
            )}
          </Carte>
        </div>
      )}

      {/* « Éditer » ne garde que le CATALOGUE : ce que l'œuvre et son édition
          SONT, et les gestes qui les font exister ou disparaître. Ce que j'en
          pense - classement, note, lectures, tags - relève de l'intention
          « juger », celle d'un utilisateur normal, et s'édite depuis le relevé
          qui l'affiche (étude produit du 2026-08-27, §2 et §3). */}
      {modeEdition && (
        <div className="flex flex-col gap-5 pt-6">
          <div className="grid gap-5 min-[900px]:grid-cols-2 min-[900px]:items-start">
            <Carte>
              <EntityInfoSection
                entityId={entityId}
                attributes={entity.attributes}
                customFieldKeys={entityType?.customFieldKeys ?? []}
                ouvrirEdition={false}
                onEditionOuverte={() => {}}
                edition={
                  groupeActif && groupeActif.editionName !== ''
                    ? {
                        name: groupeActif.editionName,
                        totalVolumes: totalTomes,
                        publisher: editionInfo?.publisher ?? null,
                        outOfPrint: editionInfo?.outOfPrint ?? false,
                        betterEditionAnnounced: editionInfo?.betterEditionAnnounced ?? false,
                        betterEditionNote: editionInfo?.betterEditionNote ?? null,
                        ongoing,
                      }
                    : null
                }
              />
            </Carte>
            <Carte>
              <RelationshipsSection
                entityId={entityId}
                relationshipsFrom={relFromQuery.data ?? []}
                relationshipsTo={relToQuery.data ?? []}
              />
            </Carte>
          </div>
          {/* Toujours là, contrairement à l'ancien bouton de jaquettes qui
              n'apparaissait qu'en cas de manque : une œuvre dont toutes les
              images sont en place a quand même des informations à redemander
              (un tome de plus paru, un statut qui passe à « terminée »). Le
              décompte des jaquettes manquantes reste annoncé quand il y en a,
              c'est ce qui se voit à l'œil. */}
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
