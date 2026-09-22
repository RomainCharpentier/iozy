import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordExperience } from '@/common/api/experiences'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ExperienceRow } from './ExperienceRow'
import { variantLabel } from '@/common/lib/attributsTome'
import type { ExperienceResponse, VariantDto } from '@/common/types/api'
import { libelleExperienceType } from '@/common/lib/experiences'

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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[16.5px] font-semibold text-textPrimary">Expériences</h3>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
          className="flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium text-accentText"
        >
          <Plus size={14} />
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
          className="flex flex-col gap-3 rounded-[15px] bg-background p-4"
        >
          <div className="flex gap-2">
            {allowedExperienceTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setExperienceType(type)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  experienceType === type ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                }`}
              >
                {libelleExperienceType(type)}
              </button>
            ))}
          </div>

          {variants.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-textDim">
              Tome concerné (optionnel)
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                className="champ"
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
            className="champ"
          />

          <button
            type="submit"
            disabled={addMutation.isPending}
            className="btn-primaire self-start"
          >
            {addMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          {addMutation.isError && <ErrorBanner message={addMutation.error.message} />}
        </form>
      )}

      {sorted.length === 0 && !formOpen && (
        <p className="text-[13.5px] text-faint">
          Aucune expérience enregistrée — lecture, partie, visionnage…
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {sorted.map((experience) => (
          <ExperienceRow
            key={experience.id}
            experience={experience}
            entityId={entityId}
            variant={experience.variantId ? variantsById.get(experience.variantId) : undefined}
            parTome={variants.length > 0}
          />
        ))}
      </ul>
    </section>
  )
}
