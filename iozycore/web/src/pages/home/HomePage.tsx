import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Sparkles } from 'lucide-react'
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
import { NombreAnime } from '@/common/components/NombreAnime'
import { Guide, type Conseil } from './Guide'
import { Recommandations } from './Recommandations'
import { pourquoiLaUne, titreDeSortie, titrePresqueFini } from './phrases'
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

  const formeDe = (entityTypeId: string) => getEntityTypeVisual(typesParId.get(entityTypeId)).aspectClassName
  const kicker = 'text-[11px] font-bold tracking-[0.16em] text-accentText uppercase'

  const conseils: Conseil[] = []
  if (presque) {
    conseils.push({ cle: 'presque', texte: titrePresqueFini(presque.work), to: `/entity/${presque.work.entityId}`, action: 'Voir ce qui manque' })
  }
  if (sortie) {
    conseils.push({ cle: 'sortie', texte: <>{sortie.oeuvre.title} {dansCombien(sortie.jours)}</>, to: '/releases', action: 'Voir les sorties' })
  }
  if (une?.reason === 'RELEASE' && une.release) {
    conseils.push({ cle: 'une', texte: titreDeSortie(une.work, une.release, now), to: `/entity/${une.work.entityId}`, action: 'Ouvrir la fiche' })
  }
  if (une?.reason === 'MOVED') {
    conseils.push({ cle: 'arrivee', texte: <>Ton dernier arrivé : <em>{une.work.title}</em>.</>, to: `/entity/${une.work.entityId}`, action: 'Ouvrir la fiche' })
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="sr-only">Ta semaine, {dateDuJour(now)}</h1>
      <Guide conseils={conseils} />

      <div className="grid gap-4 lg:grid-cols-12">
        {une && (
          <Link to={`/entity/${une.work.entityId}`} className="tuile relative flex items-center gap-6 overflow-hidden p-5 lg:col-span-6 lg:h-[300px] lg:gap-8 lg:p-6">
            {une.work.coverImageUrl && (
              <img src={une.work.coverImageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-2xl" />
            )}
            <Jaquette
              src={une.work.coverImageUrl}
              loading="eager"
              className="relative h-40 w-auto shrink-0 rounded-xl shadow-[0_24px_50px_-18px_rgb(0_0_0/0.7)] lg:h-full"
              repli={<SansImage titre={une.work.title} />}
            />
            <span className="relative flex min-w-0 flex-col">
              <span className={kicker}>{une.reason === 'RELEASE' ? 'Cette semaine' : 'À la une'}</span>
              <span className="mt-2 font-display text-[clamp(1.7rem,2.6vw,3rem)] leading-[0.98] font-bold tracking-[-0.04em] text-textPrimary [overflow-wrap:anywhere] [text-wrap:balance]">
                {une.work.title}
              </span>
              <span className="mt-3 text-[15px] text-textDim">{pourquoiLaUne(une, now)}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accentText">
                Ouvrir la fiche <ArrowRight size={15} aria-hidden="true" />
              </span>
            </span>
          </Link>
        )}

        <Link to="/releases" className="tuile flex items-end justify-between gap-4 overflow-hidden p-5 lg:col-span-3 lg:h-[300px]">
          <span className="flex min-w-0 flex-col self-stretch">
            <span className={kicker}>Prochaine sortie</span>
            {sortie ? (
              <>
                <span className="mt-auto font-display text-[6.5rem] leading-[0.8] font-bold tracking-[-0.06em] text-textPrimary">
                  <NombreAnime valeur={sortie.jours} />
                </span>
                <span className="mt-2 text-sm font-semibold text-textDim">{sortie.jours > 1 ? 'jours' : 'jour'}</span>
                <span className="mt-1 line-clamp-2 font-display text-[15px] leading-tight font-semibold text-textPrimary">{sortie.oeuvre.title}</span>
              </>
            ) : (
              <span className="mt-auto text-sm text-textDim">Rien d’annoncé pour l’instant.</span>
            )}
          </span>
          {sortie && (
            <Jaquette src={sortie.oeuvre.coverImageUrl} className="h-32 w-auto shrink-0 rounded-lg lg:h-44" repli={<span />} />
          )}
        </Link>

        {chiffre && (
          <div className="tuile flex flex-col p-5 lg:col-span-3 lg:h-[300px]">
            <span className={kicker}>Ta collection</span>
            <Link to="/collection" className="mt-3 font-display text-[6.5rem] leading-[0.8] font-bold tracking-[-0.06em] text-textPrimary hover:text-accentText">
              <NombreAnime valeur={chiffre.totalObjects} />
            </Link>
            <span className="mt-2 text-sm font-semibold text-textDim">{chiffre.totalObjects > 1 ? 'objets' : 'objet'}</span>
            <ul className="mt-auto flex flex-col gap-1.5">
              {rayons.map((rayon) => (
                <li key={rayon.entityTypeId}>
                  <Link to={`/collection/${rayon.entityTypeId}`} className="group grid min-h-7 grid-cols-[2rem_7.5rem_1fr] items-center gap-2 text-sm text-textDim hover:text-textPrimary">
                    <b className="font-display font-semibold text-textPrimary">{rayon.workCount}</b>
                    <span className="truncate">{typesParId.get(rayon.entityTypeId)?.label ?? 'Catégorie'}</span>
                    <span aria-hidden="true" className="h-1.5 rounded-full bg-softBtn">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(6, (rayon.objectCount / Math.max(1, chiffre.totalObjects)) * 100)}%` }} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {presque && (
          <div className="tuile flex flex-col gap-4 p-5 lg:col-span-4">
            <span className={kicker}>Presque fini</span>
            <ul className="flex h-40 gap-2.5">
              <Face oeuvre={presque.work} />
              {presque.missing.map((element) => (
                <li key={element.key} className="h-full shrink-0">
                  <Link
                    to={`/entity/${presque.work.entityId}`}
                    aria-label={`${element.label} de ${presque.work.title} : l'ajouter depuis la fiche`}
                    title={`${element.label} : l'ajouter depuis la fiche`}
                    className={`iozy-manque flex h-full flex-col justify-end rounded-lg p-2.5 font-display text-xs font-semibold ${formeDe(presque.work.entityTypeId)}`}
                  >
                    {element.number !== null ? <b className="text-3xl leading-none font-bold">{element.number}</b> : <span className="line-clamp-3">{element.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
            <Link to={`/entity/${presque.work.entityId}`} className="font-display text-lg leading-tight font-semibold text-textPrimary hover:underline">
              {titrePresqueFini(presque.work)}
            </Link>
          </div>
        )}

        {reste.length > 0 && (
          <section aria-label="Derniers arrivés" className={`tuile flex min-w-0 flex-col gap-4 p-5 ${presque ? 'lg:col-span-8' : 'lg:col-span-12'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className={kicker}>Derniers arrivés</span>
              <Link to="/collection" className="inline-flex min-h-7 items-center gap-1.5 text-sm font-semibold text-textDim hover:text-textPrimary">
                Toute ma collection <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <ul className="flex h-40 flex-wrap gap-2.5 overflow-hidden">
              {reste.slice(0, 10).map((oeuvre) => (
                <Face key={oeuvre.entityId} oeuvre={oeuvre} hauteur={160} ratio={ratioDe(formeDe(oeuvre.entityTypeId))} />
              ))}
            </ul>
          </section>
        )}
      </div>

      <Recommandations nomDuType={(id) => typesParId.get(id)?.label ?? 'Catégorie'} />

      {reste.length > 10 && (
        <ul className="flex h-[21.625rem] flex-wrap gap-2.5 overflow-hidden lg:h-[410px]" aria-label="Le reste de ta collection">
          {reste.slice(10).map((oeuvre) => (
            <Face key={oeuvre.entityId} oeuvre={oeuvre} hauteur={200} ratio={ratioDe(formeDe(oeuvre.entityTypeId))} petite />
          ))}
        </ul>
      )}
    </div>
  )
}

/** The width over height of an aspect class of a type ("aspect-[2/3]", "aspect-square"). */
function ratioDe(forme: string): number {
  const lu = /aspect-\[(\d+)\/(\d+)\]/.exec(forme)
  if (lu) return Number(lu[1]) / Number(lu[2])
  return forme.includes('square') ? 1 : 2 / 3
}

/**
 * A cover in the wall. With a ratio, it is a brick of a justified row: it
 * starts at its natural width and grows to fill the row, so every row ends
 * flush on the right (the cover is cropped by a few pixels at most). Without
 * a ratio, it keeps its exact proportions at the height of its row.
 */
function Face({
  oeuvre,
  petite,
  hate,
  hauteur,
  ratio,
}: {
  oeuvre: { entityId: string; title: string; coverImageUrl: string | null }
  petite?: boolean
  hate?: boolean
  hauteur?: number
  ratio?: number
}) {
  const brique = hauteur !== undefined && ratio !== undefined
  return (
    <li
      className={brique ? `min-w-0 grow ${petite ? 'h-[10.5rem] lg:h-[200px]' : 'h-full'}` : 'h-full shrink-0'}
      style={brique ? { flexBasis: Math.round(hauteur * ratio), maxWidth: Math.round(hauteur * ratio * 1.3) } : undefined}
    >
      <Link to={`/entity/${oeuvre.entityId}`} aria-label={oeuvre.title} title={oeuvre.title} className="face block h-full">
        <Jaquette
          src={oeuvre.coverImageUrl}
          loading={hate ? 'eager' : 'lazy'}
          className={brique ? 'h-full w-full rounded-lg object-cover' : 'h-full w-auto rounded-lg'}
          repli={<SansImage titre={oeuvre.title} />}
        />
      </Link>
    </li>
  )
}

function SansImage({ titre }: { titre: string }) {
  return (
    <span className="flex aspect-[2/3] h-full items-end rounded-lg bg-surface2 p-2 font-display text-xs leading-tight font-bold text-textDim">
      {titre}
    </span>
  )
}
