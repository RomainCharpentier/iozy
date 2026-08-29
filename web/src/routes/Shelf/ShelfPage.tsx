import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BarChart3, Download, ImagePlus, Layers, Link2, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { mergeVariantAttributes } from '../../api/entities'
import { searchVolumes } from '../../api/metadata'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { CategorySection } from './CategorySection'
import { CollectionFilters, type CompletionFilter } from './CollectionFilters'
import { BarreVues } from './BarreVues'
import { rattraperJaquettes, variantsMissingCover } from './backfillCovers'
import {
  aplatirEnElements,
  correspondAuFiltre,
  etatDeLOeuvre,
  groupByEntityType,
  matchesCompletionFilter,
  trierTypes,
} from './shelfTiles'
import { indexerVenues, trierOeuvres } from './venues'
import { usePreferencesCollection, type FiltreCollection } from '../../lib/preferencesCollection'

import { useModalA11y } from '../../lib/useModalA11y'
import type { EntityResponse } from '../../types/api'
import { EnTeteSection } from '../../components/EnTeteSection'
import { CLASSE_CARTE } from '../../components/Carte'
import { useDonneesCollection } from './useDonneesCollection'

/**
 * Ce que compte le sous-titre, selon ce qu'on regarde. Un décompte doit nommer
 * la chose comptée : sous « Envies + non groupée », « 12 titres possédés »
 * serait faux deux fois.
 */
const LIBELLES_DECOMPTE: Record<'groupee' | 'plate', Record<FiltreCollection, (n: number) => string>> = {
  groupee: {
    tout: (n) => `titre${n > 1 ? 's' : ''} suivi${n > 1 ? 's' : ''}`,
    possedes: (n) => `titre${n > 1 ? 's' : ''} possédé${n > 1 ? 's' : ''}`,
    envies: (n) => `titre${n > 1 ? 's' : ''} avec une envie en cours`,
  },
  // Sans nom d'objet en vue dégroupée : « tome » ne vaut que pour un manga, et
  // « élément » sonne comme un mot de développeur. Le contraste avec
  // « titres » de la vue groupée dit déjà ce qu'on compte.
  plate: {
    tout: (n) => `possédé${n > 1 ? 's' : ''} ou voulu${n > 1 ? 's' : ''}`,
    possedes: (n) => `possédé${n > 1 ? 's' : ''}`,
    envies: () => 'dans mes envies',
  },
}

/** Un écran vide doit dire POURQUOI il l'est, et par où en sortir. */
function messageVide(filtre: FiltreCollection, filtreEtatActif: boolean): { titre: string; detail: string } {
  if (filtreEtatActif) {
    return { titre: 'Aucune série ne correspond à ces filtres.', detail: '' }
  }
  if (filtre === 'envies') {
    return {
      titre: 'Aucune envie en cours.',
      detail: "Sur une fiche, « Je le veux » sur un élément manquant le fera apparaître ici.",
    }
  }
  return {
    titre: "Rien ici pour l'instant.",
    detail: 'Utilise l\'onglet "Rechercher" pour commencer ta collection.',
  }
}

// Référence stable pour le fallback "pas encore chargé" - un `[]` inline
// serait recréé à chaque render et invaliderait la mémoïsation.

/**
 * Structure V1.2 (voir docs/DESIGN_MIGRATION_V1.2.md, Lot 3) : une ligne par
 * catégorie possédée (voir CategorySection) plutôt qu'une grille unique
 * filtrée par chips Tout/Manga/Jeu vidéo/Jeu de société - la répartition
 * par type est maintenant structurelle, plus besoin de choisir un filtre
 * pour la voir. Le filtre "Par tome" (grille à plat, un tome = une tuile)
 * n'a pas d'équivalent dans cette structure en rails (chaque rail montre
 * des SÉRIES, jamais des tomes individuels) et n'apparaît nulle part dans
 * la maquette V1.2 - retiré de cet écran (différence documentée, voir
 * docs/DESIGN_MIGRATION_V1.2.md). Rien n'est perdu côté modèle/données : le
 * suivi tome par tome (Ownership individuelle) reste entier.
 *
 * <h2>Une page, trois lectures (étude produit du 2026-08-27)</h2>
 * « Collection » et « Envies » étaient deux écrans pour le même endroit. Ce
 * sont désormais trois FILTRES - Tout / Possédés / Envies - qui raisonnent
 * tous sur les ÉLÉMENTS qu'un groupe contient, et deux VUES : groupée (une
 * carte par groupe) ou dégroupée (les éléments eux-mêmes). Le mode « par
 * tome » retiré au Lot 3 revient donc ici, mais comme une vue de plein droit
 * plutôt que comme un filtre de type déguisé - et sans supposer que
 * l'élément soit un tome : chaque type a ses propres groupes.
 *
 * <p>Filtre, vue et tri sont mémorisés (voir lib/preferencesCollection) : ils
 * décrivent une habitude, pas un choix à refaire à chaque ouverture.
 */
