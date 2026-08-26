import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { AlertTriangle, Pencil, Scale } from 'lucide-react'
import { getEntity, mergeEntityAttributes, renameEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { findEdition, getCompleteness } from '../../api/purchaseAnalysis'
import { getEntityTierSummary } from '../../api/tierLists'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { WishlistToggle } from '../../components/WishlistToggle'
import { Carte } from '../../components/Carte'
import { EnTeteSection } from '../../components/EnTeteSection'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import { groupVariantsByEdition, ownedVolumeNumbers, resolveEditionView } from '../../lib/editionGroups'
import { TomesGridSection } from './TomesGridSection'
import { TierSummarySection } from './TierSummarySection'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import { EditionCorrectionSection } from './EditionCorrectionSection'
import { EditionUpgradeWishToggle } from './EditionUpgradeWishToggle'
import { BarreSectionsFiche, type DefinitionSection, type SectionFiche } from './BarreSectionsFiche'
import { BoutonsAssistant, ReponseAssistant, type QuestionAssistant } from './AssistantSection'
import { EntityInfoSection } from './EntityInfoSection'
import { FicheHero } from './FicheHero'

/**
 * La fiche d'une œuvre, d'après la maquette v4.
 *
 * <h2>Une section à la fois, à toutes les largeurs</h2>
 * La version précédente montrait « Mes tomes » en pleine largeur puis deux
 * colonnes côte à côte, et ne repliait la fiche en onglets qu'en dessous de
 * 900px. La maquette v4 tranche l'inverse : trois sections numérotées, une
 * seule visible, du téléphone au grand écran.
 *
 * <p>Ce n'est pas un choix de mise en page mais de lecture. Les trois sections
 * sont les trois axes du modèle - ce que je POSSÈDE, ce que j'en PENSE, ce que
 * l'œuvre EST - et ce sont trois questions qu'on ne se pose pas en même temps.
 * Les afficher ensemble obligeait à trier soi-même à chaque coup d'œil, et
 * produisait deux colonnes dont l'une finissait systématiquement plus courte
 * que l'autre (mesuré : 566px contre 799px sur une même fiche).
 *
 * <h2>Ce que le hero absorbe</h2>
 * Le haut de page répond désormais aux trois questions immédiates - où j'en
 * suis, ce que j'en pense, quelle édition je suis - sans qu'aucune section ne
 * soit ouverte (voir FicheHero). L'ancienne EditionProgressSection est
 * dissoute : sa barre de progression est devenue l'anneau du hero, sa ligne
 * d'édition un relevé du hero, ses pastilles de choix d'édition ont rejoint
 * « Mes tomes » (la seule chose qu'une édition commande), et ses
 * avertissements sont restés en haut, là où se forme l'envie de changer
 * d'édition.
 */
export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Correction manuelle de la couverture de SÉRIE (audit UX "correction
  // manuelle") - le Tome a sa propre correction équivalente dans
  // VolumeInteractionPanel (voir VariantCoverEditor), jamais la Série
  // elle-même jusqu'ici. Action secondaire (icône crayon discrète sur la
  // jaquette), pas un champ de formulaire permanent.
  const [editingCover, setEditingCover] = useState(false)
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const coverMutation = useMutation({
    mutationFn: (coverImageUrl: string) => mergeEntityAttributes(entityId, { [COVER_IMAGE_ATTRIBUTE_KEY]: coverImageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingCover(false)
    },
  })
  // Correction manuelle du NOM de série (voir migration "Série -> Édition
  // par ID", historique de la conversation) : ne casse plus les
  // Éditions/Tomes déjà rattachés, leur lien passe désormais par entityId,
  // jamais par une égalité de titre - même action secondaire discrète que
  // la couverture ci-dessus.
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const renameMutation = useMutation({
    mutationFn: (title: string) => renameEntity(entityId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingTitle(false)
    },
  })
  // Édition sélectionnée : partagée entre le hero (relevé « Édition suivie »,
  // anneau de progression) et la grille de tomes, qui doivent réagir au même
  // changement. Déclarée avant les retours anticipés ci-dessous (règle des
  // Hooks), même si sa valeur ne prend son sens qu'une fois `entity` chargée.
  const [activeEdition, setActiveEdition] = useState<string | null>(null)
  /**
   * La section visible. Un état local plutôt que l'URL : c'est une façon de
   * regarder la même fiche, pas une destination. Mettre la section dans l'URL
   * ferait de chaque changement d'angle une entrée d'historique, et le bouton
   * Retour ne ramènerait plus à l'écran précédent mais à la section
   * précédente.
   */
  const [section, setSection] = useState<SectionFiche>('tomes')
  const barreRef = useRef<HTMLDivElement>(null)
  // L'assistant est fermé par défaut, comme dans la maquette : deux questions
  // toujours visibles pousseraient les sections vers le bas sur toutes les
  // fiches, pour une aide qu'on ne demande qu'occasionnellement.
  const [assistantOuvert, setAssistantOuvert] = useState(false)
  // « Modifier » vit dans l'en-tête de la section « L'œuvre » (maquette v4),
  // le formulaire dans la carte en dessous : ce drapeau fait le lien, et
  // EntityInfoSection le rabaisse dès qu'il l'a consommé.
  const [modifierOeuvre, setModifierOeuvre] = useState(false)
  const [question, setQuestion] = useState<QuestionAssistant | null>(null)

  // 7 requêtes indépendantes déclenchées en parallèle (React Query émet
  // chaque useQuery dès le rendu, pas de chaînage séquentiel) - même
  // parallélisme que le `async let` groupé de EntityDetailView côté iOS.
  const entityQuery = useQuery({
    queryKey: queryKeys.entities.detail(entityId),
    queryFn: () => getEntity(entityId),
  })
  const ownershipsQuery = useQuery({
    queryKey: queryKeys.ownerships(entityId),
    queryFn: () => listOwnerships(entityId),
  })
  const experiencesQuery = useQuery({
    queryKey: queryKeys.experiences(entityId),
    queryFn: () => listExperiences(entityId),
  })
  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const relFromQuery = useQuery({
    queryKey: queryKeys.relationships.from(entityId),
    queryFn: () => relationshipsFrom(entityId),
  })
  const relToQuery = useQuery({
    queryKey: queryKeys.relationships.to(entityId),
    queryFn: () => relationshipsTo(entityId),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  // Même clé de cache que TierSummarySection (« Mon suivi ») : le rang du hero
  // et celui de la section sont la même donnée, chargée une seule fois.
  const tierSummaryQuery = useQuery({
    queryKey: queryKeys.tierLists.entitySummary(entityId),
    queryFn: () => getEntityTierSummary(entityId),
  })

  // Tout ce qui suit vit AVANT les retours anticipés : un Hook ne peut pas
  // être appelé conditionnellement (React rendrait moins de Hooks pendant le
  // chargement qu'après, voir "Rendered fewer hooks than expected"). D'où un
  // `entity` qui tolère null jusqu'à la garde plus bas.
  const entity = entityQuery.data ?? null
  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity?.entityTypeId)
  const isManga = entityType?.code === 'MANGA'

  const editionGroups = entity && isManga ? resolveEditionView(groupVariantsByEdition(entity.variants)) : []
  const activeEditionGroup = editionGroups.find((g) => g.edition === activeEdition) ?? editionGroups[0]
  const owned = activeEditionGroup
    ? ownedVolumeNumbers(entity?.variants ?? [], ownerships, activeEditionGroup.sourceEditions)
    : []

  // Fiche d'édition de l'édition affichée - MÊME clé de cache que
  // EditionCorrectionSection (React Query partage la requête, aucun appel
  // réseau de plus) : elle alimente le sous-groupe « Édition » de « L'œuvre »
  // et les deux avertissements du hero.
  const activeEditionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', activeEditionGroup?.edition ?? ''),
    queryFn: () => findEdition(entity!.title, activeEditionGroup!.edition, entityId),
    enabled: !!entity && !!activeEditionGroup && activeEditionGroup.edition !== '',
    retry: false,
  })
  const activeEditionInfo = activeEditionInfoQuery.isSuccess ? activeEditionInfoQuery.data : null

  // Complétude de l'édition affichée - MÊME clé que TomesGridSection et que
  // l'Assistant : le hero et le résumé de la barre lisent le même total sans
  // requête supplémentaire.
  const completenessQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.completeness(entity?.title ?? '', activeEditionGroup?.edition ?? '', owned),
    queryFn: () =>
      getCompleteness(entity!.title, activeEditionGroup!.edition, owned, activeEditionGroup!.volumeNumbers, entityId),
    enabled: !!entity && !!activeEditionGroup && activeEditionGroup.edition !== '',
  })
  const totalVolumes = completenessQuery.data?.totalVolumes ?? null

  // isPending, pas isLoading : isLoading retombe à false entre deux tentatives
  // (temporisation exponentielle), et la fiche affichait alors un écran vide.
  if (entityQuery.isPending) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (!entity) return null

  const coverImageUrl = coverImageUrlFrom(entity.attributes)
  // mangaka (Manga) ou studio (Jeu vidéo) - voir creatorInfo.ts. Rien pour
  // Jeu de société tant qu'aucune source ne fournit réellement cette donnée.
  const author = creatorFrom(entity.attributes)
  const activeOwnership = ownerships.find((o) => o.status === 'OWNED')
  // Une grille de tomes n'a de sens que pour une série manga dont une édition
  // est affichée.
  const grilleDeTomes = isManga && !!activeEditionGroup

  const generalRank = tierSummaryQuery.data?.generalRank ?? null
  const bestExperience = experiences.reduce<(typeof experiences)[number] | null>((best, exp) => {
    if (exp.rating === null) return best
    if (!best || (best.rating ?? -1) < exp.rating) return exp
    return best
  }, null)
  const note = bestExperience?.rating ?? null
  const ongoing = isSeriesOngoing(entity.attributes)
  const startYear = typeof entity.attributes.startYear === 'string' ? entity.attributes.startYear : null
  // La maquette écrit « 2003 → 2006 ». Aucun fournisseur branché n'écrit
  // d'année de fin aujourd'hui (grep sur backend/src/main/java : seul
  // `startYear` est produit, par Jikan et MyAnimeList) - mais l'attribut est
  // saisissable à la main depuis « L'œuvre », et la plage s'affiche dès qu'il
  // existe. On ne l'invente jamais, on sait juste la lire.
  const endYear = typeof entity.attributes.endYear === 'string' ? entity.attributes.endYear : null

  /** Les sections réellement disponibles pour CETTE fiche. « Mes tomes »
   *  disparaît quand la notion de tome n'existe pas (jeu vidéo, type
   *  personnalisé, série seulement en envies) : la maquette la numérote 01,
   *  mais un onglet vide serait pire qu'un onglet absent. La numérotation
   *  suit alors la liste réelle, jamais un rang figé. */
  const sections: DefinitionSection[] = []
  if (grilleDeTomes) {
    sections.push({
      cle: 'tomes',
      libelle: 'Mes tomes',
      resume:
        totalVolumes !== null
          ? `${owned.length} sur ${totalVolumes} possédés`
          : `${owned.length} tome${owned.length > 1 ? 's' : ''} possédé${owned.length > 1 ? 's' : ''}`,
    })
  }
  sections.push({
    cle: 'suivi',
    libelle: 'Mon suivi',
    resume:
      generalRank && note !== null
        ? `Rang ${generalRank} · ${note}/10`
        : generalRank
          ? `Rang ${generalRank}`
          : note !== null
            ? `Note ${note}/10`
            : 'Rien de noté',
  })
  sections.push({ cle: 'oeuvre', libelle: "L'œuvre", resume: 'Catalogue & édition' })

  // La section demandée peut ne pas exister sur cette fiche (« Mes tomes » sur
  // un jeu vidéo) : on retombe sur la première réellement disponible plutôt
  // que d'afficher une page vide.
  const sectionActive = sections.some((s) => s.cle === section) ? section : sections[0].cle

  /**
   * Changer de section depuis le bas d'un panneau long déposerait ailleurs au
   * hasard - le navigateur garde la position, et la section d'arrivée est
   * souvent plus courte. On ne remonte QUE si la barre est sortie par le
   * haut : remonter alors qu'elle est déjà visible serait un sursaut gratuit.
   */
  function changerDeSection(suivante: SectionFiche) {
    setSection(suivante)
    const barre = barreRef.current
    if (barre && barre.getBoundingClientRect().top < 0) barre.scrollIntoView({ block: 'start' })
  }

  const visuelType = entityType ? getEntityTypeVisual(entityType) : null

  return (
    <div className="flex flex-col gap-6">
      <FicheHero
        titre={entity.title}
        onModifierTitre={() => {
          setTitleInput(entity.title)
          setEditingTitle(true)
        }}
        auteur={author}
        couvertureUrl={coverImageUrl}
        repliCouverture={
          <div className="absolute inset-0" style={{ background: gradientFor(entity.title) }} aria-hidden="true" />
        }
        onModifierCouverture={() => {
          setCoverUrlInput(coverImageUrl ?? '')
          setEditingCover(true)
        }}
        pastilles={
          <>
            {entityType && visuelType && (
              <Pastille couleur={visuelType.color} fond={visuelType.tint}>
                {entityType.label}
              </Pastille>
            )}
            {ongoing !== null && (
              <Pastille
                couleur={ongoing ? 'var(--color-warning)' : 'var(--color-ok)'}
                fond={ongoing ? 'var(--color-warningTint)' : 'var(--color-okTint)'}
              >
                {ongoing ? 'Série en cours' : 'Série terminée'}
              </Pastille>
            )}
            {startYear && (
              <Pastille couleur="var(--color-textDim)" fond="var(--color-softBtn)">
                {endYear ? `${startYear} → ${endYear}` : ongoing ? `Depuis ${startYear}` : startYear}
              </Pastille>
            )}
          </>
        }
        progression={grilleDeTomes ? { possedes: owned.length, total: totalVolumes } : null}
        rang={generalRank}
        rangLibelle={entityType?.label ?? null}
        note={note}
        edition={
          activeEditionGroup && activeEditionGroup.edition !== ''
            ? {
                nom: activeEditionGroup.edition,
                total: totalVolumes,
                correction: (
                  <EditionCorrectionSection
                    entityId={entityId}
                    entityTitle={entity.title}
                    editionName={activeEditionGroup.edition}
                    editionInfo={activeEditionInfo}
                  />
                ),
              }
            : null
        }
        aide={
          grilleDeTomes
            ? "Un lot d'occasion repéré sur Vinted ou Leboncoin ? On compare le prix demandé à ta collection : tomes manquants, doublons, prix conseillé pour négocier."
            : undefined
        }
        actions={
          <>
            {/* Point d'entrée contextuel vers Analyse d'achat (voir la maquette
                V1.2, evalFromHere). La série ET l'édition affichée sont
                emportées dans l'écran d'analyse (voir PurchaseAnalysisPage,
                location.state - même mécanisme que SearchPage -> AddDraftPage),
                ce qui rend le libellé littéralement vrai plutôt qu'à moitié
                tenu. */}
            {grilleDeTomes && (
              <button
                type="button"
                onClick={() =>
                  navigate('/purchase-analysis', {
                    state: { seriesTitle: entity.title, editionName: activeEditionGroup!.edition },
                  })
                }
                className="flex min-h-12 items-center gap-2.5 rounded-[14px] bg-accent px-5 text-[14.5px] font-semibold text-accentInk shadow-token-accent transition-transform hover:-translate-y-0.5"
              >
                <Scale size={17} />
                Évaluer une annonce
              </button>
            )}

            {/* Envies : la décision « je le veux » se prend en regardant la
                fiche, c'est donc là que le bouton doit vivre. Hors de toute
                condition, à dessein : il manquait exactement là où on le
                cherche - sur la fiche d'une œuvre justement SOUHAITÉE, qui n'a
                ni tome ni édition. Vouloir une œuvre ne dépend ni de son type,
                ni de ce qu'on en possède déjà. */}
            <WishlistToggle entityId={entity.id} />

            {!grilleDeTomes && activeOwnership && (
              <span className="rounded-full bg-accentTint px-3.5 py-1.5 text-sm font-medium text-accentText">
                Possédé
              </span>
            )}
          </>
        }
        complements={
          activeEditionGroup && activeEditionGroup.edition !== '' ? (
            <>
              {/* Avertissements propres à CETTE édition - jamais affichés quand
                  ils ne s'appliquent pas (« pas épuisée » ne mérite pas une
                  ligne). Ils changent avec l'édition active : une Perfect
                  Edition annoncée ne concerne que l'édition standard. */}
              {activeEditionInfo?.outOfPrint && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} className="shrink-0" />
                  Cette édition est épuisée
                </p>
              )}
              {activeEditionInfo?.betterEditionAnnounced && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} className="shrink-0" />
                  Nouvelle édition annoncée
                  {activeEditionInfo.betterEditionNote ? ` · ${activeEditionInfo.betterEditionNote}` : ''}
                </p>
              )}
              {/* Juste après ces deux avertissements, qui sont précisément ce
                  qui déclenche l'envie (« épuisée », « nouvelle édition
                  annoncée ») - c'est le « Chercher une meilleure édition » de
                  la maquette, branché sur la fonctionnalité qui existe
                  vraiment. */}
              <EditionUpgradeWishToggle entityId={entityId} editionName={activeEditionGroup.edition} />
            </>
          ) : null
        }
      />

      {editingTitle && (
        <div className="flex items-center gap-2">
          <input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Nom de la série"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => titleInput.trim() && renameMutation.mutate(titleInput.trim())}
            disabled={!titleInput.trim() || renameMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditingTitle(false)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-textDim"
          >
            Annuler
          </button>
        </div>
      )}
      {editingTitle && renameMutation.isError && <ErrorBanner message={renameMutation.error.message} />}

      {editingCover && (
        <div className="flex items-center gap-2">
          <input
            value={coverUrlInput}
            onChange={(e) => setCoverUrlInput(e.target.value)}
            placeholder="URL de l'image (ex: https://...)"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => coverUrlInput.trim() && coverMutation.mutate(coverUrlInput.trim())}
            disabled={!coverUrlInput.trim() || coverMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditingCover(false)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
          >
            Annuler
          </button>
        </div>
      )}
      {editingCover && coverMutation.isError && <ErrorBanner message={coverMutation.error.message} />}

      <BarreSectionsFiche
        sections={sections}
        actif={sectionActive}
        onChange={changerDeSection}
        barreRef={barreRef}
        assistant={
          <BoutonsAssistant
            ouvert={assistantOuvert}
            question={question}
            onOuvrir={() => setAssistantOuvert(true)}
            onFermer={() => {
              setAssistantOuvert(false)
              setQuestion(null)
            }}
            onQuestion={(q) => setQuestion((courante) => (courante === q ? null : q))}
          />
        }
      />

      {question && (
        <ReponseAssistant
          entityId={entityId}
          entityTitle={entity.title}
          variants={entity.variants}
          ownerships={ownerships}
          experiences={experiences}
          activeGroup={activeEditionGroup ?? null}
          question={question}
        />
      )}

      {/* ---------- 01 · Ce que je POSSÈDE ---------- */}
      {sectionActive === 'tomes' && activeEditionGroup && (
        <section role="tabpanel" id="panneau-tomes" aria-labelledby="onglet-tomes" tabIndex={-1}>
          <TomesGridSection
            entityId={entityId}
            entityTypeId={entity.entityTypeId}
            entityTitle={entity.title}
            variants={entity.variants}
            ownerships={ownerships}
            activeGroup={activeEditionGroup}
            displayGroups={editionGroups}
            onSelectEdition={setActiveEdition}
          />
        </section>
      )}

      {/* ---------- 02 · Ce que J'EN PENSE ---------- */}
      {sectionActive === 'suivi' && (
        <section
          role="tabpanel"
          id="panneau-suivi"
          aria-labelledby="onglet-suivi"
          tabIndex={-1}
          className="flex flex-col gap-5"
        >
          <EnTeteSection titre="Mon suivi" sousTitre="Ton jugement, tes lectures, tes tags — rien de public." />
          <div className="grid gap-5 min-[900px]:grid-cols-2 min-[900px]:items-start">
            <Carte className="flex flex-col gap-5">
              {/* Classer une œuvre ne demande AUCUNE possession : le backend
                  sait classer n'importe quelle Entity depuis toujours. */}
              <TierSummarySection
                entityId={entityId}
                entityTitle={entity.title}
                entityTypeLabel={entityType?.label ?? null}
                coverImageUrl={coverImageUrl}
              />
              <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data ?? []} />
            </Carte>

            {/* Une Expérience ne dépend d'aucune Possession - c'est l'un des
                invariants du modèle. Elle vit donc avec le classement et les
                tags, sous « ce que j'en pense », jamais sous « ce que j'ai ». */}
            <Carte>
              <ExperiencesSection
                entityId={entityId}
                experiences={experiences}
                allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
                variants={entity.variants}
              />
            </Carte>
          </div>
        </section>
      )}

      {/* ---------- 03 · Ce que l'œuvre EST ---------- */}
      {sectionActive === 'oeuvre' && (
        <section
          role="tabpanel"
          id="panneau-oeuvre"
          aria-labelledby="onglet-oeuvre"
          tabIndex={-1}
          className="flex flex-col gap-5"
        >
          <EnTeteSection
            titre="L'œuvre"
            sousTitre="Les informations de catalogue — corrigeables, elles t'appartiennent."
            action={
              <button
                type="button"
                onClick={() => setModifierOeuvre(true)}
                className="flex min-h-11 items-center gap-2 rounded-[13px] bg-surface px-4 text-sm font-medium text-textPrimary shadow-token-sm"
              >
                <Pencil size={15} />
                Modifier
              </button>
            }
          />
          {/* 1.35fr / 1fr, les proportions de la maquette : le catalogue porte
              une dizaine de lignes, la colonne de droite deux blocs courts. */}
          <div className="grid gap-5 min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] min-[900px]:items-start">
            <Carte>
              <EntityInfoSection
                entityId={entityId}
                attributes={entity.attributes}
                customFieldKeys={entityType?.customFieldKeys ?? []}
                ouvrirEdition={modifierOeuvre}
                onEditionOuverte={() => setModifierOeuvre(false)}
                edition={
                  activeEditionGroup && activeEditionGroup.edition !== ''
                    ? {
                        name: activeEditionGroup.edition,
                        totalVolumes,
                        publisher: activeEditionInfo?.publisher ?? null,
                        outOfPrint: activeEditionInfo?.outOfPrint ?? false,
                        betterEditionAnnounced: activeEditionInfo?.betterEditionAnnounced ?? false,
                        betterEditionNote: activeEditionInfo?.betterEditionNote ?? null,
                        ongoing,
                      }
                    : null
                }
              />
            </Carte>

            <div className="flex flex-col gap-5">
              {/* Une relation est un fait de catalogue - « ceci adapte cela » -
                  pas un avis ni une possession. */}
              <Carte>
                <RelationshipsSection
                  entityId={entityId}
                  relationshipsFrom={relFromQuery.data ?? []}
                  relationshipsTo={relToQuery.data ?? []}
                />
              </Carte>

              {/* Dernier bloc de la dernière section, dans sa propre zone
                  teintée : une action destructive n'est pas cachée, elle est
                  simplement au bout. */}
              <Carte ton="danger" className="flex flex-col gap-3">
                <div>
                  <p className="text-[14.5px] font-medium text-dangerText">Supprimer cette fiche</p>
                  <p className="mt-0.5 text-[13px] text-textDim">
                    Tomes, expériences et classements associés seront perdus.
                  </p>
                </div>
                <DeleteEntitySection entityId={entityId} entityTitle={entity.title} />
              </Carte>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/** Les pastilles du hero : couleur et fond viennent toujours d'un token, pour
 *  que le thème sombre les suive (voir index.css). */
function Pastille({ couleur, fond, children }: { couleur: string; fond: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-[12.5px] font-medium"
      style={{ backgroundColor: fond, color: couleur }}
    >
      {children}
    </span>
  )
}
