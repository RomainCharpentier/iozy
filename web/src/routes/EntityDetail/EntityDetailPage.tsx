import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom'
import { getEntity, mergeEntityAttributes, renameEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { findEdition, getCompleteness } from '../../api/purchaseAnalysis'
import { getEntityTierSummary } from '../../api/tierLists'
import { followEdition, listFollowedEdition, unfollowEdition } from '../../api/followedEdition'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { useWishlist } from '../../lib/useWishlist'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { groupVariantsByEdition, resolveEditionView, variantLabel } from '../../lib/editionGroups'
import { buildTiles, ownedVolumeNumbers } from '../../lib/tomeTiles'
import { usePropositionTomes } from './usePropositionTomes'
import { useTeinteJaquette } from '../../lib/useTeinteJaquette'
import { CLASSE_BANDE_PLEINE_LARGEUR, CLASSE_CONTENU_BANDE } from '../../components/layout/AppShell'
import { TierBadge } from '../TierLists/TierBadge'
import { BoutonEnviesHero, FicheHero } from './FicheHero'
import { CartesEditions, type EditionAffichee } from './CartesEditions'
import { GrilleTomes, type FiltreTomes } from './GrilleTomes'
import { InspecteurFiche, RangeeInspecteur, ReleveInspecteur } from './InspecteurFiche'
import { AideFlottante } from './AideFlottante'
import { ReponseAssistant, type QuestionAssistant } from './AssistantSection'
import { VolumeInteractionPanel } from './VolumeInteractionPanel'
import { AddVolumeSection } from './AddVolumeSection'
import { TierSummarySection } from './TierSummarySection'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { EntityInfoSection } from './EntityInfoSection'
import { EditionCorrectionSection } from './EditionCorrectionSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import { Carte } from '../../components/Carte'
import { retourDepuis } from './retourFiche'
import { ArrowLeft } from 'lucide-react'

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
  const [filtre, setFiltre] = useState<FiltreTomes>('tous')
  const [tomeActif, setTomeActif] = useState<number | null>(null)
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

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameEntity(entityId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingTitle(false)
    },
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

  const groupes = entity && isManga ? resolveEditionView(groupVariantsByEdition(entity.variants)) : []
  const editionSuivie = followedQuery.data?.[0]?.editionName ?? null
  // L'édition ouverte par défaut est celle qu'on SUIT - c'est tout l'intérêt
  // de l'avoir persistée. À défaut, la première du catalogue.
  const groupeActif =
    groupes.find((g) => g.edition === editionAffichee) ??
    groupes.find((g) => g.edition === editionSuivie) ??
    groupes[0]
  const owned = groupeActif ? ownedVolumeNumbers(entity?.variants ?? [], ownerships, groupeActif.sourceEditions) : []

  // Une fiche peut exister sans le moindre tome - ajoutée en envies, ou
  // créée par un ajout qui n'a rien trouvé. C'est le même « quels tomes
  // possèdes-tu ? » que l'aperçu, donc le même hook (voir
  // usePropositionTomes) : une seule implémentation pour les deux écrans.
  const proposition = usePropositionTomes({
    entityTypeId: entity?.entityTypeId ?? '',
    titre: entity?.title ?? '',
    attributs: entity?.attributes ?? {},
    entityId,
    actif: !!entity && isManga && groupes.length === 0,
  })

  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entity?.title ?? '', groupeActif?.edition ?? '', owned),
    queryFn: () => getCompleteness(entity!.title, groupeActif!.edition, owned, groupeActif!.volumeNumbers, entityId),
    enabled: !!entity && !!groupeActif && groupeActif.edition !== '',
  })
  const editionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', groupeActif?.edition ?? ''),
    queryFn: () => findEdition(entity!.title, groupeActif!.edition, entityId),
    enabled: !!entity && !!groupeActif && groupeActif.edition !== '',
    retry: false,
  })
  const editionInfo = editionInfoQuery.isSuccess ? editionInfoQuery.data : null

  if (entityQuery.isPending) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (!entity) return null

  const totalTomes = completenessQuery.data?.totalVolumes ?? null
  const tuiles = groupeActif
    ? buildTiles(
        groupeActif,
        entity.variants,
        owned,
        totalTomes,
        completenessQuery.data?.cataloguedMissingVolumeNumbers ?? [],
      )
    : []
  const tuileActive = tuiles.find((t) => t.volumeNumber === tomeActif) ?? null

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
  const dansEnvies = !!wishlist.entryFor(entityId)
  const tomesVoulus = wishlist.variantsVoulus

  const editionsAffichees: EditionAffichee[] = groupes.map((groupe) => ({
    nom: groupe.edition,
    editeur: groupe.edition === groupeActif?.edition ? (editionInfo?.publisher ?? null) : null,
    total: groupe.edition === groupeActif?.edition ? totalTomes : groupe.volumeNumbers.length || null,
    possedes: ownedVolumeNumbers(entity.variants, ownerships, groupe.sourceEditions).length,
  }))

  const manquants = totalTomes !== null ? Math.max(totalTomes - owned.length, 0) : null
  const resumeEdition = [
    editionInfo?.publisher,
    totalTomes !== null
      ? `${owned.length} possédé${owned.length > 1 ? 's' : ''} sur ${totalTomes}`
      : `${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`,
    manquants !== null ? `${manquants} manquant${manquants > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

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
    const cible = { entityId, volumeNumber: numero, edition: groupeActif?.edition || undefined }
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
        onCouverture={() => {
          setCoverUrlInput(couvertureUrl ?? '')
          setEditingCover(true)
        }}
        onEvaluer={
          groupeActif
            ? () =>
                navigate('/purchase-analysis', {
                  state: { seriesTitle: entity.title, editionName: groupeActif.edition },
                })
            : null
        }
        actionEnvies={
          isManga ? null : (
            <BoutonEnviesHero dedans={dansEnvies} onBasculer={() => void basculerEnvies()} disabled={wishlist.isPending} />
          )
        }
        editions={
          groupes.length > 0 ? (
            <CartesEditions
              editions={editionsAffichees}
              editionAffichee={groupeActif?.edition ?? ''}
              editionSuivie={editionSuivie}
              onAfficher={(nom) => {
                setEditionAffichee(nom)
                setTomeActif(null)
              }}
              onSuivre={(nom) => suivreMutation.mutate(nom)}
              onNePlusSuivre={() => nePlusSuivreMutation.mutate()}
              onAjouterEdition={() => setAjoutTomeOuvert(true)}
              modeEdition={modeEdition}
              onBasculerMode={() => setModeEdition((v) => !v)}
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
            titre={groupeActif.edition || 'Édition non précisée'}
            resume={resumeEdition}
            filtre={filtre}
            onFiltre={setFiltre}
            tuiles={tuiles}
            tomeActif={tomeActif}
            onChoisirTome={setTomeActif}
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

          <VolumeInteractionPanel
            activeTile={tuileActive}
            onRenumbered={setTomeActif}
            onClose={() => setTomeActif(null)}
            entityId={entityId}
            entityTypeId={entity.entityTypeId}
            entityTitle={entity.title}
            editionName={groupeActif.edition}
            ownerships={ownerships}
          />
        </>
      )}

      <div className="pt-6">
        <InspecteurFiche
          teinte={teinte}
          personnel={
            <>
              <ReleveInspecteur libelle="Tier list">
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
              <ReleveInspecteur libelle="Ma note">
                {meilleureNote !== null ? (
                  <span className="font-display text-[23px] leading-tight font-semibold tracking-[-0.02em] text-accentText">
                    {meilleureNote} / 10
                  </span>
                ) : (
                  <span className="text-[13.5px] text-faint">Pas encore notée</span>
                )}
              </ReleveInspecteur>
              <ReleveInspecteur libelle="Lectures">
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
              <div className="flex flex-wrap items-center gap-1.5">
                {entity.tagIds.length === 0 ? (
                  <span className="text-xs text-faint">Aucun tag</span>
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
              {groupeActif && groupeActif.edition !== '' && (
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  <EditionCorrectionSection
                    entityId={entityId}
                    entityTitle={entity.title}
                    editionName={groupeActif.edition}
                    editionInfo={editionInfo}
                  />
                </div>
              )}
            </div>
          }
          source={
            <>
              <div className="flex flex-col">
                {CLES_SOURCE.map(({ cle, libelle }) => {
                  const valeur = entity.attributes[cle]
                  if (valeur === null || valeur === undefined || valeur === '') return null
                  return (
                    <RangeeInspecteur key={cle} libelle={libelle} compact>
                      {String(valeur)}
                    </RangeeInspecteur>
                  )
                })}
              </div>
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

      {/* Les éditeurs complets, déjà construits, révélés par le pinceau. Ils
          ne sont pas une deuxième version de l'inspecteur : celui-ci montre,
          ceux-là modifient. */}
      {modeEdition && (
        <div className="flex flex-col gap-5 pt-6">
          <div className="grid gap-5 min-[900px]:grid-cols-2 min-[900px]:items-start">
            <Carte className="flex flex-col gap-5">
              <TierSummarySection
                entityId={entityId}
                entityTitle={entity.title}
                entityTypeLabel={entityType?.label ?? null}
                coverImageUrl={couvertureUrl}
              />
              <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data ?? []} />
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
              <EntityInfoSection
                entityId={entityId}
                attributes={entity.attributes}
                customFieldKeys={entityType?.customFieldKeys ?? []}
                ouvrirEdition={false}
                onEditionOuverte={() => {}}
                edition={
                  groupeActif && groupeActif.edition !== ''
                    ? {
                        name: groupeActif.edition,
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
          <div className="flex items-center gap-3">
            <DeleteEntitySection entityId={entityId} entityTitle={entity.title} />
            <button type="button" onClick={() => setEditingTitle(true)} className="text-[13px] text-textDim underline">
              Renommer la série
            </button>
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
              ownerships={ownerships}
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

/** Les rouages recopiés d'un fournisseur - colonne SOURCE de la maquette.
 *  Liste fermée et ORDONNÉE : c'est l'ordre de la maquette, pas celui,
 *  imprévisible, des clés du sac d'attributs. */
const CLES_SOURCE: { cle: string; libelle: string }[] = [
  { cle: 'malId', libelle: 'malId' },
  { cle: 'titleRomaji', libelle: 'Titre romaji' },
  { cle: 'titleJapanese', libelle: 'Titre japonais' },
  { cle: 'seriesStatus', libelle: 'Statut source' },
  { cle: 'totalVolumes', libelle: 'Nb de tomes source' },
  { cle: 'endYear', libelle: 'Année de fin' },
]

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
