import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { getReleaseCalendar } from '@/common/api/insights'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { isoLocal, libelleMois, titreDuJour } from '@/common/lib/releaseDate'
import { Chip } from '@/common/components/Chip'
import { EtatVide } from '@/common/components/EtatVide'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { LienRetour } from '@/common/components/LienRetour'
import { ReleaseRow } from '@/common/components/ReleaseRow'
import { GrilleDuMois } from './GrilleDuMois'
import { ListeAVenir } from './ListeAVenir'
import { bornesDuMois, cleDeSortie, compterParCategorie, moisDepuisParametre, moisPrecedent, moisSuivant, rangerParJour } from './releaseCalendar'
import { Squelette } from '@/common/components/Squelette'

const PARAMETRE_MOIS = 'mois'

/** L'intertitre d'un jour de l'agenda : la même voix que le titre du mois, un cran dessous. */
const CLASSE_INTERTITRE = 'font-display text-base font-bold tracking-[-0.01em] text-textPrimary'

/**
 * Le calendrier des sorties : mois par mois, ce qui sort pour les œuvres
 * qu'on possède ou qu'on veut, toutes catégories confondues (lot 146).
 *
 * <p>Trois lectures du même calendrier. La <b>grille</b> donne la forme du
 * mois - où tombe aujourd'hui, quels jours sont chargés, ce qui sort dans
 * chaque case. L'<b>agenda</b> donne le détail du mois, rangé par jour ;
 * toucher une case le réduit à ce jour. Et <b>à venir</b>, à côté de la grille
 * sur desktop, dessous en mobile, liste tout ce qui sort dans l'année sans
 * tourner les pages ; une de ses lignes amène la grille sur son jour. Une
 * liste des seuls jours qui ont quelque chose ne faisait pas un calendrier :
 * c'est le premier retour d'usage de cet écran, et la raison de la grille.
 *
 * <p>Le serveur ne rend jamais une date approximative : ce qui n'est connu
 * qu'au mois près se lit « date à préciser », hors de la grille ; une année
 * seule ne se lit pas du tout.
 *
 * <p>Le mois vit dans l'URL (`?mois=2026-10`) : un lien s'y partage, et
 * revenir en arrière revient au mois d'avant, pas à la page d'avant. Le jour
 * choisi, lui, ne vit qu'à l'écran : c'est un regard, pas un endroit.
 */
