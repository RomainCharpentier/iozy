package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.SourceUnavailableException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@RequiredArgsConstructor
@Slf4j
public class IgdbMetadataProvider implements MetadataProvider {

    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String COMPANY_AND_PLATFORM_FIELDS =
            "platforms.name,involved_companies.publisher,involved_companies.developer,involved_companies.company.name";
    private static final String SEARCH_BODY =
            "search \"%s\"; fields name,cover.url," + COMPANY_AND_PLATFORM_FIELDS + "; limit 10;";
    private static final String DETAILS_BODY =
            "where id = %s; fields " + COMPANY_AND_PLATFORM_FIELDS + "; limit 1;";

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

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

    /**
     * Every console and the real publisher of a game already in the catalog.
     * The works added before batch 203 only kept the first of each.
     */
    @Override
    public Map<String, Object> details(Map<String, Object> attributes) {
        Object igdbId = attributes.get("igdbId");
        if (igdbId == null || !igdbId.toString().trim().matches("\\d+")) {
            return Map.of();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GAMES_URL))
                    .timeout(Duration.ofSeconds(8))
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + tokenProvider.getAccessToken())
                    .POST(HttpRequest.BodyPublishers.ofString(DETAILS_BODY.formatted(igdbId.toString().trim())))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                throw new SourceUnavailableException("IGDB answered " + response.statusCode());
            }
            return parseDetails(response.body());
        } catch (SourceUnavailableException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SourceUnavailableException("IGDB call interrupted");
        } catch (Exception e) {
            throw new SourceUnavailableException("IGDB call failed: " + e.getMessage());
        }
    }

    Map<String, Object> parseDetails(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        if (!root.isArray() || root.isEmpty()) {
            return Map.of();
        }
        Map<String, Object> details = new HashMap<>();
        putPlatformsAndCompanies(root.get(0), details);
        details.remove("platform");
        details.remove("studio");
        return details;
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
            putPlatformsAndCompanies(item, attributes);

            candidates.add(new MetadataCandidate("IGDB", igdbId, title, imageUrl, attributes));
        }
        return candidates;
    }

    /**
     * The first entry of each IGDB list says nothing: Celeste came first on
     * Stadia, and Monolith Soft first on a Zelda. The console depends on the
     * copy, so all of them are kept for the owner to choose; the companies are
     * read by their role. {@code platforms} is joined like the designers of a
     * board game, an attribute is a value the detail page can show and edit.
     */
    private void putPlatformsAndCompanies(JsonNode item, Map<String, Object> attributes) {
        List<String> platforms = new ArrayList<>();
        for (JsonNode platform : item.path("platforms")) {
            String name = platform.path("name").asText("").trim();
            if (!name.isEmpty()) {
                platforms.add(name);
            }
        }
        if (!platforms.isEmpty()) {
            attributes.put("platform", platforms.get(0));
            attributes.put("platforms", String.join(", ", platforms));
        }
        JsonNode companies = item.path("involved_companies");
        String developer = companyWithRole(companies, "developer");
        String anyCompany = companies.isEmpty() ? null : companies.get(0).path("company").path("name").asText(null);
        String studio = developer != null ? developer : anyCompany;
        if (studio != null) {
            attributes.put("studio", studio);
        }
        String publisher = companyWithRole(companies, "publisher");
        if (publisher != null) {
            attributes.put("publisher", publisher);
        }
    }

    private static String companyWithRole(JsonNode companies, String role) {
        for (JsonNode company : companies) {
            if (company.path(role).asBoolean(false)) {
                String name = company.path("company").path("name").asText("").trim();
                if (!name.isEmpty()) {
                    return name;
                }
            }
        }
        return null;
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
