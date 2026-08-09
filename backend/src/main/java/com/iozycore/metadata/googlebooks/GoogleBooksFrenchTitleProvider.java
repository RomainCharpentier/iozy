package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.FrenchTitleProvider;
import com.iozycore.metadata.QuotaExceededException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Recherche best-effort d'un titre d'édition française via Google Books,
 * déclenchée uniquement quand l'utilisateur choisit une suggestion Jikan/
 * MyAnimeList (jamais pour toute une liste de résultats - voir
 * MetadataSearchService.findFrenchTitle, mis en cache) : ni Jikan ni
 * MyAnimeList ne connaissent de titre français, contrairement à Google
 * Books qui indexe des éditions par langue.
 * <p>
 * Repli (@Order(2)) derrière {@link com.iozycore.metadata.openlibrary.OpenLibraryFrenchTitleProvider} :
 * le quota anonyme Google Books est fréquemment épuisé (429) en pratique -
 * Open Library (pas de clé, pas de quota agressif) est essayé en premier.
 * <p>
 * Recherche volontairement en texte libre ({@code q=}), pas en
 * {@code intitle:} : le terme cherché (romaji/anglais) n'apparaît par
 * définition PAS dans un titre français traduit (ex: chercher "Attack on
 * Titan" en intitle ne trouvera jamais "L'Attaque des Titans") - une
 * recherche libre a une chance de matcher via les métadonnées/description
 * d'une fiche bien cataloguée. Reste un best-effort : pas de garantie de
 * résultat, et un faux positif thématiquement proche n'est pas à exclure.
 * <p>
 * Repli supplémentaire sur l'auteur seul (vérifié manuellement, voir
 * historique de la conversation) : "Forget Me Not" (Nao Emoto) est publié
 * en France sous le titre "Fragments d'elles" - AUCUN mot commun avec le
 * titre original, la combinaison titre+auteur ne matche donc jamais rien.
 * Chercher l'auteur seul remonte "Fragments d'elles" en tout premier
 * résultat français - même principe que le dernier recours déjà en place
 * côté OpenLibraryFrenchTitleProvider.
 */
@Component
@Order(2)
public class GoogleBooksFrenchTitleProvider implements FrenchTitleProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksFrenchTitleProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=5";

    // "Fragments d'elles T04" - Google Books indexe le tome scanné, pas la
    // série : on ne veut que le titre de la série pour pré-remplir l'ajout.
    // Même principe que OpenLibraryFrenchTitleProvider.cleanVolumeSuffix,
    // dupliqué ici (fournisseurs volontairement indépendants) plutôt que
    // partagé, comme le reste des regex de ce module.
    private static final Pattern VOLUME_SUFFIX = Pattern.compile("(?i),?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\s*$");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksFrenchTitleProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructeur utilisé par les tests unitaires : parse()/search() sur un
     * corps déjà en mémoire n'ont jamais besoin d'un vrai appel réseau. */
    GoogleBooksFrenchTitleProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<String> findFrenchTitle(String query, String author, List<String> excludedTitleFragments) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }
        String combinedQuery = (author == null || author.isBlank()) ? query : author + " " + query;

        Optional<String> result = search(combinedQuery, excludedTitleFragments);
        if (result.isPresent()) {
            return result;
        }

        // Dernier recours : auteur seul, sans le titre original qui peut ne
        // partager aucun mot avec l'édition française (voir javadoc). Accepte
        // le risque de retomber sur une autre œuvre du même auteur si rien
        // d'autre n'a matché - même limite déjà documentée côté Open Library.
        //
        // inauthor: structuré, jamais en texte libre ici : vérifié
        // manuellement qu'une recherche libre `q=Nao Emoto` remonte "New
        // Authentic Magical Girl" (Nisioisin, aucun rapport) - Google matche
        // les deux mots séparément n'importe où dans la fiche, alors que
        // inauthor: exige un vrai match sur le champ auteur.
        if (author == null || author.isBlank()) {
            return Optional.empty();
        }
        return search("inauthor:\"" + author + "\"", excludedTitleFragments);
    }

    private Optional<String> search(String rawQuery, List<String> excludedTitleFragments) {
        try {
            String encodedQuery = URLEncoder.encode(rawQuery, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            if (body == null) {
                return Optional.empty();
            }
            return parse(body, excludedTitleFragments);
        } catch (QuotaExceededException e) {
            // Open Library est déjà essayé en premier (voir @Order) - pas
            // d'alarme utilisateur nécessaire pour ce repli.
            log.warn("Quota Google Books dépassé pour la recherche de titre français '{}'", rawQuery);
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Échec de la recherche de titre français Google Books pour '{}' : {}", rawQuery, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<String> parse(String body) throws Exception {
        return parse(body, List.of());
    }

    /** Variante avec exclusion de suites/spin-offs connus (voir RelatedSeriesService) -
     * séparée de {@link #parse(String)} pour ne pas casser les tests existants
     * qui n'en ont pas besoin. */
    Optional<String> parse(String body, List<String> excludedTitleFragments) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        if (root.path("totalItems").asInt(0) == 0) {
            return Optional.empty();
        }

        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            // langRestrict est une préférence côté Google, pas une garantie absolue -
            // on revérifie la langue déclarée du volume avant de faire confiance au titre.
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue;
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank()) {
                continue;
            }
            // Même biais de popularité que côté Open Library (voir
            // OpenLibraryFrenchTitleProvider, "Dragon Ball Super nº 18" pour
            // une recherche "Dragon Ball") - possible aussi ici en repli.
            if (matchesKnownRelatedSeries(title, excludedTitleFragments)) {
                continue;
            }
            String cleaned = VOLUME_SUFFIX.matcher(title).replaceFirst("").trim();
            if (!cleaned.isBlank()) {
                return Optional.of(cleaned);
            }
        }
        return Optional.empty();
    }

    /** Comparaison par mot entier (?U pour reconnaître les lettres accentuées
     * comme des caractères de mot) - un simple contains() ferait matcher un
     * fragment générique/court à l'intérieur d'un autre mot sans rapport. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }
}
