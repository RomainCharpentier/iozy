import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, SlidersHorizontal } from 'lucide-react'
import { searchEntities } from '../../api/entities'
import { listAllOwnerships } from '../../api/ownerships'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { CoverTile } from '../../components/CoverTile'
import { ErrorBanner } from '../../components/ErrorBanner'
import { getEntityTypeVisual } from '../../lib/entityTypeVisuals'
import {
  aplatirEnElements,
  buildShelfTile,
  correspondAuFiltre,
  etatDeLOeuvre,
  indexEditionTotals,
  matchesCompletionFilter,
  type CompletionFilter,
} from './shelfTiles'
import { BarreVues } from './BarreVues'
import { indexerVenues, trierOeuvres } from './venues'
import { GrilleElements } from './GrilleElements'
import { usePreferencesCollection, type FiltreCollection } from '../../lib/preferencesCollection'
import { useWishlist } from '../../lib/useWishlist'
import { listAllEditions } from '../../api/purchaseAnalysis'
import type { MangaEditionDto } from '../../types/purchaseAnalysis'

/** Référence stable - voir ShelfPage pour la même précaution. */
const EMPTY_EDITIONS: MangaEditionDto[] = []
import { CollectionFilters } from './CollectionFilters'
import { ownedVariantIds } from './ownership'
import type { EntityResponse, EntityTypeDto, OwnershipResponse } from '../../types/api'
import { CLASSE_CARTE } from '../../components/Carte'

const EMPTY_ENTITIES: EntityResponse[] = []
const EMPTY_ENTITY_TYPES: EntityTypeDto[] = []
const EMPTY_OWNERSHIPS: OwnershipResponse[] = []

/**
 * "Vue catégorie" (voir la maquette V1.2) - la grille complète d'un seul type,
 * accessible via "Tout voir" depuis une ligne de Ma collection.
 *
 * <h2>Deux réglages, deux portées</h2>
 * Le filtre d'ÉTAT (Complètes/Incomplètes) est propre à cette page : filtrer
 * "Incomplètes" ici ne doit pas affecter les autres rails quand on revient en
 * arrière. Le filtre Tout/Possédés/Envies, la vue et le tri, eux, sont les
 * préférences PARTAGÉES de Ma collection : arriver ici par "Tout voir" depuis
 * « Envies » et retomber sur les possessions serait une rupture, pas un
 * filtre local.
 */
