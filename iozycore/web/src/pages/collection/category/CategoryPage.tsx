import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LienRetour } from '@/common/components/LienRetour'
import { CalendarCheck, Heart, Layers, SlidersHorizontal } from 'lucide-react'
import { CoverTile } from '@/common/components/CoverTile'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import {
  aplatirEnElements,
  buildShelfTile,
  correspondAuFiltre,
  etatDeLOeuvre,
  matchesCompletionFilter,
} from '@/pages/collection/shelfTiles'
import { BarreVues } from '@/pages/collection/BarreVues'
import { indexerVenues, trierOeuvres } from '@/pages/collection/venues'
import { usePreferencesCollection, type FiltreCollection } from '@/common/lib/preferencesCollection'

import { CollectionFilters } from '@/pages/collection/CollectionFilters'
import { EtatVide } from '@/common/components/EtatVide'
import { useDonneesCollection } from '@/pages/collection/useDonneesCollection'
import { useFiltresCollection } from '@/pages/collection/useFiltresCollection'
import { RattrapageJaquettes } from './RattrapageJaquettes'
import { SqueletteGrille } from '@/common/components/Squelette'


/**
 * "Category view" (see the V1.2 mockup) - the full grid of a single type,
 * reached through "Tout voir" from a row of My collection.
 *
 * <h2>Two settings, two scopes</h2>
 * The STATE filter (Complètes/Incomplètes) belongs to this page: filtering
 * "Incomplètes" here must not affect the other rails when going back.
 * The Tout/Possédés/Envies filter, the view and the sort, for their part, are the
 * SHARED preferences of My collection: arriving here through "Tout voir" from
 * "Envies" and landing on the owned items would be a break, not a
 * local filter.
 */
