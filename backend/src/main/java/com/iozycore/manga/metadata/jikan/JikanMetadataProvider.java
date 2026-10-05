package com.iozycore.manga.metadata.jikan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Queries the public Jikan API (https://jikan.moe), which exposes the
 * data of MyAnimeList without needing an API key. Covers the
 * MANGA type only.
 * <p>
 * @Order(2): behind AniList (Batch 119), before GoogleBooksTitleSearchProvider in
 * MetadataSearchService.search - in case of an identical title returned by both
 * (e.g. "Naruto", unchanged in French), the Jikan/MAL result wins the
 * deduplication (richer attributes: titleEnglish/titleRomaji/mediaType/
 * startYear, useful for the title resolution and the volume search).
 */
@Component
@Order(2)
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
                log.warn("Jikan answered {} for the query '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // An outage of the third-party API must never make the quick add fail:
            // the user can always type the title manually.
            log.warn("Jikan call failed for '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : data) {
            String malId = item.path("mal_id").asText();
            String defaultTitle = item.path("title").asText();
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
            // Absent (null)/0 for a series still ongoing or whose final
            // count is not yet known to MAL - never stored in this case
            // (see Ma collection on the web side: "total inconnu" rather than a false 0).
            JsonNode volumesNode = item.path("volumes");
            if (volumesNode.isInt() && volumesNode.asInt() > 0) {
                attributes.put("totalVolumes", volumesNode.asInt());
            }
            // The same title can designate several distinct works at MAL/Jikan
            // (e.g. the manga "Naruto" and a pilot one-shot also titled "Naruto") -
            // type + year of first publication allow the user to
            // tell them apart in the list of suggestions (see QuickAddPage/QuickAddView).
            attributes.put("mediaType", item.path("type").asText(null));
            attributes.put("startYear", extractYear(item.path("published").path("from").asText(null)));

            // The MAL/Jikan "title" (defaultTitle) is often the romaji/Japanese
            // (e.g. "Shingeki no Kyojin"), not very readable to recognize
            // the work. None of our sources knows a real French title
            // (e.g. "L'Attaque des Titans") - failing that, the English title (when
            // provided and different) is used as the displayed/kept title, the
            // French publishers sometimes taking it as is. The original
            // romaji is kept as an attribute ("originalTitle") so as not to
            // lose the info, without polluting the main display.
            String titleEnglish = item.path("title_english").asText(null);
            String title = defaultTitle;
            if (titleEnglish != null && !titleEnglish.isBlank() && !titleEnglish.equalsIgnoreCase(defaultTitle)) {
                title = titleEnglish;
                attributes.put("originalTitle", defaultTitle);
            }
            // "titleRomaji"/"titleEnglish" (unconditional, unlike
            // "originalTitle" above which only serves the English fallback) -
            // allow the client to freely compose the display of the title
            // between French (best-effort, see /metadata/french-title),
            // English and romaji according to the user preference (see Réglages
            // > Titre des mangas), without depending on the choice already made above.
            attributes.put("titleRomaji", defaultTitle);
            if (titleEnglish != null && !titleEnglish.isBlank()) {
                attributes.put("titleEnglish", titleEnglish);
            }
            // Native Japanese title (e.g. "進撃の巨人") - always useful as a
            // visual landmark next to the kept title (see candidateDisplayTitle on the
            // web/iOS side), whether or not it already served above.
            String titleJapanese = item.path("title_japanese").asText(null);
            if (titleJapanese != null && !titleJapanese.isBlank()) {
                attributes.put("titleJapanese", titleJapanese);
            }

            candidates.add(new MetadataCandidate("JIKAN", malId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** Extracts "1999" from "1999-09-21T00:00:00+00:00" (the published.from format of Jikan). */
    private static String extractYear(String isoDateTime) {
        return isoDateTime != null && isoDateTime.length() >= 4 ? isoDateTime.substring(0, 4) : null;
    }
}
