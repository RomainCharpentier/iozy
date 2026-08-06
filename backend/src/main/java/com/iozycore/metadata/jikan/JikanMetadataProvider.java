package com.iozycore.metadata.jikan;

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
import java.util.List;
import java.util.Map;

/**
 * Interroge l'API publique Jikan (https://jikan.moe), qui expose les
 * données de MyAnimeList sans nécessiter de clé d'API. Couvre le type
 * MANGA uniquement.
 */
@Component
public class JikanMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(JikanMetadataProvider.class);
    private static final String SEARCH_URL = "https://api.jikan.moe/v4/manga?q=%s&limit=10";

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
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Jikan a répondu {} pour la requête '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // Une panne de l'API tierce ne doit jamais faire échouer l'ajout rapide :
            // l'utilisateur pourra toujours saisir le titre manuellement.
            log.warn("Échec de l'appel à Jikan pour '{}' : {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : data) {
            String malId = item.path("mal_id").asText();
            String title = item.path("title").asText();
            String imageUrl = item.path("images").path("jpg").path("image_url").asText(null);

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("malId", malId);
            JsonNode authors = item.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                attributes.put("mangaka", authors.get(0).path("name").asText(null));
            }
            JsonNode serializations = item.path("serializations");
            if (serializations.isArray() && !serializations.isEmpty()) {
                attributes.put("publisher", serializations.get(0).path("name").asText(null));
            }
            attributes.put("seriesStatus", item.path("status").asText(null));

            candidates.add(new MetadataCandidate("JIKAN", malId, title, imageUrl, attributes));
        }
        return candidates;
    }
}
