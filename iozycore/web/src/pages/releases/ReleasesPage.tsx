import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { getReleaseCalendar } from '@/common/api/insights'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { isoLocal, libelleMois, periodeSurUnAn } from '@/common/lib/releaseDate'
import { useNow } from '@/common/hooks/useNow'
import { useAuth } from '@/common/hooks/useAuth'
import { Chip } from '@/common/components/Chip'
import { EtatVide } from '@/common/components/EtatVide'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { ReleaseRefreshLine } from '@/common/components/ReleaseRefreshLine'
import { Squelette } from '@/common/components/Squelette'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { useReleaseRefresh } from '@/common/hooks/useReleaseRefresh'
import type { ReleaseEntryDto } from '@/common/types/api'
import { AbonnementAgenda } from './AbonnementAgenda'
import { CarteSortie } from './CarteSortie'
import { CompteARebours } from './CompteARebours'
import { cleDeSortie, compterParCategorie, grouperParMois, prochaineSortie } from './releaseCalendar'
import { useJeLAiSortie } from './useJeLAiSortie'

const RETOUR = { to: '/releases', libelle: 'Sorties' }

/**
 * Sorties (lot 215, mock-up "Sorties", look A): what comes out in the year
 * for the works one owns, follows or wants, all categories together.
 *
 * <p>The top of the page is the next release: the days left in a huge
 * number, its cover spread blurred behind the whole screen. Under it, every
 * release to come, month by month. The filters are read from the data - one
 * chip per category that has a release, a custom type included.
 *
 * <p>What the collection does not have yet breathes (`.iozy-manque`); a click
 * on it says "je l'ai précommandé" through quick-add, the path of every other
 * screen. What it has is plain glass that leads to the work.
 *
 * <p>The state of the data is one line, at the bottom: when the sources were
 * read, and when they will be read again. The .ics file of before became a
 * subscription: the agenda app reads the link again by itself.
 */
export function ReleasesPage() {
  const now = useNow()
  const aujourdHui = isoLocal(now)
  const { from, to } = periodeSurUnAn(now)
  const { estInvite } = useAuth()
  const [categorie, setCategorie] = useState<string | null>(null)

  const calendrierQuery = useQuery({
    queryKey: queryKeys.insights.releases(from, to),
    queryFn: () => getReleaseCalendar(from, to),
  })
  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const typesParId = useMemo(() => new Map((typesQuery.data ?? []).map((t) => [t.id, t])), [typesQuery.data])
  const { status: etatMiseAJour } = useReleaseRefresh()
  const jamaisConsultees = !!etatMiseAJour?.available && !etatMiseAJour.lastRun

  const toutes = calendrierQuery.data?.entries ?? []
  const comptes = compterParCategorie(toutes)
  // A chosen category that no longer has a release falls back on "Tout": a
  // chip that cannot be seen must not filter silently.
  const categorieActive = categorie && comptes.has(categorie) ? categorie : null
  const visibles = categorieActive ? toutes.filter((e) => e.entityTypeId === categorieActive) : toutes
  const prochaine = prochaineSortie(visibles, aujourdHui)
  const mois = grouperParMois(visibles.filter((e) => e !== prochaine))

  usePleinCadre(prochaine?.coverImageUrl)

  const jeLAi = useJeLAiSortie()
  const onJeLAi = estInvite ? undefined : (entry: ReleaseEntryDto) => jeLAi.mutate(entry)
  const enCours = (entry: ReleaseEntryDto) => jeLAi.isPending && jeLAi.variables === entry
  const aspect = (entry: ReleaseEntryDto) => getEntityTypeVisual(typesParId.get(entry.entityTypeId)).aspectClassName

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Sorties</h1>

      {calendrierQuery.isError && <ErrorBanner message={calendrierQuery.error.message} />}
      {calendrierQuery.isLoading && <Squelette lignes={4} />}
      {jeLAi.isError && <ErrorBanner message={jeLAi.error.message} />}

      {calendrierQuery.isSuccess && toutes.length === 0 && (
        <EtatVide
          icone={CalendarDays}
          titre={jamaisConsultees ? "Les sorties n'ont pas encore été cherchées." : "Rien d'annoncé pour l'année qui vient."}
          detail={
            // A guest has no refresh button and adds nothing: never point them to one.
            estInvite
              ? jamaisConsultees
                ? "Les sources n'ont pas encore été lues."
                : 'Aucune sortie annoncée pour cette collection.'
              : jamaisConsultees
                ? 'Lance une mise à jour ci-dessous : les sources seront lues pour ta collection et tes envies.'
                : 'Ajoute une œuvre à ta collection ou à tes envies, ou suis-la depuis sa fiche, pour voir ses sorties ici.'
          }
        />
      )}

      {prochaine && (
        <CompteARebours
          entry={prochaine}
          aujourdHui={aujourdHui}
          typeLabel={typesParId.get(prochaine.entityTypeId)?.label}
          aspectClassName={aspect(prochaine)}
          retour={RETOUR}
          onJeLAi={onJeLAi}
          enCours={enCours(prochaine)}
        />
      )}

      {toutes.length > 0 && (
        <section aria-labelledby="a-venir-titre" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="a-venir-titre" className="font-display text-xl font-bold tracking-[-0.02em] text-textPrimary">
              À venir
            </h2>
            {comptes.size > 1 && (
              <div className="defilement-discret flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer par catégorie">
                <Chip label="Tout" isActive={categorieActive === null} onClick={() => setCategorie(null)} count={toutes.length} />
                {[...comptes.entries()].map(([typeId, compte]) => (
                  <Chip
                    key={typeId}
                    label={typesParId.get(typeId)?.label ?? 'Catégorie'}
                    isActive={categorieActive === typeId}
                    onClick={() => setCategorie(typeId)}
                    count={compte}
                  />
                ))}
              </div>
            )}
          </div>

          {mois.length === 0 && <p className="text-sm text-textDim">Rien d'autre d'annoncé pour l'instant.</p>}

          {mois.map((m) => (
            <section key={m.mois} aria-label={libelleMois(m.mois)} className="flex flex-col gap-3">
              <h3 className="text-[13px] font-semibold tracking-[0.12em] text-textDim uppercase">{libelleMois(m.mois)}</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {m.entries.map((entry) => (
                  <li key={cleDeSortie(entry)} className="min-w-0">
                    <CarteSortie
                      entry={entry}
                      aspectClassName={aspect(entry)}
                      retour={RETOUR}
                      onJeLAi={onJeLAi}
                      enCours={enCours(entry)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-4">
        {!estInvite && <AbonnementAgenda />}
        <ReleaseRefreshLine />
      </div>
    </div>
  )
}
