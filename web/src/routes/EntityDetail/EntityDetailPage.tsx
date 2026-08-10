import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { gradientFor } from '../../theme/gradient'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { TagsSection } from './TagsSection'
import { OwnershipsSection } from './OwnershipsSection'
import { SeriesCompletenessSection } from './SeriesCompletenessSection'
import { AddVolumeSection } from './AddVolumeSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!

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

  const coverImageUrl = coverImageUrlFrom(entity.attributes)
  const activeOwnership = ownerships.find((o) => o.status === 'OWNED')
  const bestExperience = experiences.reduce<(typeof experiences)[number] | null>((best, exp) => {
    if (exp.rating === null) return best
    if (!best || (best.rating ?? -1) < exp.rating) return exp
    return best
  }, null)

  return (
    <div className="flex flex-col gap-6">
      <div
        className="relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl p-4"
        style={coverImageUrl ? undefined : { background: gradientFor(entity.title) }}
      >
        {coverImageUrl && (
          <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}
        />
        {entityType && (
          <span className="relative mb-1 w-fit rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-textPrimary">
            {entityType.label}
          </span>
        )}
        <h1 className="relative font-display text-2xl font-bold text-textPrimary">{entity.title}</h1>
      </div>

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

      {tagsQuery.data && (
        <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data} />
      )}

      <OwnershipsSection entityId={entityId} ownerships={ownerships} variants={entity.variants} />

      {/* Réservé au Manga : complétude par édition + détection d'éditions
          mélangées (voir SeriesCompletenessSection) - n'a de sens que pour
          une série composée de tomes numérotés. */}
      {entityType?.code === 'MANGA' && (
        <SeriesCompletenessSection entityTitle={entity.title} variants={entity.variants} />
      )}

      {/* Réservé au Manga (volumeNumber/edition n'ont de sens que pour un
          tome, voir QuickAddService côté backend) - complète une édition déjà
          en collection sans repasser par tout le parcours Ajout rapide (voir
          AddVolumeSection). */}
      {entityType?.code === 'MANGA' && (
        <AddVolumeSection entityId={entityId} entityTypeId={entity.entityTypeId} title={entity.title} />
      )}

      <ExperiencesSection
        entityId={entityId}
        experiences={experiences}
        allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
      />

      <RelationshipsSection
        entityId={entityId}
        relationshipsFrom={relFromQuery.data ?? []}
        relationshipsTo={relToQuery.data ?? []}
      />
    </div>
  )
}
