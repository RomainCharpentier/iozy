import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordExperience } from '../../api/experiences'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import type { ExperienceResponse, VariantDto } from '../../types/api'

interface ExperiencesSectionProps {
  entityId: string
  experiences: ExperienceResponse[]
  allowedExperienceTypes: string[]
  // Facultatif (absent pour un type sans notion de tome) - permet de préciser
  // QUEL tome une expérience concerne (audit "on mélange tome et série" :
  // jusqu'ici une Experience ne référençait que la série entière, impossible
  // de distinguer "j'ai lu le tome 3" de "j'ai lu le tome 4" dans l'historique).
  variants?: VariantDto[]
}

/** "Tome 12" si un numéro de tome est exploitable, sinon le label brut -
 * même règle que ShelfPage.variantSubtitle, gardée cohérente ici. */
function variantLabel(variant: VariantDto): string {
  const volumeNumber = variant.attributes.volumeNumber
  return typeof volumeNumber === 'number' ? `Tome ${volumeNumber}` : variant.label
}

export function ExperiencesSection({ entityId, experiences, allowedExperienceTypes, variants = [] }: ExperiencesSectionProps) {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [experienceType, setExperienceType] = useState(allowedExperienceTypes[0] ?? '')
  const [variantId, setVariantId] = useState('')
  const [rating, setRating] = useState(7)
  const [comment, setComment] = useState('')

  const addMutation = useMutation({
    mutationFn: recordExperience,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiences(entityId) })
      setFormOpen(false)
      setComment('')
      setRating(7)
      setVariantId('')
    },
  })

  const variantsById = new Map(variants.map((v) => [v.id, v]))
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
              variantId: variantId || undefined,
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

          {variants.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-textDim">
              Tome concerné (optionnel)
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                <option value="">Toute la série</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {variantLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          )}

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
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
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
        {sorted.map((experience) => {
          const variant = experience.variantId ? variantsById.get(experience.variantId) : undefined
          return (
            <li key={experience.id} className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-textPrimary">
                {experience.experienceType}
                {variant && ` · ${variantLabel(variant)}`}
                {experience.rating !== null && ` · ★ ${experience.rating}/10`}
              </p>
              {experience.comment && <p className="text-textDim">{experience.comment}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
