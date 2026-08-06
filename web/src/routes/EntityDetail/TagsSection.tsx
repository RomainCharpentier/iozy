import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { attachTag, createTag, detachTag } from '../../api/tags'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import type { TagDto } from '../../types/api'

interface TagsSectionProps {
  entityId: string
  attachedTagIds: string[]
  allTags: TagDto[]
}

/** Miroir de ManageTagsSheet : chips des tags attachés (cliquer = détacher),
 * chips des tags disponibles (cliquer = attacher), + création + attache en
 * une action pour un nouveau label. */
export function TagsSection({ entityId, attachedTagIds, allTags }: TagsSectionProps) {
  const queryClient = useQueryClient()
  const [newLabel, setNewLabel] = useState('')

  const invalidateEntity = () => queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })

  const attachMutation = useMutation({
    mutationFn: (tagId: string) => attachTag(entityId, tagId),
    onSuccess: invalidateEntity,
  })
  const detachMutation = useMutation({
    mutationFn: (tagId: string) => detachTag(entityId, tagId),
    onSuccess: invalidateEntity,
  })
  const createMutation = useMutation({
    mutationFn: (label: string) => createTag(label),
    onSuccess: (tag) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      attachMutation.mutate(tag.id)
      setNewLabel('')
    },
  })

  const attachedSet = new Set(attachedTagIds)
  const attached = allTags.filter((t) => attachedSet.has(t.id))
  const available = allTags.filter((t) => !attachedSet.has(t.id))

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-semibold text-textPrimary">Tags</h2>

      <div className="flex flex-wrap gap-2">
        {attached.length === 0 && <p className="text-sm text-textDim">Aucun tag pour l'instant.</p>}
        {attached.map((tag) => (
          <Chip key={tag.id} label={tag.label} isActive onClick={() => detachMutation.mutate(tag.id)} />
        ))}
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((tag) => (
            <Chip key={tag.id} label={`+ ${tag.label}`} onClick={() => attachMutation.mutate(tag.id)} />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newLabel.trim()) createMutation.mutate(newLabel.trim())
        }}
        className="flex gap-2"
      >
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nouveau tag"
          className="flex-1 rounded-lg bg-surface2 px-3 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newLabel.trim() || createMutation.isPending}
          className="rounded-lg bg-surface2 px-3 py-1.5 text-sm font-medium text-textPrimary disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>
    </section>
  )
}
