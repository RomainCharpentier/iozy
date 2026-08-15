import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { getEntity, mergeEntityAttributes, renameEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { OwnershipsSection } from './OwnershipsSection'
import { TomesGridSection } from './TomesGridSection'
import { AddVolumeSection } from './AddVolumeSection'
import { MoreOptionsSection } from './MoreOptionsSection'

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Correction manuelle de la couverture de SÉRIE (audit UX "correction
  // manuelle") - jusqu'ici seul le Tome avait une jaquette rattrapable après
  // coup (voir OwnershipsSection), jamais la Série elle-même. Action
  // secondaire (icône crayon discrète sur la bannière), pas un champ de
  // formulaire permanent.
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
  // Présent quand on arrive en cliquant une tuile de tome précise dans "Ma
  // collection" (vue non groupée, voir ShelfPage.tsx), ou en cliquant un
  // tome possédé dans la grille ci-dessous (voir onSelectOwnedVariant) -
  // permet à OwnershipsSection de mettre ce tome en évidence au lieu
  // d'atterrir sur la fiche entière sans indication de laquelle des
  // possessions on vient de désigner.
  const [searchParams] = useSearchParams()
  const highlightedVariantId = searchParams.get('variant')
  // Déclenché par un clic sur un tome MANQUANT dans la grille - ouvre
  // AddVolumeSection déjà pré-rempli plutôt que de faire retaper un numéro
  // et une édition déjà connus (voir TomesGridSection/AddVolumeSection).
  const [addVolumePrefill, setAddVolumePrefill] = useState<{ volumeNumber: number; edition: string } | null>(null)

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

  if (entityQuery.isLoading) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (!entityQuery.data) return null

  const entity = entityQuery.data
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity.entityTypeId)
  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []
  const isManga = entityType?.code === 'MANGA'

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
      {/* Identité : vraie jaquette dimensionnée (pas un fond d'écran rogné
          derrière un dégradé) à côté du titre/auteur, comme sur la fiche Série
          d'une bibliothèque numérique (voir la maquette validée) - remplace
          l'ancienne bannière horizontale h-40 décorative, qui ne permettait pas
          de reconnaître la jaquette (recadrée en fond, jamais montrée entière).
          Même composition côte-à-côte du mobile au desktop, seule la taille de
          la jaquette grandit avec la largeur disponible (voir la maquette
          mobile "[Couverture] [Titre/auteur]" - déjà côte-à-côte, pas empilé). */}
      <div className="flex gap-4 sm:gap-6">
        <div
          className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl sm:w-36 md:w-44 lg:w-52"
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
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
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
              "À propos" juste en dessous (voir TomesGridSection), pas la peine
              de le montrer deux fois. */}
          {entityType && (
            <span className="w-fit rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-textDim">
              {entityType.label}
            </span>
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
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accentText disabled:opacity-50"
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
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentText disabled:opacity-50"
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

      {/* Pastilles Possédé/expérience : réservées aux types SANS grille de
          tomes (jeu vidéo, jeu de société), où elles restent le seul repère
          "est-ce que je l'ai déjà ?". Pour un manga, la ligne de progression
          de TomesGridSection ("X / Y tomes possédés") dit déjà ça, plus
          précisément (par édition) - garder la pastille en plus aurait
          recréé exactement la redondance signalée par l'audit UX (Possédé /
          Tomes / 0 possédé qui répétaient la même chose trois fois). */}
      {!isManga && (
        <div className="flex flex-wrap gap-2">
          {activeOwnership && (
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accentText">
              Possédé
            </span>
          )}
          {bestExperience && (
            <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-textDim">
              {bestExperience.experienceType} · {bestExperience.rating}/10
            </span>
          )}
        </div>
      )}

      {/* Priorité visuelle : la grille des tomes (possédé/manquant) juste
          après l'en-tête, avant tout le reste - voir l'audit UX "la
          consultation doit d'abord répondre à ce que je possède/ce qu'il me
          manque". Réservée au Manga : volumeNumber/édition n'ont de sens que
          pour un tome (voir QuickAddService côté backend). */}
      {isManga && (
        <TomesGridSection
          entityId={entityId}
          entityTitle={entity.title}
          entityAttributes={entity.attributes}
          variants={entity.variants}
          ownerships={ownerships}
          onSelectOwnedVariant={(variantId) => navigate(`/entity/${entityId}?variant=${variantId}`, { replace: true })}
          onSelectMissingVolume={(volumeNumber, edition) => setAddVolumePrefill({ volumeNumber, edition })}
        />
      )}

      {isManga && (
        <AddVolumeSection
          entityId={entityId}
          entityTypeId={entity.entityTypeId}
          title={entity.title}
          prefill={addVolumePrefill}
        />
      )}

      <OwnershipsSection
        entityId={entityId}
        entityTypeId={entity.entityTypeId}
        entityTitle={entity.title}
        ownerships={ownerships}
        variants={entity.variants}
        highlightedVariantId={highlightedVariantId}
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
