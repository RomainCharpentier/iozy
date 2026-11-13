import { useQuery } from '@tanstack/react-query'
import { BookOpenText } from 'lucide-react'
import { useState } from 'react'
import { fetchWorkStory } from '@/common/api/works'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * What the work is about, and where the collector stopped. Asked on demand: a
 * language model writes it (GET /api/works/{id}/story), so nothing is fetched
 * until the person opens it. The reminder stops at the last volume owned; the
 * text says that an AI wrote it and that it may be wrong. When no text can be
 * given, the reason is shown instead.
 */
export function ResumeOeuvre({ entityId }: { entityId: string }) {
  const { estInvite } = useAuth()
  // Open from the start since lot 227 (the detail page "les tomes d'abord"): what the
  // work is about reads under its volumes, not behind a button. The server keeps
  // each text in memory, so a page opened twice asks the model once.
  const [ouvert, setOuvert] = useState(true)
  const histoire = useQuery({
    queryKey: ['works', entityId, 'story'],
    queryFn: () => fetchWorkStory(entityId),
    enabled: ouvert,
    staleTime: Infinity,
    retry: false,
  })
  if (estInvite) return null

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="btn-secondaire self-start">
        <BookOpenText size={16} aria-hidden="true" /> De quoi ça parle, et où j’en étais
      </button>
    )
  }

  return (
    <section aria-label="Résumé de l’œuvre" aria-busy={histoire.isPending} className="grid gap-x-14 gap-y-6 pt-4 md:grid-cols-2">
      {histoire.isPending ? (
        <p className="text-[15px] text-textDim">Rédaction du résumé…</p>
      ) : histoire.isError ? (
        <p className="text-[15px] text-dangerText">Le résumé n’a pas pu être chargé : {histoire.error.message}</p>
      ) : !histoire.data.summary ? (
        <p className="text-[15px] text-textDim">{histoire.data.note ?? 'Pas de résumé pour cette œuvre.'}</p>
      ) : (
        <>
          <div>
            <h2 className="font-display text-section font-bold tracking-[-0.02em] text-textPrimary">De quoi ça parle</h2>
            <p className="mt-2 max-w-[70ch] text-corps text-textDim">{histoire.data.summary}</p>
          </div>
          {histoire.data.soFar && (
            <div>
              <h2 className="font-display text-section font-bold tracking-[-0.02em] text-textPrimary">
                Où j’en étais{histoire.data.upTo !== null && ` · jusqu’au tome ${histoire.data.upTo}`}
              </h2>
              <p className="mt-2 max-w-[70ch] text-corps text-textDim">{histoire.data.soFar}</p>
            </div>
          )}
          <p className="text-mention text-faint md:col-span-2">Écrit par une IA : le texte peut contenir des erreurs, surtout sur le découpage par tome.</p>
        </>
      )}
    </section>
  )
}
