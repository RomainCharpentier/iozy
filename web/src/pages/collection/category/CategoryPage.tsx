import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LienRetour } from '@/common/components/LienRetour'
import { CalendarCheck, Heart, Layers, SlidersHorizontal } from 'lucide-react'
import { CoverTile } from '@/pages/collection/CoverTile'
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
  // Nommé par l'écran d'origine quand il le passe, sinon le parent naturel.
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

  /** Ce que chaque filtre donnerait dans la VUE COURANTE - même règle que sur
   *  Ma collection : un nombre posé à côté d'un libellé compte ce que ce
   *  libellé montre, groupes ou éléments. */
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

  // Un seul type ici : pas de badge de type sur les tuiles, il serait le même
  // partout et répéterait le titre de la page.
  const tuilesElements = useMemo(() => {
    const tuiles = aplatirEnElements(entities, preferences.filtre, contexteAplatissement)
    // Par titre, l'ordre des œuvres suffit ; par récence, ce sont les ÉLÉMENTS
    // qu'il faut réordonner - sinon « Récents d'abord » ne ferait rien de
    // visible dans la vue qui les délie justement de leur groupe.
    return preferences.tri === 'titre' ? tuiles : [...tuiles].sort((a, b) => b.depuis.localeCompare(a.depuis))
  }, [entities, preferences.filtre, preferences.tri, contexteAplatissement])

  // Un seul rendu pour les deux vues : dégrouper change les tuiles, pas leur
  // mise en forme (même raison que sur Ma collection).
  const tuilesAffichees = preferences.vue === 'plate' ? tuilesElements : tiles
  const affiches = tuilesAffichees.length

  // L'outil de l'univers manga, sur son rayon et nulle part ailleurs (voir
  // RattrapageJaquettes) : les mangas possédés, filtre ou pas.
  const mangasPossedes = useMemo(
    () =>
      entityType?.code === 'MANGA'
        ? duType.filter((e) => etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies).possede)
        : [],
    [entityType, duType, ownerships, owned, tomesVoulus, oeuvresVoulues, oeuvresSuivies],
  )

  // Aucun chiffre tant que tout n'est pas arrivé, sans quoi la page annonce une
  // catégorie vide qui ne l'est pas - la règle vit dans useDonneesCollection.
  const isLoading = donnees.chargement


  return (
    <div className="flex flex-col gap-4">
      {/* Le lien de retour commun : 44 px de haut (la copie manuelle d'ici en
          faisait 20), la destination nommée par celui qui a ouvert l'écran
          (voir lib/retour), sinon le parent naturel - lien reçu, F5. */}
      <LienRetour parDefaut={{ to: '/', libelle: 'Ma collection' }} />

      <div className="flex items-center gap-2.5">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em]" style={{ color: entityType ? visual.color : undefined }}>
          {entityType?.label ?? '…'}
        </h1>
        {!isLoading && <span className="text-sm text-faint">{affiches}</span>}
      </div>

      <BarreVues
        filtre={preferences.filtre}
        onFiltre={(filtre) => preferences.definir({ filtre })}
        vue={preferences.vue}
        onVue={(vue) => preferences.definir({ vue })}
        tri={preferences.tri}
        onTri={(tri) => preferences.definir({ tri })}
        comptes={!isLoading ? comptes : null}
      />

      <div className="flex flex-wrap items-start gap-2">
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
          Filtres
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