export function ReleasesPage() {
  const [parametres, setParametres] = useSearchParams()
  const mois = moisDepuisParametre(parametres.get(PARAMETRE_MOIS), new Date())
  const { from, to } = bornesDuMois(mois)
  const [categorie, setCategorie] = useState<string | null>(null)
  const [jourChoisi, setJourChoisi] = useState<string | null>(null)
  const grilleRef = useRef<HTMLDivElement>(null)

  const calendrierQuery = useQuery({
    queryKey: queryKeys.insights.releases(from, to),
    queryFn: () => getReleaseCalendar(from, to),
  })
  const typesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const libelleParType = useMemo(() => new Map((typesQuery.data ?? []).map((t) => [t.id, t.label])), [typesQuery.data])

  const toutes = calendrierQuery.data?.entries ?? []
  const comptes = compterParCategorie(toutes)
  // Une catégorie choisie qui n'a rien ce mois-ci retombe sur « Tout » : une
  // puce qu'on ne peut plus voir ne doit pas filtrer en silence.
  const categorieActive = categorie && comptes.has(categorie) ? categorie : null
  const visibles = categorieActive ? toutes.filter((e) => e.entityTypeId === categorieActive) : toutes
  const range = rangerParJour(visibles)
  const parJour = new Map(range.jours.map((jour) => [jour.iso, jour.entries]))
  // Même règle pour le jour : choisi puis vidé par un filtre ou un autre mois, il s'efface.
  const jourActif = jourChoisi && parJour.has(jourChoisi) ? jourChoisi : null
  const jours = jourActif ? range.jours.filter((jour) => jour.iso === jourActif) : range.jours

  const aujourdHui = isoLocal(new Date())
  const moisCourant = aujourdHui.slice(0, 7)
  const retour = { to: `/releases?${PARAMETRE_MOIS}=${mois}`, libelle: 'Calendrier des sorties' }

  function allerAuMois(cible: string) {
    setJourChoisi(null)
    setParametres({ [PARAMETRE_MOIS]: cible })
  }

  /** Depuis la liste de ce qui vient : le mois, et le jour quand la source le connaît. */
  function voirDansLaGrille(cible: string, jour: string | null) {
    setJourChoisi(jour)
    setParametres({ [PARAMETRE_MOIS]: cible })
    // En mobile la liste est sous l'agenda : ramener la grille sous les yeux.
    // `nearest` ne bouge rien quand elle y est déjà (desktop).
    grilleRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }

  const toutLeMois = (
    <button type="button" onClick={() => setJourChoisi(null)} className="min-h-11 shrink-0 text-sm font-semibold text-accentText">
      Tout le mois
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/discover', libelle: 'Découvrir' }} />

      <EnTeteSection niveau={1} titre="Calendrier des sorties" sousTitre="Ce qui sort pour les œuvres que tu suis." />

      {/* Deux colonnes dès 1100 px (la page passe à 960 px, voir AppShell) : le
          mois à gauche, tout ce qui vient à droite. En mobile, l'un sous l'autre. */}
      <div className="flex flex-col gap-8 min-[1100px]:grid min-[1100px]:grid-cols-[1.6fr_1fr] min-[1100px]:items-start min-[1100px]:gap-x-8">
        <div className="flex min-w-0 flex-col gap-5">
          <div ref={grilleRef} className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => allerAuMois(moisPrecedent(mois))}
              aria-label="Mois précédent"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-textPrimary"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex min-w-0 flex-col items-center gap-1">
              <h2 className="font-display text-lg font-bold tracking-[-0.02em] text-textPrimary">{libelleMois(mois)}</h2>
              {mois !== moisCourant && (
                <button type="button" onClick={() => allerAuMois(moisCourant)} className="min-h-11 text-sm font-semibold text-accentText">
                  Aujourd'hui
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => allerAuMois(moisSuivant(mois))}
              aria-label="Mois suivant"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-textPrimary"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {calendrierQuery.isError && <ErrorBanner message={calendrierQuery.error.message} />}

          {toutes.length > 0 && comptes.size > 1 && (
            <div className="defilement-discret flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer par catégorie">
              <Chip label="Tout" isActive={categorieActive === null} onClick={() => setCategorie(null)} count={toutes.length} />
              {[...comptes.entries()].map(([typeId, compte]) => (
                <Chip
                  key={typeId}
                  label={libelleParType.get(typeId) ?? 'Catégorie'}
                  isActive={categorieActive === typeId}
                  onClick={() => setCategorie(typeId)}
                  count={compte}
                />
              ))}
            </div>
          )}

          <GrilleDuMois mois={mois} parJour={parJour} jourChoisi={jourActif} onChoisir={setJourChoisi} aujourdHui={aujourdHui} />

          {calendrierQuery.isLoading && <Squelette lignes={3} />}

          {calendrierQuery.isSuccess && toutes.length === 0 && (
            <EtatVide
              icone={CalendarDays}
              titre={`Rien ne sort en ${libelleMois(mois).toLowerCase()} pour les œuvres que tu suis.`}
              detail="Suis une œuvre depuis sa fiche pour voir ses sorties ici."
            />
          )}

          {!jourActif && range.aPreciser.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className={CLASSE_INTERTITRE}>Ce mois-ci, date à préciser</h3>
              {range.aPreciser.map((entry) => (
                <ReleaseRow key={cleDeSortie(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} retour={retour} />
              ))}
            </section>
          )}

          {jours.map((jour) => (
            <section key={jour.iso} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={CLASSE_INTERTITRE}>{titreDuJour(jour.iso)}</h3>
                {jourActif && toutLeMois}
              </div>
              {jour.entries.map((entry) => (
                <ReleaseRow key={cleDeSortie(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} retour={retour} />
              ))}
            </section>
          ))}
        </div>

        <ListeAVenir
          libelleParType={libelleParType}
          onVoir={voirDansLaGrille}
          className="defilement-discret min-[1100px]:sticky min-[1100px]:top-20 min-[1100px]:max-h-[calc(100vh-6rem)] min-[1100px]:overflow-y-auto"
        />
      </div>
    </div>
  )
}
