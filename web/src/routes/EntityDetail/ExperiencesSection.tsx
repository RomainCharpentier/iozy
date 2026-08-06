import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordExperience } from '../../api/experiences'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { ExperienceResponse } from '../../types/api'

interface ExperiencesSectionProps {
  entityId: string
  experiences: ExperienceResponse[]
  allowedExperienceTypes: string[]
}

export function ExperiencesSection({ entityId, experiences, allowedExperienceTypes }: ExperiencesSectionProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [experienceType, setExperienceType] = useState(allowedExperienceTypes[0] ?? '')
  const [rating, setRating] = useState(7)
  const [comment, setComment] = useState('')

  const addMutation = useMutation({
    mutationFn: recordExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiences(entityId) })
      setFormOpen(false)
      setComment('')
      setRating(7)
    },
  })

  const sorted = [...experiences].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Expériences</h2>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="text-sm font-medium text-accent"
        >
          Ajouter une expérience
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addMutation.mutate({
              entityId,
              experienceType,
              // Format YYYY-MM-DD attendu par le backend, en UTC explicite
              // (même choix que côté iOS, pas le fuseau local).
              occurredAt: new Date().toISOString().slice(0, 10),
              rating,
              comment: comment.trim() || undefined,
            })
          }}
          className="flex flex-col gap-3 rounded-xl bg-surface p-3"
        >
          <div className="flex gap-2">
            {allowedExperienceTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setExperienceType(type)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  experienceType === type ? 'bg-accent text-accentText' : 'bg-surface2 text-textDim'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

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

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Commentaire (optionnel)"
            rows={2}
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
          />

          <button
            type="submit"
            disabled={addMutation.isPending}
            className="self-start rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accentText disabled:opacity-50"
          >
            {addMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}
        </form>
      )}

      <ul className="flex flex-col gap-2">
        {sorted.map((experience) => (
          <li key={experience.id} className="rounded-xl bg-surface p-3 text-sm">
            <p className="text-textPrimary">
              {experience.experienceType}
              {experience.rating !== null && ` · ★ ${experience.rating}/10`}
            </p>
            {experience.comment && <p className="text-textDim">{experience.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
