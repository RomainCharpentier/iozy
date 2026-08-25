import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MoreHorizontal } from 'lucide-react'
import { getEntity } from '../../api/entities'
import { deleteRelationship, updateRelationshipType } from '../../api/relationships'
import { queryKeys } from '../../lib/queryKeys'
import { coverImageUrlFrom } from '../../lib/coverImage'
import { ErrorBanner } from '../../components/ErrorBanner'
import { RELATIONSHIP_TYPE_PRESETS, relationshipTypeLabel } from '../../types/entityTypes'
import type { RelationshipDto } from '../../types/api'
import { TexteCoupe } from '../../components/TexteCoupe'
import { Jaquette } from '../../components/Jaquette'

/**
 * Une relation, telle qu'elle existe vraiment : une œuvre liée, un TYPE, et un
 * sens de lecture.
 *
 * La fiche n'affichait jusqu'ici qu'une rangée de jaquettes des œuvres liées -
 * le type choisi à la création (« Adapté en », « Fait partie de la série », ou
 * un texte libre) n'était jamais réaffiché, et les deux sens étaient fondus
 * dans la même rangée. Une relation créée avec le mauvais type restait donc à
 * la fois invisible et incorrigible (docs/USER_JOURNEYS.md, §14).
 *
 * **Ce qui est modifiable** : le type, rien d'autre. Changer une extrémité ne
 * corrige pas une relation, c'est en décrire une autre - on supprime alors
 * celle-ci et on en crée une bonne.
 */
export function RelationshipRow({
  relationship,
  direction,
  entityId,
}: {
  relationship: RelationshipDto
  /** `outgoing` : cette œuvre est la source. `incoming` : elle est la cible. */
  direction: 'outgoing' | 'incoming'
  entityId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState(relationship.relationshipType)

  const otherId = direction === 'outgoing' ? relationship.targetEntityId : relationship.sourceEntityId
  const otherQuery = useQuery({ queryKey: queryKeys.entities.detail(otherId), queryFn: () => getEntity(otherId) })

  function invalidate() {
    // Les deux sens : une relation retirée d'ici disparaît aussi de la fiche
    // d'en face, qui la voit dans l'autre sens.
    queryClient.invalidateQueries({ queryKey: queryKeys.relationships.from(entityId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.relationships.to(entityId) })
  }

  const updateMutation = useMutation({
    mutationFn: () => updateRelationshipType(relationship.id, type.trim()),
    onSuccess: () => {
      invalidate()
      setEditing(false)
      setMenuOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRelationship(relationship.id),
    onSuccess: () => {
      invalidate()
      setMenuOpen(false)
    },
  })

  const otherTitle = otherQuery.data?.title ?? 'Œuvre liée'
  const cover = otherQuery.data ? coverImageUrlFrom(otherQuery.data.attributes) : null
  const Fleche = direction === 'outgoing' ? ArrowRight : ArrowLeft

  return (
    <li className="rounded-xl bg-surface p-2.5 text-sm">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => navigate(`/entity/${otherId}`)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Jaquette
            src={cover}
            className="h-14 w-10 shrink-0 rounded object-cover"
            repli={<span className="h-14 w-10 shrink-0 rounded bg-surface2" />}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <TexteCoupe texte={otherTitle} className="truncate font-medium text-textPrimary" />
            <span className="flex items-center gap-1 text-xs text-textDim">
              {/* Le sens est porté par la flèche ET par les mots : une flèche
                  seule laisse deviner qui adapte qui. */}
              <Fleche size={12} className="shrink-0" />
              {direction === 'outgoing'
                ? `${relationshipTypeLabel(relationship.relationshipType)} — depuis cette œuvre`
                : `${relationshipTypeLabel(relationship.relationshipType)} — vers cette œuvre`}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions sur la relation avec ${otherTitle}`}
          className="shrink-0 rounded-full p-1 text-textDim hover:bg-surface2 hover:text-textPrimary"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {menuOpen && !editing && (
        <div className="mt-2 flex flex-col gap-1 border-t border-surface2 pt-2">
          <button
            type="button"
            onClick={() => {
              setType(relationship.relationshipType)
              setEditing(true)
            }}
            className="w-fit text-textDim hover:text-textPrimary"
          >
            Modifier le type de relation
          </button>
          <button
            type="button"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="w-fit text-dangerText hover:underline disabled:opacity-50"
          >
            Supprimer cette relation
          </button>
        </div>
      )}

      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (type.trim()) updateMutation.mutate()
          }}
          className="mt-2 flex flex-col gap-2 border-t border-surface2 pt-2"
        >
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_TYPE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setType(preset.value)}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  type === preset.value ? 'bg-accent text-accentInk' : 'bg-surface2 text-textDim'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Ou un type personnalisé..."
            aria-label="Type de relation"
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!type.trim() || updateMutation.isPending}
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
