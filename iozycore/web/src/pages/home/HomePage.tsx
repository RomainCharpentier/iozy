import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listWorks } from '@/common/api/works'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EtatVide } from '@/common/components/EtatVide'
import { Jaquette } from '@/common/components/Jaquette'
import { Squelette } from '@/common/components/Squelette'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { useNow } from '@/common/hooks/useNow'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import { queryKeys } from '@/common/lib/queryKeys'
import type { WorkProgressDto } from '@/common/types/api'
import { legendeDuChiffre, titreDeSortie, titrePresqueFini } from './phrases'
import { useSemaine } from './useSemaine'

const JOUR_MS = 24 * 60 * 60 * 1000

function dateDuJour(now: Date): string {
  const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** Whole days from today to an ISO day; 0 is today. */
function joursAvant(isoDay: string, now: Date): number {
  const jour = new Date(`${isoDay.slice(0, 10)}T00:00:00`)
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((jour.getTime() - aujourdhui.getTime()) / JOUR_MS)
}

/** The soonest work with a release from today on, or null. */
function prochaineSortie(oeuvres: WorkProgressDto[], now: Date): { oeuvre: WorkProgressDto; jours: number } | null {
  let trouvee: { oeuvre: WorkProgressDto; jours: number } | null = null
  for (const oeuvre of oeuvres) {
    if (!oeuvre.nextReleaseDate) continue
    const jours = joursAvant(oeuvre.nextReleaseDate, now)
    if (jours >= 0 && (!trouvee || jours < trouvee.jours)) trouvee = { oeuvre, jours }
  }
  return trouvee
}

function dansCombien(jours: number): ReactNode {
  if (jours === 0) return <>sort <em>aujourd’hui</em>.</>
  if (jours === 1) return <>sort <em>demain</em>.</>
  return <>dans <em>{jours}</em> jours.</>
}

/**
 * The home page, "le mur": the covers are the interface. On the left, a few
 * sentences say the week (the count, what is almost done, the next release);
 * on the right, a wall of covers in their real proportions. What is missing is
 * an empty place in the wall, where it belongs; what is coming is there too,
 * greyed, under its date. No panel, no effect: the collection is the decor.
 *
 * <p>The week comes from GET /api/home/week; the wall and the next release
 * from the works list (GET /api/works). A new account sees where to start.
 */
export function HomePage() {
  const now = useNow()
  const { semaine, typesParId, chargement, erreur, reessayer, reessaiEnCours } = useSemaine()
  const liste = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  usePleinCadre(semaine?.une?.work.coverImageUrl ?? null)

  if (erreur) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorBanner message={`Ta semaine n'a pas pu être chargée : ${erreur.message}`} />
        <button type="button" onClick={reessayer} disabled={reessaiEnCours} className="btn-secondaire">
          {reessaiEnCours ? 'Nouvelle tentative…' : 'Réessayer'}
        </button>
      </div>
    )
  }
  if (chargement || !semaine) {
    return (
      <div aria-busy="true" aria-label="Chargement de ta semaine" className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Squelette lignes={6} />
        <Squelette lignes={6} />
      </div>
    )
  }

  const { une, chiffre, presqueFini, rayons } = semaine
  const oeuvres = liste.data ?? []
  const presque = presqueFini[0] ?? null
  const sortie = prochaineSortie(oeuvres, now)
  const dejaMontrees = new Set([une?.work.entityId, presque?.work.entityId, sortie?.oeuvre.entityId])
  const reste = oeuvres
    .filter((o) => o.ownedCount > 0 && !dejaMontrees.has(o.entityId))
    .sort((a, b) => (b.lastMovedAt ?? '').localeCompare(a.lastMovedAt ?? ''))
    .slice(0, 48)

  if (!une && oeuvres.length === 0) {
    return (
      <section aria-labelledby="titre-semaine">
        <h1 id="titre-semaine" className="sr-only">Ta semaine</h1>
        <EtatVide
          icone={Sparkles}
          titre="Ta semaine commence ici."
          detail="Ajoute une première œuvre avec « Chercher ou ajouter » : elle ouvrira ton mur, et ses sorties avec elle."
          action={<Link to="/add" className="btn-primaire">Ajouter une œuvre</Link>}
        />
      </section>
    )
  }

  const legende = chiffre ? legendeDuChiffre(chiffre, now) : null
  const formeDe = (entityTypeId: string) => getEntityTypeVisual(typesParId.get(entityTypeId)).aspectClassName

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-10">
      <section aria-labelledby="titre-semaine" className="flex flex-col">
        <h1 id="titre-semaine" className="text-xs font-semibold tracking-[0.14em] text-textDim uppercase">
          <span className="sr-only">Ta semaine · </span>
          {dateDuJour(now)}
        </h1>
        {chiffre && legende && (
          <Phrase to="/collection" detail={[une?.reason === 'MOVED' ? `Dernier arrivé : ${une.work.title}.` : null, ...legende.details].filter(Boolean).join(' ')}>
            <em>{chiffre.totalObjects}</em> {chiffre.totalObjects > 1 ? 'objets' : 'objet'}.
          </Phrase>
        )}
        {une?.reason === 'RELEASE' && une.release && (
          <Phrase to={`/entity/${une.work.entityId}`} detail="Cette semaine.">
            {titreDeSortie(une.work, une.release, now)}
          </Phrase>
        )}
        {presque && (
          <Phrase to={`/entity/${presque.work.entityId}`} detail={`${presque.missing.map((m) => m.label).join(', ')}. Leur place est dans le mur.`}>
            {titrePresqueFini(presque.work)}
          </Phrase>
        )}
        {sortie && (
          <Phrase
            to="/releases"
            detail={new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${sortie.oeuvre.nextReleaseDate!.slice(0, 10)}T00:00:00`))}
          >
            {sortie.oeuvre.title} {dansCombien(sortie.jours)}
          </Phrase>
        )}
        {rayons.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-textDim lg:mt-auto lg:pt-6">
            {rayons.map((rayon) => (
              <li key={rayon.entityTypeId}>
                <Link to={`/collection/${rayon.entityTypeId}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-textPrimary">
                  <b className="font-semibold text-textPrimary">{rayon.workCount}</b>
                  {typesParId.get(rayon.entityTypeId)?.label ?? 'Catégorie'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Ton mur" className="flex min-w-0 flex-col gap-2">
        <ul className="flex flex-wrap gap-2 lg:h-[200px] lg:flex-nowrap lg:overflow-hidden">
          {une && <Face oeuvre={une.work} hate />}
          {presque && (
            <>
              <Face oeuvre={presque.work} />
              {presque.missing.map((element) => (
                <li key={element.key} className="h-36 shrink-0 lg:h-full">
                  <Link
                    to={`/entity/${presque.work.entityId}`}
                    aria-label={`${element.label} de ${presque.work.title} : l'ajouter depuis la fiche`}
                    title={`${element.label} : l'ajouter depuis la fiche`}
                    className={`iozy-manque flex h-full flex-col justify-end rounded-[3px] p-2.5 font-display text-xs font-semibold ${formeDe(presque.work.entityTypeId)}`}
                  >
                    {element.number !== null && <b className="text-3xl leading-none font-bold">{element.number}</b>}
                    <span className="line-clamp-2">{element.number !== null ? presque.work.title : element.label}</span>
                  </Link>
                </li>
              ))}
            </>
          )}
          {sortie && (
            <li className="relative h-36 shrink-0 lg:h-full">
              <Link to={`/entity/${sortie.oeuvre.entityId}`} aria-label={`${sortie.oeuvre.title}, à venir`} className="block h-full">
                <Jaquette
                  src={sortie.oeuvre.coverImageUrl}
                  className="h-full w-auto rounded-[3px] brightness-[0.55] grayscale"
                  repli={<SansImage titre={sortie.oeuvre.title} />}
                />
                <span className="absolute inset-x-0 bottom-0 rounded-b-[3px] bg-accent px-2 py-1 font-display text-xs font-bold text-accentInk">
                  {sortie.jours === 0 ? 'AUJOURD’HUI' : `${sortie.jours} J`}
                </span>
              </Link>
            </li>
          )}
        </ul>
        {reste.length > 0 && (
          <ul className="flex h-[25.5rem] flex-wrap content-start gap-2 overflow-hidden lg:h-[544px]" aria-label="Le reste de ta collection">
            {reste.map((oeuvre) => (
              <Face key={oeuvre.entityId} oeuvre={oeuvre} petite />
            ))}
          </ul>
        )}
        <Link to="/collection" className="btn-discret mt-1 self-start !px-0">
          Toute ma collection
        </Link>
      </section>
    </div>
  )
}

/** One sentence of the week: large type, a line of detail, the whole block a link. */
function Phrase({ to, detail, children }: { to: string; detail: string; children: ReactNode }) {
  return (
    <Link to={to} className="group block border-b border-lineStrong py-5">
      <strong className="block font-display text-[2rem] leading-[1.05] font-bold tracking-[-0.03em] text-textPrimary [&_em]:text-accentText [&_em]:not-italic group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
        {children}
      </strong>
      {detail && <span className="mt-1.5 block text-sm text-textDim">{detail}</span>}
    </Link>
  )
}

/** A cover in the wall, in its real proportions: the height is the row's, the width follows. */
function Face({ oeuvre, petite, hate }: { oeuvre: { entityId: string; title: string; coverImageUrl: string | null }; petite?: boolean; hate?: boolean }) {
  return (
    <li className={`shrink-0 ${petite ? 'h-32 lg:h-[176px]' : 'h-36 lg:h-full'}`}>
      <Link to={`/entity/${oeuvre.entityId}`} aria-label={oeuvre.title} title={oeuvre.title} className="block h-full transition-opacity hover:opacity-85">
        <Jaquette
          src={oeuvre.coverImageUrl}
          loading={hate ? 'eager' : 'lazy'}
          className="h-full w-auto rounded-[3px]"
          repli={<SansImage titre={oeuvre.title} />}
        />
      </Link>
    </li>
  )
}

function SansImage({ titre }: { titre: string }) {
  return (
    <span className="flex aspect-[2/3] h-full items-end rounded-[3px] bg-surface2 p-2 font-display text-xs leading-tight font-bold text-textDim">
      {titre}
    </span>
  )
}
