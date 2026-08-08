package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Point d'entrée unique du Bounded Context Metadata Enrichment (étape 8
 * de la conception). Sélectionne le(s) MetadataProvider/BarcodeMetadataProvider
 * compétent(s) pour l'EntityType demandé et agrège leurs résultats - le
 * reste de l'application n'a jamais besoin de connaître Jikan/BGG/Open
 * Library directement.
 * <p>
 * Les appels aux providers eux-mêmes (recherche par titre et lookup par
 * code-barres) sont mis en cache (voir {@link TtlCache}) pour limiter les
 * appels aux API externes - une même recherche retapée, un débounce qui
 * laisse quand même passer plusieurs requêtes proches, ou plusieurs clients
 * (iOS + Web) interrogeant la même chose ne déclenchent qu'un seul appel
 * réel par fenêtre de temps.
 */
@Service
public class MetadataSearchService {

    private final List<MetadataProvider> providers;
    private final List<BarcodeMetadataProvider> barcodeProviders;
    private final EntityRepository entityRepository;
    private final List<FrenchTitleProvider> frenchTitleProviders;
    private final List<VolumeSearchProvider> volumeSearchProviders;
    private final VolumeSearchCacheRepository volumeSearchCacheRepository;

    // Clé = entityTypeId + requête/code-barres normalisés. La recherche par
    // titre cache le résultat BRUT des providers (avant filtrage "déjà
    // possédé") : ce filtrage dépend de l'état courant de la collection, qui
    // peut changer entre deux appels (un ajout vient d'avoir lieu) - il est
    // donc toujours recalculé à la volée, seul l'appel réseau est mis en cache.
    // TTL plus long pour les codes-barres : un ISBN scanné n'a par nature
    // qu'une seule réponse possible, contrairement à une recherche par titre
    // dont on veut quand même revoir les nouveautés de temps en temps. Même
    // logique pour le titre français (recherché une seule fois par titre,
    // pas à chaque re-sélection du même candidat).
    //
    // barcodeCache/frenchTitleCache ne mémorisent QUE les résultats trouvés
    // (jamais une absence de résultat) : un échec réseau transitoire (timeout,
    // 429...) ne doit pas condamner la même recherche à échouer pendant 24h -
    // au pire, un ISBN/titre réellement introuvable relance un appel externe
    // à chaque fois, ce qui reste largement acceptable (juste plus rare que
    // pour un vrai hit). searchCache garde le comportement précédent (même
    // un résultat vide est mis en cache) : son TTL de 15 min est court, et
    // une liste de résultats vide y est une réponse légitime (aucun résultat
    // pour cette recherche), pas une distinction nette échec/succès comme
    // pour un Optional.
    private final TtlCache<String, List<MetadataCandidate>> searchCache = new TtlCache<>(Duration.ofMinutes(15), 300);
    private final TtlCache<String, MetadataCandidate> barcodeCache = new TtlCache<>(Duration.ofHours(24), 500);
    private final TtlCache<String, String> frenchTitleCache = new TtlCache<>(Duration.ofHours(24), 500);
    // Cache mémoire "chaud" (évite un aller-retour base pour des recherches
    // rapprochées dans la même fenêtre) - le stockage durable, lui, est
    // volumeSearchCacheRepository (survit aux redémarrages, voir plus bas).
    private final TtlCache<String, List<VolumeCandidate>> volumeSearchCache = new TtlCache<>(Duration.ofHours(24), 300);

    public MetadataSearchService(List<MetadataProvider> providers,
                                  List<BarcodeMetadataProvider> barcodeProviders,
                                  EntityRepository entityRepository,
                                  List<FrenchTitleProvider> frenchTitleProviders,
                                  List<VolumeSearchProvider> volumeSearchProviders,
                                  VolumeSearchCacheRepository volumeSearchCacheRepository) {
        this.providers = providers;
        this.barcodeProviders = barcodeProviders;
        this.entityRepository = entityRepository;
        this.frenchTitleProviders = frenchTitleProviders;
        this.volumeSearchProviders = volumeSearchProviders;
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
    }

    /**
     * Exclut les candidats dont le titre correspond déjà à une Entity de ce
     * type dans la collection (comparaison insensible à la casse, même
     * règle que la déduplication de QuickAddService) : le but de cette
     * recherche est de préparer l'ajout d'un nouvel élément, pas de
     * réafficher ce qu'on possède déjà parmi les suggestions.
     * <p>
     * Ne s'applique volontairement qu'à la recherche par titre - le lookup
     * par code-barres ({@link #lookupByBarcode}) doit au contraire pouvoir
     * retrouver un titre déjà possédé, pour y rattacher un second exemplaire
     * scanné (voir QuickAddService.addNewEntityWithOwnership).
     */
    public List<MetadataCandidate> search(EntityType entityType, String query) {
        String cacheKey = entityType.id() + "|" + normalize(query);
        List<MetadataCandidate> rawResults = searchCache.get(cacheKey).orElseGet(() -> {
            List<MetadataCandidate> fetched = providers.stream()
                    .filter(provider -> provider.supports(entityType))
                    .flatMap(provider -> provider.search(query).stream())
                    .collect(Collectors.toList());
            List<MetadataCandidate> deduped = dedupeByTitle(fetched);
            searchCache.put(cacheKey, deduped);
            return deduped;
        });

        Set<String> alreadyOwnedTitles = entityRepository.findAllByType(entityType.id()).stream()
                .map(entity -> normalize(entity.title()))
                .collect(Collectors.toSet());

        return rawResults.stream()
                .filter(candidate -> !alreadyOwnedTitles.contains(normalize(candidate.title())))
                .collect(Collectors.toList());
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase();
    }

