import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getReleaseCalendar } from '@/common/api/insights'
import { listEntityTypes } from '@/common/api/entityTypes'
import { listWorks } from '@/common/api/works'
import { queryKeys } from '@/common/lib/queryKeys'
import { isoLocal, periodeSurUnAn } from '@/common/lib/releaseDate'
import { useNow } from '@/common/hooks/useNow'
import { useAuth } from '@/common/hooks/useAuth'
import { Chip } from '@/common/components/Chip'
import { EtatVide } from '@/common/components/EtatVide'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Jaquette } from '@/common/components/Jaquette'
import { NombreAnime } from '@/common/components/NombreAnime'
import { ReleaseRefreshLine } from '@/common/components/ReleaseRefreshLine'
import { Squelette } from '@/common/components/Squelette'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { useReleaseRefresh } from '@/common/hooks/useReleaseRefresh'
import type { ReleaseEntryDto, WorkProgressDto } from '@/common/types/api'
import { AbonnementAgenda } from './AbonnementAgenda'
import { cleDeSortie, compterParCategorie, estManquante, grouperParMois, joursAvant } from './releaseCalendar'
import { useJeLAiSortie, nomDeSortie } from './useJeLAiSortie'

const RETOUR = { to: '/releases', libelle: 'Sorties' }
const ENTRES_MAX = 6
const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' })

/** The works the collector has, most recently moved first: what "came in" before today. */
function dernieresEntrees(oeuvres: WorkProgressDto[]): WorkProgressDto[] {
  return oeuvres
    .filter((o) => o.ownedCount > 0 && o.lastMovedAt)
    .sort((a, b) => (b.lastMovedAt ?? '').localeCompare(a.lastMovedAt ?? ''))
    .slice(0, ENTRES_MAX)
}

