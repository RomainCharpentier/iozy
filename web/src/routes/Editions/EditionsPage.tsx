import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { deleteEdition, listAllEditions } from '../../api/purchaseAnalysis'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { EditionObservations } from './EditionObservations'
import type { MangaEditionDto } from '../../types/purchaseAnalysis'
import { TexteCoupe } from '../../components/TexteCoupe'
import { EnTeteSection } from '../../components/EnTeteSection'
import { LienRetour } from '../../components/LienRetour'

/**
 * "Éditions de référence" - la seule vue d'ensemble du référentiel
 * MangaEdition, et le seul endroit d'où en supprimer une.
 * <p>
 * Ces fiches se créent jusqu'ici uniquement en contexte (fiche Série ->
 * « Éditer » puis le formulaire de l'édition, ou "Évaluer un achat" -> EditionReferenceLookup) et
 * n'étaient visibles NULLE PART ensuite : une édition mal nommée, créée par
 * erreur ou par un test, restait dans la base sans moyen de la voir ni de
 * l'enlever. Elle continuait pourtant à compter - c'est ce référentiel qui
 * fournit le total de tomes affiché par Ma collection et par la fiche (voir
 * Lot 16).
 * <p>
 * Écran de LECTURE et de SUPPRESSION seulement : renseigner/corriger reste
 * là où l'information manque concrètement (la fiche de la série), pour ne
 * pas dupliquer un formulaire déjà existant à deux endroits.
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

  // Groupées par série : le référentiel n'a de sens que série par série (deux
  // éditions d'une même série se comparent, deux éditions de séries
  // différentes n'ont rien à voir).
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
          sousTitre="Le nombre de tomes, l'éditeur et les alertes de chaque édition. C'est d'ici que vient la progression X/Y affichée sur tes séries — une édition non renseignée affiche simplement le nombre de tomes possédés."
        />
      </div>

      {editionsQuery.isLoading && <p className="text-textDim">Chargement...</p>}
      {editionsQuery.isError && <ErrorBanner message={editionsQuery.error.message} />}
      {deleteMutation.isError && <ErrorBanner message={deleteMutation.error.message} />}

      {editionsQuery.isSuccess && bySeries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface2 p-6 text-center">
          <p className="text-sm text-textDim">
            Aucune édition renseignée. Depuis la fiche d'une série, « Éditer » puis le formulaire de l'édition crée la première.
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
                    {/* Lien vers la série seulement quand l'édition y est
                        réellement rattachée (entityId non nul) : une édition
                        créée depuis "Évaluer un achat" pour une série pas
                        encore possédée n'a nulle part où mener. */}
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

                {/* Les prix relevés de cette édition : c'est leur contexte
                    naturel, et le seul endroit d'où ils étaient jusqu'ici
                    invisibles après enregistrement. */}
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
