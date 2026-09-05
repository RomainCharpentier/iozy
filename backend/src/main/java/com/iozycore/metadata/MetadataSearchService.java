package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.shared.TexteRecherche;
import com.iozycore.metadata.catalog.CatalogSearchService;
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
 * Point d'entrée du Bounded Context Metadata Enrichment (étape 8 de la
 * conception) pour ce qui vaut POUR TOUS LES UNIVERS : la recherche par
 * titre et la reconnaissance d'un code-barres. Sélectionne le(s)
 * MetadataProvider/BarcodeMetadataProvider compétent(s) pour l'EntityType
 * demandé et agrège leurs résultats - le reste de l'application n'a jamais
 * besoin de connaître Jikan/BGG/IGDB directement.
 *
 * <h2>Un paquet par univers (Lot 132)</h2>
 * Ce qui n'a de sens que pour un manga - le titre de l'édition française,
 * les tomes et leurs éditions, les séries liées - vit dans
 * {@code metadata.manga} ({@code FrenchTitleService}, {@code TomeSearchService},
 * {@code RelatedSeriesService}) avec ses sources (AniList, Jikan,
 * MyAnimeList, Google Books, BnF, Open Library). Les jeux vidéo (IGDB) sont
 * dans {@code metadata.videogame}, les jeux de société (BGG) dans
 * {@code metadata.boardgame}, et ce que la BASE IOZYCORE sait déjà - le
 * catalogue local - dans {@code metadata.catalog}. Ici ne restent que les
 * contrats communs et les deux gestes transverses.
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
    private final CatalogSearchService catalogue;

    // Clé = entityTypeId + requête/code-barres normalisés. La recherche par
    // titre cache le résultat BRUT des providers (avant filtrage "déjà
    // possédé") : ce filtrage dépend de l'état courant de la collection, qui
    // peut changer entre deux appels (un ajout vient d'avoir lieu) - il est
    // donc toujours recalculé à la volée, seul l'appel réseau est mis en cache.
    // TTL plus long pour les codes-barres : un ISBN scanné n'a par nature
    // qu'une seule réponse possible, contrairement à une recherche par titre
    // dont on veut quand même revoir les nouveautés de temps en temps.
    //
    // barcodeCache ne mémorise QUE les résultats trouvés (jamais une absence
    // de résultat) : un échec réseau transitoire (timeout, 429...) ne doit
    // pas condamner la même recherche à échouer pendant 24h - au pire, un
    // ISBN réellement introuvable relance un appel externe à chaque fois, ce
    // qui reste largement acceptable (juste plus rare que pour un vrai hit).
    // searchCache garde le comportement précédent (même un résultat vide est
    // mis en cache) : son TTL de 15 min est court, et une liste de résultats
    // vide y est une réponse légitime (aucun résultat pour cette recherche),
    // pas une distinction nette échec/succès comme pour un Optional.
    private final TtlCache<String, List<MetadataCandidate>> searchCache = new TtlCache<>(Duration.ofMinutes(15), 300);
    private final TtlCache<String, MetadataCandidate> barcodeCache = new TtlCache<>(Duration.ofHours(24), 500);

    /**
     * Les codes-barres cherchés sans succès.
     *
     * <p>Un cache <b>séparé</b>, et à durée bien plus courte, parce qu'il ne
     * mémorise pas la même nature de chose : « ce code désigne Naruto tome 9 »
     * est une connaissance durable, « aucune base ne connaît ce code » est un
     * état du monde qui change dès qu'un contributeur l'ajoute. Trente minutes
     * couvrent la session pendant laquelle on relance une analyse sur les mêmes
     * photos, sans rendre le catalogue aveugle à ses propres progrès.
     *
     * <p>Plus d'entrées que le cache des succès : sur une photo de pile, les
     * EAN introuvables sont souvent les plus nombreux. Chacune ne pèse qu'une
     * clé et un booléen.
     */
    private final TtlCache<String, Boolean> barcodeMissCache = new TtlCache<>(Duration.ofMinutes(30), 1000);

    public MetadataSearchService(List<MetadataProvider> providers,
                                  List<BarcodeMetadataProvider> barcodeProviders,
                                  CatalogSearchService catalogue) {
        this.providers = providers;
        this.barcodeProviders = barcodeProviders;
        this.catalogue = catalogue;
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
     * <p>
     * Voir {@link #search(EntityType, String, boolean)} pour le seul appelant
     * qui a besoin de l'inverse.
     */
    public List<MetadataCandidate> search(EntityType entityType, String query) {
        return search(entityType, query, false);
    }

    /**
     * Même recherche, avec la possibilité de GARDER ce qu'on possède déjà.
     * <p>
     * Le filtre ci-dessus sert un écran précis : celui qui prépare un ajout.
     * Recharger les informations d'une fiche existante pose la question
     * inverse - « que sait la source sur CETTE œuvre-là ? » - et le filtre y
     * garantissait zéro correspondance, par construction. Constaté sur Naruto :
     * la recherche rendait huit dérivés (Boruto, les light novels…) et jamais
     * la série elle-même.
     * <p>
     * Le cache n'est pas concerné : il mémorise les résultats BRUTS des
     * fournisseurs, le filtre s'applique après.
     */
    public List<MetadataCandidate> search(EntityType entityType, String query, boolean includeOwned) {
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

        if (includeOwned) {
            return rawResults;
        }

        Set<String> alreadyOwnedTitles = catalogue.titresConnus(entityType.id());

        return rawResults.stream()
                .filter(candidate -> !alreadyOwnedTitles.contains(normalize(candidate.title())))
                .collect(Collectors.toList());
    }

    /**
     * La cle de comparaison des titres - accents et ponctuation plies, comme
     * la recherche locale et Decouvrir (voir TexteRecherche). Sert aussi de
     * cle de cache : deux frappes qui designent la meme oeuvre partagent la
     * meme reponse des fournisseurs.
     */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
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

    /**
     * Retourne le premier résultat trouvé par un provider compétent pour ce
     * code-barres.
     *
     * <h2>Les échecs aussi sont mémorisés — et pas pour la même durée</h2>
     * Seuls les succès l'étaient. Un EAN qu'aucune base n'indexe était donc
     * réinterrogé <b>à chaque fois</b>, au prix fort : de 1,4 à 5,5 secondes
     * mesurées par appel. La lecture des codes-barres sur les photos d'un lot
     * a rendu ce trou coûteux — une pile de mangas peut porter une douzaine
     * d'EAN dont plusieurs absents des bases, et l'utilisateur qui relance son
     * analyse repayait l'attente entière.
     *
     * <p>Les deux durées diffèrent, et c'est le fond du sujet : <b>un succès
     * est une connaissance, un échec est un état du monde</b>. « Ce code
     * désigne Naruto tome 9 » reste vrai indéfiniment ({@code 24 h} ici, par
     * prudence) ; « aucune base ne connaît ce code » peut cesser d'être vrai
     * dès qu'un contributeur l'ajoute. Mémoriser un échec aussi longtemps
     * qu'un succès rendrait le catalogue aveugle à ses propres progrès.
     */
    public Optional<MetadataCandidate> lookupByBarcode(EntityType entityType, String barcode) {
        return lookupDetailedByBarcode(entityType, barcode).candidateIfAny();
    }

    /**
     * Comme {@link #lookupByBarcode}, mais en disant AUSSI si l'absence a été
     * constatée ou seulement subie.
     * <p>
     * Le service faisait déjà la différence pour son cache - une panne n'y est
     * jamais mémorisée - mais la gardait pour lui : l'appelant ne recevait qu'un
     * {@code Optional} vide, et l'écran ne pouvait que rester vague. Or c'est
     * précisément la distinction qui intéresse celui qui scanne : « ce code
     * n'existe pas » appelle une saisie par titre, « une base n'a pas répondu »
     * appelle un simple ré-essai.
     */
    public BarcodeLookup lookupDetailedByBarcode(EntityType entityType, String barcode) {
        String cacheKey = entityType.id() + "|" + normalize(barcode);
        Optional<MetadataCandidate> cached = barcodeCache.get(cacheKey);
        if (cached.isPresent()) {
            return BarcodeLookup.found(cached.get());
        }
        if (barcodeMissCache.get(cacheKey).isPresent()) {
            // Déjà cherché récemment, et introuvable. Inutile de refaire
            // l'aller-retour pour obtenir la même réponse.
            return BarcodeLookup.absent();
        }

        // Tous les providers compétents sont interrogés jusqu'au premier
        // résultat - et l'on retient au passage si chacun a bien RÉPONDU.
        Optional<MetadataCandidate> result = Optional.empty();
        boolean tousOntRepondu = true;
        for (BarcodeMetadataProvider provider : barcodeProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            BarcodeLookup lookup = provider.lookupDetailed(barcode);
            if (lookup.candidate() != null) {
                result = Optional.of(lookup.candidate());
                break;
            }
            tousOntRepondu &= lookup.conclusive();
        }

        if (result.isPresent()) {
            barcodeCache.put(cacheKey, result.get());
            return BarcodeLookup.found(result.get());
        } else if (tousOntRepondu) {
            // Absence CONSTATÉE : toutes les bases compétentes ont répondu, et
            // aucune ne connaît ce code. La reposer dans la demi-heure donnerait
            // la même chose - autant l'éviter, chaque appel coûte des secondes.
            //
            // Une panne, elle, n'est jamais mémorisée : sinon le ré-essai de
            // l'utilisateur rendrait l'échec en cache au lieu de retenter, et un
            // incident d'une seconde se figerait pour trente minutes.
            barcodeMissCache.put(cacheKey, Boolean.TRUE);
        }
        return tousOntRepondu ? BarcodeLookup.absent() : BarcodeLookup.unavailable();
    }
}