export function CategoryPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')
  const preferences = usePreferencesCollection()
  const wishlist = useWishlist()

  const entitiesQuery = useQuery({ queryKey: queryKeys.entities.search({}), queryFn: () => searchEntities({}) })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const ownershipsQuery = useQuery({ queryKey: queryKeys.allOwnerships, queryFn: listAllOwnerships })
  // Référentiel d'éditions : une seule requête pour tout l'écran, partagée
  // en cache entre Ma collection et la page catégorie - la progression X/Y
  // se lit PAR ÉDITION (voir indexEditionTotals), comme sur la fiche.
  const editionsQuery = useQuery({ queryKey: queryKeys.purchaseAnalysis.allEditions, queryFn: listAllEditions })
  const editionTotals = useMemo(() => indexEditionTotals(editionsQuery.data ?? EMPTY_EDITIONS), [editionsQuery.data])

  const allEntities = entitiesQuery.data ?? EMPTY_ENTITIES
  const entityTypes = entityTypesQuery.data ?? EMPTY_ENTITY_TYPES
  const ownerships = ownershipsQuery.data ?? EMPTY_OWNERSHIPS
  const owned = useMemo(() => ownedVariantIds(ownerships), [ownerships])
  const entityType = entityTypes.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType)

  const oeuvresVoulues = useMemo(
    () => new Set(wishlist.entries.filter((e) => !e.variantId).map((e) => e.entityId)),
    [wishlist.entries],
  )
  const tomesVoulus = wishlist.variantsVoulus

  const duType = useMemo(
    () => allEntities.filter((e) => e.entityTypeId === entityTypeId),
    [allEntities, entityTypeId],
  )

  const comptes = useMemo(() => {
    const total: Record<FiltreCollection, number> = { tout: 0, possedes: 0, envies: 0 }
    for (const entity of duType) {
      const etat = etatDeLOeuvre(entity, ownerships, owned, tomesVoulus, oeuvresVoulues)
      if (etat.possede) total.possedes++
      if (etat.voulu) total.envies++
      if (etat.possede || etat.voulu) total.tout++
    }
    return total
  }, [duType, ownerships, owned, tomesVoulus, oeuvresVoulues])

  const venues = useMemo(() => indexerVenues(ownerships, wishlist.entries), [ownerships, wishlist.entries])

  const entities = useMemo(() => {
    const retenues = duType.filter((e) => {
      const etat = etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues)
      if (!correspondAuFiltre(etat, preferences.filtre)) return false
      return !etat.possede || matchesCompletionFilter(e, owned, status, editionTotals)
    })
    return trierOeuvres(retenues, preferences.tri, venues)
  }, [duType, ownerships, owned, tomesVoulus, oeuvresVoulues, preferences.filtre, preferences.tri, status, editionTotals, venues])

  const tiles = useMemo(
    () =>
      entities.map((e) =>
        buildShelfTile(e, owned, editionTotals, {
          possede: etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues).possede,
          tomesVoulus: e.variants.filter((v) => tomesVoulus.has(v.id)).length + (oeuvresVoulues.has(e.id) ? 1 : 0),
          prioritaire: preferences.filtre === 'envies',
        }),
      ),
    [entities, owned, editionTotals, ownerships, tomesVoulus, oeuvresVoulues, preferences.filtre],
  )

  // Un seul type ici : pas de badge de type sur les tuiles, il serait le même
  // partout et répéterait le titre de la page.
  const tuilesElements = useMemo(() => {
    const tuiles = aplatirEnElements(entities, preferences.filtre, {
      ownerships,
      owned,
      tomesVoulus,
      oeuvresVoulues,
      depuisTome: (variantId) => venues.parTome.get(variantId) ?? '',
      depuisOeuvre: (entityId) => venues.parOeuvre.get(entityId) ?? '',
    })
    // Par titre, l'ordre des œuvres suffit ; par récence, ce sont les TOMES
    // qu'il faut réordonner - sinon « Récents d'abord » ne ferait rien de
    // visible dans la vue qui délie justement les tomes de leur série.
    return preferences.tri === 'titre' ? tuiles : [...tuiles].sort((a, b) => b.depuis.localeCompare(a.depuis))
  }, [entities, preferences.filtre, preferences.tri, ownerships, owned, tomesVoulus, oeuvresVoulues, venues])

  const typesParId = useMemo(() => new Map(entityTypes.map((t) => [t.id, t])), [entityTypes])
  const affiches = preferences.vue === 'plate' ? tuilesElements.length : tiles.length

  const isLoading = entitiesQuery.isLoading || ownershipsQuery.isLoading || wishlist.isLoading

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => navigate('/')} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-textDim">
        <ArrowLeft size={15} />
        Ma collection
      </button>

      <div className="flex items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em]" style={{ color: entityType ? visual.color : undefined }}>
          {entityType?.label ?? '…'}
        </h1>
        <span className="text-sm text-faint">{affiches}</span>
      </div>

      <BarreVues
        filtre={preferences.filtre}
        onFiltre={(filtre) => preferences.definir({ filtre })}
        vue={preferences.vue}
        onVue={(vue) => preferences.definir({ vue })}
        tri={preferences.tri}
        onTri={(tri) => preferences.definir({ tri })}
        comptes={comptes}
      />

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-expanded={filtersOpen}
        className={`flex w-fit min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
          status !== 'ALL' ? 'border-transparent bg-accentTint text-accentText' : 'border-fieldBorder text-textDim hover:bg-rowHover'
        }`}
      >
        <SlidersHorizontal size={15} />
        Filtres
        {status !== 'ALL' && (
          <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accentInk">
            1
          </span>
        )}
      </button>

      {entitiesQuery.isError && <ErrorBanner message={entitiesQuery.error.message} />}
      {ownershipsQuery.isError && <ErrorBanner message={ownershipsQuery.error.message} />}
      {isLoading && <p className="text-textDim">Chargement...</p>}

      {!isLoading && entitiesQuery.isSuccess && affiches === 0 && (
        <div className={CLASSE_CARTE}>
          <p className="font-display text-base font-semibold text-textPrimary">
            {preferences.filtre === 'envies'
              ? 'Aucune envie en cours dans cette catégorie.'
              : 'Aucune série ne correspond à ces filtres.'}
          </p>
          {status !== 'ALL' && (
            <button type="button" onClick={() => setStatus('ALL')} className="mt-3 w-fit text-sm font-semibold text-accentText">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {preferences.vue === 'plate' ? (
        <GrilleElements tuiles={tuilesElements} typesParId={typesParId} />
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-5 xl:grid-cols-5 2xl:grid-cols-6">
          {tiles.map((tile) => (
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
      )}

      <CollectionFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} status={status} onStatusChange={setStatus} />
    </div>
  )
}
