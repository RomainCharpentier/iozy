import { useCallback, useMemo, useState } from 'react'
import { BarChart3, CalendarCheck, Heart, Layers, Library, Link2, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CategorySection } from './CategorySection'
import { CollectionFilters } from './CollectionFilters'
import { BarreVues } from './BarreVues'
import {
  aplatirEnElements,
  compterLesTitresParType,
  correspondAuFiltre,
  etatDeLOeuvre,
  groupByEntityType,
  matchesCompletionFilter,
  ordonnerLesTypes,
} from './shelfTiles'
import { indexerVenues, trierOeuvres } from './venues'
import { usePreferencesCollection, type FiltreCollection } from '@/common/lib/preferencesCollection'

import { useModalA11y } from '@/common/hooks/useModalA11y'
import type { EntityResponse } from '@/common/types/api'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { EtatVide } from '@/common/components/EtatVide'
import { useDonneesCollection } from './useDonneesCollection'
import { useFiltresCollection } from './useFiltresCollection'
import { SqueletteRail } from '@/common/components/Squelette'

/**
 * What the subtitle counts, depending on what is being looked at. A count must name
 * the thing counted: under "Envies + non groupée", "12 titres possédés"
 * would be wrong twice.
 */
const LIBELLES_DECOMPTE: Record<'groupee' | 'plate', Record<FiltreCollection, (n: number) => string>> = {
  groupee: {
    tout: (n) => `titre${n > 1 ? 's' : ''}`,
    possedes: (n) => `titre${n > 1 ? 's' : ''} possédé${n > 1 ? 's' : ''}`,
    suivies: (n) => `titre${n > 1 ? 's' : ''} suivi${n > 1 ? 's' : ''}`,
    envies: (n) => `titre${n > 1 ? 's' : ''} avec une envie en cours`,
  },
  // Without an object name in the ungrouped view: "tome" only applies to a manga, and
  // "élément" sounds like a developer word. The contrast with
  // "titres" of the grouped view already says what is counted.
  plate: {
    tout: (n) => `possédé${n > 1 ? 's' : ''} ou voulu${n > 1 ? 's' : ''}`,
    possedes: (n) => `possédé${n > 1 ? 's' : ''}`,
    suivies: () => 'suivis',
    envies: () => 'dans mes envies',
  },
}