export function ShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [status, setStatus] = useState<CompletionFilter>('ALL')
  const preferences = usePreferencesCollection()
  const [hubMenuOpen, setHubMenuOpen] = useState(false)
  // Escape + piège de focus + focus rendu au déclencheur - voir
  // useModalA11y (Lot 9).
  const hubMenuRef = useModalA11y<HTMLDivElement>(hubMenuOpen, () => setHubMenuOpen(false))

  const donnees = useDonneesCollection()
  const {
    entities: allEntities,
    entityTypes,
    ownerships,
    progression,
    owned,
    oeuvresVoulues,
    tomesVoulus,
    wishlist,
  } = donnees

  // L'état de chaque œuvre, calculé une fois : les trois compteurs de la barre
  // et la liste affichée le lisent tous, au lieu de le redériver chacun.
  const etats = useMemo(
    () => new Map(allEntities.map((e) => [e.id, etatDeLOeuvre(e, ownerships, owned, tomesVoulus, oeuvresVoulues)])),
    [allEntities, ownerships, owned, tomesVoulus, oeuvresVoulues],
  )

  const venues = useMemo(() => indexerVenues(ownerships, wishlist.entries), [ownerships, wishlist.entries])

  const typesParId = useMemo(() => new Map(entityTypes.map((t) => [t.id, t])), [entityTypes])

  /** Les œuvres que CE filtre retient - le filtre d'état (Complètes /
   *  Incomplètes) ne s'appliquant qu'à ce qui a une complétude, une œuvre
   *  seulement voulue n'en ayant pas encore. */
  const retenuesPour = useCallback(
    (filtre: FiltreCollection) =>
      allEntities.filter((e) => {
        const etat = etats.get(e.id)
        if (!etat || !correspondAuFiltre(etat, filtre)) return false
        return !etat.possede || matchesCompletionFilter(e, status, progression)
      }),
    [allEntities, etats, status, progression],
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
   * Ce que chaque filtre donnerait, **dans la vue courante**.
   *
   * Le compteur passait toujours par les groupes : en vue dégroupée il
   * annonçait « Possédés 6 » au-dessus de douze tuiles. Un nombre posé à côté
   * d'un libellé doit compter ce que ce libellé montre - sinon il n'est pas
   * une aide, c'est une contradiction. Il suit donc le même chemin que
   * l'affichage, filtre d'état compris.
   */
  const comptes = useMemo(() => {
    const compter = (filtre: FiltreCollection) => {
      const retenues = retenuesPour(filtre)
      return preferences.vue === 'groupee'
        ? retenues.length
        : aplatirEnElements(retenues, filtre, contexteAplatissement).length
    }
    return { tout: compter('tout'), possedes: compter('possedes'), envies: compter('envies') }
  }, [retenuesPour, preferences.vue, contexteAplatissement])

  const triees = useMemo(
    () => trierOeuvres(retenuesPour(preferences.filtre), preferences.tri, venues),
    [retenuesPour, preferences.filtre, preferences.tri, venues],
  )

  const envieDe = useMemo(
    () => (entity: EntityResponse) => ({
      possede: etats.get(entity.id)?.possede ?? false,
      tomesVoulus:
        entity.variants.filter((v) => tomesVoulus.has(v.id)).length + (oeuvresVoulues.has(entity.id) ? 1 : 0),
      prioritaire: preferences.filtre === 'envies',
    }),
    [etats, tomesVoulus, oeuvresVoulues, preferences.filtre],
  )

  const sections = useMemo(
    () => groupByEntityType(triees, entityTypes, progression, envieDe),
    [triees, entityTypes, progression, envieDe],
  )

  const tuilesElements = useMemo(
    () => aplatirEnElements(triees, preferences.filtre, contexteAplatissement),
    [triees, preferences.filtre, contexteAplatissement],
  )

  // Le tri par titre est déjà porté par l'ordre des œuvres ; par récence, ce
  // sont les ÉLÉMENTS qu'il faut réordonner - sans quoi ceux d'un même groupe
  // resteraient ensemble alors que la vue dégroupée les délie justement.
  const tuilesAffichees = useMemo(
    () =>
      preferences.tri === 'titre'
        ? tuilesElements
        : [...tuilesElements].sort((a, b) => b.depuis.localeCompare(a.depuis)),
    [tuilesElements, preferences.tri],
  )

  /**
   * Les rangées à afficher - MÊME forme, MÊME composant, dans les deux vues.
   *
   * Dégrouper ne change que ce qu'une rangée contient : des groupes ou les
   * éléments qu'ils contiennent. La présentation, elle, ne bouge pas - halo
   * teinté par univers, en-tête cliquable, défilement horizontal. Une seconde
   * mise en forme n'aurait fait que diverger de celle-ci.
   */
  const rangees = useMemo(
    () =>
      preferences.vue === 'groupee'
        ? sections
        : trierTypes([...typesParId.values()])
            .map((entityType) => ({
              entityType,
              tiles: tuilesAffichees.filter((tuile) => tuile.entityTypeId === entityType.id),
            }))
            .filter((rangee) => rangee.tiles.length > 0),
    [preferences.vue, sections, tuilesAffichees, typesParId],
  )

  // "Retrouver les jaquettes manquantes" - déplacé dans le menu "Plus
  // d'outils" (voir hubMenuOpen ci-dessous), l'action elle-même est
  // inchangée (voir backfillCovers.ts et son commentaire d'origine).
  //
  // Sur TOUTE la collection possédée, jamais sur la liste affichée : c'est un outil
  // de maintenance, pas une action sur ce qui est affiché. Depuis que la page
  // a des filtres, passer sur « Envies » lui aurait fait traiter trois séries
  // en annonçant le faire pour la collection - et son compteur aurait chuté
  // sans raison visible.
  const mangaType = entityTypes.find((t) => t.code === 'MANGA')
  const entitiesMissingCovers = useMemo(
    () =>
      mangaType
        ? allEntities.filter(
            (e) =>
              e.entityTypeId === mangaType.id &&
              (etats.get(e.id)?.possede ?? false) &&
              variantsMissingCover(e).length > 0,
          )
        : [],
    [allEntities, etats, mangaType],
  )
  const [backfill, setBackfill] = useState<
    { running: boolean; processed: number; total: number; found: number; fournisseurMuet: boolean } | null
  >(null)

  async function backfillMissingCovers() {
    if (!mangaType || entitiesMissingCovers.length === 0) return
    setHubMenuOpen(false)
    setBackfill({ running: true, processed: 0, total: entitiesMissingCovers.length, found: 0, fournisseurMuet: false })
    let found = 0
    let fournisseurMuet = false

    // Séquentiel, jamais Promise.all : chaque série coûte potentiellement un
    // vrai appel Google Books (cache manquant), un lot en parallèle risquerait
    // de vider le quota d'un coup plutôt que de s'arrêter proprement dessus.
    //
    // Le travail d'UNE série vit dans rattraperJaquettes, partagé avec la fiche
    // (voir backfillCovers) : ici il ne reste que le parcours et l'arrêt net
    // sur quota.
    for (let i = 0; i < entitiesMissingCovers.length; i++) {
      const resultat = await rattraperJaquettes(
        entitiesMissingCovers[i],
        mangaType.id,
        searchVolumes,
        (entityId, variantId, url) => mergeVariantAttributes(entityId, variantId, { coverImageUrl: url }),
      )
      found += resultat.trouvees
      if (resultat.fournisseurMuet) {
        fournisseurMuet = true
        break
      }
      setBackfill({ running: true, processed: i + 1, total: entitiesMissingCovers.length, found, fournisseurMuet })
    }

    setBackfill({ running: false, processed: entitiesMissingCovers.length, total: entitiesMissingCovers.length, found, fournisseurMuet })
    queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
  }

  const addedThisMonthCount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    return ownerships.filter((o) => o.status === 'OWNED' && o.acquiredAt.startsWith(currentMonth)).length
  }, [ownerships])

  /**
   * Vrai seulement quand TOUT ce dont un chiffre dépend est arrivé.
   *
   * Un décompte se calcule sur `data ?? []` : tant qu'une seule de ces
   * requêtes n'a pas répondu, il vaut zéro - et l'écran annonce alors une
   * collection vide à quelqu'un qui en a une (constaté en gelant l'API :
   * « 0 possédé ou voulu », filtres à 0/0/0, pendant que « Chargement... »
   * s'affichait juste en dessous). Le référentiel d'éditions en fait partie :
   * il décide de la complétude, donc du filtre Complètes/Incomplètes.
   */
  const isLoading = donnees.chargement
  const affiches = preferences.vue === 'plate' ? tuilesAffichees.length : triees.length

  const vide = messageVide(preferences.filtre, status !== 'ALL')

  return (
    <div className="flex flex-col gap-1">
      {/* Le sous-titre suit le filtre : sous « Envies », annoncer un nombre de
          titres possédés décrirait autre chose que ce qui est à l'écran. */}
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
            // Occupe la même ligne pour que rien ne saute quand le vrai
            // décompte arrive.
            'Chargement...'
          )
        }
      />

      <div className="mt-3">
        <BarreVues
          filtre={preferences.filtre}
          onFiltre={(filtre) => preferences.definir({ filtre })}
          vue={preferences.vue}
          onVue={(vue) => preferences.definir({ vue })}
          tri={preferences.tri}
          onTri={(tri) => preferences.definir({ tri })}
          comptes={!isLoading ? comptes : null}
        />
      </div>

      {/* Toolbar calme : une seule entrée Filtres (badge si actif), deux
          raccourcis visibles, le reste dans "Plus d'outils" (voir la
          maquette V1.2 - "la bibliothèque reste dominante, la toolbar reste
          calme"). */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          aria-expanded={filtersOpen}
          className={`flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors ${
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
        {/* « Valeur » menait à un écran intitulé « Statistiques », où il
            fallait ensuite trouver la section - trois mots pour une seule
            idée (UX-6). Le bouton emmène désormais À la section qui porte
            ce nom, exactement comme « Partager » déroule jusqu'au partage
            depuis Ma collection. */}
        <button
          type="button"
          onClick={() => navigate('/stats', { state: { focusValeur: true } })}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <BarChart3 size={15} />
          Valeur
        </button>
        <button
          type="button"
          onClick={() => navigate('/import-bgg')}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-3.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
        >
          <Download size={15} />
          Import
        </button>
        <button
          type="button"
          onClick={() => setHubMenuOpen(true)}
          title="Plus d'outils"
          // aria-label en plus du title : un bouton qui n'a qu'une icône tire
          // sinon son nom accessible du seul title, jamais annoncé au toucher.
          aria-label="Plus d'outils"
          aria-expanded={hubMenuOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-fieldBorder text-textDim transition-colors hover:bg-rowHover"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {backfill && !backfill.running && (
        <p className="mt-2 text-xs text-textDim">
          {backfill.found > 0
            ? `${backfill.found} jaquette${backfill.found > 1 ? 's' : ''} retrouvée${backfill.found > 1 ? 's' : ''}.`
            : 'Aucune jaquette retrouvée cette fois.'}
          {backfill.fournisseurMuet &&
            ` Le fournisseur n'a pas répondu - ${backfill.processed}/${backfill.total} séries traitées, réessaie plus tard pour les autres.`}
        </p>
      )}

      {donnees.erreurs.map((message) => (
        <ErrorBanner key={message} message={message} />
      ))}

      {isLoading && <p className="mt-6 text-textDim">Chargement...</p>}

      {!isLoading && donnees.listeChargee && affiches === 0 && (
        <div className={`mt-6 ${CLASSE_CARTE}`}>
          <p className="font-display text-base font-semibold text-textPrimary">{vide.titre}</p>
          <p className="mt-1 text-sm text-textDim">{vide.detail}</p>
          {status !== 'ALL' && (
            <button type="button" onClick={() => setStatus('ALL')} className="mt-3 w-fit text-sm font-semibold text-accentText">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {rangees.map(({ entityType, tiles }) => (
          <CategorySection key={entityType.id} entityType={entityType} tiles={tiles} />
        ))}
      </div>

      <CollectionFilters open={filtersOpen} onClose={() => setFiltersOpen(false)} status={status} onStatusChange={setStatus} />

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
            <button
              type="button"
              onClick={backfillMissingCovers}
              disabled={entitiesMissingCovers.length === 0 || backfill?.running}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover disabled:opacity-40"
            >
              <ImagePlus size={17} />
              Retrouver les jaquettes manquantes
              {entitiesMissingCovers.length > 0 && (
                <span className="ml-auto text-xs font-normal text-textDim">{entitiesMissingCovers.length}</span>
              )}
            </button>
            {/* "Types de collection" ici plutôt qu'uniquement sous Profil >
                Paramètres > Administration avancée : un type STRUCTURE cet
                écran (un rail par type), c'est donc ici qu'on se rend compte
                qu'il en manque un - signalé par l'utilisateur, "pas logique de
                passer par le profil". L'écran reste atteignable depuis
                Administration : ce n'est pas un déplacement mais un second
                chemin, plus court, posé là où le besoin naît. */}
            <button
              type="button"
              onClick={() => {
                setHubMenuOpen(false)
                navigate('/types')
              }}
              className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary transition-colors hover:bg-rowHover"
            >
              <Layers size={17} />
              Types de collection
              <span className="ml-auto text-xs font-normal text-textDim">{entityTypes.length}</span>
            </button>
            {/* Raccourci vers le partage commun, pas un second mécanisme :
                collection et envies se partagent par le MÊME lien, et ce
                raccourci mène donc aux mêmes réglages que depuis Profil ou
                Envies. Entrer par ici ne crée pas un jeton de plus. */}
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
