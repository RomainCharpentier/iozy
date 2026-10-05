package com.iozycore.manga.metadata.myanimelist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
 * Queries the official MyAnimeList v2 API (authenticated by a simple
 * application Client ID, without a full OAuth flow - see README.md, section
 * "Obtenir et configurer un Client ID MyAnimeList") in addition to Jikan
 * for the MANGA type.
 * <p>
 * Unlike Jikan (third-party wrapper that must itself connect to
 * MyAnimeList at each request, and that MyAnimeList blocks/throttles from time to time -
 * frequent 504 outages "failed to connect to MyAnimeList"),
 * this API is served directly by MyAnimeList: it stays available
 * independently of the state of Jikan. The two providers are aggregated by
 * MetadataSearchService (never one instead of the other) - if Jikan is
 * down, its results are simply absent and these take over.
 * <p>
 * No degraded mode without a configured Client ID (like IGDB): supports()
 * returns false as long as {@code mal.client-id} is empty, which amounts to
 * the absence of this provider (Jikan stays alone, behavior unchanged).
 * <p>
 * @Order(3): behind AniList and Jikan (Batch 119), before GoogleBooksTitleSearchProvider in
 * MetadataSearchService.search - same reason as on JikanMetadataProvider.
 */
@Component
@Order(3)
public class MyAnimeListMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(MyAnimeListMetadataProvider.class);
    private static final String SEARCH_URL = "https://api.myanimelist.net/v2/manga?q=%s&limit=10"
            + "&fields=main_picture,media_type,start_date,alternative_titles,"
            + "authors%%7Bfirst_name,last_name%%7D,serialization%%7Bname%%7D,status,num_volumes";

    @Value("${mal.client-id:}")
    private String clientId;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code()) && clientId != null && !clientId.isBlank();
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(SEARCH_URL.formatted(encodedQuery)))
                    .timeout(Duration.ofSeconds(8))
                    .header("X-MAL-CLIENT-ID", clientId)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("MyAnimeList answered {} for the query '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // An outage of the third-party API must never make the quick add fail:
            // Jikan (if it is up) or the manual entry take over.
            log.warn("MyAnimeList call failed for '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        JsonNode data = root.path("data");
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : data) {
            JsonNode node = item.path("node");
            String malId = node.path("id").asText();
            String defaultTitle = node.path("title").asText();
            JsonNode mainPicture = node.path("main_picture");
            String imageUrl = mainPicture.path("large").asText(null);
            if (imageUrl == null) {
                imageUrl = mainPicture.path("medium").asText(null);
            }

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("malId", malId);
            JsonNode authors = node.path("authors");
            if (authors.isArray() && !authors.isEmpty()) {
                JsonNode authorNode = authors.get(0).path("node");
                String firstName = authorNode.path("first_name").asText("");
                String lastName = authorNode.path("last_name").asText("");
                String fullName = (firstName + " " + lastName).trim();
                if (!fullName.isEmpty()) {
                    attributes.put("mangaka", fullName);
                }
            }
            JsonNode serialization = node.path("serialization");
            if (serialization.isArray() && !serialization.isEmpty()) {
                attributes.put("publisher", serialization.get(0).path("node").path("name").asText(null));
            }
            attributes.put("seriesStatus", node.path("status").asText(null));
            // 0 at MAL v2 means "not yet determined" (ongoing series or
            // final count unknown) - never stored in this case (see Ma
            // collection on the web side: "total inconnu" rather than a false 0).
            int numVolumes = node.path("num_volumes").asInt(0);
            if (numVolumes > 0) {
                attributes.put("totalVolumes", numVolumes);
            }
            // The same title can designate several distinct works at MAL
            // (e.g. the manga "Naruto" and a pilot one-shot also titled
            // "Naruto") - type + year of first publication allow
            // the user to tell them apart in the list of suggestions
            // (see QuickAddPage/QuickAddView).
            attributes.put("mediaType", node.path("media_type").asText(null));
            attributes.put("startYear", extractYear(node.path("start_date").asText(null)));
            // The MAL "title" (defaultTitle) is often the romaji/Japanese (e.g.
            // "Shingeki no Kyojin"), not very readable to recognize the work.
            // None of our sources knows a real French title (e.g.
            // "L'Attaque des Titans") - failing that, the English title (when
            // provided and different) is used as the displayed/kept title, the
            // French publishers sometimes taking it as is. The original
            // romaji is kept as an attribute ("originalTitle") so as not to
            // lose the info, without polluting the main display.
            String titleEnglish = node.path("alternative_titles").path("en").asText(null);
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
            // Native Japanese title (e.g. "進撃の巨人") - already present in
            // alternative_titles (requested for "en" above), no additional
            // call. Always useful as a visual landmark next to the kept
            // title (see candidateDisplayTitle on the web/iOS side).
            String titleJapanese = node.path("alternative_titles").path("ja").asText(null);
            if (titleJapanese != null && !titleJapanese.isBlank()) {
                attributes.put("titleJapanese", titleJapanese);
            }

            candidates.add(new MetadataCandidate("MYANIMELIST", malId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** Extracts "1999" from "1999-09-21" (the start_date format of MyAnimeList, sometimes just "1999"). */
    private static String extractYear(String isoDate) {
        return isoDate != null && isoDate.length() >= 4 ? isoDate.substring(0, 4) : null;
    }
}
