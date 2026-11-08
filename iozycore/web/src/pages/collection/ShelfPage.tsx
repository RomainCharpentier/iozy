import { useCallback, useMemo, useRef, useState } from 'react'
import { BarChart3, CalendarCheck, Heart, Layers, Library, Link2, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { BarreCategories } from './BarreCategories'
import { CollectionFilters } from './CollectionFilters'
import { BarreVues } from './BarreVues'
import { BasculeAffichage } from './BasculeAffichage'
import { deplacer, sortirLesDos } from './mouvement'
import { SalleCollection } from './SalleCollection'
import {
  compterLesTitresParType,
  correspondAuFiltre,
  ordonnerLesTypes,
} from './shelfTiles'
import { couvertureDuMoment, indexerVenues, plusRecentes } from './venues'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { useObjetsCollection } from './useObjetsCollection'
import { useOuvrirOeuvre } from './useOuvrirOeuvre'
import {
  usePreferencesCollection,
  type AffichageCollection,
  type FiltreCollection,
} from '@/common/lib/preferencesCollection'

import { useModalA11y } from '@/common/hooks/useModalA11y'
import { useNow } from '@/common/hooks/useNow'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { EtatVide } from '@/common/components/EtatVide'
import { useDonneesCollection } from './useDonneesCollection'
import { useFiltresCollection } from './useFiltresCollection'
import { SqueletteRail } from '@/common/components/Squelette'

/**
 * What the subtitle counts, depending on what is being looked at. A count must
 * name the thing counted: under "Envies", "12 titres possédés" would be wrong.
 */
const LIBELLES_DECOMPTE: Record<FiltreCollection, (n: number) => string> = {
  tout: (n) => `titre${n > 1 ? 's' : ''}`,
  completer: (n) => `titre${n > 1 ? 's' : ''} à compléter`,
  suivies: (n) => `titre${n > 1 ? 's' : ''} suivi${n > 1 ? 's' : ''}`,
  envies: (n) => `titre${n > 1 ? 's' : ''} avec une envie en cours`,
}

/** A room shows what moved last, about one screen: everything is one click away, on its shelf page. */
const OEUVRES_PAR_SALLE = 10
const RETOUR_COLLECTION = { to: '/collection', libelle: 'Ma collection' }

/** An empty screen must say WHY it is empty, and how to get out of it. */
function messageVide(filtre: FiltreCollection, filtresActifs: boolean): { titre: string; detail: string } {
  if (filtresActifs) {
    return { titre: 'Rien ne correspond à ces filtres.', detail: '' }
  }
  if (filtre === 'completer') {
    return { titre: 'Rien à compléter.', detail: 'Il ne manque aucun tome connu à tes séries.' }
  }
  if (filtre === 'suivies') {
    return {
      titre: 'Aucune œuvre suivie.',
      detail: 'Sur une fiche, « Suivre cette œuvre » la fera apparaître ici, et ses sorties au calendrier.',
    }
  }
  if (filtre === 'envies') {
    return {
      titre: 'Aucune envie en cours.',
      detail: "Sur une fiche, « Je le veux » sur un élément manquant le fera apparaître ici.",
    }
  }
  return {
    titre: "Rien ici pour l'instant.",
    detail: 'Utilise l\'onglet « Catalogue » pour commencer ta collection.',
  }
}

/**
 * My collection: one room per category, showing the ten works that moved last
 * (batch 206). "Tout voir" opens its shelf page, in the same style, with everything
 * and the tools of the category.
 *
 * <h2>The core screen (batch 136)</h2>
 * This page works for any collection: nothing that it shows assumes a
 * universe. The order of the rooms comes from the data (see ordonnerLesTypes),
 * and the page adapts to what the account owns: one category, no room name and
 * no category bar; no series, no "À compléter".
 */
export function ShelfPage() {
  const navigate = useNavigate()
  const filtres = useFiltresCollection()
  const preferences = usePreferencesCollection()
  const [hubMenuOpen, setHubMenuOpen] = useState(false)
  // Escape + focus trap + focus returned to the trigger - see
  // useModalA11y (Batch 9).
  const hubMenuRef = useModalA11y<HTMLDivElement>(hubMenuOpen, () => setHubMenuOpen(false))
  const zone = useRef<HTMLDivElement>(null)

  const donnees = useDonneesCollection()
  const { entities: allEntities, entityTypes, ownerships, wishlist } = donnees
  const { etats, manquants, objetDe } = useObjetsCollection(donnees, preferences.filtre)
  const venues = useMemo(() => indexerVenues(ownerships, wishlist.entries), [ownerships, wishlist.entries])
  // The collection wears the cover of the work that moved last (lot 210).
  usePleinCadre(useMemo(() => couvertureDuMoment(allEntities, venues), [allEntities, venues]))

  /** The works that THIS filter keeps. The tag applies to all: it is set on the
   *  work, owned or not. */
  const retenuesPour = useCallback(
    (filtre: FiltreCollection) =>
      allEntities.filter((e) => {
        const etat = etats.get(e.id)
        if (!etat || !correspondAuFiltre(etat, filtre, (manquants.get(e.id) ?? 0) > 0)) return false
        return filtres.porteLeTag(e)
      }),
    [allEntities, etats, manquants, filtres],
  )

  const comptes = useMemo(
    () => ({
      tout: retenuesPour('tout').length,
      completer: retenuesPour('completer').length,
      suivies: retenuesPour('suivies').length,
      envies: retenuesPour('envies').length,
    }),
    [retenuesPour],
  )

  // "À compléter" only speaks to what has volumes. A remembered filter must not
  // leave a collection of games on a choice it no longer sees.
  const avecCompleter = useMemo(
    () => allEntities.some((e) => e.variants.length > 0 && etats.get(e.id)?.possede),
    [allEntities, etats],
  )
  const filtre: FiltreCollection = preferences.filtre === 'completer' && !avecCompleter ? 'tout' : preferences.filtre

  const triees = useMemo(() => retenuesPour(filtre), [retenuesPour, filtre])

  // The order of the rooms is computed on the WHOLE collection, before any filter,
  // the tag included: a filter must not move a room, nor take its name away.
  const titresParType = useMemo(
    () =>
      compterLesTitresParType(
        allEntities.filter((e) => {
          const etat = etats.get(e.id)
          return etat ? correspondAuFiltre(etat, 'tout') : false
        }),
      ),
    [allEntities, etats],
  )
  const unSeulType = titresParType.size <= 1

  const salles = useMemo(
    () =>
      ordonnerLesTypes(entityTypes, titresParType)
        .map((entityType) => {
          const duType = triees.filter((e) => e.entityTypeId === entityType.id)
          return {
            entityType,
            nombre: duType.length,
            objets: plusRecentes(duType, venues, OEUVRES_PAR_SALLE).map(objetDe),
          }
        })
        .filter((salle) => salle.nombre > 0),
    [entityTypes, titresParType, triees, venues, objetDe],
  )

  const now = useNow()
  const addedThisMonthCount = useMemo(() => {
    const currentMonth = now.toISOString().slice(0, 7) // "YYYY-MM"
    return ownerships.filter((o) => o.status === 'OWNED' && o.acquiredAt.startsWith(currentMonth)).length
  }, [ownerships, now])

  /**
   * True only when EVERYTHING that a number depends on has arrived.
   *
   * A count is computed on `data ?? []`: as long as one single one of these
   * queries has not answered, it is zero - and the screen then announces an
   * empty collection to someone who has one (observed by freezing the API).
   */
  const isLoading = donnees.chargement
  const affiches = triees.length
  const vide = messageVide(filtre, filtres.nombreActifs > 0)

  const ouvrir = useOuvrirOeuvre({
    entities: allEntities,
    retour: RETOUR_COLLECTION,
    zone,
    pret: !isLoading && salles.length > 0,
  })

  const choisirFiltre = (suivant: FiltreCollection) =>
    deplacer(zone.current, () => preferences.definir({ filtre: suivant }))

  const choisirAffichage = (suivant: AffichageCollection) => {
    if (suivant === preferences.affichage) return
    deplacer(zone.current, () => preferences.definir({ affichage: suivant }), sortirLesDos)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <EnTeteSection
          niveau={1}
          titre="Ma collection"
          sousTitre={
            !isLoading ? (
              <>
                {affiches} {LIBELLES_DECOMPTE[filtre](affiches)}
                {filtre !== 'envies' &&
                  addedThisMonthCount > 0 &&
                  ` · ${addedThisMonthCount} ajout${addedThisMonthCount > 1 ? 's' : ''} ce mois`}
              </>
            ) : (
              // Takes the same line so that nothing jumps when the real
              // count arrives.
              'Chargement...'
            )
          }
        />

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <BarreVues
            filtre={filtre}
            onFiltre={choisirFiltre}
            comptes={!isLoading ? comptes : null}
            avecCompleter={avecCompleter}
          />
          <BasculeAffichage affichage={preferences.affichage} onChoisir={choisirAffichage} />
          {/* Without any tag there is nothing to filter on: no button at all. */}
          {filtres.tags.length > 0 && (
            <button
              type="button"
              onClick={filtres.ouvrir}
              aria-expanded={filtres.ouverts}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
                filtres.nombreActifs > 0
                  ? 'border-transparent bg-accentTint text-accentText'
                  : 'border-line bg-surface text-textPrimary shadow-token-sm hover:bg-rowHover'
              }`}
            >
              <SlidersHorizontal size={15} />
              Filtres
              {filtres.nombreActifs > 0 && (
                <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
                  {filtres.nombreActifs}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setHubMenuOpen(true)}
            title="Plus d'outils"
            // aria-label in addition to title: a button that only has an icon otherwise
            // takes its accessible name from the title alone, never announced on touch.
            aria-label="Plus d'outils"
            aria-expanded={hubMenuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-textPrimary shadow-token-sm transition-colors hover:bg-rowHover"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {donnees.erreurs.map((message) => (
        <ErrorBanner key={message} message={message} />
      ))}

      {isLoading && (
        <div className="mt-6 flex flex-col gap-2">
          <SqueletteRail />
          <SqueletteRail tuiles={3} />
        </div>
      )}

      {!isLoading && donnees.listeChargee && affiches === 0 && (
        <div className="mt-6">
          <EtatVide
            icone={
              filtres.nombreActifs > 0
                ? SlidersHorizontal
                : filtre === 'envies'
                  ? Heart
                  : filtre === 'suivies'
                    ? CalendarCheck
                    : Library
            }
            titre={vide.titre}
            detail={vide.detail || undefined}
            action={
              filtres.nombreActifs > 0 ? (
                <button type="button" onClick={filtres.reinitialiser} className="btn-secondaire">
                  Réinitialiser les filtres
                </button>
              ) : filtre === 'tout' ? (
                <Link to="/add" className="btn-primaire">
                  Ouvrir le Catalogue
                </Link>
              ) : undefined
            }
          />
        </div>
      )}

      {!unSeulType && salles.length > 1 && (
        <BarreCategories salles={salles.map((s) => ({ entityType: s.entityType, nombre: s.nombre }))} />
      )}

      <div ref={zone} data-affichage={preferences.affichage} className="mt-3 flex flex-col">
        {salles.map(({ entityType, objets, nombre }) => (
          <SalleCollection
            key={entityType.id}
            entityType={entityType}
            objets={objets}
            affichage={preferences.affichage}
            nommee={!unSeulType}
            lienRayon={nombre}
            onOuvrir={ouvrir}
          />
        ))}
      </div>

      <CollectionFilters
        open={filtres.ouverts}
        onClose={filtres.fermer}
        status={filtres.status}
        tags={filtres.tags}
        tagId={filtres.tagId}
        onTagChange={filtres.definirTag}
        onReset={filtres.reinitialiser}
      />

      {hubMenuOpen && (
        <>
          <div className="voile-entree fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={() => setHubMenuOpen(false)} />
          <div
            ref={hubMenuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-menu-title"
            className="feuille-entree fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-token-elevated md:inset-x-auto md:top-32 md:left-[max(12px,calc((100%-min(100%-48px,1600px))/2))] md:bottom-auto md:w-[280px] md:rounded-2xl md:border md:border-surface2 md:p-2"
          >
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <span id="hub-menu-title" className="font-display text-sm font-semibold text-textPrimary">
                Outils de ma collection
              </span>
              <button
                type="button"
                onClick={() => setHubMenuOpen(false)}
                aria-label="Fermer"
                className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:bg-rowHover"
              >
                <X size={16} />
              </button>
            </div>
            {/* "Valeur" leads TO the section that bears this name, not to a
                screen titled "Statistiques" where it then had to be found
                (UX-6). It was a visible button until the UI review of
                2026-10-13: a figure one checks now and then, not a way of
                reading the shelf. */}
            <button
              type="button"
              onClick={() => {
                setHubMenuOpen(false)
                navigate('/stats', { state: { focusValeur: true } })
              }}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              <BarChart3 size={17} />
              Valeur de la collection
            </button>
            {/* "Catégories de collection" here rather than only under
                Administration: a category STRUCTURES this
                screen (one rail per type), so this is where one realizes
                that one is missing - reported by the user, "pas logique de
                passer par le profil". The screen stays reachable from
                Administration: this is not a move but a second
                path, shorter, placed where the need is born. */}
            <button
              type="button"
              onClick={() => {
                setHubMenuOpen(false)
                // The origin travels with the navigation: without it, the back link
                // of this screen would offer Administration, its natural
                // parent - a detour, for someone who comes from here.
                navigate('/types', { state: { retour: RETOUR_COLLECTION } })
              }}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              <Layers size={17} />
              Catégories de collection
              <span className="ml-auto text-xs font-normal text-textDim">{entityTypes.length}</span>
            </button>
            {/* Shortcut to the common sharing, not a second mechanism:
                collection and wishes are shared by the SAME link, and this
                shortcut therefore leads to the same settings as from Profil or
                Envies. Entering from here does not create one more token. */}
            <button
              type="button"
              onClick={() => {
                setHubMenuOpen(false)
                navigate('/profile', { state: { focusPartage: true } })
              }}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              <Link2 size={17} />
              Partager ma collection
            </button>
          </div>
        </>
      )}
    </div>
  )
}