    /**
     * Plusieurs fournisseurs peuvent remonter le même titre - ex: "Naruto",
     * inchangé en français, ressort à la fois de Jikan/MyAnimeList (titre
     * original) et de GoogleBooksTitleSearchProvider (recherche par titre
     * français) - deux entrées visuellement identiques dans la liste de
     * suggestions, sans intérêt pour l'utilisateur. Garde la première
     * occurrence rencontrée par titre normalisé (insensible à la casse) :
     * l'ordre des providers (voir leurs @Order respectifs) fait gagner
     * Jikan/MyAnimeList sur Google Books/Open Library quand les deux
     * trouvent le même titre - attributs plus riches (titleEnglish/
     * titleRomaji/mediaType/startYear), utiles à la résolution du titre
     * français et à la recherche de tomes qui suivent la sélection.
     */
    private static List<MetadataCandidate> dedupeByTitle(List<MetadataCandidate> candidates) {
        Map<String, MetadataCandidate> byTitle = new LinkedHashMap<>();
        for (MetadataCandidate candidate : candidates) {
            byTitle.putIfAbsent(normalize(candidate.title()), candidate);
        }
        return new ArrayList<>(byTitle.values());
    }

    /** Retourne le premier résultat trouvé par un provider compétent pour ce code-barres. */
    public Optional<MetadataCandidate> lookupByBarcode(EntityType entityType, String barcode) {
        String cacheKey = entityType.id() + "|" + normalize(barcode);
        Optional<MetadataCandidate> cached = barcodeCache.get(cacheKey);
        if (cached.isPresent()) {
            return cached;
        }

        Optional<MetadataCandidate> result = barcodeProviders.stream()
                .filter(provider -> provider.supports(entityType))
                .map(provider -> provider.lookup(barcode))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst();
        result.ifPresent(candidate -> barcodeCache.put(cacheKey, candidate));
        return result;
    }

    /**
     * Recherche best-effort d'un titre d'édition française (voir
     * OpenLibraryFrenchTitleProvider, essayé en premier, puis
     * GoogleBooksFrenchTitleProvider en repli) - déclenchée uniquement quand
     * l'utilisateur choisit une suggestion (jamais pour toute une liste de
     * résultats de recherche), pour limiter les appels externes. Vide si le
     * type n'est pas couvert ou si aucun fournisseur n'a rien trouvé.
     *
     * @param author mangaka, si connu (voir MetadataCandidate.attributes) -
     *               améliore nettement la précision (voir OpenLibraryFrenchTitleProvider).
     */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author) {
        String cacheKey = entityType.id() + "|" + normalize(query) + "|" + normalize(author == null ? "" : author);
        Optional<String> cached = frenchTitleCache.get(cacheKey);
        if (cached.isPresent()) {
            return cached;
        }

        Optional<String> result = frenchTitleProviders.stream()
                .filter(provider -> provider.supports(entityType))
                .map(provider -> provider.findFrenchTitle(query, author))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .findFirst();
        result.ifPresent(title -> frenchTitleCache.put(cacheKey, title));
        return result;
    }

    /**
     * Recherche best-effort des tomes réels (avec jaquette) des éditions
     * françaises d'une série (voir GoogleBooksVolumeSearchProvider, 8
     * requêtes en parallèle par appel - coûteux) - déclenchée après
     * sélection d'une suggestion, pour proposer une sélection visuelle des
     * tomes possédés plutôt qu'une saisie manuelle du numéro de tome. Vide
     * si le type n'est pas couvert ou si rien n'a été trouvé (l'appelant
     * garde alors le parcours de saisie manuelle).
     */
    public List<VolumeCandidate> searchVolumes(EntityType entityType, String seriesTitle, String author) {
        return searchVolumes(entityType, seriesTitle, author, false);
    }

    /**
     * @param forceRefresh ignore le cache mémoire ET le stockage durable,
     *                      relance systématiquement les 8 requêtes Google
     *                      Books et écrase le résultat stocké - c'est le
     *                      point d'entrée du bouton "Actualiser" côté
     *                      client. Sans lui, un résultat une fois stocké
     *                      n'est plus jamais rappelé automatiquement : les
     *                      éditions/tomes d'une série changent rarement, pas
     *                      la peine de re-payer 8 appels externes à chaque
     *                      sélection du même candidat.
     */
    public List<VolumeCandidate> searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;

        if (!forceRefresh) {
            Optional<List<VolumeCandidate>> inMemory = volumeSearchCache.get(cacheKey);
            if (inMemory.isPresent()) {
                return inMemory.get();
            }

            Optional<List<VolumeCandidate>> stored = volumeSearchCacheRepository.find(entityType.id(), normalizedTitle, normalizedAuthor);
            if (stored.isPresent()) {
                volumeSearchCache.put(cacheKey, stored.get()); // réchauffe le cache mémoire pour les appels suivants
                return stored.get();
            }
        }

        List<VolumeCandidate> result = volumeSearchProviders.stream()
                .filter(provider -> provider.supports(entityType))
                .flatMap(provider -> provider.searchVolumes(seriesTitle, author).stream())
                .collect(Collectors.toList());
        if (!result.isEmpty()) {
            volumeSearchCache.put(cacheKey, result);
            volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, result);
        }
        return result;
    }
}
