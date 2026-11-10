import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listEntityTypes } from '@/common/api/entityTypes'
import { listWorks } from '@/common/api/works'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Jaquette } from '@/common/components/Jaquette'
import { Squelette } from '@/common/components/Squelette'
import { queryKeys } from '@/common/lib/queryKeys'
import type { WorkProgressDto } from '@/common/types/api'

/** What is closest to complete comes first; what is complete goes last. */
function ordre(a: WorkProgressDto, b: WorkProgressDto): number {
  const rang = (o: WorkProgressDto) => (o.missingCount > 0 ? 0 : o.totalCount === null ? 1 : 2)
  return rang(a) - rang(b) || a.missingCount - b.missingCount || a.title.localeCompare(b.title, 'fr')
}

/**
 * The collection as lines: one work per line, a bar that fills with what is
 * owned, the count beside it. Everything followed fits on one screen. The bar
 * only says how many, never which ones: the entity page shows each element.
 * An unknown total draws no bar, since a proportion would be a guess.
 */
export function LignesCollection() {
  const oeuvres = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  const types = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  if (oeuvres.isPending) return <Squelette lignes={8} />
  if (oeuvres.isError) return <ErrorBanner message={oeuvres.error.message} />
  const nomDuType = new Map((types.data ?? []).map((t) => [t.id, t.label]))
  const lignes = oeuvres.data.filter((o) => o.ownedCount > 0).sort(ordre)
  const aTrouver = lignes.reduce((somme, o) => somme + o.missingCount, 0)

  return (
    <section aria-label="Ma collection, ligne par ligne">
      <p className="pb-3 text-sm text-textDim">
        {lignes.length} œuvre{lignes.length > 1 ? 's' : ''}
        {aTrouver > 0 && ` · ${aTrouver} à trouver`}
      </p>
      <ul>
        {lignes.map((oeuvre) => {
          const total = oeuvre.totalCount
          const part = total ? Math.min(100, (oeuvre.ownedCount / total) * 100) : 0
          return (
            <li key={oeuvre.entityId} className="border-t border-lineStrong">
              <Link
                to={`/entity/${oeuvre.entityId}`}
                className="grid min-h-[60px] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-4 py-1.5 hover:bg-rowHover sm:grid-cols-[34px_minmax(0,220px)_minmax(0,1fr)_auto]"
              >
                <Jaquette
                  src={oeuvre.coverImageUrl}
                  className="h-[50px] w-[34px] rounded-[2px] object-cover"
                  repli={<span className="block h-[50px] w-[34px] rounded-[2px] bg-surface2" />}
                />
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-semibold text-textPrimary">{oeuvre.title}</span>
                  <span className="block text-xs text-textDim">{nomDuType.get(oeuvre.entityTypeId) ?? 'Catégorie'}</span>
                </span>
                <span aria-hidden="true" className="col-span-3 row-start-2 h-2 sm:col-span-1 sm:row-start-auto sm:h-[18px]">
                  {total !== null && (
                    <span className="block h-full rounded-[2px] shadow-[inset_0_0_0_1px_var(--color-muted)]">
                      <span className="block h-full rounded-[2px] bg-accent" style={{ width: `${part}%` }} />
                    </span>
                  )}
                </span>
                <span className="min-w-[72px] text-right font-display text-[15px] font-semibold whitespace-nowrap text-textPrimary">
                  {oeuvre.ownedCount}
                  <span className="font-medium text-textDim">{total !== null ? `/${total}` : ' · total inconnu'}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