export function CategoryPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const navigate = useNavigate()
  // Named by the screen of origin when it passes it, otherwise the natural parent.
  const filtres = useFiltresCollection()
  const preferences = usePreferencesCollection()

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
  const entityType = entityTypes.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType)

  const duType = useMemo(
    () => allEntities.filter((e) => e.entityTypeId === entityTypeId),
    [allEntities, entityTypeId],
  )

  const venues = useMemo(() => indexerVenues(ownerships, wishlist.entries), [ownerships, wishlist.entries])

  const retenuesPour = useCallback(
    (filtre: FiltreCollection) =>
      duType.filter((e) => {
        const etat = etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies)
        if (!correspondAuFiltre(etat, filtre)) return false
        if (!filtres.porteLeTag(e)) return false
        return !etat.possede || matchesCompletionFilter(e, filtres.status, progression)
      }),
    [duType, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies, filtres, progression],
  )

  const contexteAplatissement = useMemo(
    () => ({
      ownerships,
      owned,
      tomesVoulus,
      oeuvresVoulues,
      oeuvresSuivies,
      depuisTome: (variantId: string) => venues.parTome.get(variantId) ?? '',
      depuisOeuvre: (entityId: string) => venues.parOeuvre.get(entityId) ?? '',
    }),
    [ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies, venues],
  )

  /** What each filter would give in the CURRENT VIEW - same rule as on
   *  My collection: a number placed next to a label counts what this
   *  label shows, groups or items. */
  const comptes = useMemo(() => {
    const compter = (filtre: FiltreCollection) => {
      const retenues = retenuesPour(filtre)
      return preferences.vue === 'groupee'
        ? retenues.length
        : aplatirEnElements(retenues, filtre, contexteAplatissement).length
    }
    return { tout: compter('tout'), possedes: compter('possedes'), suivies: compter('suivies'), envies: compter('envies') }
  }, [retenuesPour, preferences.vue, contexteAplatissement])

  const entities = useMemo(
    () => trierOeuvres(retenuesPour(preferences.filtre), preferences.tri, venues),
    [retenuesPour, preferences.filtre, preferences.tri, venues],
  )

  const tiles = useMemo(
    () =>
      entities.map((e) =>
        buildShelfTile(e, progression, {
          possede: etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies).possede,
          suivi: oeuvresSuivies.has(e.id),
          tomesVoulus: e.variants.filter((v) => tomesVoulus.has(v.id)).length + (oeuvresVoulues.has(e.id) ? 1 : 0),
          prioritaire: preferences.filtre === 'envies',
        }),
      ),
    [entities, owned, progression, ownerships, tomesVoulus, oeuvresVoulues, oeuvresSuivies, preferences.filtre],
  )

  // A single type here: no type badge on the tiles, it would be the same
  // everywhere and would repeat the title of the page.
  const tuilesElements = useMemo(() => {
    const tuiles = aplatirEnElements(entities, preferences.filtre, contexteAplatissement)
    // By title, the order of the works is enough; by recency, it is the ITEMS
    // that must be reordered - otherwise "Récents d'abord" would do nothing
    // visible in the view that precisely unlinks them from their group.
    return preferences.tri === 'titre' ? tuiles : [...tuiles].sort((a, b) => b.depuis.localeCompare(a.depuis))
  }, [entities, preferences.filtre, preferences.tri, contexteAplatissement])

  // A single render for both views: ungrouping changes the tiles, not their
  // layout (same reason as on My collection).
  const tuilesAffichees = preferences.vue === 'plate' ? tuilesElements : tiles
  const affiches = tuilesAffichees.length

  // The tool of the manga universe, on its shelf and nowhere else (see
  // RattrapageJaquettes): the owned mangas, filtered or not.
  const mangasPossedes = useMemo(
    () =>
      entityType?.code === 'MANGA'
        ? duType.filter((e) => etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies).possede)
        : [],
    [entityType, duType, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies],
  )

  // No number until everything has arrived, otherwise the page announces an
  // empty category that is not empty - the rule lives in useDonneesCollection.
  const isLoading = donnees.chargement


  return (
    <div className="flex flex-col gap-4">
      {/* The common back link: 44 px high (the manual copy here
          made 20), the destination named by whoever opened the screen
          (see lib/retour), otherwise the natural parent - received link, F5. */}
      <LienRetour parDefaut={{ to: '/', libelle: 'Ma collection' }} />

      <div className="flex items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em]" style={{ color: entityType ? visual.color : undefined }}>
          {entityType?.label ?? '…'}
        </h1>
        {!isLoading && <span className="text-sm text-faint">{affiches}</span>}
      </div>

      {/* One row, like My collection: grouping and sort live in "Affichage". */}
      <div className="flex flex-wrap items-center gap-2">
        <BarreVues
          filtre={preferences.filtre}
          onFiltre={(filtre) => preferences.definir({ filtre })}
          comptes={!isLoading ? comptes : null}
        />
        <button
          type="button"
          onClick={filtres.ouvrir}
          aria-expanded={filtres.ouverts}
          className={`flex w-fit min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
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
        {entityType && entityType.code === 'MANGA' && !isLoading && (
          <RattrapageJaquettes oeuvresPossedees={mangasPossedes} mangaTypeId={entityType.id} />
        )}
      </div>

      {donnees.erreurs.map((message) => (
        <ErrorBanner key={message} message={message} />
      ))}
      {isLoading && <SqueletteGrille />}

      {!isLoading && donnees.listeChargee && affiches === 0 && (
        <EtatVide
          icone={preferences.filtre === 'envies' ? Heart : preferences.filtre === 'suivies' ? CalendarCheck : Layers}
          titre={
            preferences.filtre === 'envies'
              ? 'Aucune envie en cours dans cette catégorie.'
              : preferences.filtre === 'suivies'
                ? 'Aucune œuvre suivie dans cette catégorie.'
                : 'Rien ne correspond à ces filtres.'
          }
          action={
            filtres.nombreActifs > 0 ? (
              <button type="button" onClick={filtres.reinitialiser} className="btn-secondaire">
                Réinitialiser les filtres
              </button>
            ) : undefined
          }
        />
      )}

      <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5 2xl:grid-cols-6">
        {tuilesAffichees.map((tile) => (
          <CoverTile
            key={tile.key}
            title={tile.title}
            subtitle={tile.subtitle}
            imageUrl={tile.imageUrl}
            gradientKey={tile.gradientKey}
            aspectClassName={visual.aspectClassName}
            signal={tile.signal}
            onClick={() => navigate(`/entity/${tile.entityId}`)}
          />
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
    </div>
  )
}