/** An empty screen must say WHY it is empty, and how to get out of it. */
function messageVide(filtre: FiltreCollection, filtresActifs: boolean): { titre: string; detail: string } {
  if (filtresActifs) {
    return { titre: 'Rien ne correspond à ces filtres.', detail: '' }
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

// Stable reference for the "not loaded yet" fallback - an inline `[]`
// would be recreated at every render and would invalidate the memoization.

/**
 * V1.2 structure (see docs/DESIGN_MIGRATION_V1.2.md, Batch 3): one row per
 * owned category (see CategorySection) rather than a single grid
 * filtered by chips Tout/Manga/Jeu vidéo/Jeu de société - the split
 * by type is now structural, no need to choose a filter
 * to see it. The "Par tome" filter (flat grid, one volume = one tile)
 * has no equivalent in this rail structure (each rail shows
 * SERIES, never individual volumes) and appears nowhere in
 * the V1.2 mockup - removed from this screen (documented difference, see
 * docs/DESIGN_MIGRATION_V1.2.md). Nothing is lost on the model/data side: the
 * volume by volume tracking (individual Ownership) stays whole.
 *
 * <h2>One page, three readings (product study of 2026-08-27)</h2>
 * "Collection" and "Envies" were two screens for the same place. They
 * are now three FILTERS - Tout / Possédés / Envies - which all reason
 * about the ITEMS that a group contains, and two VIEWS: grouped (one
 * card per group) or ungrouped (the items themselves). The "by
 * volume" mode removed in Batch 3 therefore comes back here, but as a full view
 * rather than as a disguised type filter - and without assuming that
 * the item is a volume: each type has its own groups.
 *
 * <p>Filter, view and sort are remembered (see lib/preferencesCollection): they
 * describe a habit, not a choice to redo at every opening.
 *
 * <h2>The core screen (batch 136)</h2>
 * This page works for any collection: nothing that it shows
 * assumes a universe. What belongs to one of them - the cover tool
 * of the mangas, the BoardGameGeek import - lives on its shelf or on the Catalog,
 * never in the toolbar here; and the order of the rails comes from the data
 * (see ordonnerLesTypes), not from a list of codes that named manga
 * first.
 */
export function ShelfPage() {
  const navigate = useNavigate()
  const filtres = useFiltresCollection()
  const preferences = usePreferencesCollection()
  const [hubMenuOpen, setHubMenuOpen] = useState(false)
  // Escape + focus trap + focus returned to the trigger - see
  // useModalA11y (Batch 9).
  const hubMenuRef = useModalA11y<HTMLDivElement>(hubMenuOpen, () => setHubMenuOpen(false))

  const donnees = useDonneesCollection()
  const {
    entities: allEntities,
    entityTypes,
    ownerships,
    progression,
    owned,
    oeuvresVoulues,
    oeuvresSuivies,
    tomesVoulus,
    wishlist,
  } = donnees

  // The state of each work, computed once: the three counters of the bar
  // and the displayed list all read it, instead of deriving it again each.
  const etats = useMemo(
    () => new Map(allEntities.map((e) => [e.id, etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies)])),
    [allEntities, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies],
  )

  const venues = useMemo(() => indexerVenues(ownerships, wishlist.entries), [ownerships, wishlist.entries])

  const typesParId = useMemo(() => new Map(entityTypes.map((t) => [t.id, t])), [entityTypes])

  /** The works that THIS filter keeps - the state filter (Complètes /
   *  Incomplètes) only applies to what has a completeness, a work
   *  that is only wished not having one yet. The tag, for its part, applies to all:
   *  it is set on the work, owned or not. */
  const retenuesPour = useCallback(
    (filtre: FiltreCollection) =>
      allEntities.filter((e) => {
        const etat = etats.get(e.id)
        if (!etat || !correspondAuFiltre(etat, filtre)) return false
        if (!filtres.porteLeTag(e)) return false
        return !etat.possede || matchesCompletionFilter(e, filtres.status, progression)
      }),
    [allEntities, etats, filtres, progression],
  )

  const contexteAplatissement = useMemo(
    () => ({
      ownerships,
      owned,
      tomesVoulus,
      oeuvresVoulues,
      depuisTome: (variantId: string) => venues.parTome.get(variantId) ?? '',
      depuisOeuvre: (entityId: string) => venues.parOeuvre.get(entityId) ?? '',
    }),
    [ownerships, owned, tomesVoulus, oeuvresVoulues, venues],
  )

  /**
   * What each filter would give, **in the current view**.
   *
   * The counter always went through the groups: in the ungrouped view it
   * announced "Possédés 6" above twelve tiles. A number placed next
   * to a label must count what this label shows - otherwise it is not
   * a help, it is a contradiction. It therefore follows the same path as
   * the display, state filter included.
   */
  const comptes = useMemo(() => {
    const compter = (filtre: FiltreCollection) => {
      const retenues = retenuesPour(filtre)
      return preferences.vue === 'groupee'
        ? retenues.length
        : aplatirEnElements(retenues, filtre, contexteAplatissement).length
    }
    return { tout: compter('tout'), possedes: compter('possedes'), suivies: compter('suivies'), envies: compter('envies') }
  }, [retenuesPour, preferences.vue, contexteAplatissement])

  const triees = useMemo(
    () => trierOeuvres(retenuesPour(preferences.filtre), preferences.tri, venues),
    [retenuesPour, preferences.filtre, preferences.tri, venues],
  )

  const envieDe = useMemo(
    () => (entity: EntityResponse) => ({
      possede: etats.get(entity.id)?.possede ?? false,
      suivi: etats.get(entity.id)?.suivi ?? false,
      tomesVoulus:
        entity.variants.filter((v) => tomesVoulus.has(v.id)).length + (oeuvresVoulues.has(entity.id) ? 1 : 0),
      prioritaire: preferences.filtre === 'envies',
    }),
    [etats, tomesVoulus, oeuvresVoulues, preferences.filtre],
  )

  // The order of the rails is computed on the WHOLE collection - owned or wished,
  // before the filter and whatever the view: changing the filter must not
  // make a rail jump above another one.
  const titresParType = useMemo(() => compterLesTitresParType(retenuesPour('tout')), [retenuesPour])

  const sections = useMemo(
    () => groupByEntityType(triees, entityTypes, progression, envieDe, titresParType),
    [triees, entityTypes, progression, envieDe, titresParType],
  )

  const tuilesElements = useMemo(
    () => aplatirEnElements(triees, preferences.filtre, contexteAplatissement),
    [triees, preferences.filtre, contexteAplatissement],
  )

  // The sort by title is already carried by the order of the works; by recency, it
  // is the ITEMS that must be reordered - otherwise those of the same group
  // would stay together although the ungrouped view precisely unlinks them.
  const tuilesAffichees = useMemo(
    () =>
      preferences.tri === 'titre'
        ? tuilesElements
        : [...tuilesElements].sort((a, b) => b.depuis.localeCompare(a.depuis)),
    [tuilesElements, preferences.tri],
  )

  /**
   * The rows to display - SAME shape, SAME component, in both views.
   *
   * Ungrouping only changes what a row contains: groups or the
   * items that they contain. The presentation, for its part, does not move - halo
   * tinted by universe, clickable header, horizontal scroll. A second
   * layout would only have diverged from this one.
   */
  const rangees = useMemo(
    () =>
      preferences.vue === 'groupee'
        ? sections
        : ordonnerLesTypes([...typesParId.values()], titresParType)
            .map((entityType) => ({
              entityType,
              tiles: tuilesAffichees.filter((tuile) => tuile.entityTypeId === entityType.id),
            }))
            .filter((rangee) => rangee.tiles.length > 0),
    [preferences.vue, sections, tuilesAffichees, typesParId, titresParType],
  )

  const addedThisMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    return ownerships.filter((o) => o.status === 'OWNED' && o.acquiredAt.startsWith(currentMonth)).length
  }, [ownerships])

  /**
   * True only when EVERYTHING that a number depends on has arrived.
   *
   * A count is computed on `data ?? []`: as long as one single one of these
   * queries has not answered, it is zero - and the screen then announces an
   * empty collection to someone who has one (observed by freezing the API:
   * "0 possédé ou voulu", filters at 0/0/0, while "Chargement..."
   * was displayed just below). The editions reference is part of it:
   * it decides the completeness, therefore the Complètes/Incomplètes filter.
   */
  const isLoading = donnees.chargement
  const affiches = preferences.vue === 'plate' ? tuilesAffichees.length : triees.length

  const vide = messageVide(preferences.filtre, filtres.nombreActifs > 0)

  return (
    <div className="flex flex-col gap-1">
      {/* The subtitle follows the filter: under "Envies", announcing a number of
          titres possédés would describe something other than what is on the screen. */}
      <EnTeteSection
        niveau={1}
        titre="Ma collection"
        sousTitre={
          !isLoading ? (
            <>
              {affiches} {LIBELLES_DECOMPTE[preferences.vue][preferences.filtre](affiches)}
              {preferences.filtre !== 'envies' &&
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

      {/* Calm toolbar, ONE row on desktop: the four readings, one
          "Affichage" entry (grouping, sort and filters, badge if a filter is
          active) and "Plus d'outils". Grouping, sort and Valeur used to be
          visible buttons too: eight controls, three rows on a phone, about 40%
          of the screen before the first cover (UI review of 2026-10-13). */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <BarreVues
          filtre={preferences.filtre}
          onFiltre={(filtre) => preferences.definir({ filtre })}
          comptes={!isLoading ? comptes : null}
        />
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
          Affichage
          {filtres.nombreActifs > 0 && (
            <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
              {filtres.nombreActifs}
            </span>
          )}
        </button>
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
                : preferences.filtre === 'envies'
                  ? Heart
                  : preferences.filtre === 'suivies'
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
              ) : preferences.filtre === 'tout' ? (
                <Link to="/add" className="btn-primaire">
                  Ouvrir le Catalogue
                </Link>
              ) : undefined
            }
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {rangees.map(({ entityType, tiles }) => (
          <CategorySection key={entityType.id} entityType={entityType} tiles={tiles} />
        ))}
      </div>

      <CollectionFilters
        open={filtres.ouverts}
        onClose={filtres.fermer}
        vue={preferences.vue}
        onVue={(vue) => preferences.definir({ vue })}
        tri={preferences.tri}
        onTri={(tri) => preferences.definir({ tri })}
        status={filtres.status}
        onStatusChange={filtres.definirStatus}
        tags={filtres.tags}
        tagId={filtres.tagId}
        onTagChange={filtres.definirTag}
        onReset={filtres.reinitialiser}
      />

      {hubMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:bg-transparent" onClick={() => setHubMenuOpen(false)} />
          <div
            ref={hubMenuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-menu-title"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-token-elevated md:inset-x-auto md:top-32 md:left-[max(12px,calc((100%-min(100%-48px,1600px))/2))] md:bottom-auto md:w-[280px] md:rounded-2xl md:border md:border-surface2 md:p-2"
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
                navigate('/types', { state: { retour: { to: '/', libelle: 'Ma collection' } } })
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
