import { useEffect, useMemo, useRef, useState } from 'react'
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

/** What the filter menu can hold: everything, a sign, or the id of a category. */
type Filtre = 'tout' | 'SORTIE' | 'ENVIE' | 'IDEE' | string

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`
}

/**
 * True once the person has scrolled down a little. Two thresholds, so the
 * column does not flicker between its two shapes around the limit.
 */
function useDefile(): boolean {
  const [reduit, setReduit] = useState(false)
  useEffect(() => {
    const lire = () => setReduit((deja) => (deja ? window.scrollY > 90 : window.scrollY > 220))
    lire()
    window.addEventListener('scroll', lire, { passive: true })
    return () => window.removeEventListener('scroll', lire)
  }, [])
  return reduit
}

/** True once the element has entered the screen; where there is no observer, at once. */
function useVu<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [vu, setVu] = useState(typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observateur = new IntersectionObserver(
      ([entree]) => {
        if (entree.isIntersecting) {
          setVu(true)
          observateur.disconnect()
        }
      },
      { rootMargin: '0px 0px -4% 0px' },
    )
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])
  return [ref, vu] as const
}

/**
 * The home page, "le mur": the collection is the screen. On the left the
 * count, three lines and a menu of filters; on the right the covers, mixed in
 * an order that changes once a day, and scrolling. What the collector has
 * carries no mark; only exceptions do (a release to come, a wish, a recent
 * arrival, an idea).
 *
 * <p>The left column follows the scroll: at the top it is a poster (the big
 * count, three sentences); once the wall has moved, it folds into a compact
 * count and the filter menu, which is what one needs then.
 *
 * <p>Nothing here waits for the ideas: they are asked in the background (a
 * model, then the catalog) and join the wall when they arrive.
 */
export function HomePage() {
  const now = useNow()
  const { semaine, typesParId, erreur, reessayer, reessaiEnCours } = useSemaine()
  const liste = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  const { idees } = useIdees()
  const reduit = useDefile()
  const [filtre, setFiltre] = useState<Filtre>('tout')

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

  // The menu: one entry per category the account has, then the exceptions that exist.
  const entreesMenu: { cle: Filtre; libelle: string; nombre: number | null }[] = [
    { cle: 'tout', libelle: 'Tout', nombre: null },
    ...semaine.rayons.map((r) => ({ cle: r.entityTypeId, libelle: typesParId.get(r.entityTypeId)?.label ?? 'Catégorie', nombre: r.workCount })),
    ...(sorties.length > 0 ? [{ cle: 'SORTIE', libelle: 'Sorties', nombre: sorties.length }] : []),
    ...(envies.length > 0 ? [{ cle: 'ENVIE', libelle: 'Envies', nombre: envies.length }] : []),
    ...(ideesTuiles.length > 0 ? [{ cle: 'IDEE', libelle: 'Pour toi', nombre: ideesTuiles.length }] : []),
  ]
  const filtreActif = entreesMenu.some((e) => e.cle === filtre) ? filtre : 'tout'
  const visibles =
    filtreActif === 'tout'
      ? tuiles
      : tuiles.filter((t) => (filtreActif === 'SORTIE' || filtreActif === 'ENVIE' || filtreActif === 'IDEE' ? t.signe === filtreActif : t.entityTypeId === filtreActif))

  return (
    <div className="grid gap-8 lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-10">
      <section aria-labelledby="titre-mur" className="flex flex-col lg:sticky lg:top-24 lg:self-start">
        <h1 id="titre-mur" className="sr-only">
          Ta collection : {pluriel(total, 'objet')}
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-4 lg:block">
          <p
            aria-hidden="true"
            className={`font-display leading-[0.8] font-bold tracking-[-0.07em] text-textPrimary transition-[font-size] duration-500 ease-out ${
              reduit ? 'lg:text-[5rem]' : 'lg:text-[clamp(7rem,15vw,15.6rem)]'
            } text-[clamp(5.5rem,22vw,9rem)]`}
          >
            <NombreAnime valeur={total} />
          </p>
          <p
            aria-hidden="true"
            className={`font-display font-bold tracking-[-0.04em] text-textPrimary transition-[font-size,margin] duration-500 ease-out ${
              reduit ? 'lg:mt-1 lg:text-2xl' : 'lg:mt-3 lg:text-6xl'
            } text-4xl`}
          >
            {total > 1 ? 'objets.' : 'objet.'}
          </p>
        </div>

        {lignes.length > 0 && (
          <div
            className={`hidden transition-[grid-template-rows,opacity,margin] duration-500 ease-out lg:grid ${
              reduit ? 'mt-0 grid-rows-[0fr] opacity-0' : 'mt-5 grid-rows-[1fr] opacity-100'
            }`}
          >
            <ul className="min-h-0 overflow-hidden">
              {lignes.map((ligne) => (
                <li key={ligne.texte} className="flex items-baseline gap-4 border-t border-lineStrong py-3.5">
                  <span className="w-14 shrink-0 font-display text-[2.75rem] leading-none font-bold tracking-[-0.04em] text-accentText">
                    {ligne.valeur}
                  </span>
                  <span className="text-[17px] leading-snug text-textPrimary">{ligne.texte}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entreesMenu.length > 1 && (
          <nav aria-label="Filtrer le mur" className="mt-5 flex flex-wrap gap-2">
            {entreesMenu.map((entree) => {
              const actif = entree.cle === filtreActif
              return (
                <button
                  key={entree.cle}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => {
                    setFiltre(entree.cle)
                    if (window.scrollY > 120) window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
                    actif
                      ? 'border-transparent bg-textPrimary text-background'
                      : 'border-lineStrong text-textDim hover:border-textDim hover:text-textPrimary'
                  }`}
                >
                  {entree.libelle}
                  {entree.nombre !== null && <span className={actif ? 'opacity-70' : 'text-faint'}>{entree.nombre}</span>}
                </button>
              )
            })}
          </nav>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5">
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
          <ul key={filtreActif} className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
            {visibles.map((tuile, i) => (
              <CaseDuMur key={tuile.cle} tuile={tuile} rang={i % 5} />
            ))}
            {filtreActif === 'tout' && (
              <li>
                <Link
                  to="/add"
                  className="flex aspect-[192/225] flex-col justify-end bg-surface p-3.5 text-textDim transition-colors hover:text-textPrimary"
                  aria-label="Ajouter une œuvre"
                >
                  <span aria-hidden="true" className="font-display text-7xl leading-[0.85] font-medium">
                    +
                  </span>
                  <span className="mt-1 text-[13px] font-semibold">Ajouter</span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  )
}

/** One cover of the wall. The sign, when there is one, is the only text on it. */
function CaseDuMur({ tuile, rang }: { tuile: Tuile; rang: number }) {
  const [ref, vu] = useVu<HTMLLIElement>()
  const sortie = tuile.signe === 'SORTIE'
  const nom = tuile.signe
    ? `${tuile.titre} (${LIBELLE_SIGNE[tuile.signe].toLowerCase()}${sortie ? `, dans ${tuile.jours} j` : ''})`
    : tuile.titre
  return (
    <li ref={ref} style={{ '--rang': rang } as React.CSSProperties} className={`mur-tuile ${vu ? 'mur-tuile--vue' : ''}`}>
      <Link to={tuile.to} aria-label={nom} title={tuile.titre} className="group relative block aspect-[192/225] overflow-hidden">
        <Jaquette
          src={tuile.couverture}
          className={`h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.07] group-focus-visible:scale-[1.07] ${
            sortie ? 'brightness-50 grayscale' : 'group-hover:brightness-110'
          }`}
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
            <NombreAnime valeur={tuile.jours ?? 0} />
            <span className="text-[22px]"> j</span>
          </span>
        )}
      </Link>
    </li>
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
