import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { attachTag, createTag, detachTag } from '@/common/api/tags'
import { queryKeys } from '@/common/lib/queryKeys'
import { Chip } from '@/common/components/Chip'
import { useAuth } from '@/common/hooks/useAuth'
import type { TagDto } from '@/common/types/api'

interface TagsSectionProps {
  entityId: string
  attachedTagIds: string[]
  allTags: TagDto[]
}

/**
 * Les tags d'une œuvre : lus par tous, posés par un administrateur.
 *
 * <h2>Pourquoi cette asymétrie</h2>
 * Un tag décrit l'ŒUVRE - « seinen », « one-shot » - pas la collection de
 * celui qui le pose : il vit donc dans le catalogue partagé, où une œuvre est
 * la même pour tout le monde. Sans cette règle, n'importe quel compte
 * étiquetterait les œuvres de tous les autres, et rien à l'écran ne le
 * montrerait (décision du 2026-08-30).
 *
 * <p>Ce n'est pas ce composant qui protège : le serveur répond 403 sur toute
 * écriture (voir SecurityConfig). Ici, on évite seulement de proposer des
 * gestes qui ne mèneraient qu'à un refus - un compte ordinaire VOIT les tags
 * de l'œuvre, en lecture, parce qu'ils la décrivent et qu'ils lui servent à
 * filtrer sa collection.
 */
export function TagsSection({ entityId, attachedTagIds, allTags }: TagsSectionProps) {
  const queryClient = useQueryClient()
  const { compte } = useAuth()
  const [newLabel, setNewLabel] = useState('')
  const peutEtiqueter = compte?.admin === true

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

      {/* Les tags posés, toujours visibles : ils décrivent l'œuvre, et ils
          servent à filtrer sa collection. Cliquables seulement pour qui peut
          les retirer. */}
      <div className="flex flex-wrap gap-2 empty:hidden">
        {attached.map((tag) =>
          peutEtiqueter ? (
            <Chip key={tag.id} label={tag.label} isActive onClick={() => detachMutation.mutate(tag.id)} />
          ) : (
            <span
              key={tag.id}
              className="rounded-full bg-accentTint px-3 py-1.5 text-[13px] font-medium text-accentText"
            >
              {tag.label}
            </span>
          ),
        )}
      </div>

      {peutEtiqueter && available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map((tag) => (
            <Chip key={tag.id} label={`+ ${tag.label}`} onClick={() => attachMutation.mutate(tag.id)} />
          ))}
        </div>
      )}

      {!peutEtiqueter && (
        <span className="text-[13px] text-faint">
          Les tags décrivent l'œuvre et sont communs à tous les comptes : seul un administrateur les pose.
        </span>
      )}

      {peutEtiqueter && (
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
      )}
    </section>
  )
}
