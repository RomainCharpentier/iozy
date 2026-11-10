import { useQuery } from '@tanstack/react-query'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchRecommendations, type RecommendationsDto } from '@/common/api/home'
import { Jaquette } from '@/common/components/Jaquette'
import { useAuth } from '@/common/hooks/useAuth'

const CLE = 'iozycore.recommandations'

/** The recommendations kept for the day in this browser: asking again costs a model call and several searches. */
function duJour(): RecommendationsDto | undefined {
  try {
    const lu = JSON.parse(window.localStorage.getItem(CLE) ?? 'null') as { jour: string; donnees: RecommendationsDto } | null
    return lu && lu.jour === new Date().toDateString() && lu.donnees.items.length > 0 ? lu.donnees : undefined
  } catch {
    return undefined
  }
}

function garder(donnees: RecommendationsDto): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify({ jour: new Date().toDateString(), donnees }))
  } catch {
    // No storage (private window): the recommendations are simply asked again next time.
  }
}

/**
 * "Izy te recommande": works the account does not own and may like. A language
 * model proposes them from the collection, and the server keeps only those a
 * catalog source confirms - so every card is a real work, with its cover, and
 * opens the add screen on it. Each one says why, by naming works already owned.
 *
 * <p>The list is kept for the day in this browser; "D'autres idées" asks again.
 * Without a model, the tile says so in one line instead of showing cards.
 */
export function Recommandations({ nomDuType }: { nomDuType: (entityTypeId: string) => string }) {
  const { estInvite } = useAuth()
  const recos = useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: async () => {
      const donnees = await fetchRecommendations()
      if (donnees.items.length > 0) garder(donnees)
      return donnees
    },
    initialData: duJour,
    staleTime: Infinity,
    retry: false,
    enabled: !estInvite,
  })
  if (estInvite) return null
  const kicker = 'text-[11px] font-bold tracking-[0.16em] text-accentText uppercase'
  const enCours = recos.isFetching

  return (
    <section aria-labelledby="titre-recos" className="tuile flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titre-recos" className={kicker}>
          Izy te recommande
        </h2>
        <button
          type="button"
          onClick={() => void recos.refetch()}
          disabled={enCours}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary disabled:opacity-60"
        >
          <RefreshCw size={14} aria-hidden="true" className={enCours ? 'animate-spin motion-reduce:animate-none' : ''} />
          {enCours ? 'Izy cherche…' : 'D’autres idées'}
        </button>
      </div>

      {recos.isError ? (
        <p className="text-sm text-dangerText">Les recommandations n’ont pas pu être chargées : {recos.error.message}</p>
      ) : !recos.data ? (
        <p aria-busy="true" className="text-[15px] text-textDim">
          Izy parcourt ta collection et vérifie chaque idée dans le catalogue. Cela prend quelques dizaines de secondes.
        </p>
      ) : recos.data.items.length === 0 ? (
        <p className="text-[15px] text-textDim">{recos.data.note ?? 'Rien à proposer pour l’instant.'}</p>
      ) : (
        <>
          <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${enCours ? 'opacity-50' : ''}`}>
            {recos.data.items.map((reco) => (
              <li key={`${reco.entityTypeId}-${reco.title}`}>
                <Link
                  to={`/add?q=${encodeURIComponent(reco.title)}`}
                  className="group flex h-full gap-4 rounded-2xl p-2 hover:bg-rowHover"
                >
                  <Jaquette
                    src={reco.imageUrl}
                    className="face h-36 w-auto shrink-0 rounded-lg"
                    repli={<span className="block aspect-[2/3] h-36 shrink-0 rounded-lg bg-surface2" />}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs font-semibold text-textDim">{nomDuType(reco.entityTypeId)}</span>
                    <span className="mt-0.5 font-display text-lg leading-tight font-bold text-textPrimary">{reco.title}</span>
                    <span className="mt-1.5 text-sm leading-snug text-textDim">{reco.why}</span>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-accentText group-hover:underline">
                      Voir et ajouter <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-textDim">Proposé par une IA d’après ta collection ; chaque œuvre a été retrouvée dans le catalogue.</p>
        </>
      )}
    </section>
  )
}
