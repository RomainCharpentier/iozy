package com.iozycore.manga.metadata.myanimelist;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.manga.metadata.RelatedSeriesProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Queries the official MyAnimeList v2 API (see MyAnimeListMetadataProvider,
 * same Client ID) for the related series ({@code related_manga}) of a manga -
 * deliberately NOT Jikan (third-party wrapper, see javadoc of
 * MyAnimeListMetadataProvider): seen unavailable (504 "failed to
 * connect to MyAnimeList") at the time of writing this provider, while
 * the official API answered normally for the same id.
 * <p>
 * "spin_off", "side_story", "sequel", "prequel", "alternative_version" and
 * "alternative_setting" are kept as clearly DISTINCT series
 * (checked manually on "Blue Lock" -&gt; "Blue Lock: Episode Nagi" and
 * "Demon Slayer" -&gt; "Kimetsu Gakuen!", both tagged "spin_off";
 * "Dragon Ball" -&gt; "Dragon Ball Super", tagged "sequel" - a sequel with
 * its own story, not an edition; "Dragon Ball" -&gt; "Dragon Ball
 * SD", tagged "alternative_version" - a chibi parody with a
 * distinct story, MyAnimeList not reliably telling apart in this category
 * a real reissue (kanzenban, color...) from a reinterpretation with a
 * different story like this one; reported directly by
 * the user while testing "Dragon Ball", see history of the
 * conversation; "Shaman King" -&gt; "Shaman King Zero", tagged "prequel" -
 * a prequel with its own story, wrongly came out as an
 * edition named "0" before this relation was added, found while continuing
 * the tests, see history; "Gantz" -&gt; "Gantz:E", tagged
 * "alternative_setting" - a spin-off in an alternative universe (same
 * characters, different context), wrongly came out as an edition
 * named "E", found while continuing the tests, see history - FIRST concrete
 * case met for this relation despite extended tests on
 * many franchises this session, justifying adding it in its turn).
 * <p>
 * No degraded mode without a configured Client ID (like MyAnimeListMetadataProvider):
 * supports() returns false as long as {@code mal.client-id} is empty.
 */
@Component
public class MyAnimeListRelatedSeriesProvider implements RelatedSeriesProvider {

    private static final Logger log = LoggerFactory.getLogger(MyAnimeListRelatedSeriesProvider.class);
    private static final String RELATIONS_URL = "https://api.myanimelist.net/v2/manga/%s?fields=related_manga";
    private static final Set<String> DISTINCT_SERIES_RELATIONS =
            Set.of("spin_off", "side_story", "sequel", "prequel", "alternative_version", "alternative_setting");

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
    public List<String> findRelatedSeriesTitles(String externalId) {
        if (externalId == null || externalId.isBlank()) {
            return List.of();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(RELATIONS_URL.formatted(externalId)))
                    .timeout(Duration.ofSeconds(8))
                    .header("X-MAL-CLIENT-ID", clientId)
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("MyAnimeList answered {} for the relations of '{}'", response.statusCode(), externalId);
                return List.of();
            }

            return parse(response.body());
        } catch (Exception e) {
            // Best-effort: an outage must never block the search of
            // volumes, just deprive it of this additional filter.
            log.warn("MyAnimeList relations search failed for '{}': {}", externalId, e.getMessage());
            return List.of();
        }
    }

    List<String> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<String> titles = new ArrayList<>();
        for (JsonNode relation : root.path("related_manga")) {
            String relationType = relation.path("relation_type").asText("");
            if (!DISTINCT_SERIES_RELATIONS.contains(relationType)) {
                continue;
            }
            String title = relation.path("node").path("title").asText(null);
            if (title != null && !title.isBlank()) {
                titles.add(title);
            }
        }
        return titles;
    }
}