function libelleIlYA(isoInstant: string, now: Date): string {
  const jours = Math.max(0, Math.round((now.getTime() - new Date(isoInstant).getTime()) / 86_400_000))
  if (jours === 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  if (jours < 60) return `il y a ${jours} jours`
  return `il y a ${Math.round(jours / 30)} mois`
}

/**
 * Sorties, as a timeline: today is a vertical line. On its left, what came
 * in (the last works the collector got); on its right, what comes out, in the
 * order of the dates, with the days left in big numbers. A row to scroll
 * sideways; the filters, read from the data, keep only the categories that
 * have a release.
 *
 * <p>What the collection does not have yet is outlined in the vivid tone (a
 * click says "je l'ai précommandé"); what it has is a plain cover. Nothing is
 * written under a cover but its title and its day. The state of the sources is
 * one line, and the agenda subscription replaces the .ics file.
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
  const oeuvresQuery = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks, enabled: !estInvite })
  const typesParId = useMemo(() => new Map((typesQuery.data ?? []).map((t) => [t.id, t])), [typesQuery.data])
  const { status: etatMiseAJour } = useReleaseRefresh()
  const jamaisConsultees = !!etatMiseAJour?.available && !etatMiseAJour.lastRun

  const toutes = calendrierQuery.data?.entries ?? []
  const comptes = compterParCategorie(toutes)
  // A chosen category that no longer has a release falls back on "Tout": a
  // chip that cannot be seen must not filter silently.
  const categorieActive = categorie && comptes.has(categorie) ? categorie : null
  const visibles = categorieActive ? toutes.filter((e) => e.entityTypeId === categorieActive) : toutes
  const aVenir = grouperParMois(visibles).flatMap((m) => m.entries)
  const premiere = aVenir.find((e) => e.precision === 'DAY' && e.date >= aujourdHui) ?? aVenir[0] ?? null
  const entrees = categorieActive
    ? dernieresEntrees((oeuvresQuery.data ?? []).filter((o) => o.entityTypeId === categorieActive))
    : dernieresEntrees(oeuvresQuery.data ?? [])

  usePleinCadre(premiere?.coverImageUrl)

  // The row opens on today, with a little of the past on its left: what comes out is what one came for.
  const rangee = useRef<HTMLDivElement>(null)
  const aujourdhuiRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (rangee.current && aujourdhuiRef.current) rangee.current.scrollLeft = Math.max(0, aujourdhuiRef.current.offsetLeft - 150)
  }, [aVenir.length, entrees.length])

  const jeLAi = useJeLAiSortie()
  const onJeLAi = estInvite ? undefined : (entry: ReleaseEntryDto) => jeLAi.mutate(entry)
  const enCours = (entry: ReleaseEntryDto) => jeLAi.isPending && jeLAi.variables === entry

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

      {toutes.length > 0 && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pt-3">
            <div>
              <p className="font-display text-[clamp(4.5rem,11vw,9rem)] leading-[0.85] font-bold tracking-[-0.06em] text-textPrimary">Sorties</p>
              <p className="mt-2 text-[15px] text-textDim">
                {visibles.length} à venir sur l’année · {entrees.length > 0 ? `${entrees.length} entrées récentes` : 'aucune entrée récente'}
              </p>
            </div>
            {comptes.size > 1 && (
              <div className="defilement-discret flex max-w-full gap-2 overflow-x-auto" role="group" aria-label="Filtrer par catégorie">
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
          </header>

          <section aria-label="Frise des sorties" className="relative -mx-4 [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-56px),transparent)] md:-mx-6">
            <div ref={rangee} className="defilement-discret flex items-end gap-5 overflow-x-auto px-4 pb-6 md:px-6">
              {entrees.length > 0 && (
                <ul aria-label="Ce qui est entré" className="flex shrink-0 items-end gap-4 opacity-80">
                  {entrees.slice().reverse().map((oeuvre) => (
                    <li key={oeuvre.entityId} className="w-28 shrink-0 md:w-32">
                      <Link to={`/entity/${oeuvre.entityId}`} state={{ retour: RETOUR }} className="group block" aria-label={`${oeuvre.title}, entré ${libelleIlYA(oeuvre.lastMovedAt!, now)}`}>
                        <span className="block aspect-[2/3] overflow-hidden">
                          <Jaquette
                            src={oeuvre.coverImageUrl}
                            className="h-full w-full object-cover brightness-75 transition duration-500 group-hover:scale-105 group-hover:brightness-100"
                            repli={<span className="block h-full w-full bg-surface2" />}
                          />
                        </span>
                        <span className="mt-2 block line-clamp-2 font-display text-[15px] leading-tight font-bold text-textPrimary">{oeuvre.title}</span>
                        <span className="block text-xs text-textDim">entré {libelleIlYA(oeuvre.lastMovedAt!, now)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div ref={aujourdhuiRef} aria-hidden="true" className="relative mx-2 flex h-[21rem] w-1 shrink-0 self-end rounded-full bg-textPrimary">
                <span className="absolute top-0 right-4 w-32 text-right text-[11px] font-bold tracking-[0.16em] text-textPrimary uppercase">Aujourd’hui</span>
              </div>

              <ul aria-label="Ce qui sort" className="flex shrink-0 items-end gap-6">
                {aVenir.map((entry) => (
                  <li key={cleDeSortie(entry)} className="shrink-0">
                    <Sortie
                      entry={entry}
                      aujourdHui={aujourdHui}
                      grande={entry === premiere}
                      onJeLAi={onJeLAi}
                      enCours={enCours(entry)}
                    />
                  </li>
                ))}
              </ul>
              <p className="w-44 shrink-0 pb-10 text-sm text-textDim">
                {aVenir.length > 3 ? 'C’est tout pour l’année.' : 'Rien d’autre d’annoncé pour l’instant.'}
              </p>
            </div>
          </section>
        </>
      )}

      <div className="flex flex-col gap-4">
        {!estInvite && <AbonnementAgenda />}
        <ReleaseRefreshLine />
      </div>
    </div>
  )
}

/** One release on the timeline: its cover, its days in big, its title. A missing one is outlined and clickable. */
function Sortie({
  entry,
  aujourdHui,
  grande,
  onJeLAi,
  enCours,
}: {
  entry: ReleaseEntryDto
  aujourdHui: string
  grande: boolean
  onJeLAi?: (entry: ReleaseEntryDto) => void
  enCours: boolean
}) {
  const manquante = estManquante(entry)
  const auJour = entry.precision === 'DAY'
  const jours = auJour ? joursAvant(entry.date, aujourdHui) : null
  const [a, m] = entry.date.split('-').map(Number)
  const mois = MOIS_COURT.format(new Date(Date.UTC(a, m - 1, 1)))
  const largeur = grande ? 'w-52 md:w-60' : 'w-36 md:w-44'
  const nom = `${nomDeSortie(entry)}, ${auJour ? (jours === 0 ? "aujourd'hui" : `dans ${jours} jour${(jours ?? 0) > 1 ? 's' : ''}`) : `en ${mois}, date à préciser`}${manquante && onJeLAi ? " : je l'ai précommandé" : ''}`

  const contenu = (
    <>
      <span className={`block aspect-[2/3] overflow-hidden ${manquante ? 'iozy-manque iozy-teinte rounded-lg p-1' : ''}`}>
        <Jaquette
          src={entry.coverImageUrl}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          repli={<span className="block h-full w-full bg-surface2" />}
        />
      </span>
      <span
        aria-hidden="true"
        className={`mt-3 block font-display leading-[0.85] font-bold tracking-[-0.05em] text-textPrimary ${grande ? 'text-[4.5rem] md:text-[6rem]' : 'text-5xl'}`}
      >
        {jours !== null ? (
          jours <= 0 ? (
            "Auj."
          ) : (
            <>
              <NombreAnime valeur={jours} />
              <span className="ml-1 text-xl font-semibold tracking-normal text-textDim">j</span>
            </>
          )
        ) : (
          <span className="text-3xl">{mois}</span>
        )}
      </span>
      <span aria-hidden="true" className={`mt-2 block line-clamp-2 font-display leading-tight font-bold text-textPrimary ${grande ? 'text-xl' : 'text-[15px]'}`}>
        {entry.entityTitle}
      </span>
      {entry.label && (
        <span aria-hidden="true" className="block truncate text-xs text-textDim">
          {entry.label}
        </span>
      )}
      {auJour && (
        <span aria-hidden="true" className="block text-xs text-textDim">
          {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${entry.date}T00:00:00Z`))}
        </span>
      )}
    </>
  )

  if (manquante && onJeLAi) {
    return (
      <button type="button" onClick={() => onJeLAi(entry)} disabled={enCours} aria-label={nom} title={nom} className={`group block text-left disabled:opacity-60 ${largeur}`}>
        {contenu}
      </button>
    )
  }
  return (
    <Link to={`/entity/${entry.entityId}`} state={{ retour: RETOUR }} aria-label={nom} className={`group block ${largeur}`}>
      {contenu}
    </Link>
  )
}

