import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronRight } from 'lucide-react'
import { getReadingList } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { Jaquette } from '@/common/components/Jaquette'

/**
 * « À lire » sur Ma collection : les trois séries à reprendre en premier, et
 * un lien vers la liste entière.
 *
 * <h2>Rien quand il n'y a rien</h2>
 * Ni bloc vide, ni « tu as tout lu ! » : une collection qui n'attend aucune
 * lecture n'a pas besoin d'une ligne pour le dire, et une collection dont
 * aucune expérience n'a jamais été enregistrée verrait ce bloc annoncer
 * qu'elle est intégralement à lire — vrai, mais sans intérêt tant qu'on ne
 * s'en sert pas. Le bloc disparaît donc aussi tant qu'aucun tome n'a été
 * vécu (voir `commencee` côté serveur).
 */
export function ALireSection() {
  const requete = useQuery({ queryKey: queryKeys.insights.readingList, queryFn: getReadingList })
  const series = requete.data?.series ?? []
  const commencees = series.filter((s) => s.commencee)
  if (commencees.length === 0) return null

  return (
    <section aria-labelledby="titre-a-lire" className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titre-a-lire" className="flex items-center gap-2 text-xs font-semibold tracking-wide text-textDim uppercase">
          <BookOpen size={13} className="text-accentText" />À lire
        </h2>
        <Link to="/a-lire" className="flex min-h-9 items-center gap-1 text-xs font-semibold text-accentText">
          Les {series.length} séries
          <ChevronRight size={13} />
        </Link>
      </div>
      <ul className="flex flex-col gap-1.5">
        {commencees.slice(0, 3).map((serie) => (
          <li key={serie.entityId}>
            <Link
              to={`/entity/${serie.entityId}?variant=${serie.prochain.variantId}`}
              state={{ retour: { to: '/', libelle: 'Ma collection' } }}
              className="flex items-center gap-2.5 rounded-xl bg-surface p-2 transition-transform hover:-translate-y-0.5"
            >
              <Jaquette
                src={serie.prochain.couvertureUrl ?? serie.couvertureUrl}
                className="h-12 w-8 shrink-0 rounded object-cover"
                repli={<span className="h-12 w-8 shrink-0 rounded bg-surface2" />}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-textPrimary">{serie.titre}</span>
                <span className="text-xs text-textDim">
                  {serie.prochain.numero !== null ? `Tome ${serie.prochain.numero}` : serie.prochain.libelle}
                  {' · '}
                  {serie.restants} restant{serie.restants > 1 ? 's' : ''}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-textDim" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
