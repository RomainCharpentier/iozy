import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { getReadingList } from '@/common/api/insights'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { Jaquette } from '@/common/components/Jaquette'
import type { ReadingSerieDto } from '@/common/types/api'

/**
 * « Qu'est-ce que je lis ensuite ? » — les séries dont il reste des tomes
 * possédés et non lus, celles déjà commencées en premier.
 *
 * <h2>Rien à tenir à jour</h2>
 * Cette liste ne se remplit pas et ne se vide pas à la main : elle se déduit
 * des possessions et des expériences (voir ReadingListService). Un tome y
 * entre en étant acheté, en sort en étant lu. C'est pour ça qu'elle n'a pas
 * d'écran vide au premier jour, et qu'aucun geste n'est nécessaire ici : on
 * ouvre le tome sur sa fiche, où « J'ai lu ce tome » vit déjà.
 */
export function ALirePage() {
  const requete = useQuery({ queryKey: queryKeys.insights.readingList, queryFn: getReadingList })
  const series = requete.data?.series ?? []
  const commencees = series.filter((s) => s.commencee)
  const aCommencer = series.filter((s) => !s.commencee)

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/', libelle: 'Ma collection' }} />

      <EnTeteSection
        niveau={1}
        titre="À lire"
        sousTitre={
          requete.isLoading
            ? 'Chargement...'
            : series.length === 0
              ? 'Aucun tome possédé n’attend d’être lu.'
              : `${requete.data!.tomesARelire} tome${requete.data!.tomesARelire > 1 ? 's' : ''} possédé${requete.data!.tomesARelire > 1 ? 's' : ''} sans lecture enregistrée, sur ${series.length} série${series.length > 1 ? 's' : ''}.`
        }
      />

      {requete.isError && <ErrorBanner message={requete.error.message} />}

      {commencees.length > 0 && <GroupeSeries titre="Reprendre" series={commencees} />}
      {aCommencer.length > 0 && <GroupeSeries titre="Commencer" series={aCommencer} />}
    </div>
  )
}

function GroupeSeries({ titre, series }: { titre: string; series: ReadingSerieDto[] }) {
  return (
    <section className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-textDim uppercase">{titre}</span>
      <ul className="flex flex-col gap-1.5">
        {series.map((serie) => (
          <li key={serie.entityId}>
            {/* Le paramètre `variant` fait défiler la fiche jusqu'à CE tome et
                l'entoure (voir EntityDetailPage) : arriver sur la série entière
                obligerait à le rechercher dans la liste. */}
            <Link
              to={`/entity/${serie.entityId}?variant=${serie.prochain.variantId}`}
              state={{ retour: { to: '/a-lire', libelle: 'À lire' } }}
              className="flex items-center gap-3 rounded-xl bg-surface p-2.5 transition-transform hover:-translate-y-0.5"
            >
              <Jaquette
                src={serie.prochain.couvertureUrl ?? serie.couvertureUrl}
                className="h-16 w-11 shrink-0 rounded object-cover"
                repli={<span className="h-16 w-11 shrink-0 rounded bg-surface2" />}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-textPrimary">{serie.titre}</span>
                <span className="text-xs text-textDim">
                  {serie.prochain.numero !== null ? `Tome ${serie.prochain.numero}` : serie.prochain.libelle}
                  {serie.prochain.edition ? ` · ${serie.prochain.edition}` : ''}
                </span>
                <span className="text-xs text-faint">
                  {serie.lus > 0 ? `${serie.lus} lu${serie.lus > 1 ? 's' : ''} · ` : ''}
                  {serie.restants} tome{serie.restants > 1 ? 's' : ''} en attente
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-textDim" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
