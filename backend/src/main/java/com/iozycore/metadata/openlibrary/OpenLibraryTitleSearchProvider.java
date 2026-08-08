package com.iozycore.metadata.openlibrary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Recherche par titre FRANÇAIS via Open Library (pas de clé, pas de quota
 * agressif) - complète Jikan/MyAnimeList qui ne connaissent que les titres
 * japonais/anglais/romaji, jamais le titre choisi par l'éditeur français.
 * <p>
 * Cas réel qui motive ce provider (vérifié manuellement, voir historique de
 * la conversation) : "Forget Me Not" (Nao Emoto) est publié en France sous
 * le titre "Fragments d'elles" (Pika) - taper "Fragments d'elles" dans la
 * recherche ne remontait jusqu'ici QUE des résultats Jikan/MyAnimeList sans
 * aucun rapport (ces sources ne connaissent que "Forget Me Not"). Ce
 * provider tourne toujours en parallèle de Jikan/MyAnimeList (jamais en
 * repli conditionnel : une recherche par titre original qui ne matche rien
 * ici est un résultat vide, indiscernable à l'avance d'une recherche par
 * titre français mal formulée).
 * <p>
 * Un candidat choisi ici a déjà son titre définitif (l'édition française
 * exacte) - contrairement à un candidat Jikan/MyAnimeList, jamais retraduit
 * par la suite (voir QuickAddPage.pickCandidate côté web, même règle que
 * pour un scan ISBN).
 */
@Component
public class OpenLibraryTitleSearchProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenLibraryTitleSearchProvider.class);
    private static final String SEARCH_URL = "https://openlibrary.org/search.json?q=%s&language=fre&limit=8";

    // "Fragments d'elles, Vol. 3" - Open Library indexe chaque tome
    // séparément avec son numéro dans le titre ; on ne veut que le titre de
    // la série pour peupler la liste de suggestions (une seule fiche par
    // série, jamais une par tome - voir dédoublonnage dans parse()). Même
    // paire de motifs que OpenLibraryFrenchTitleProvider, dupliquée ici
    // (fournisseurs volontairement indépendants).
    private static final Pattern VOLUME_KEYWORD_SUFFIX = Pattern.compile("(?i),?\\s*(vol\\.?|tome|t\\.?)\\s*\\d+\\s*$");
    private static final Pattern TRAILING_NUMBER_SUFFIX = Pattern.compile("\\s+\\d+\\s*$");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Open Library a répondu {} pour la recherche par titre '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de la recherche par titre Open Library pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();
        // Une série a souvent plusieurs tomes indexés séparément par Open
        // Library - une seule suggestion par série une fois le numéro de
        // tome retiré du titre, jamais une par tome.
        Set<String> seenTitles = new HashSet<>();

        for (JsonNode doc : root.path("docs")) {
            String key = doc.path("key").asText(null);
            String rawTitle = doc.path("title").asText(null);
            if (key == null || rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            String title = cleanVolumeSuffix(rawTitle);
            if (title.isBlank() || !seenTitles.add(title.toLowerCase())) {
                continue;
            }

            Map<String, Object> attributes = new HashMap<>();
            JsonNode authorNames = doc.path("author_name");
            if (authorNames.isArray() && !authorNames.isEmpty()) {
                attributes.put("mangaka", authorNames.get(0).asText(null));
            }
            JsonNode publishers = doc.path("publisher");
            if (publishers.isArray() && !publishers.isEmpty()) {
                attributes.put("publisher", publishers.get(0).asText(null));
            }

            String imageUrl = doc.has("cover_i")
                    ? "https://covers.openlibrary.org/b/id/" + doc.path("cover_i").asText() + "-M.jpg"
                    : null;

            candidates.add(new MetadataCandidate("OPEN_LIBRARY", key, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** "Fragments d'elles Vol. 3" -> "Fragments d'elles", "Naruto 58" -> "Naruto".
     * Miroir de OpenLibraryFrenchTitleProvider.cleanVolumeSuffix. */
    private static String cleanVolumeSuffix(String rawTitle) {
        String withoutKeywordSuffix = VOLUME_KEYWORD_SUFFIX.matcher(rawTitle).replaceFirst("");
        return TRAILING_NUMBER_SUFFIX.matcher(withoutKeywordSuffix).replaceFirst("").trim();
    }
}
