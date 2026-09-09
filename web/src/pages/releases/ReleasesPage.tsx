import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getReleaseCalendar } from '@/common/api/insights'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { libelleJour, libelleMois, phraseDeCouverture, yearMonthLocal } from '@/common/lib/releaseDate'
import { Chip } from '@/common/components/Chip'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { LienRetour } from '@/common/components/LienRetour'
import { ReleaseRow } from '@/common/components/ReleaseRow'
import { bornesDuMois, compterParCategorie, moisDepuisParametre, moisPrecedent, moisSuivant, rangerParJour } from './releaseCalendar'

const PARAMETRE_MOIS = 'mois'

/**
 * Le calendrier des sorties : mois par mois, ce qui sort pour les œuvres
 * qu'on possède ou qu'on veut, toutes catégories confondues (lot 146).
 *
 * <p>« Prochaines sorties » avait quitté Découvrir au lot 142 parce qu'aucune
 * donnée n'existait. Elle existe désormais - les tomes datés par Google Books,
 * les jeux datés par IGDB, et la date qu'on écrit sur une fiche pour tout le
 * reste - et le serveur ne rend jamais une date approximative : ce qui n'est
 * connu qu'au mois près se lit « date à préciser », une année seule ne se lit
 * pas du tout.
 *
 * <p>Le mois vit dans l'URL (`?mois=2026-10`) : un lien s'y partage, et
 * revenir en arrière revient au mois d'avant, pas à la page d'avant.
 */
export function ReleasesPage() {
  const [parametres, setParametres] = useSearchParams()
  const mois = moisDepuisParametre(parametres.get(PARAMETRE_MOIS), new Date())
  const { from, to } = bornesDuMois(mois)
  const [categorie, setCategorie] = useState<string | null>(null)

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

  const moisCourant = yearMonthLocal(new Date())
  const retour = { to: `/releases?${PARAMETRE_MOIS}=${mois}`, libelle: 'Calendrier des sorties' }

  function allerAuMois(cible: string) {
    setParametres({ [PARAMETRE_MOIS]: cible })
  }

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/discover', libelle: 'Découvrir' }} />

      <EnTeteSection
        niveau={1}
        titre="Calendrier des sorties"
        sousTitre="Ce qui sort pour tes collections et tes envies, toutes catégories confondues."
      />

      <div className="flex items-center justify-between gap-2">
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
      {calendrierQuery.isLoading && <p className="text-sm text-textDim">Chargement...</p>}

      {calendrierQuery.isSuccess && toutes.length === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="text-sm font-semibold text-textPrimary">Rien de prévu en {libelleMois(mois).toLowerCase()} pour tes collections.</p>
          {typesQuery.data && typesQuery.data.length > 0 && (
            <p className="mt-2 text-sm text-textDim">{phraseDeCouverture(typesQuery.data)}</p>
          )}
        </div>
      )}

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

      {range.aPreciser.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Dans le mois, date à préciser</h3>
          {range.aPreciser.map((entry) => (
            <ReleaseRow key={cle(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} retour={retour} />
          ))}
        </section>
      )}

      {range.jours.map((jour) => (
        <section key={jour.iso} className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">{libelleJour(jour.iso)}</h3>
          {jour.entries.map((entry) => (
            <ReleaseRow key={cle(entry)} entry={entry} typeLabel={libelleParType.get(entry.entityTypeId)} retour={retour} />
          ))}
        </section>
      ))}
    </div>
  )
}

/** Une œuvre peut sortir plusieurs fois dans le mois (deux tomes) : la clé porte ce qui sort, pas seulement qui. */
function cle(entry: { entityId: string; label: string; date: string }): string {
  return `${entry.entityId}|${entry.label}|${entry.date}`
}
