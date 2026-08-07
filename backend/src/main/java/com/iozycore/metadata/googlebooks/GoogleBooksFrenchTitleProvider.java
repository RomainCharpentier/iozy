package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.FrenchTitleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

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
 */
@Component
@Order(2)
public class GoogleBooksFrenchTitleProvider implements FrenchTitleProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksFrenchTitleProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=5";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Optional<String> findFrenchTitle(String query, String author) {
        if (query == null || query.isBlank()) {
            return Optional.empty();
        }
        String combinedQuery = (author == null || author.isBlank()) ? query : author + " " + query;

        try {
            String encodedQuery = URLEncoder.encode(combinedQuery, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Google Books a répondu {} pour la recherche de titre français '{}'",
                        response.statusCode(), combinedQuery);
                return Optional.empty();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de la recherche de titre français Google Books pour '{}' : {}", combinedQuery, e.getMessage());
            return Optional.empty();
        }
    }

    Optional<String> parse(String body) throws Exception {
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
            if (title != null && !title.isBlank()) {
                return Optional.of(title);
            }
        }
        return Optional.empty();
    }
}
