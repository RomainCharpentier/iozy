import { useCallback, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarCheck, Heart, Layers, SlidersHorizontal } from 'lucide-react'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EtatVide } from '@/common/components/EtatVide'
import { LienRetour } from '@/common/components/LienRetour'
import { SqueletteGrille } from '@/common/components/Squelette'
import { getEntityTypeVisual } from '@/common/lib/entityTypeVisuals'
import {
  usePreferencesCollection,
  type AffichageCollection,
  type FiltreCollection,
} from '@/common/lib/preferencesCollection'
import { BarreVues } from '@/pages/collection/BarreVues'
import { BasculeAffichage } from '@/pages/collection/BasculeAffichage'
import { CollectionFilters } from '@/pages/collection/CollectionFilters'
import { deplacer, sortirLesDos } from '@/pages/collection/mouvement'
import { SalleCollection } from '@/pages/collection/SalleCollection'
import { correspondAuFiltre, matchesCompletionFilter } from '@/pages/collection/shelfTiles'
import { useDonneesCollection } from '@/pages/collection/useDonneesCollection'
import { useFiltresCollection } from '@/pages/collection/useFiltresCollection'
import { useObjetsCollection } from '@/pages/collection/useObjetsCollection'
import { useOuvrirOeuvre } from '@/pages/collection/useOuvrirOeuvre'
import { RattrapageEditeurs } from './RattrapageEditeurs'
import { RattrapageJaquettes } from './RattrapageJaquettes'

/**
 * The shelf page of a category: the same room as on My collection, with
 * everything in it. A room there only shows what moved last (batch 206); this is
 * where the rest is, and the tools of the category.
 *
 * <h2>Two settings, two scopes</h2>
 * The STATE filter (Complètes/Incomplètes) belongs to this page: filtering
 * "Incomplètes" here must not affect the other rooms when going back. The
 * Tout/À compléter/Suivies/Envies filter and the view are the SHARED preferences of
 * My collection: arriving here from "Envies" and landing on the owned items would
 * be a break, not a local filter.
 */
export function CategoryPage() {
  const { entityTypeId } = useParams<{ entityTypeId: string }>()
  const filtres = useFiltresCollection()
  const preferences = usePreferencesCollection()
  const donnees = useDonneesCollection()
  const zone = useRef<HTMLDivElement>(null)

  const entityType = donnees.entityTypes.find((t) => t.id === entityTypeId)
  const visual = getEntityTypeVisual(entityType)
  const { etats, manquants, objetDe } = useObjetsCollection(donnees, preferences.filtre)
  const { entities: allEntities, progression } = donnees

  const duType = useMemo(() => allEntities.filter((e) => e.entityTypeId === entityTypeId), [allEntities, entityTypeId])

  const retenuesPour = useCallback(
    (filtre: FiltreCollection) =>
      duType.filter((e) => {
        const etat = etats.get(e.id)
        if (!etat || !correspondAuFiltre(etat, filtre, (manquants.get(e.id) ?? 0) > 0)) return false
        if (!filtres.porteLeTag(e)) return false
        return !etat.possede || matchesCompletionFilter(e, filtres.status, progression)
      }),
    [duType, etats, manquants, filtres, progression],
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

  // Everything, by title; "À compléter" starts with the shortest list.
  const objets = useMemo(() => {
    const parTitre = [...retenuesPour(preferences.filtre)].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
    if (preferences.filtre === 'completer') {
      parTitre.sort((a, b) => (manquants.get(a.id) ?? 0) - (manquants.get(b.id) ?? 0))
    }
    return parTitre.map(objetDe)
  }, [retenuesPour, preferences.filtre, manquants, objetDe])

  const possedees = useMemo(() => duType.filter((e) => etats.get(e.id)?.possede), [duType, etats])

  // No number until everything has arrived, otherwise the page announces an
  // empty category that is not empty - the rule lives in useDonneesCollection.
  const isLoading = donnees.chargement

  const retour = useMemo(
    () => ({ to: `/collection/${entityTypeId}`, libelle: entityType?.label ?? 'Ma collection' }),
    [entityTypeId, entityType?.label],
  )
  const ouvrir = useOuvrirOeuvre({ entities: allEntities, retour, zone, pret: !isLoading && objets.length > 0 })

  const choisirFiltre = (suivant: FiltreCollection) =>
    deplacer(zone.current, () => preferences.definir({ filtre: suivant }))
  const choisirAffichage = (suivant: AffichageCollection) => {
    if (suivant === preferences.affichage) return
    deplacer(zone.current, () => preferences.definir({ affichage: suivant }), sortirLesDos)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The common back link: 44 px high, the destination named by whoever opened
          the screen (see lib/retour), otherwise the natural parent. */}
      <LienRetour parDefaut={{ to: '/', libelle: 'Ma collection' }} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2.5">
          <span className="h-[11px] w-[11px] shrink-0 rounded-full" style={{ background: visual.color }} />
          <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-textPrimary">
            {entityType?.label ?? '…'}
          </h1>
          {!isLoading && <span className="text-sm text-faint">{objets.length}</span>}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <BarreVues
            filtre={preferences.filtre}
            onFiltre={choisirFiltre}
            comptes={!isLoading ? comptes : null}
            avecCompleter={duType.some((e) => e.variants.length > 0)}
          />
          <BasculeAffichage affichage={preferences.affichage} onChoisir={choisirAffichage} />
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
        </div>
      </div>

      {entityType && !isLoading && (
        <div className="flex flex-wrap items-start gap-2 empty:hidden">
          {entityType.code === 'MANGA' && (
            <RattrapageJaquettes oeuvresPossedees={possedees} mangaTypeId={entityType.id} />
          )}
          {(entityType.code === 'VIDEO_GAME' || entityType.code === 'BOARD_GAME') && possedees.length > 0 && (
            <RattrapageEditeurs oeuvresPossedees={possedees} entityTypeId={entityType.id} />
          )}
        </div>
      )}

      {donnees.erreurs.map((message) => (
        <ErrorBanner key={message} message={message} />
      ))}
      {isLoading && <SqueletteGrille />}

      {!isLoading && donnees.listeChargee && objets.length === 0 && (
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

      <div ref={zone} data-affichage={preferences.affichage} className="flex flex-col">
        {entityType && objets.length > 0 && (
          <SalleCollection
            entityType={entityType}
            objets={objets}
            affichage={preferences.affichage}
            nommee={false}
            onOuvrir={ouvrir}
          />
        )}
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
