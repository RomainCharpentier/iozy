package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
 * Recherche par titre FRANÇAIS via Google Books - complète Jikan/MyAnimeList
 * qui ne connaissent que les titres japonais/anglais/romaji, jamais le titre
 * choisi par l'éditeur français, ET complète OpenLibraryTitleSearchProvider
 * qui n'indexe pas systématiquement les mêmes séries.
 * <p>
 * Cas réel qui motive ce provider (vérifié manuellement, voir historique de
 * la conversation) : "Forget Me Not" (Nao Emoto) est publié en France sous
 * le titre "Fragments d'elles" (Pika) - Open Library n'a AUCUNE fiche pour
 * cette série ni son auteur en français, alors que Google Books l'indexe
 * abondamment (tomes numérotés "Tome N" et "TNN"). D'où l'utilité des deux
 * sources en parallèle plutôt qu'une seule : ni l'une ni l'autre ne couvre
 * la totalité du catalogue manga francophone.
 * <p>
 * Tourne toujours en parallèle de Jikan/MyAnimeList/Open Library (jamais en
 * repli conditionnel) - un résultat non pertinent de ces sources est
 * indiscernable à l'avance d'une recherche par titre français.
 */
@Component
public class GoogleBooksTitleSearchProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksTitleSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=intitle:%s&langRestrict=fr&maxResults=20";

    // "Fragments d'elles Tome 2" / "Fragments d'elles T01" - Google Books
    // indexe chaque tome séparément ; \b devant le mot-clé + point optionnel
    // couvrent les deux formats ("Tome N" et l'abrégé "TNN" sans point,
    // vérifié manuellement) - même règle que GoogleBooksVolumeSearchProvider.
    private static final Pattern VOLUME_SUFFIX = Pattern.compile("(?i),?\\s*\\b(?:tome|vol\\.?|t\\.?)\\s*\\d+\\s*$");

    @Value("${google-books.api-key:}")
    private String apiKey;

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
            String url = SEARCH_URL.formatted(encodedQuery);
            if (apiKey != null && !apiKey.isBlank()) {
                url += "&key=" + apiKey;
            }
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Google Books a répondu {} pour la recherche par titre '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            log.warn("Échec de la recherche par titre Google Books pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();
        // Une série a souvent plusieurs tomes indexés séparément - une seule
        // suggestion par série une fois le numéro de tome retiré du titre.
        Set<String> seenTitles = new HashSet<>();

        for (JsonNode item : root.path("items")) {
            String id = item.path("id").asText(null);
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict est une préférence, pas une garantie - on revérifie
            }
            String rawTitle = volumeInfo.path("title").asText(null);
            if (id == null || rawTitle == null || rawTitle.isBlank()) {
                continue;
            }
            String title = VOLUME_SUFFIX.matcher(rawTitle).replaceFirst("").trim();
            if (title.isBlank() || !seenTitles.add(title.toLowerCase())) {
                continue;
            }

            Map<String, Object> attributes = new HashMap<>();
            JsonNode authors = volumeInfo.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                attributes.put("mangaka", authors.get(0).asText(null));
            }
            String publisher = volumeInfo.path("publisher").asText(null);
            if (publisher != null) {
                attributes.put("publisher", publisher);
            }

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            candidates.add(new MetadataCandidate("GOOGLE_BOOKS", id, title, imageUrl, attributes));
        }
        return candidates;
    }
}
