import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { getEntity, mergeEntityAttributes, mergeVariantAttributes, quickAdd, renameEntity } from '@/common/api/entities'
import { deleteOwnership, listOwnerships } from '@/common/api/ownerships'
import { detailsOeuvre, rechercherOeuvrePossedee, searchVolumes } from '@/common/api/metadata'
import { findBestCoverMatch, rattraperJaquettes, variantsMissingCover } from '@/common/lib/backfillCovers'
import { listExperiences } from '@/common/api/experiences'
import { listTags } from '@/common/api/tags'
import { relationshipsFrom, relationshipsTo } from '@/common/api/relationships'
import { listEntityTypes } from '@/common/api/entityTypes'
import { getEntityProgress } from '@/common/api/insights'
import { findEdition } from '@/common/api/purchaseAnalysis'
import { getEntityTierSummary } from '@/common/api/tierLists'
import { followEdition, listFollowedEdition, unfollowEdition } from '@/common/api/followedEdition'
import { isSeriesOngoing, libelleStatutSerie } from './seriesInfo'
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
import { attributsARecharger, avecDetails, candidatCorrespondant, identifiantsSource } from './rechargerSource'
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
import { ReponseAssistant, ReponseCatalogue, type QuestionAssistant } from './AssistantSection'
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
import { SqueletteFiche } from '@/common/components/Squelette'

/**
 * The detail page of a work, after the mockup "Fiche série - multi-éditions".
 *
 * <h2>The page has three bands</h2>
 * A top band tinted by the cover (identity + row of editions),
 * the dense grid of the volumes of the displayed edition, and an inspector with three
 * columns (personal / work / source). No more tabs: everything is there, and
 * it is the structure of the page that does the sorting.
 *
 * <h2>Read, then edit</h2>
 * The brush button of the mockup switches the whole page between two states.
 * At rest it is READ: compact readouts, no form, no stray "+".
 * In edit mode the add points appear (follow an
 * edition, add a volume) and, under the inspector, the full editors already
 * built (rankings, experiences, tags, information, relationships,
 * deletion). None of these editors was rewritten for this mockup -
 * they change when they appear, not how they behave.
 *
 * <h2>Displaying an edition is not following it</h2>
 * Two separate things, long mixed up in a single `useState`:
 * the DISPLAYED edition is a screen state, the FOLLOWED edition is persisted
 * data (see com.iozycore.domain.followededition). It is the one that decides
 * what is opened on the next visit.
 */
/** Default values with a STABLE identity: passed to the inspector draft
 *  while the work is not loaded, a fresh `{}` or `[]` at
 *  each render would restart its reset effect in a loop. */
