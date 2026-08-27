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
    <section className="flex flex-col gap-3.5 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[16.5px] font-semibold text-textPrimary">Tags</h3>
        {attached.length === 0 && <span className="text-[13px] text-faint">Aucun tag pour l'instant</span>}
      </div>

      <div className="flex flex-wrap gap-2 empty:hidden">
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
          className="min-w-0 flex-1 rounded-xl border border-fieldBorder bg-background px-3.5 py-3 text-sm text-textPrimary placeholder:text-faint focus:ring-2 focus:ring-accent/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newLabel.trim() || createMutation.isPending}
          className="shrink-0 rounded-xl bg-textPrimary px-4 py-3 text-[13.5px] font-medium text-background hover:bg-accent hover:text-accentInk disabled:opacity-50"
        >
          Ajouter ce tag
        </button>
      </form>
    </section>
  )
}
