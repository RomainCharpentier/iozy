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
 * Une expérience enregistrée, avec de quoi la corriger ou la retirer.
 *
 * Une expérience était jusqu'ici une donnée à sens unique : enregistrée, elle
 * ne pouvait plus être ni modifiée ni supprimée (docs/USER_JOURNEYS.md, §14).
 * Une note posée à 7 par réflexe ou un commentaire écrit trop vite y restaient
 * définitivement, alors qu'ils alimentent la note moyenne, les statistiques et
 * le bilan annuel.
 *
 * **Ce qui est modifiable** : la note et le commentaire, rien d'autre. Le type
 * d'expérience, la date et le tome concerné sont immuables côté domaine — se
 * tromper de tome, c'est avoir enregistré une AUTRE expérience, qu'on
 * supprime. Proposer de les « modifier » laisserait croire à une correction
 * là où il faudrait recommencer.
 *
 * Même patron de menu qu'OwnershipDetails : expansion inline plutôt qu'un
 * popover flottant, correct même dans un panneau scrollable.
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
  /** Faux pour une œuvre qui se possède d'une pièce (jeu vidéo, jeu de
   *  société) : « Toute la série » n'y veut rien dire, la date suffit. */
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
    // La note moyenne, les statistiques et le bilan annuel se calculent sur
    // les expériences : les laisser en cache afficherait une moyenne qui ne
    // correspond plus à ce que la fiche montre.
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
        // Restauration réelle : tout ce qui définit une expérience est
        // réenregistré à l'identique (type, date, tome, note, commentaire).
        // Seul son identifiant technique change, et rien ne le référence.
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
    // Une rangée, pas un pavé : le TYPE en pastille à gauche, ce que
    // l'expérience concerne au milieu, la note à droite (maquette v4). Le
    // commentaire passe sous cette ligne - il est facultatif et souvent long,
    // il ne doit pas déformer la rangée quand il existe.
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
          className="shrink-0 rounded-lg p-1.5 text-faint hover:text-textPrimary"
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
            {/* Sans cette case, une expérience notée ne pouvait plus redevenir
                non notée : le curseur n'a pas de position « aucune note ». */}
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
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accentInk disabled:opacity-50"
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
