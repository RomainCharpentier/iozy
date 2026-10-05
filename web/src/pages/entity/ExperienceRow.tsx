import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Star } from 'lucide-react'
import { deleteExperience, recordExperience, updateExperience } from '@/common/api/experiences'
import { queryKeys } from '@/common/lib/queryKeys'
import { useToast } from '@/common/lib/toast'
import { variantLabel } from '@/common/lib/attributsTome'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { ExperienceResponse, VariantDto } from '@/common/types/api'
import { libelleExperienceType } from '@/common/lib/experiences'
import { formaterDateCourte } from '@/common/lib/formats'

/**
 * A recorded experience, with what is needed to fix it or remove it.
 *
 * An experience used to be one-way data: once recorded, it
 * could be neither edited nor deleted (docs/USER_JOURNEYS.md, section 14).
 * A rating set to 7 by reflex or a comment written too fast stayed there
 * for good, even though they feed the average rating, the statistics and
 * the yearly review.
 *
 * **What can be edited**: the rating and the comment, nothing else. The type
 * of experience, the date and the volume concerned are immutable on the domain side -
 * picking the wrong volume means having recorded ANOTHER experience, which one
 * deletes. Offering to "edit" them would suggest a correction
 * where one would need to start again.
 *
 * Same menu pattern as OwnershipDetails: inline expansion rather than a floating
 * popover, correct even in a scrollable panel.
 */
export function ExperienceRow({
  experience,
  entityId,
  variant,
  parTome = true,
}: {
  experience: ExperienceResponse
  entityId: string
  variant?: VariantDto
  /** False for a work that is owned as a single piece (video game, board
   *  game): "Toute la série" means nothing there, the date is enough. */
  parTome?: boolean
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(experience.rating ?? 7)
  const [noteEnabled, setNoteEnabled] = useState(experience.rating !== null)
  const [comment, setComment] = useState(experience.comment ?? '')

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.experiences(entityId) })
    // The average rating, the statistics and the yearly review are computed on
    // the experiences: leaving them in cache would show an average that no
    // longer matches what the detail page shows.
    queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateExperience(experience.id, {
        rating: noteEnabled ? rating : null,
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      invalidate()
      setEditing(false)
      setMenuOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteExperience(experience.id),
    onSuccess: () => {
      invalidate()
      setMenuOpen(false)
      toast('Expérience supprimée', {
        label: 'Annuler',
        // Real restore: everything that defines an experience is
        // saved again identically (type, date, volume, rating, comment).
        // Only its technical id changes, and nothing references it.
        onAction: async () => {
          await recordExperience({
            entityId: experience.entityId,
            variantId: experience.variantId ?? undefined,
            experienceType: experience.experienceType,
            occurredAt: experience.occurredAt,
            rating: experience.rating ?? undefined,
            comment: experience.comment ?? undefined,
          })
          invalidate()
        },
      })
    },
  })

  const variantSuffix = variant ? ` · ${variantLabel(variant)}` : ''

  return (
    // A row, not a block: the TYPE as a pill on the left, what the
    // experience is about in the middle, the rating on the right (mockup v4). The
    // comment goes under this line - it is optional and often long,
    // it must not distort the row when it exists.
    <li className="rounded-[15px] bg-background px-4 py-3 text-sm">
      <div className="flex items-center gap-3.5">
        <span className="shrink-0 rounded-full bg-accentTint px-2.5 py-1 text-[11.5px] font-medium text-accentText">
          {libelleExperienceType(experience.experienceType)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[14.5px] text-textPrimary">
          {[variant ? variantLabel(variant) : parTome ? 'Toute la série' : null, formaterDateCourte(experience.occurredAt)]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {experience.rating !== null && (
          <span className="flex shrink-0 items-center gap-1.5 font-display text-[14.5px] font-bold text-textPrimary">
            <Star size={13} className="fill-accent text-accent" />
            {experience.rating}/10
          </span>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions sur l'expérience ${libelleExperienceType(experience.experienceType)}${variantSuffix}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-faint hover:text-textPrimary"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
      {experience.comment && <p className="mt-1.5 text-textDim">{experience.comment}</p>}

      {menuOpen && !editing && (
        <div className="mt-2 flex flex-col gap-1 border-t border-surface2 pt-2">
          <button
            type="button"
            onClick={() => {
              setRating(experience.rating ?? 7)
              setNoteEnabled(experience.rating !== null)
              setComment(experience.comment ?? '')
              setEditing(true)
            }}
            className="w-fit text-textDim hover:text-textPrimary"
          >
            Modifier la note et le commentaire
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="w-fit text-dangerText hover:underline disabled:opacity-50"
          >
            Supprimer cette expérience
          </button>
        </div>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updateMutation.mutate()
          }}
          className="mt-2 flex flex-col gap-3 border-t border-surface2 pt-3"
        >
          <label className="flex items-center gap-2 text-sm text-textDim">
            <input
              type="checkbox"
              checked={noteEnabled}
              onChange={(e) => setNoteEnabled(e.target.checked)}
              className="accent-accent"
            />
            {/* Without this checkbox, a rated experience could not become
                unrated again: the slider has no "no rating" position. */}
            Donner une note
          </label>
          {noteEnabled && (
            <label className="flex flex-col gap-1 text-sm text-textDim">
              Note : {rating}/10
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="accent-accent"
              />
            </label>
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Commentaire (optionnel)"
            rows={2}
            className="champ"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primaire"
            >
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setMenuOpen(false)
              }}
              className="rounded-lg px-2 py-1.5 text-sm text-textDim"
            >
              Annuler
            </button>
          </div>
          {updateMutation.isError && <ErrorBanner message={updateMutation.error.message} />}
        </form>
      )}

      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}
    </li>
  )
}