const VIDE: Record<string, unknown> = {}
const AUCUN: string[] = []
/** The internals that a manga can fill in even when absent (see useBrouillonInspecteur). */
const CLES_SOURCE_MANGA = CLES_SOURCE.map((c) => c.cle)

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Where the user comes from, when the previous screen took the trouble to say so (see
  // retourFiche). Absent on a reloaded detail page or one received by link: the
  // shortcut then disappears, the page stays whole.
  const retour = retourDepuis(useLocation().state)
  const wishlist = useWishlist()
  const suivis = useOeuvresSuivies()

  const [editionAffichee, setEditionAffichee] = useState<string | null>(null)
  const [modeEdition, setModeEdition] = useState(false)
  /** "Terminer" was requested while the inspector draft has
   *  changed: leaving waits for the user to save or discard. */
  const [sortieDemandee, setSortieDemandee] = useState(false)
  // A visit changes nothing: the edit entry points are not
  // disabled, they do not exist. All are optional by construction, and
  // not passing them is enough to remove them - "Éditer" takes with it
  // all the catalog sections, which live behind `modeEdition`.
  //
  // The finer gestures (checking a volume, following an edition) stay in place
  // and run into the refusal of the server, explained in one sentence by
  // lib/useRefusDeVisite: hiding them one by one in about forty
  // places amounted to betting that none would be forgotten.
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
   * "Je l'ai" on a missing volume - one click, nothing to fill in.
   *
   * The volume panel no longer opens on this path: it only existed there
   * to carry the condition and price form, which is gone (see the previous
   * batch). It remains the surface of an OWNED volume, where it manages a
   * real copy - price paid, rating, sold/lost, past copies.
   *
   * `quickAdd` finds or creates the volume by (title, number, edition), as
   * everywhere else: nothing new is invented here.
   */
  const ajoutTome = useMutation({
    mutationFn: async (tome: {
      entityTypeId: string
      titre: string
      numero: number
      edition?: string
      /** Filled in only when this add UNDOES a removal: the copy is then restored
       *  as it was, not a new one dated today. */
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

      // Ownership is written: the screen shows it RIGHT AWAY. What
      // follows (the cover) is a search at providers, from two
      // to thirty seconds depending on their mood - the tile stayed "missing"
      // all that time, and the E2E flow measured it (2026-09-05).
      invaliderApresPossession(queryClient)

      // The cover of the volume, searched right away - and without asking anything.
      //
      // `quickAdd` only saves one if the caller gives it one: a volume
      // added with one click from the grid was therefore born without an image, while
      // those coming from a proposal had one. Seen on Death Note.
      //
      // Best-effort by nature: quota exceeded, silent provider or no
      // match simply leave the volume without a cover - never an
      // error on screen for an add that did succeed. The grouped
      // catch-up stays available from Ma collection (see backfillCovers).
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
          // See above: the add comes first, the cover is a bonus.
        }
      }
      return resultat
    },
    onSuccess: () => invaliderApresPossession(queryClient),
  })

  /**
   * Clicking an OWNED volume turns it back into missing.
   *
   * It is the opposite gesture of "Je l'ai", and the only way left to leave
   * the third state since the volume panel is gone (user
   * decision of 2026-08-27: keep only owned / wish / missing, no more
   * rating at group level).
   *
   * Deletes the Ownership rather than marking it sold: "vendu" and
   * "perdu" were removed with the panel, so only one meaning is left for
   * this gesture - I no longer have it.
   */
  /** The number of a volume from the id of its variant - the undo
   *  of a removal must add THE SAME volume back, and `quick-add` designates it by its
   *  number. Goes through `numeroDe`, the only reading of an attribute bag (Batch 62). */
  function numeroDeVariant(variantId: string | null): number | null {
    if (!variantId) return null
    const variante = entity?.variants.find((v) => v.id === variantId)
    return variante ? numeroDe(variante) : null
  }

  /**
   * Remove a volume, with the possibility of going back.
   *
   * <p>The removal DELETES the Ownership: neither "vendu" nor "perdu" remain
   * since Batch 55, so nothing keeps a trace of it. One click too many on a tile
   * thus erased the real acquisition date, and the only way to go
   * back - clicking again - made a new one, dated today.
   * Seen on 2026-08-28 on a volume that went from 26/08 to 28/08.
   *
   * <p>Same convention as the wishes (see useWishlist): a short message and
   * "Annuler". The undo gives back the copy as it was - its date, its
   * condition, its purchase price. Its possible rating does not come back: the field
   * lost its screen in Batch 55 and `quick-add` does not carry it.
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
   * "Recharger depuis la source" for THIS work: its information, then
   * the covers of its volumes.
   *
   * <h2>One gesture, because it is one question</h2>
   * "Ask the source again what it knows." The cover catch-up
   * already existed here, but the attributes of the work (mangaka, status, number
   * of volumes, series cover) were only copied AT THE TIME OF THE ADD and never
   * again - an ongoing series kept forever the number of volumes of the
   * day it was added. Two buttons side by side for "reload" and
   * "reload also" would have helped nobody (user request of
   * 2026-08-27: "je veux un bouton pour recharger les images ou les infos
   * api").
   *
   * <h2>Order matters</h2>
   * Information first: if the source tells us the mangaka, the
   * volume search that follows uses it to aim right. The covers of
   * volumes go through the same catch-up as Ma collection, for one series.
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
        // A source that does not answer is NOT an unknown work - same
        // distinction as in batch 58, on the server side. The covers are tried
        // anyway: they do not depend on the same providers.
        fournisseurMuet = true
      }

      if (candidats) {
        let candidat = candidatCorrespondant(candidats, oeuvre)
        if (!candidat) {
          sansCorrespondance = true
        } else {
          // What the search does not give (a board game's cover, players,
          // designers: batch 160). A silent source answers {} and the search
          // result is used alone, as before.
          const identifiants = identifiantsSource({ ...oeuvre.attributes, ...candidat.attributes })
          if (Object.keys(identifiants).length > 0) {
            try {
              candidat = avecDetails(candidat, await detailsOeuvre(oeuvre.entityTypeId, identifiants))
            } catch {
              fournisseurMuet = true
            }
          }
          const aEcrire = attributsARecharger(candidat, oeuvre)
          if (Object.keys(aEcrire).length > 0) {
            // origine=source: the server keeps the keys entered by hand
            // and does not rewrite them, even if this filter were bypassed.
            await mergeEntityAttributes(entityId, aEcrire, 'source')
            infos = Object.keys(aEcrire).length
            attributs = { ...attributs, ...aEcrire }
          }
        }
      }

      // The list of volumes too, forcing the source (Batch 121): the durable
      // cache never expires, and a list saved while a
      // provider was silent would stay incomplete forever - "Ajouter un
      // tome" would never offer the missing ones. A source that does not
      // answer does not make the rest of the reload fail.
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

  // Everything below lives BEFORE the early returns: a Hook cannot
  // be called conditionally.
  const entity = entityQuery.data ?? null
  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity?.entityTypeId)
  const isManga = entityType?.code === 'MANGA'
  const couvertureUrl = entity ? coverImageUrlFrom(entity.attributes) : null
  const teinte = useTeinteJaquette(couvertureUrl)

  /**
   * "X volumes owned out of Y", asked from the server.
   *
   * <h2>The last of the three computations</h2>
   * This page grouped the volumes by edition, re-read the Ownership records to
   * know which are owned, then sent all that back to completeness to
   * get a total. Three derivations for a question that
   * `CollectionProgressService` already answers - and the absence of ONE rule (a
   * cataloged volume without an edition joins the only named edition of the series) has
   * produced two real divergences, in batches 31 and 49. Ma collection stopped
   * recomputing in batch 51; this was the last one.
   *
   * <p>Launched in parallel with the detail page (no `enabled` on the type): it
   * only depends on the id, already in the URL. Waiting for it therefore costs nothing
   * more than the slower of the two requests - and showing nothing as long as
   * we do not know is the rule of batch 47.
   */
  const progressQuery = useQuery({
    queryKey: queryKeys.insights.progressOf(entityId),
    queryFn: () => getEntityProgress(entityId),
  })

  const groupes = isManga ? (progressQuery.data?.editions ?? []) : []
  const editionSuivie = followedQuery.data?.[0]?.editionName ?? null
  // The edition opened by default is the one being FOLLOWED - this is the whole point
  // of having persisted it. Failing that, the first of the catalog.
  const groupeActif =
    groupes.find((g) => g.editionName === editionAffichee) ??
    groupes.find((g) => g.editionName === editionSuivie) ??
    groupes[0]

  // A detail page can exist without any volume - added to the wishes, or
  // created by an add that found nothing. It is the same "quels tomes
  // possèdes-tu ?" as the preview, so the same hook (see
  // usePropositionTomes): a single implementation for both screens.
  const proposition = usePropositionTomes({
    entityTypeId: entity?.entityTypeId ?? '',
    titre: entity?.title ?? '',
    attributs: entity?.attributes ?? {},
    entityId,
    modeEdition,
    // `progressQuery.isSuccess` as much as the count: Hooks also run
    // while the progress is in flight, where `groupes` is still
    // empty - without this guard, a series that has twelve volumes would trigger a
    // volume search at providers on every opening of a detail page.
    //
    // Never for a visitor: this is the "quels tomes possèdes-tu ?" of an ADD,
    // and the volume search behind it asks providers for every edition.
    actif: !!entity && isManga && progressQuery.isSuccess && groupes.length === 0 && !estInvite,
  })

  const editionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', groupeActif?.editionName ?? ''),
    queryFn: () => findEdition(entity!.title, groupeActif!.editionName, entityId),
    enabled: !!entity && !!groupeActif && groupeActif.editionName !== '',
    retry: false,
  })
  const editionInfo = editionInfoQuery.isSuccess ? editionInfoQuery.data : null

  // Progress is part of what we wait for: without it, the grid would say
  // "aucun tome" to a series that has twelve (see batch 47).
  // Before the guards below, like any Hook: the page renders nothing as long as
  // the work is not there, and the draft resets as soon as it
  // arrives (see useBrouillonInspecteur).
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

  if (entityQuery.isPending || progressQuery.isPending) return <SqueletteFiche />
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (progressQuery.isError) return <ErrorBanner message={progressQuery.error.message} />
  if (!entity) return null

  const totalTomes = groupeActif?.totalVolumes ?? null
  const tuiles = groupeActif ? buildTiles(groupeActif, entity.variants) : []

  const auteur = creatorFrom(entity.attributes)
  const ongoing = isSeriesOngoing(entity.attributes)
  const statutSerie = libelleStatutSerie(entity.attributes.seriesStatus)
  const startYear = typeof entity.attributes.startYear === 'string' ? entity.attributes.startYear : null
  const endYear = typeof entity.attributes.endYear === 'string' ? entity.attributes.endYear : null
  const annees = startYear ? (endYear ? `${startYear} → ${endYear}` : ongoing ? `Depuis ${startYear}` : startYear) : null
  const generalRank = tierSummaryQuery.data?.generalRank ?? null
  const notes = experiences.map((e) => e.rating).filter((r): r is number => r !== null)
  const meilleureNote = notes.length > 0 ? Math.max(...notes) : null
  // The heart of the top band only applies to a work that is owned as a
  // single piece. For a manga, the series is a GROUP: we do not want
  // "Naruto", we want volume 47 - and it is the grid that says it.
  const remarques = typeof entity.attributes.note === 'string' ? entity.attributes.note : ''
  // While reading, the PERSONAL column only shows what exists: five stacked
  // "Aucune" / "Pas encore" lines said five times that nothing was there
  // (UI review of 2026-10-13). Edit mode still shows every readout.
  const persoVide =
    generalRank === null && meilleureNote === null && !remarques && experiences.length === 0 && entity.tagIds.length === 0

  /**
   * A single "Éditer" for the whole page (user request of
   * 2026-09-04): it opens the personal editors - ranking, rating and
   * readings, tags - and turns the fields of the inspector into input
   * fields, in the same place (see useBrouillonInspecteur). The draft
   * restarts from the database each time the mode is left.
   */
  function basculerModeEdition() {
    if (!modeEdition) {
      setModeEdition(true)
      return
    }
    // "Terminer" with a modified draft: we throw nothing away without
    // saying so. An inline panel under the inspector, same idiom as the
    // deletions (see EntityTypesPage) - no window.confirm.
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
  // Only one state at a time (Owned / Followed / Wish). Followed wins in
  // the display: one follows what one still collects, even with volumes in
  // hand; then owned; then wanted.
  const etatCollection = suivie
    ? { libelle: 'Suivie', couleur: 'var(--color-accentText)' }
    : possedee
      ? { libelle: 'Possédée', couleur: 'var(--color-ok)' }
      : dansEnvies
        ? { libelle: 'Dans mes envies', couleur: 'var(--color-warning)' }
        : null
  const tomesVoulus = wishlist.variantsVoulus

  // `totalVolumes` ALONE, never the number of cataloged volumes as a fallback: that
  // fallback announced "2 tomes possédés sur 2" to someone whose edition
  // was never filled in - a collection declared complete while
  // the application knows nothing about its size. It contradicted the comment of
  // CartesEditions right next to it ("deducing it from the number of volumes a
  // search BROUGHT BACK would poison the completeness engine") and the
  // documentation of EditionAffichee.total ("null as long as no source
  // knows it"). Found by the end-to-end flow of flow 8.
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
   * "Je le veux" / "Retirer" on ONE volume of the displayed edition.
   *
   * The volume is designated by its number and not by its id: on a detail
   * page, most missing volumes are deduced from the total of the edition
   * and are cataloged nowhere. It is the backend that makes them exist
   * along the way (see TomeResolver), without ever creating an ownership.
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
      {/* Before the hero, so the band no longer sticks to the top: without it, it
          would go up over this link (see FicheHero.colleEnHaut). */}
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
                    // The analysis is no longer a destination of the navigation
                    // (batch 137): it says where the user comes from, and it is here.
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
        etat={estInvite ? null : etatCollection}
        modeEdition={modeEdition}
        onBasculerMode={estInvite ? undefined : basculerModeEdition}
        editions={
          groupes.length > 0 ? (
            <CartesEditions
              editions={editionsAffichees}
              editionAffichee={groupeActif?.editionName ?? ''}
              editionSuivie={editionSuivie}
              onAfficher={(nom) => setEditionAffichee(nom)}
              // Following an edition is a personal choice: absent for a visitor.
              onSuivre={estInvite ? undefined : (nom) => suivreMutation.mutate(nom)}
              onNePlusSuivre={estInvite ? undefined : () => nePlusSuivreMutation.mutate()}
              consultation={estInvite}
              onAjouterEdition={() => setAjoutTomeOuvert(true)}
              modeEdition={modeEdition}
            />
          ) : (
            // Nothing in the catalog: these are the editions offered by the
            // provider, and the gauge counts what is checked.
            proposition.cartesEditions
          )
        }
      />

      {/* Renaming and cover: two rare corrections, on the band, right
          under what they change. They do not deserve a permanent field. */}
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
            onChoisirTome={(numero) =>
              // A missing volume enters the collection in one gesture: nothing to
              // fill in, nothing to lose.
              ajoutTome.mutate({ entityTypeId: entity.entityTypeId, titre: entity.title, numero, edition: groupeActif?.editionName || undefined })
            }
            onRetirerTome={(numero) => {
              // Removal only comes on the second gesture - the tile asks
              // the question (see GrilleVolumes): it deletes the copy, and
              // "Annuler" has only six seconds to give it back.
              const tuile = tuiles.find((t) => t.volumeNumber === numero)
              if (tuile?.status === 'owned' && tuile.variant) {
                retraitTome.mutate(ownerships.filter((o) => o.variantId === tuile.variant!.id))
              }
            }}
            onJeLAi={(numero) =>
              ajoutTome.mutate({ entityTypeId: entity.entityTypeId, titre: entity.title, numero, edition: groupeActif?.editionName || undefined })
            }
            tomesVoulus={tomesVoulus}
            onBasculerEnvie={basculerEnvieDuTome}
            modeEdition={modeEdition}
            onAjouterTome={() => setAjoutTomeOuvert(true)}
            // A visitor sees the volumes of the edition, not holes in a
            // collection they do not have, and no "Je l'ai" / "Je le veux".
            consultation={estInvite}
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
          // Nothing personal for a visitor (see InspecteurFiche).
          personnel={
            estInvite ? undefined : !modeEdition && persoVide ? (
              <div className="flex flex-col items-start gap-2.5">
                <span className="text-[13.5px] text-textDim">Rien de personnel pour l&apos;instant.</span>
                <button type="button" onClick={basculerModeEdition} className="btn-secondaire">
                  Noter, classer, ajouter un tag
                </button>
              </div>
            ) : <>
              {(modeEdition || generalRank) && (
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
              )}
              {/* The rating LIVES on an experience (see Experience.rating): it is
                  the same editor that carries it, and offering two entry points
                  for the same data would amount to inventing a second one. */}
              {(modeEdition || meilleureNote !== null) && (
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
              )}
              {(modeEdition || remarques) && (
              <ReleveInspecteur libelle="Mes remarques">
                {modeEdition ? (
                  <textarea
                    value={brouillon.attributs.valeur('note')}
                    onChange={(e) => brouillon.attributs.saisir('note', e.target.value)}
                    rows={3}
                    placeholder="Ce que tu veux retenir sur cette œuvre…"
                    aria-label="Mes remarques"
                    className="champ w-full"
                  />
                ) : remarques ? (
                  <span className="text-[13.5px] whitespace-pre-line text-textPrimary">{remarques}</span>
                ) : (
                  <span className="text-[13.5px] text-faint">Aucune</span>
                )}
              </ReleveInspecteur>
              )}
              {(modeEdition || experiences.length > 0) && (
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
              )}
              {/* The tags floated under the three readouts, without a heading: they
                  therefore had nothing to carry their own entry point. */}
              {(modeEdition || entity.tagIds.length > 0) && (
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
              )}
            </>
          }
          oeuvre={
            modeEdition ? (
              // The SAME rows as in reading, as input fields - all of them,
              // even empty, this is where one completes what the source did not
              // give (user request of 2026-09-05). The status is entered
              // in the SOURCE column ("Statut source"), where it comes from.
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
              {/* "Auteur" topped the studio of a video game: the word follows the attribute read (see creatorFrom). */}
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
          sourceRepliee={!modeEdition}
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
              className="btn-primaire"
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
              className="btn-primaire"
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

      {/* The personal editors - ranking, rating and readings, tags -
          all open with edit mode, right under the inspector, at
          full width because a 240 px column cannot hold
          a form. A single "Éditer" for the whole page (user
          request of 2026-09-04): no more "Modifier" per readout. */}
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

      {/* The CATALOG: what the work and its edition ARE, and the gestures that
          make them exist or disappear. Under the same "Éditer" as the
          personal editors above, since 2026-09-04. */}
      {modeEdition && (
        <div className="flex flex-col gap-5 pt-6">
          {/* The information of the work and its edition is no longer here:
              it is entered in the inspector itself, in the place where it
              is read (user request of 2026-09-05). */}
          <Carte>
            <RelationshipsSection
              entityId={entityId}
              relationshipsFrom={relFromQuery.data ?? []}
              relationshipsTo={relToQuery.data ?? []}
            />
          </Carte>
          {/* Always there, unlike the old covers button that
              only appeared when something was missing: a work whose images
              are all in place still has information to ask again
              (one more volume released, a status that becomes "terminée"). The
              count of missing covers is still announced when there are some,
              this is what is visible to the eye. */}
          {/* Administrator only (request of 2026-09-04): they are the one who
              answers for the uniform data of the instance and the quotas of the
              providers. The server ignores the forced reload for the
              other accounts. */}
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

          {/* Identity corrections stay with the rest of the editors;
              what DESTROYS lives below, in a block that says so. */}
          <button
            type="button"
            onClick={() => {
              setTitleInput(entity.title)
              setEditingTitle(true)
            }}
            className="flex min-h-11 w-fit items-center text-[13px] text-textDim underline"
          >
            Renommer l’œuvre
          </button>

          {/* Visually separated and named, at the bottom of the edit space
              (product study of 2026-08-27, section 3): a final action must
              not be found by accident in the middle of ordinary
              corrections. The confirmation lives in the button itself. */}
          <div className="mt-2 flex flex-col gap-2.5 rounded-2xl border border-danger/30 bg-dangerTint p-4">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-dangerText uppercase">
              Zone sensible
            </span>
            <p className="text-[13px] text-textDim">
              Supprimer la fiche efface l’œuvre du catalogue. Contrairement à « vendu » ou « perdu », qui
              gardent une trace, c&apos;est définitif - et refusé tant qu&apos;un exemplaire ou une lecture y
              est rattaché.
            </p>
            <DeleteEntitySection entityId={entityId} entityTitle={entity.title} />
          </div>
        </div>
      )}

      {/* Room for the floating "Aide": at the bottom of the page it covered
          the end of the inspector. On a wide screen too - at 1280 px the
          content reaches the edge, and the button sat on the panel's corner
          (UI review of 2026-10-13). */}
      <div aria-hidden="true" className="h-14" />

      <AideFlottante
        titreSerie={entity.title}
        /* The questions depend on what the type ALLOWS. "Que me
           manque-t-il ?" is computed on the completeness of an edition: asked
           on a video game, it answered "Tes tomes n'ont pas d'édition
           précisée… Renseigne l'édition sur un tome", that is to say
           manga vocabulary in front of a work that has neither volume nor edition.
           And "mes lectures" only applies to what is read - the type
           declares its own experiences itself (see EntityType.allowedExperienceTypes). */
        /* A visitor has no collection and no readings: their questions are
           about the work, and only those the data can answer. */
        questions={
          estInvite
            ? [
                ...(groupeActif ? [{ cle: 'volumes' as const, libelle: 'Combien de tomes compte cette édition ?' }] : []),
                ...(statutSerie ? [{ cle: 'status' as const, libelle: 'Cette série est-elle terminée ?' }] : []),
                ...(groupes.length > 0 ? [{ cle: 'editions' as const, libelle: 'Quelles éditions sont connues ?' }] : []),
                ...(auteur ? [{ cle: 'author' as const, libelle: isManga ? 'Qui est le mangaka ?' : "Qui est l'auteur ?" }] : []),
              ]
            : [
                ...(groupeActif ? [{ cle: 'missing' as const, libelle: 'Que me manque-t-il ?' }] : []),
                { cle: 'reading' as const, libelle: libelleQuestionExperiences(entityType?.allowedExperienceTypes ?? []) },
              ]
        }
        question={question}
        onQuestion={setQuestion}
        reponse={
          question === 'missing' || question === 'reading' ? (
            <ReponseAssistant
              entityId={entityId}
              entityTitle={entity.title}
              variants={entity.variants}
              experiences={experiences}
              activeGroup={groupeActif ?? null}
              missingKnownVolumes={tuiles.filter((t) => t.status !== 'owned').map((t) => t.volumeNumber)}
              question={question}
            />
          ) : question ? (
            <ReponseCatalogue
              question={question}
              editionName={groupeActif?.editionName ?? ''}
              totalVolumes={totalTomes}
              shownVolumes={tuiles.map((t) => t.volumeNumber)}
              editions={editionsAffichees}
              seriesStatus={statutSerie}
              ongoing={ongoing}
              years={annees}
              creator={auteur}
              creatorLabel={isManga ? 'Mangaka' : 'Auteur'}
            />
          ) : null
        }
      />
    </>
  )
}

/**
 * The title of the progress question, in the vocabulary of the type.
 *
 * A type declares its experiences ("Read", "Play", "Watch"...): it is the
 * only source that knows whether one READS, PLAYS or WATCHES this work. Failing that,
 * a neutral wording - never "mes lectures" placed at random in front of a
 * video game.
 */
function libelleQuestionExperiences(typesDExperience: string[]): string {
  // The codes really shipped by this catalog: READ (manga), PLAYED (board
  // game), FINISHED (video game), plus ABANDONED/IN_PROGRESS shared.
  // The latter describe a STATE, not a gesture - so they name nothing,
  // and the neutral wording takes over rather than an invented word.
  const codes = typesDExperience.map((t) => t.toUpperCase())
  if (codes.includes('READ')) return 'Où en suis-je dans mes lectures ?'
  if (codes.includes('PLAYED')) return 'Où en suis-je dans mes parties ?'
  if (codes.includes('WATCHED')) return 'Où en suis-je dans mes visionnages ?'
  return 'Où en suis-je ?'
}

/**
 * What the reload gave, in one sentence.
 *
 * Three cases look alike on screen and call for three different gestures:
 * the source did not answer (try again), it answered but does not know
 * this work (nothing to expect from a second click), it answered and everything was
 * already up to date. Mixing them under a "nothing found" was exactly the
 * defect of batch 58.
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
    // What was done comes first, even if a source stayed silent on the side:
    // the user sees the result, and the rest will be tried again.
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
        className="champ min-w-0 flex-1"
      />
      <button
        type="button"
        onClick={onValider}
        disabled={!valeur.trim() || enCours}
        className="btn-primaire shrink-0"
      >
        Enregistrer
      </button>
      <button type="button" onClick={onAnnuler} className="shrink-0 rounded-lg px-2 py-2 text-sm text-textDim">
        Annuler
      </button>
    </div>
  )
}
