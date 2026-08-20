import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Scale } from 'lucide-react'
import { getEntity, mergeEntityAttributes, renameEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { findEdition } from '../../api/purchaseAnalysis'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { groupVariantsByEdition, resolveEditionView } from '../../lib/editionGroups'
import { EditionProgressSection } from './EditionProgressSection'
import { TomesGridSection } from './TomesGridSection'
import { MoreOptionsSection } from './MoreOptionsSection'
import { EntityInfoSection } from './EntityInfoSection'

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Correction manuelle de la couverture de SÉRIE (audit UX "correction
  // manuelle") - le Tome a sa propre correction équivalente dans
  // VolumeInteractionPanel (voir VariantCoverEditor), jamais la Série
  // elle-même jusqu'ici. Action secondaire (icône crayon discrète sur la
  // bannière), pas un champ de formulaire permanent.
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
  // Édition sélectionnée dans le bloc Identité (voir EditionProgressSection) -
  // portée ici plutôt que dans un des deux composants qui l'utilisent : le
  // hero (progression/édition) et la grille de tomes doivent réagir au même
  // changement d'édition active (voir la maquette validée - regroupés dans
  // un même bloc Identité). Déclaré avant les retours anticipés ci-dessous
  // (règle des Hooks), même si sa valeur ne prend son sens qu'une fois
  // `entity` chargée.
  const [activeEdition, setActiveEdition] = useState<string | null>(null)

  // 5 requêtes indépendantes déclenchées en parallèle (React Query émet
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

  // Tout ce qui suit vit AVANT les retours anticipés : un Hook ne peut pas
  // être appelé conditionnellement (React rendrait moins de Hooks pendant le
  // chargement qu'après, voir "Rendered fewer hooks than expected"). D'où un
  // `entity` qui tolère null jusqu'à la garde plus bas.
  const entity = entityQuery.data ?? null
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity?.entityTypeId)
  const isManga = entityType?.code === 'MANGA'

  // Édition active partagée entre EditionProgressSection (dans le hero) et
  // TomesGridSection (la grille, hors du hero) - voir activeEdition ci-dessus.
  const editionGroups = entity && isManga ? resolveEditionView(groupVariantsByEdition(entity.variants)) : []
  const activeEditionGroup = editionGroups.find((g) => g.edition === activeEdition) ?? editionGroups[0]

  // Fiche d'édition de l'édition affichée - MÊME clé de cache que
  // EditionProgressSection (React Query partage la requête, aucun appel réseau
  // de plus) : elle alimente le sous-groupe "Édition" du bloc "L'œuvre".
  const activeEditionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', activeEditionGroup?.edition ?? ''),
    queryFn: () => findEdition(entity!.title, activeEditionGroup!.edition, entityId),
    enabled: !!entity && !!activeEditionGroup && activeEditionGroup.edition !== '',
    retry: false,
  })
  const activeEditionInfo = activeEditionInfoQuery.isSuccess ? activeEditionInfoQuery.data : null

  if (entityQuery.isLoading) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (!entity) return null

  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []

  const coverImageUrl = coverImageUrlFrom(entity.attributes)
  // mangaka (Manga) ou studio (Jeu vidéo) - voir creatorInfo.ts. Rien pour
  // Jeu de société tant qu'aucune source ne fournit réellement cette donnée.
  const author = creatorFrom(entity.attributes)
  const activeOwnership = ownerships.find((o) => o.status === 'OWNED')
  const bestExperience = experiences.reduce<(typeof experiences)[number] | null>((best, exp) => {
    if (exp.rating === null) return best
    if (!best || (best.rating ?? -1) < exp.rating) return exp
    return best
  }, null)

  return (
    <div className="flex flex-col gap-6">
      {/* MangaHero : cover + identité + progression + édition regroupés dans
          UN SEUL bloc (voir la maquette validée) - la progression et
          l'édition ne sont plus des sections pleine largeur séparées, elles
          vivent dans la colonne de contenu à droite de la jaquette, plafonnée
          à 560px (voir hero-content) pour ne jamais s'étirer sur toute la
          largeur du container élargi de la page (une barre de progression à
          1500px de large serait absurde). Grille desktop à 2 colonnes fixes
          (200px jaquette + jusqu'à 520px de contenu) à partir de 768px ; en
          dessous, une ligne flex plus modeste - même composition côte-à-côte
          du mobile au desktop (voir la maquette mobile "[Couverture]
          [Titre/auteur]", déjà côte-à-côte, jamais empilé), seule la taille
          de la jaquette grandit. Remplace l'ancienne bannière horizontale
          h-40 décorative, qui ne permettait pas de reconnaître la jaquette
          (recadrée en fond, jamais montrée entière). */}
      <div className="flex items-start gap-4 sm:gap-6 md:grid md:grid-cols-[200px_minmax(0,520px)] md:gap-8">
        <div
          className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl sm:w-36 md:w-[200px]"
          style={coverImageUrl ? undefined : { background: gradientFor(entity.title) }}
        >
          {coverImageUrl && <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <button
            type="button"
            onClick={() => {
              setCoverUrlInput(coverImageUrl ?? '')
              setEditingCover(true)
            }}
            aria-label="Modifier la couverture de la série"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-textPrimary hover:bg-black/70"
          >
            <Pencil size={13} />
          </button>
        </div>
        {/* hero-content : max-width 560px (voir ci-dessus) - important, pas
            1fr/flex-1 sans plafond jusqu'à la largeur du container large. */}
        <div className="flex min-w-0 flex-col gap-3 md:max-w-[560px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-2xl font-bold text-textPrimary sm:text-3xl">{entity.title}</h1>
              <button
                type="button"
                onClick={() => {
                  setTitleInput(entity.title)
                  setEditingTitle(true)
                }}
                aria-label="Modifier le nom de la série"
                className="shrink-0 text-textDim hover:text-textPrimary"
              >
                <Pencil size={13} />
              </button>
            </div>
            {author && <p className="text-sm text-textDim sm:text-base">{author}</p>}
            {/* Type en petite pastille discrète : aide à reconnaître le type
                immédiatement (même principe que les tuiles de Ma Collection),
                sans répéter l'éditeur ici - déjà porté par la ligne Édition et
                "À propos" plus bas (voir EditionProgressSection/
                TomesGridSection), pas la peine de le montrer deux fois. */}
            {entityType && (
              <span className="w-fit rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-textDim">
                {entityType.label}
              </span>
            )}
          </div>

          {/* Progression + édition (Manga) - voir EditionProgressSection.
              Pastilles Possédé/expérience (jeu vidéo, jeu de société) sinon :
              même emplacement conceptuel ("état personnel" du bloc Identité),
              pas de grille de tomes pour ces types donc pas de progression à
              afficher à la place. */}
          {isManga && activeEditionGroup ? (
            <>
              <EditionProgressSection
                entityId={entityId}
                entityTitle={entity.title}
                variants={entity.variants}
                ownerships={ownerships}
                displayGroups={editionGroups}
                activeGroup={activeEditionGroup}
                onSelectEdition={setActiveEdition}
              />
              {/* Point d'entrée contextuel vers Analyse d'achat (voir la
                  maquette V1.2, evalFromHere). Libellé et sous-titre
                  explicites : "Évaluer une annonce" seul, posé au milieu
                  d'une fiche de série possédée, ne disait ni de quelle
                  annonce il s'agissait, ni ce que la série venait y faire -
                  signalé directement par l'utilisateur. La série ET
                  l'édition affichée sont maintenant emportées dans l'écran
                  d'analyse (voir PurchaseAnalysisPage, location.state - même
                  mécanisme que SearchPage -> AddDraftPage), ce qui rend le
                  libellé littéralement vrai plutôt qu'à moitié tenu. */}
              <div className="flex w-fit flex-col gap-1">
                <button
                  type="button"
                  onClick={() =>
                    navigate('/purchase-analysis', {
                      state: { seriesTitle: entity.title, editionName: activeEditionGroup.edition },
                    })
                  }
                  className="flex w-fit items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
                >
                  <Scale size={16} />
                  Évaluer une annonce de cette série
                </button>
                <p className="text-xs text-textDim">
                  Tu as trouvé un lot d'occasion (Vinted, Leboncoin...) ? Compare le prix demandé à ta collection :
                  tomes qui te manquent, doublons, prix conseillé pour négocier.
                </p>
              </div>
            </>
          ) : (
            !isManga && (
              <div className="flex flex-wrap gap-2">
                {activeOwnership && (
                  <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accentInk">Possédé</span>
                )}
                {bestExperience && (
                  <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-textDim">
                    {bestExperience.experienceType} · {bestExperience.rating}/10
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {editingTitle && (
        <div className="flex items-center gap-2">
          <input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Nom de la série"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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

      {/* "Mes tomes" - hors du bloc Identité, séparée visuellement (voir la
          maquette validée : margin-top généreux). Réservée au Manga :
          volumeNumber/édition n'ont de sens que pour un tome (voir
          QuickAddService côté backend). */}
      {isManga && activeEditionGroup && (
        // mt-6 en plus du gap-6 déjà porté par le conteneur racine (voir plus
        // bas) = 48px au total entre le hero et "Mes tomes" (cible 40-48px,
        // voir la maquette validée) - une vraie séparation visuelle, pas la
        // même respiration que le reste de la page.
        <div className="mt-6">
          <TomesGridSection
            entityId={entityId}
            entityTypeId={entity.entityTypeId}
            entityTypeLabel={entityType?.label ?? null}
            entityTitle={entity.title}
            entityAttributes={entity.attributes}
            variants={entity.variants}
            ownerships={ownerships}
            experiences={experiences}
            activeGroup={activeEditionGroup}
          />
        </div>
      )}

      {/* "Informations" : les attributs de l'œuvre, affichés ET modifiables,
          pour TOUS les types - un jeu ou un type personnalisé n'affichait
          jusqu'ici aucune information (voir EntityInfoSection : "À propos"
          est propre aux mangas et vit dans TomesGridSection). Ce qu'une API
          a copié en base devient une donnée à soi, donc corrigeable. */}
      <EntityInfoSection
        entityId={entityId}
        attributes={entity.attributes}
        customFieldKeys={entityType?.customFieldKeys ?? []}
        edition={
          activeEditionGroup && activeEditionGroup.edition !== ''
            ? {
                name: activeEditionGroup.edition,
                publisher: activeEditionInfo?.publisher ?? null,
                outOfPrint: activeEditionInfo?.outOfPrint ?? false,
                betterEditionAnnounced: activeEditionInfo?.betterEditionAnnounced ?? false,
                betterEditionNote: activeEditionInfo?.betterEditionNote ?? null,
                ongoing: isSeriesOngoing(entity.attributes),
              }
            : null
        }
      />

      {/* Tags/Expériences/Relations/Suppression : rien de tout ça ne répond
          aux 6 questions centrales de cette fiche (quelle série, quelle
          édition, combien de tomes, combien possédés, lesquels manquent,
          comment en ajouter un) - voir MoreOptionsSection. Repliées derrière
          un seul clic plutôt que d'occuper une place permanente. */}
      <MoreOptionsSection
        entityId={entityId}
        entityTitle={entity.title}
        attachedTagIds={entity.tagIds}
        allTags={tagsQuery.data ?? []}
        experiences={experiences}
        allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
        variants={entity.variants}
        relationshipsFrom={relFromQuery.data ?? []}
        relationshipsTo={relToQuery.data ?? []}
      />
    </div>
  )
}
