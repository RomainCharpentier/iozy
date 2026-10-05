import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { deleteEdition, listAllEditions } from '@/common/api/purchaseAnalysis'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EditionObservations } from './EditionObservations'
import type { MangaEditionDto } from '@/common/types/purchaseAnalysis'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { Squelette } from '@/common/components/Squelette'

/**
  * "Reference editions" - the only overview of the MangaEdition
  * reference data, and the only place to delete one from.
  * <p>
  * Until now these pages were only created in context (Series detail page ->
  * "Edit" then the edition fields in the inspector, or "Evaluate a purchase" -> EditionReferenceLookup) and
  * were visible NOWHERE afterwards: an edition with a wrong name, created by
  * mistake or by a test, stayed in the database with no way to see or
  * remove it. It still counted, though - this reference data
  * provides the total number of volumes shown by My collection and by the detail page (see
  * Batch 16).
  * <p>
  * A READ and DELETE screen only: filling in or fixing stays
  * where the information is missing in practice (the series page), so as not to
  * duplicate a form that already exists in two places.
  */
export function EditionsPage() {
  const queryClient = useQueryClient()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const editionsQuery = useQuery({ queryKey: queryKeys.purchaseAnalysis.allEditions, queryFn: listAllEditions })

  const deleteMutation = useMutation({
    mutationFn: deleteEdition,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseAnalysis.allEditions })
      setConfirmingId(null)
    },
  })

  // Grouped by series: the reference data only makes sense series by series (two
  // editions of the same series can be compared, two editions of different
  // series have nothing to do with each other).
  const bySeries = useMemo(() => {
    const groups = new Map<string, MangaEditionDto[]>()
    for (const edition of editionsQuery.data ?? []) {
      const list = groups.get(edition.seriesTitle) ?? []
      list.push(edition)
      groups.set(edition.seriesTitle, list)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
  }, [editionsQuery.data])

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/administration', libelle: 'Administration' }} />

      <div>
        <EnTeteSection
          niveau={1}
          titre="Éditions de référence"
          sousTitre="Le nombre de tomes, l'éditeur et les alertes de chaque édition. C'est d'ici que vient la progression X/Y affichée sur tes séries — une édition non renseignée affiche simplement le nombre de tomes possédés. Les prix relevés viennent des annonces analysées, ou se saisissent à la main."
        />
      </div>

      {editionsQuery.isLoading && <Squelette lignes={3} />}
      {editionsQuery.isError && <ErrorBanner message={editionsQuery.error.message} />}
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}

      {editionsQuery.isSuccess && bySeries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface2 p-6 text-center">
          <p className="text-sm text-textDim">
            Aucune édition renseignée. Depuis la fiche d'une série, « Éditer » puis les champs de l'édition créent la première.
          </p>
        </div>
      )}

      {bySeries.map(([seriesTitle, editions]) => (
        <section key={seriesTitle} className="flex flex-col gap-2">
          <h2 className="font-display text-base font-semibold text-textPrimary">{seriesTitle}</h2>
          <div className="flex flex-col gap-2 rounded-2xl border border-surface2 bg-surface p-2 shadow-token-sm">
            {editions.map((edition) => (
              <div key={edition.id} className="flex flex-col gap-1.5 rounded-xl p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <TexteCoupe as="p" texte={edition.editionName} className="truncate text-sm font-semibold text-textPrimary" />
                    <p className="text-xs text-textDim">
                      {[
                        edition.totalVolumes !== null ? `${edition.totalVolumes} tomes` : 'Nombre de tomes inconnu',
                        edition.publisher,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Link to the series only when the edition is actually
                            attached to it (entityId not null): an edition
                            created from "Évaluer un achat" for a series not yet
                            owned has nowhere to lead. */}
                    {edition.entityId && (
                      <Link to={`/entity/${edition.entityId}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-accentText">
                        Voir la série
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmingId(confirmingId === edition.id ? null : edition.id)}
                      aria-label={`Supprimer l'édition ${edition.editionName}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-dangerTint hover:text-dangerText"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* The recorded prices of this edition: this is their natural
                        context, and the only place where they were until now
                        invisible after being saved. */}
                <EditionObservations editionId={edition.id} editionName={edition.editionName} />

                {(edition.outOfPrint || edition.betterEditionAnnounced) && (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle size={12} className="shrink-0" />
                    {[
                      edition.outOfPrint ? 'Épuisée' : null,
                      edition.betterEditionAnnounced ? 'Meilleure édition annoncée' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}

                {confirmingId === edition.id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-dangerTint p-2.5">
                    <p className="flex-1 text-xs text-textPrimary">
                      Supprimer « {edition.editionName} » ? Les tomes déjà rattachés à cette édition l'empêchent —
                      détache-les d'abord depuis la série.
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(edition.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-dangerInk disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg px-2 py-1.5 text-xs text-textDim"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
