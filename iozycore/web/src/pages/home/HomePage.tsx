import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listWorks } from '@/common/api/works'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Jaquette } from '@/common/components/Jaquette'
import { NombreAnime } from '@/common/components/NombreAnime'
import { Squelette } from '@/common/components/Squelette'
import { useNow } from '@/common/hooks/useNow'
import { queryKeys } from '@/common/lib/queryKeys'
import { construireMur, type SigneTuile, type Tuile } from './mur'
import { useIdees } from './useIdees'
import { useSemaine } from './useSemaine'

const LIBELLE_SIGNE: Record<SigneTuile, string> = {
  SORTIE: 'Sortie',
  ENVIE: 'Envie',
  NOUVEAU: 'Nouveau',
  IDEE: 'Pour toi',
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

/**
 * The home page, "le mur": the collection is the screen. On the left the
 * count and three lines; on the right the covers, mixed in an order that
 * changes once a day, and scrolling. What the collector has carries no mark;
 * only exceptions do (a release to come, a wish, a recent arrival, an idea).
 *
 * <p>Nothing here waits for the ideas: they are asked in the background (a
 * model, then the catalog) and join the wall when they arrive.
 */
export function HomePage() {
  const now = useNow()
  const { semaine, typesParId, erreur, reessayer, reessaiEnCours } = useSemaine()
  const liste = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  const { idees } = useIdees()

  const tuiles = useMemo(() => construireMur(liste.data ?? [], idees, now), [liste.data, idees, now])

  if (erreur || liste.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorBanner message={`Ton mur n'a pas pu être chargé : ${(erreur ?? liste.error)?.message ?? 'erreur inconnue'}`} />
        <button
          type="button"
          onClick={() => {
            reessayer()
            void liste.refetch()
          }}
          disabled={reessaiEnCours || liste.isFetching}
          className="btn-secondaire"
        >
          Réessayer
        </button>
      </div>
    )
  }
  if (liste.isPending || !semaine) {
    return (
      <div aria-busy="true" aria-label="Chargement de ton mur" className="grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
        <Squelette lignes={6} />
        <Squelette lignes={8} />
      </div>
    )
  }

  const total = semaine.chiffre?.totalObjects ?? 0
  const sorties = tuiles.filter((t) => t.signe === 'SORTIE')
  const envies = tuiles.filter((t) => t.signe === 'ENVIE')
  const ideesTuiles = tuiles.filter((t) => t.signe === 'IDEE')
  const prochaine = sorties.reduce<Tuile | null>((p, t) => (!p || (t.jours ?? 0) < (p.jours ?? 0) ? t : p), null)

  const lignes: { valeur: string; texte: string }[] = []
  if (prochaine) {
    const j = prochaine.jours ?? 0
    lignes.push(
      j === 0
        ? { valeur: '0', texte: `jour avant ${prochaine.titre} : c’est aujourd’hui.` }
        : { valeur: String(j), texte: `${j > 1 ? 'jours' : 'jour'} avant ${prochaine.titre}.` },
    )
  }
  if (envies.length > 0) {
    lignes.push({
      valeur: String(envies.length),
      texte: `${envies.length > 1 ? 'envies qui attendent' : 'envie qui attend'}, dont ${envies[0].titre}.`,
    })
  }
  if (ideesTuiles.length > 0) {
    lignes.push({
      valeur: String(ideesTuiles.length),
      texte: `${ideesTuiles.length > 1 ? 'idées pour toi' : 'idée pour toi'}, dont ${ideesTuiles[0].titre}.`,
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-10">
      <section aria-labelledby="titre-mur" className="flex flex-col lg:sticky lg:top-24 lg:self-start">
        <h1 id="titre-mur" className="sr-only">
          Ta collection : {pluriel(total, 'objet')}
        </h1>
        <p aria-hidden="true" className="font-display text-[clamp(7rem,15vw,15.6rem)] leading-[0.8] font-bold tracking-[-0.07em] text-textPrimary">
          <NombreAnime valeur={total} />
        </p>
        <p aria-hidden="true" className="mt-3 font-display text-6xl font-bold tracking-[-0.04em] text-textPrimary">
          {total > 1 ? 'objets.' : 'objet.'}
        </p>
        {semaine.rayons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 text-[15px] text-textDim">
            {semaine.rayons.map((rayon) => (
              <li key={rayon.entityTypeId}>
                <Link to={`/collection/${rayon.entityTypeId}`} className="inline-flex min-h-11 items-center gap-1.5 hover:text-textPrimary">
                  <b className="font-semibold text-textPrimary">{rayon.workCount}</b>
                  {typesParId.get(rayon.entityTypeId)?.label ?? 'Catégorie'}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {lignes.length > 0 && (
          <ul className="mt-5">
            {lignes.map((ligne) => (
              <li key={ligne.texte} className="flex items-baseline gap-4 border-t border-lineStrong py-3.5">
                <span className="w-14 shrink-0 font-display text-[2.75rem] leading-none font-bold tracking-[-0.04em] text-accentText">
                  {ligne.valeur}
                </span>
                <span className="text-[17px] leading-snug text-textPrimary">{ligne.texte}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link to="/add" className="btn-primaire">
            Chercher ou ajouter
          </Link>
          <Link to="/collection" className="btn-secondaire">
            Toute la collection
          </Link>
        </div>
      </section>

      <section aria-label="Ton mur de jaquettes" className="min-w-0">
        {tuiles.length === 0 ? (
          <MurVide />
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {tuiles.map((tuile) => (
              <li key={tuile.cle}>
                <CaseDuMur tuile={tuile} />
              </li>
            ))}
            <li>
              <Link
                to="/add"
                className="flex aspect-[192/225] flex-col justify-end bg-surface p-3.5 text-textDim hover:text-textPrimary"
                aria-label="Ajouter une œuvre"
              >
                <span aria-hidden="true" className="font-display text-7xl leading-[0.85] font-medium">
                  +
                </span>
                <span className="mt-1 text-[13px] font-semibold">Ajouter</span>
              </Link>
            </li>
          </ul>
        )}
      </section>
    </div>
  )
}

/** One cover of the wall. The sign, when there is one, is the only text on it. */
function CaseDuMur({ tuile }: { tuile: Tuile }) {
  const sortie = tuile.signe === 'SORTIE'
  const nom = tuile.signe
    ? `${tuile.titre} (${LIBELLE_SIGNE[tuile.signe].toLowerCase()}${sortie ? `, dans ${tuile.jours} j` : ''})`
    : tuile.titre
  return (
    <Link to={tuile.to} aria-label={nom} title={tuile.titre} className="relative block aspect-[192/225] overflow-hidden transition hover:brightness-110 focus-visible:brightness-110">
      <Jaquette
        src={tuile.couverture}
        className={`h-full w-full object-cover ${sortie ? 'brightness-50 grayscale' : ''}`}
        repli={
          <span className="flex h-full w-full items-end bg-surface2 p-3 font-display text-sm leading-tight font-bold text-textDim">
            {tuile.titre}
          </span>
        }
      />
      {tuile.signe && (
        <span
          aria-hidden="true"
          className={`absolute top-0 left-0 px-2.5 py-1.5 text-[11px] font-bold tracking-[0.16em] uppercase ${
            sortie ? 'bg-black/85 text-white' : 'bg-accent text-accentInk'
          }`}
        >
          {LIBELLE_SIGNE[tuile.signe]}
        </span>
      )}
      {sortie && (
        <span aria-hidden="true" className="absolute bottom-2.5 left-3 font-display text-6xl leading-[0.9] font-bold tracking-[-0.04em] text-white">
          {tuile.jours}
          <span className="text-[22px]"> j</span>
        </span>
      )}
    </Link>
  )
}

/** A new account: one big place for the first cover, and three ways to put it there. */
function MurVide() {
  return (
    <div className="flex min-h-[28rem] flex-col justify-end gap-6 bg-surface p-8 lg:min-h-[40rem]">
      <p aria-hidden="true" className="font-display text-[10rem] leading-[0.8] font-medium text-textDim">
        +
      </p>
      <p className="font-display text-5xl leading-[0.95] font-bold tracking-[-0.04em] text-textPrimary">
        Ta première jaquette
        <br />
        ira ici.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link to="/add" className="btn-primaire">
          Chercher un titre
        </Link>
        <Link to="/scan" className="btn-secondaire">
          Scanner un code
        </Link>
        <Link to="/import-photo" className="btn-secondaire">
          Photographier mon étagère
        </Link>
      </div>
    </div>
  )
}
