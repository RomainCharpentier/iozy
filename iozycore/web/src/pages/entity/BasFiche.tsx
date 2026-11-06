import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setGeneralRank } from '@/common/api/tierLists'
import { Carte } from '@/common/components/Carte'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { libelleSectionExperiences } from '@/common/lib/experiences'
import { queryKeys } from '@/common/lib/queryKeys'
import { RANKS, type Rank } from '@/common/types/tierList'
import type { ExperienceResponse, TagDto, VariantDto } from '@/common/types/api'
import { ExperiencesSection } from './ExperiencesSection'
import { TagsSection } from './TagsSection'

const VERBE: Record<string, string> = {
  Lectures: 'Noter une lecture',
  Visionnages: 'Noter un visionnage',
  Écoutes: 'Noter une écoute',
  Parties: 'Noter une partie',
}

function Rubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="font-display text-[11px] font-bold tracking-[0.1em] text-faint uppercase">{titre}</p>
      {children}
    </div>
  )
}

/**
 * What the owner does with the work, on the page and in one gesture: ranking it,
 * noting a reading, tagging it. These used to wait behind "Éditer", which said
 * that they were corrections, not what a collection is for.
 */
export function BasFiche({
  entityId,
  rang,
  classable,
  experiences,
  typesDExperience,
  variants,
  tagIds,
  tags,
}: {
  entityId: string
  rang: Rank | null
  /** A wish is not ranked yet. */
  classable: boolean
  experiences: ExperienceResponse[]
  typesDExperience: string[]
  variants: VariantDto[]
  tagIds: string[]
  tags: TagDto[]
}) {
  const queryClient = useQueryClient()
  const [ouvert, setOuvert] = useState<'experiences' | 'tags' | null>(null)
  const classer = useMutation({
    mutationFn: (nouveau: Rank | null) => setGeneralRank(entityId, nouveau),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tierLists.entitySummary(entityId) }),
  })
  const section = libelleSectionExperiences(typesDExperience)
  const presents = tags.filter((tag) => tagIds.includes(tag.id))

  return (
    <div className="flex flex-col gap-4 pt-[18px]">
      <div className="flex flex-wrap gap-x-10 gap-y-[18px]">
        {classable && (
          <Rubrique titre="Mon classement">
            <div role="group" aria-label="Mon classement" className="flex flex-wrap gap-[5px]">
              {RANKS.map((lettre) => (
                <button
                  key={lettre}
                  type="button"
                  aria-pressed={rang === lettre}
                  disabled={classer.isPending}
                  onClick={() => classer.mutate(rang === lettre ? null : lettre)}
                  className={`h-11 w-11 rounded-[11px] border font-display text-[17px] font-semibold transition hover:-translate-y-[3px] disabled:opacity-60 ${
                    rang === lettre
                      ? 'border-accent bg-accent text-accentInk'
                      : 'border-line bg-surface text-textPrimary'
                  }`}
                >
                  {lettre}
                </button>
              ))}
            </div>
          </Rubrique>
        )}
        <Rubrique titre={`Mes ${section.toLowerCase()}`}>
          <button
            type="button"
            aria-expanded={ouvert === 'experiences'}
            onClick={() => setOuvert(ouvert === 'experiences' ? null : 'experiences')}
            className="btn-secondaire w-fit"
          >
            {VERBE[section] ?? 'Noter une expérience'}
            {experiences.length > 0 && <span className="text-xs font-normal text-textDim">{experiences.length}</span>}
          </button>
        </Rubrique>
        <Rubrique titre="Tags">
          <div className="flex flex-wrap items-center gap-1.5">
            {presents.map((tag) => (
              <span key={tag.id} className="rounded-full bg-softBtn px-2.5 py-1 text-xs whitespace-nowrap text-textDim">
                {tag.label}
              </span>
            ))}
            <button
              type="button"
              aria-expanded={ouvert === 'tags'}
              onClick={() => setOuvert(ouvert === 'tags' ? null : 'tags')}
              className="btn-secondaire w-fit"
            >
              Ajouter un tag
            </button>
          </div>
        </Rubrique>
      </div>
      {classer.isError && <ErrorBanner message={classer.error.message} />}
      {ouvert === 'experiences' && (
        <Carte>
          <ExperiencesSection
            entityId={entityId}
            experiences={experiences}
            allowedExperienceTypes={typesDExperience}
            variants={variants}
          />
        </Carte>
      )}
      {ouvert === 'tags' && (
        <Carte>
          <TagsSection entityId={entityId} attachedTagIds={tagIds} allTags={tags} />
        </Carte>
      )}
    </div>
  )
}
