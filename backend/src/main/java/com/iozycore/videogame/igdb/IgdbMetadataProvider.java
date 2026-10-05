package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Queries the IGDB API (v4, JSON + Apicalypse query language), which
 * belongs to Twitch - authentication uses a Twitch OAuth2 access
 * token (see IgdbTokenProvider), not a static API key like
 * Jikan/BGG. Covers the VIDEO_GAME type only.
 * <p>
 * Accepted limit: averageDurationHours (one of the customFieldKeys of the
 * VIDEO_GAME type) is not available through the basic search fields
 * of IGDB - left out of the attributes, to be entered manually if needed
 * (same limit already accepted on the BGG side for fields not available in
 * search).
 */
@Component
public class IgdbMetadataProvider implements MetadataProvider {

    private static final Logger log = LoggerFactory.getLogger(IgdbMetadataProvider.class);
    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String SEARCH_BODY =
            "search \"%s\"; fields name,cover.url,platforms.name,involved_companies.company.name; limit 10;";

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IgdbMetadataProvider(IgdbTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public List<MetadataCandidate> search(String query) {
        try {
            String accessToken = tokenProvider.getAccessToken();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GAMES_URL))
                    .timeout(Duration.ofSeconds(8))
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofString(
                            SEARCH_BODY.formatted(query.replace("\"", "'"))))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("IGDB answered {} for the query '{}'", response.statusCode(), query);
                return List.of();
            }

            return parse(response.body());
        } catch (IgdbUnavailableException e) {
            log.warn("IGDB unavailable for the query '{}': {}", query, e.getMessage());
            return List.of();
        } catch (Exception e) {
            log.warn("Call to IGDB failed for '{}': {}", query, e.getMessage());
            return List.of();
        }
    }

    List<MetadataCandidate> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<MetadataCandidate> candidates = new ArrayList<>();

        for (JsonNode item : root) {
            String igdbId = item.path("id").asText();
            String title = item.path("name").asText();
            String imageUrl = normalizeCoverUrl(item.path("cover").path("url").asText(null));

            Map<String, Object> attributes = new HashMap<>();
            attributes.put("igdbId", igdbId);
            JsonNode platforms = item.path("platforms");
            if (platforms.isArray() && !platforms.isEmpty()) {
                attributes.put("platform", platforms.get(0).path("name").asText(null));
            }
            JsonNode involvedCompanies = item.path("involved_companies");
            if (involvedCompanies.isArray() && !involvedCompanies.isEmpty()) {
                attributes.put("studio", involvedCompanies.get(0).path("company").path("name").asText(null));
            }

            candidates.add(new MetadataCandidate("IGDB", igdbId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /** IGDB returns protocol-relative URLs in "thumb" size (//images.igdb.com/.../t_thumb/xxx.jpg) -
     * normalised to https and enlarged to "cover_big" for a better rendering on the client side. */
    private static String normalizeCoverUrl(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return null;
        }
        String withScheme = rawUrl.startsWith("//") ? "https:" + rawUrl : rawUrl;
        return withScheme.replace("t_thumb", "t_cover_big");
    }
}
